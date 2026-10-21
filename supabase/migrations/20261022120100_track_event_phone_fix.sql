-- Fix: a leading "+" of an international phone number survived search-term
-- scrubbing. Same function as 20261022120000 with the corrected pattern.
create or replace function public.track_event(
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

  if p_path is not null then
    v_path := lower(split_part(split_part(p_path, '?', 1), '#', 1));
    if v_path !~ '^/[a-z0-9/_.-]{0,199}$' then return false; end if;
    if v_path ~ '^/(admin|superadmin|business|account|auth|api)(/|$)' then return false; end if;
  end if;
  if p_event = 'page_view' and v_path is null then return false; end if;

  if p_event = 'search' then
    v_term := lower(coalesce(v_props ->> 'term', ''));
    v_term := regexp_replace(v_term, '[^[:space:]@]+@[^[:space:]@]+', ' ', 'g');
    v_term := regexp_replace(v_term, '\+?[0-9][0-9 +()-]{4,}', ' ', 'g');
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

  if (select count(*) from public.site_events e
      where e.session_id = v_session and e.created_at > now() - interval '1 hour') >= 300 then
    return false;
  end if;

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
