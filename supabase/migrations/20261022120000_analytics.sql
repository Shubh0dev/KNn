-- Part 4: privacy-conscious first-party analytics, abuse controls, reporting, indexes.
--
-- Design
--   * site_events holds anonymous, aggregate-friendly events. No user id, IP,
--     user agent, query string, message text or document data is stored. The
--     session id is a random per-tab value (sessionStorage), not a cookie, so it
--     cannot follow a person across visits.
--   * Browsers can only write through public.track_event, which validates the
--     event name and every field, strips e-mails/phone-like numbers from search
--     terms, refuses private paths, de-duplicates and caps events per session.
--   * Nobody can read raw rows through the API; super admins get aggregates from
--     public.superadmin_analytics.
--   * Listing events keep using listing_engagement_events (Part 2).

create table public.site_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in ('page_view', 'search', 'category_click', 'trip_created', 'trip_saved', 'trip_shared', 'outbound_click')),
  path text check (char_length(path) <= 200),
  search_term text check (char_length(search_term) <= 60),
  category text check (char_length(category) <= 60),
  target_host text check (char_length(target_host) <= 120),
  referrer_host text check (char_length(referrer_host) <= 120),
  utm_source text check (char_length(utm_source) <= 60),
  session_id text not null check (char_length(session_id) <= 64),
  is_authenticated boolean not null default false,
  created_at timestamptz not null default now()
);

create index site_events_created_idx on public.site_events (created_at);
create index site_events_name_created_idx on public.site_events (event_name, created_at);
create index site_events_session_idx on public.site_events (session_id, created_at desc);

alter table public.site_events enable row level security;
revoke all on public.site_events from anon, authenticated;
-- No policies: no direct reads or writes through the Data API.

create function public.track_event(
  p_event text,
  p_path text default null,
  p_props jsonb default '{}'::jsonb,
  p_session text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session text := nullif(trim(p_session), '');
  v_props jsonb := case when jsonb_typeof(p_props) = 'object' then p_props else '{}'::jsonb end;
  v_path text;
  v_term text;
  v_category text;
  v_host text;
  v_ref text;
  v_utm text;
  v_host_re constant text := '^[a-z0-9]([a-z0-9.-]{0,118}[a-z0-9])?$';
begin
  if p_event is null or p_event not in ('page_view', 'search', 'category_click', 'trip_created', 'trip_saved', 'trip_shared', 'outbound_click') then
    return false;
  end if;
  if v_session is null or v_session !~ '^[A-Za-z0-9-]{8,64}$' then
    return false;
  end if;

  -- Same-site path only, without query string or fragment; never private areas.
  if p_path is not null then
    v_path := lower(split_part(split_part(p_path, '?', 1), '#', 1));
    if v_path !~ '^/[a-z0-9/_.-]{0,199}$' then return false; end if;
    if v_path ~ '^/(admin|superadmin|business|account|auth|api)(/|$)' then return false; end if;
  end if;
  if p_event = 'page_view' and v_path is null then return false; end if;

  if p_event = 'search' then
    v_term := lower(coalesce(v_props ->> 'term', ''));
    v_term := regexp_replace(v_term, '[^[:space:]@]+@[^[:space:]@]+', ' ', 'g');   -- e-mail addresses
    v_term := regexp_replace(v_term, '[0-9][0-9 +()-]{4,}', ' ', 'g');            -- phone-like numbers
    v_term := left(trim(regexp_replace(v_term, '[[:space:]]+', ' ', 'g')), 60);
    if char_length(v_term) < 2 then return false; end if;
  elsif p_event = 'category_click' then
    v_category := lower(coalesce(v_props ->> 'category', ''));
    if v_category !~ '^[a-z0-9-]{1,60}$' then return false; end if;
  elsif p_event = 'outbound_click' then
    v_host := lower(coalesce(v_props ->> 'host', ''));
    if v_host !~ v_host_re then return false; end if;
  elsif p_event = 'page_view' then
    v_ref := lower(nullif(v_props ->> 'referrer_host', ''));
    if v_ref is not null and v_ref !~ v_host_re then v_ref := null; end if;
    v_utm := lower(nullif(v_props ->> 'utm_source', ''));
    if v_utm is not null and v_utm !~ '^[a-z0-9._-]{1,60}$' then v_utm := null; end if;
  end if;

  -- Abuse control: at most 300 events per browser session per hour.
  if (select count(*) from public.site_events e
      where e.session_id = v_session and e.created_at > now() - interval '1 hour') >= 300 then
    return false;
  end if;

  -- De-duplication of repeated identical events.
  if exists (
    select 1 from public.site_events e
    where e.session_id = v_session
      and e.event_name = p_event
      and e.created_at > now() - case p_event when 'page_view' then interval '30 minutes'
                                              when 'search' then interval '10 minutes'
                                              else interval '1 minute' end
      and e.path is not distinct from v_path
      and e.search_term is not distinct from v_term
      and e.category is not distinct from v_category
      and e.target_host is not distinct from v_host
  ) then
    return false;
  end if;

  insert into public.site_events (event_name, path, search_term, category, target_host, referrer_host, utm_source, session_id, is_authenticated)
  values (p_event, v_path, v_term, v_category, v_host, v_ref, v_utm, v_session, (select auth.uid()) is not null);
  return true;
end;
$$;

revoke all on function public.track_event(text, text, jsonb, text) from public;
grant execute on function public.track_event(text, text, jsonb, text) to anon, authenticated;

-- Listing events: now require a session id and cap events per session.
create or replace function public.track_listing_event(
  p_listing_id uuid,
  p_event_type public.engagement_event_type,
  p_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session text := left(nullif(trim(p_session_id), ''), 64);
begin
  if v_session is null or v_session !~ '^[A-Za-z0-9-]{8,64}$' then
    return;
  end if;
  if not private.listing_is_public(p_listing_id) then
    return;
  end if;
  if (select count(*) from public.listing_engagement_events e
      where e.session_id = v_session and e.created_at > now() - interval '1 hour') >= 200 then
    return;
  end if;
  if exists (
    select 1 from public.listing_engagement_events e
    where e.listing_id = p_listing_id
      and e.session_id = v_session
      and e.event_type = p_event_type
      and e.created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.listing_engagement_events (listing_id, event_type, user_id, session_id)
  values (p_listing_id, p_event_type, (select auth.uid()), v_session);
end;
$$;

-- Enquiries: per-sender limits against spam (the public enquiry form is new in Part 4).
create function private.enquiries_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.enquiries e
      where e.sender_id = (select auth.uid()) and e.created_at > now() - interval '1 day') >= 10 then
    raise exception 'You have reached the limit of 10 enquiries per day. Please try again tomorrow.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.enquiries e
      where e.sender_id = (select auth.uid()) and e.listing_id = new.listing_id and e.created_at > now() - interval '1 day') >= 3 then
    raise exception 'You have already sent several enquiries about this listing today.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger enquiries_rate_limit
  before insert on public.enquiries
  for each row execute function private.enquiries_rate_limit();

revoke all on function private.enquiries_rate_limit() from public;

-- ---------------------------------------------------------------------------
-- Super admin analytics (aggregates only)
-- ---------------------------------------------------------------------------
create function public.superadmin_analytics(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_to timestamptz;
begin
  if not private.has_role('super_admin') then
    raise exception 'Super admin required' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'Choose a date range of up to one year' using errcode = 'P0001';
  end if;
  v_from := p_from::timestamp at time zone 'UTC';
  v_to := (p_to + 1)::timestamp at time zone 'UTC';

  return jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'totals', jsonb_build_object(
      'page_views', (select count(*) from public.site_events where event_name = 'page_view' and created_at >= v_from and created_at < v_to),
      'sessions', (select count(distinct session_id) from public.site_events where created_at >= v_from and created_at < v_to),
      'signed_in_page_views', (select count(*) from public.site_events where event_name = 'page_view' and is_authenticated and created_at >= v_from and created_at < v_to),
      'searches', (select count(*) from public.site_events where event_name = 'search' and created_at >= v_from and created_at < v_to),
      'listing_views', (select count(*) from public.listing_engagement_events where event_type = 'view' and created_at >= v_from and created_at < v_to),
      'contact_clicks', (select count(*) from public.listing_engagement_events where event_type in ('contact_click', 'website_click', 'direction_click') and created_at >= v_from and created_at < v_to),
      'enquiries', (select count(*) from public.enquiries where created_at >= v_from and created_at < v_to),
      'new_accounts', (select count(*) from public.profiles where created_at >= v_from and created_at < v_to),
      'new_businesses', (select count(*) from public.businesses where created_at >= v_from and created_at < v_to),
      'submissions', (select count(*) from public.listing_moderation_events where to_status = 'pending_review' and created_at >= v_from and created_at < v_to),
      'accounts_total', (select count(*) from public.profiles)
    ),
    'daily', (select coalesce(jsonb_agg(d order by d ->> 'day'), '[]'::jsonb) from (
      select jsonb_build_object(
        'day', g::date,
        'page_views', (select count(*) from public.site_events e where e.event_name = 'page_view' and e.created_at >= g and e.created_at < g + interval '1 day'),
        'sessions', (select count(distinct e.session_id) from public.site_events e where e.created_at >= g and e.created_at < g + interval '1 day'),
        'listing_views', (select count(*) from public.listing_engagement_events e where e.event_type = 'view' and e.created_at >= g and e.created_at < g + interval '1 day'),
        'enquiries', (select count(*) from public.enquiries e where e.created_at >= g and e.created_at < g + interval '1 day'),
        'new_businesses', (select count(*) from public.businesses b where b.created_at >= g and b.created_at < g + interval '1 day'),
        'submissions', (select count(*) from public.listing_moderation_events m where m.to_status = 'pending_review' and m.created_at >= g and m.created_at < g + interval '1 day')
      ) d
      from generate_series(v_from, v_to - interval '1 day', interval '1 day') g) x),
    'top_pages', (select coalesce(jsonb_agg(t order by (t ->> 'views')::int desc), '[]'::jsonb) from (
      select jsonb_build_object('path', path, 'views', count(*), 'sessions', count(distinct session_id)) t
      from public.site_events where event_name = 'page_view' and created_at >= v_from and created_at < v_to
      group by path order by count(*) desc limit 15) x),
    'top_listings', (select coalesce(jsonb_agg(t order by (t ->> 'views')::int desc), '[]'::jsonb) from (
      select jsonb_build_object(
        'id', l.id, 'title', l.title, 'slug', l.slug, 'status', l.status,
        'views', count(*) filter (where e.event_type = 'view'),
        'contact_clicks', count(*) filter (where e.event_type in ('contact_click', 'website_click', 'direction_click')),
        'enquiries', (select count(*) from public.enquiries q where q.listing_id = l.id and q.created_at >= v_from and q.created_at < v_to)
      ) t
      from public.listing_engagement_events e join public.listings l on l.id = e.listing_id
      where e.created_at >= v_from and e.created_at < v_to
      group by l.id order by count(*) filter (where e.event_type = 'view') desc limit 15) x),
    -- Only terms searched at least twice, so one person's unique query is never shown.
    'searches', (select coalesce(jsonb_agg(t order by (t ->> 'count')::int desc), '[]'::jsonb) from (
      select jsonb_build_object('term', search_term, 'count', count(*)) t
      from public.site_events where event_name = 'search' and created_at >= v_from and created_at < v_to
      group by search_term having count(*) >= 2 order by count(*) desc limit 20) x),
    'sources', (select coalesce(jsonb_agg(t order by (t ->> 'sessions')::int desc), '[]'::jsonb) from (
      select jsonb_build_object('source', source, 'sessions', count(*)) t from (
        select coalesce(max(utm_source), max(referrer_host), 'direct / unknown') as source
        from public.site_events where event_name = 'page_view' and created_at >= v_from and created_at < v_to
        group by session_id) s
      group by source order by count(*) desc limit 12) x),
    'categories', (select coalesce(jsonb_object_agg(category, n), '{}'::jsonb) from (
      select category, count(*) n from public.site_events where event_name = 'category_click' and created_at >= v_from and created_at < v_to group by category) x),
    'trips', (select coalesce(jsonb_object_agg(event_name, n), '{}'::jsonb) from (
      select event_name, count(*) n from public.site_events where event_name in ('trip_created', 'trip_saved', 'trip_shared') and created_at >= v_from and created_at < v_to group by event_name) x),
    'outbound', (select coalesce(jsonb_agg(t order by (t ->> 'clicks')::int desc), '[]'::jsonb) from (
      select jsonb_build_object('host', target_host, 'clicks', count(*)) t
      from public.site_events where event_name = 'outbound_click' and created_at >= v_from and created_at < v_to
      group by target_host order by count(*) desc limit 15) x),
    'listings_now', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status::text, count(*) n from public.listings group by 1) x)
  );
end;
$$;

revoke all on function public.superadmin_analytics(date, date) from public, anon, authenticated;
grant execute on function public.superadmin_analytics(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Indexes: foreign keys flagged by the advisor and date columns used in reports
-- ---------------------------------------------------------------------------
create index if not exists admin_permissions_granted_by_idx on public.admin_permissions (granted_by);
create index if not exists user_roles_granted_by_idx on public.user_roles (granted_by);
create index if not exists business_verification_documents_reviewed_by_idx on public.business_verification_documents (reviewed_by);
create index if not exists business_verification_documents_uploaded_by_idx on public.business_verification_documents (uploaded_by);
create index if not exists business_verification_events_actor_idx on public.business_verification_events (actor_id);
create index if not exists listing_moderation_events_actor_idx on public.listing_moderation_events (actor_id);
create index if not exists listing_moderation_events_created_idx on public.listing_moderation_events (created_at);
create index if not exists listing_engagement_events_created_idx on public.listing_engagement_events (created_at);
create index if not exists enquiries_created_idx on public.enquiries (created_at);
create index if not exists profiles_created_idx on public.profiles (created_at);
create index if not exists businesses_created_idx on public.businesses (created_at);
