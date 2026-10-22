-- Enquiry-based booking (Part 5).
--
-- Additive only: new columns, tables, functions and grants. No existing row is
-- rewritten (the enquiry reference is a generated column derived from the id).
--
--   listings.enquiry_mode / whatsapp_enabled   how a listing takes requests
--   enquiries: booking fields, reference, duplicate token, business response
--   enquiry_events                             status / message history
--   notifications                              in-app notifications
--   status changes only through business_update_enquiry / cancel_my_enquiry
--   staff read enquiries through masked functions; revealing contact is audited

-- ---------------------------------------------------------------------------
-- 1. Listings: how each listing takes requests
-- ---------------------------------------------------------------------------
alter table public.listings
  add column enquiry_mode text not null default 'booking'
    constraint listings_enquiry_mode_check check (enquiry_mode in ('booking', 'message', 'contact_only')),
  add column whatsapp_enabled boolean not null default false;

comment on column public.listings.enquiry_mode is
  'booking: request form for the category (stay/table/experience); message: questions only; contact_only: phone/email only.';
comment on column public.listings.whatsapp_enabled is 'The listing contact_phone accepts WhatsApp messages.';

grant insert (enquiry_mode, whatsapp_enabled), update (enquiry_mode, whatsapp_enabled) on public.listings to authenticated;
grant select (enquiry_mode, whatsapp_enabled) on public.listings to anon;

-- Turning WhatsApp on publishes a new contact channel, so it needs review like other contact edits.
create or replace function private.listings_require_review_on_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'published'
     and new.status = 'published'
     and old.business_id is not null
     and (select auth.uid()) is not null
     and not private.has_permission('listings.moderate')
     and (old.title, old.slug, old.summary, old.description, old.category_id, old.subtype,
          old.area, old.address, old.latitude, old.longitude,
          old.contact_phone, old.contact_email, old.website, old.amenities, old.whatsapp_enabled)
         is distinct from
         (new.title, new.slug, new.summary, new.description, new.category_id, new.subtype,
          new.area, new.address, new.latitude, new.longitude,
          new.contact_phone, new.contact_email, new.website, new.amenities, new.whatsapp_enabled)
  then
    new.status := 'pending_review';
    new.submitted_at := now();
    insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id, note)
    values (new.id, 'published', 'pending_review', (select auth.uid()), 'Edited by business; re-review required');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Enquiries: booking details, reference, duplicate protection, response
-- ---------------------------------------------------------------------------
alter table public.enquiries
  add column reference text generated always as ('KN-' || upper(substr(replace(id::text, '-', ''), 1, 10))) stored,
  add column enquiry_type text not null default 'general'
    constraint enquiries_type_check check (enquiry_type in ('general', 'stay', 'table', 'experience')),
  add column check_in date,
  add column check_out date,
  add column requested_date date,
  add column requested_time time,
  add column guests integer constraint enquiries_guests_check check (guests between 1 and 50),
  add column rooms integer constraint enquiries_rooms_check check (rooms between 1 and 20),
  add column experience text constraint enquiries_experience_check check (char_length(experience) <= 200),
  add column contact_whatsapp boolean not null default false,
  add column client_token uuid,
  add column business_response text constraint enquiries_response_check check (char_length(business_response) <= 2000),
  add column responded_at timestamptz,
  add column status_changed_at timestamptz;

create unique index enquiries_reference_key on public.enquiries (reference);
create unique index enquiries_client_token_key on public.enquiries (sender_id, client_token) where client_token is not null;
create index if not exists enquiries_sender_created_idx on public.enquiries (sender_id, created_at desc);
create index if not exists enquiries_business_status_idx on public.enquiries (business_id, status);

grant insert (enquiry_type, check_in, check_out, requested_date, requested_time, guests, rooms, experience, contact_whatsapp, client_token)
  on public.enquiries to authenticated;
-- Status changes now go only through the workflow functions below.
revoke update (status) on public.enquiries from authenticated;

/** Booking request type a listing offers, from its category and enquiry mode. */
create function private.enquiry_kind(_category text, _mode text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when _mode = 'contact_only' then 'none'
    when _mode = 'message' then 'general'
    when _category = 'stays' then 'stay'
    when _category = 'food' then 'table'
    when _category in ('guides', 'events', 'travel', 'spiritual-services') then 'experience'
    else 'general'
  end;
$$;

/** Allowed next statuses. Mirrors src/lib/enquiries/rules.ts (unit-tested). */
create function private.enquiry_next_statuses(_from text, _actor text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when _actor = 'visitor' then
      case when _from in ('new', 'read', 'replied', 'contacted', 'accepted', 'alternative_proposed') then array['cancelled'] else array[]::text[] end
    when _from = 'new' then array['read', 'contacted', 'accepted', 'declined', 'alternative_proposed', 'spam']
    when _from in ('read', 'replied') then array['contacted', 'accepted', 'declined', 'alternative_proposed', 'closed', 'spam']
    when _from = 'contacted' then array['accepted', 'declined', 'alternative_proposed', 'closed']
    when _from = 'alternative_proposed' then array['contacted', 'accepted', 'declined', 'closed']
    when _from = 'accepted' then array['confirmed', 'cancelled']
    when _from = 'confirmed' then array['completed', 'cancelled']
    else array[]::text[]
  end;
$$;

-- Server-side validation of every new enquiry (runs after enquiries_set_business: triggers fire by name).
create function private.enquiries_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now_local timestamp := now() at time zone 'Asia/Kolkata';
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_mode text;
  v_category text;
  v_kind text;
  v_digits int;
  v_dup text;
begin
  select l.enquiry_mode, c.slug into v_mode, v_category
  from public.listings l join public.listing_categories c on c.id = l.category_id
  where l.id = new.listing_id;

  if new.business_id is null then
    raise exception 'This place is curated by KashiNagri and does not take enquiries. Please use the contact details on the page.' using errcode = 'P0001';
  end if;
  v_kind := private.enquiry_kind(v_category, v_mode);
  if v_kind = 'none' then
    raise exception 'This business takes requests by phone or email only. Please use the contact details on the listing.' using errcode = 'P0001';
  end if;
  if new.enquiry_type <> 'general' and new.enquiry_type <> v_kind then
    raise exception 'This listing does not take that kind of request.' using errcode = 'P0001';
  end if;

  -- Contact details
  new.sender_name := btrim(new.sender_name);
  new.sender_email := lower(btrim(new.sender_email));
  new.sender_phone := nullif(btrim(coalesce(new.sender_phone, '')), '');
  new.message := btrim(coalesce(new.message, ''));
  if char_length(new.sender_name) not between 2 and 120 then
    raise exception 'Enter your full name.' using errcode = 'P0001';
  end if;
  if new.sender_phone is null or new.sender_phone !~ '^\+?[0-9][0-9 ()-]{6,19}$' then
    raise exception 'Enter a valid contact number, e.g. +91 98765 43210.' using errcode = 'P0001';
  end if;
  v_digits := char_length(regexp_replace(new.sender_phone, '[^0-9]', '', 'g'));
  if v_digits not between 7 and 15 then
    raise exception 'Enter a valid contact number, e.g. +91 98765 43210.' using errcode = 'P0001';
  end if;
  if char_length(new.sender_email) > 254 or new.sender_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address.' using errcode = 'P0001';
  end if;
  if char_length(new.message) > 2000 then
    raise exception 'Keep the message under 2000 characters.' using errcode = 'P0001';
  end if;
  new.experience := nullif(btrim(coalesce(new.experience, '')), '');

  -- Request details by type
  if new.enquiry_type = 'stay' then
    if new.check_in is null or new.check_out is null then
      raise exception 'Choose check-in and check-out dates.' using errcode = 'P0001';
    end if;
    if new.check_in < v_today then
      raise exception 'Check-in cannot be in the past.' using errcode = 'P0001';
    end if;
    if new.check_in > v_today + 365 then
      raise exception 'Check-in must be within the next 12 months.' using errcode = 'P0001';
    end if;
    if new.check_out <= new.check_in then
      raise exception 'Check-out must be after check-in.' using errcode = 'P0001';
    end if;
    if new.check_out - new.check_in > 60 then
      raise exception 'Requests can cover at most 60 nights.' using errcode = 'P0001';
    end if;
    if new.guests is null or new.rooms is null then
      raise exception 'Enter the number of guests and rooms.' using errcode = 'P0001';
    end if;
    if new.rooms > new.guests then
      raise exception 'The number of rooms cannot be more than the number of guests.' using errcode = 'P0001';
    end if;
    new.requested_date := null; new.requested_time := null; new.experience := null;
  elsif new.enquiry_type = 'table' then
    if new.requested_date is null or new.requested_time is null then
      raise exception 'Choose a date and time for the reservation.' using errcode = 'P0001';
    end if;
    if new.requested_date < v_today or (new.requested_date + new.requested_time) < v_now_local then
      raise exception 'The reservation time cannot be in the past.' using errcode = 'P0001';
    end if;
    if new.requested_date > v_today + 180 then
      raise exception 'Reservations can be requested up to 6 months ahead.' using errcode = 'P0001';
    end if;
    if new.guests is null then
      raise exception 'Enter the party size.' using errcode = 'P0001';
    end if;
    new.check_in := null; new.check_out := null; new.rooms := null; new.experience := null;
  elsif new.enquiry_type = 'experience' then
    if new.requested_date is null then
      raise exception 'Choose your preferred date.' using errcode = 'P0001';
    end if;
    if new.requested_date < v_today or new.requested_date > v_today + 365 then
      raise exception 'Choose a date within the next 12 months.' using errcode = 'P0001';
    end if;
    if new.guests is null then
      raise exception 'Enter the number of participants.' using errcode = 'P0001';
    end if;
    new.check_in := null; new.check_out := null; new.rooms := null; new.requested_time := null;
  else
    if char_length(new.message) < 10 then
      raise exception 'Write a message of 10 to 2000 characters.' using errcode = 'P0001';
    end if;
    new.check_in := null; new.check_out := null; new.requested_date := null; new.requested_time := null;
    new.guests := null; new.rooms := null; new.experience := null;
  end if;

  -- Workflow fields are never taken from the request.
  new.status := 'new';
  new.business_response := null;
  new.responded_at := null;
  new.status_changed_at := now();

  -- The same open request twice within a day is a duplicate.
  select e.reference into v_dup
  from public.enquiries e
  where e.sender_id = new.sender_id
    and e.listing_id = new.listing_id
    and e.enquiry_type = new.enquiry_type
    and e.check_in is not distinct from new.check_in
    and e.check_out is not distinct from new.check_out
    and e.requested_date is not distinct from new.requested_date
    and e.requested_time is not distinct from new.requested_time
    and (new.enquiry_type <> 'general' or e.message = new.message)
    and e.status in ('new', 'read', 'replied', 'contacted', 'accepted', 'alternative_proposed', 'confirmed')
    and e.created_at > now() - interval '24 hours'
    and (new.client_token is null or e.client_token is distinct from new.client_token)
  limit 1;
  if v_dup is not null then
    raise exception 'You already sent this request (reference %). The business will reply to it there.', v_dup using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger enquiries_validate
  before insert on public.enquiries
  for each row execute function private.enquiries_validate();

-- ---------------------------------------------------------------------------
-- 3. History and in-app notifications
-- ---------------------------------------------------------------------------
create table public.enquiry_events (
  id bigint generated always as identity primary key,
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor text not null constraint enquiry_events_actor_check check (actor in ('visitor', 'business', 'staff')),
  from_status public.enquiry_status,
  to_status public.enquiry_status not null,
  message text constraint enquiry_events_message_check check (char_length(message) <= 2000),
  created_at timestamptz not null default now()
);
create index enquiry_events_enquiry_idx on public.enquiry_events (enquiry_id, created_at);
create index enquiry_events_actor_idx on public.enquiry_events (actor_id);

alter table public.enquiry_events enable row level security;
revoke all on public.enquiry_events from anon, authenticated;
grant select on public.enquiry_events to authenticated;
create policy "Enquiry events: visitor and business read" on public.enquiry_events
  for select to authenticated
  using (exists (
    select 1 from public.enquiries e
    where e.id = enquiry_id
      and (e.sender_id = (select auth.uid()) or private.is_business_member(e.business_id))
  ));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null constraint notifications_kind_check check (kind in ('enquiry_new', 'enquiry_update', 'enquiry_cancelled')),
  title text not null constraint notifications_title_check check (char_length(title) <= 200),
  body text constraint notifications_body_check check (char_length(body) <= 500),
  link text constraint notifications_link_check check (link ~ '^/[a-z0-9/_-]*/$'),
  enquiry_id uuid references public.enquiries (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_enquiry_idx on public.notifications (enquiry_id);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, update (read_at) on public.notifications to authenticated;
create policy "Notifications: owner reads" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Notifications: owner marks read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

/** Notifies every member of a business. Bodies never contain visitor contact details. */
create function private.notify_business(_business_id uuid, _kind text, _title text, _body text, _enquiry_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link, enquiry_id)
  select m.user_id, _kind, left(_title, 200), left(_body, 500), '/business/enquiries/' || _enquiry_id || '/', _enquiry_id
  from public.business_members m where m.business_id = _business_id;
$$;

create function private.enquiries_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_label text := case new.enquiry_type when 'stay' then 'New stay request' when 'table' then 'New table request'
                    when 'experience' then 'New booking request' else 'New enquiry' end;
begin
  select l.title into v_title from public.listings l where l.id = new.listing_id;
  insert into public.enquiry_events (enquiry_id, actor_id, actor, from_status, to_status)
  values (new.id, new.sender_id, 'visitor', null, 'new');
  perform private.notify_business(new.business_id, 'enquiry_new', v_label || ': ' || coalesce(v_title, 'your listing'),
    'Reference ' || new.reference, new.id);
  return null;
end;
$$;

create trigger enquiries_after_insert
  after insert on public.enquiries
  for each row execute function private.enquiries_after_insert();

-- ---------------------------------------------------------------------------
-- 4. Workflow functions
-- ---------------------------------------------------------------------------
create function public.business_update_enquiry(p_enquiry_id uuid, p_status public.enquiry_status, p_message text default null)
returns public.enquiry_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.enquiries;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
  v_title text;
begin
  select * into e from public.enquiries where id = p_enquiry_id for update;
  if not found or not private.is_business_member(e.business_id) then
    raise exception 'Enquiry not found.' using errcode = '42501';
  end if;
  if v_msg is not null and char_length(v_msg) > 2000 then
    raise exception 'Keep the message under 2000 characters.' using errcode = 'P0001';
  end if;

  if p_status = e.status then
    if v_msg is null then
      raise exception 'Nothing to update. Choose a new status or write a message.' using errcode = 'P0001';
    end if;
    if cardinality(private.enquiry_next_statuses(e.status::text, 'business')) = 0 then
      raise exception 'This enquiry is finished and can no longer be updated.' using errcode = 'P0001';
    end if;
  elsif not (p_status::text = any (private.enquiry_next_statuses(e.status::text, 'business'))) then
    raise exception 'This enquiry cannot move from "%" to "%".', replace(e.status::text, '_', ' '), replace(p_status::text, '_', ' ') using errcode = 'P0001';
  end if;
  if p_status in ('declined', 'alternative_proposed') and (v_msg is null or char_length(v_msg) < 5) then
    raise exception 'Add a short message for the traveller explaining the decision or the alternative.' using errcode = 'P0001';
  end if;

  update public.enquiries
  set status = p_status,
      business_response = coalesce(v_msg, business_response),
      responded_at = case when responded_at is null and p_status not in ('read', 'spam') then now() else responded_at end,
      status_changed_at = case when p_status <> e.status then now() else status_changed_at end
  where id = e.id;

  insert into public.enquiry_events (enquiry_id, actor_id, actor, from_status, to_status, message)
  values (e.id, (select auth.uid()), 'business', e.status, p_status, v_msg);

  if e.sender_id is not null and p_status not in ('read', 'spam') then
    select l.title into v_title from public.listings l where l.id = e.listing_id;
    insert into public.notifications (user_id, kind, title, body, link, enquiry_id)
    values (e.sender_id, 'enquiry_update',
      left(coalesce(v_title, 'Your enquiry') || ': ' || case p_status
        when 'contacted' then 'the business has responded'
        when 'accepted' then 'request accepted'
        when 'declined' then 'request declined'
        when 'alternative_proposed' then 'an alternative was proposed'
        when 'confirmed' then 'reservation confirmed'
        when 'completed' then 'marked as completed'
        when 'cancelled' then 'cancelled by the business'
        when 'closed' then 'enquiry closed'
        else 'new message from the business' end, 200),
      'Reference ' || e.reference, '/account/enquiries/' || e.id || '/', e.id);
  end if;
  return p_status;
end;
$$;

create function public.cancel_my_enquiry(p_enquiry_id uuid, p_reason text default null)
returns public.enquiry_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.enquiries;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_title text;
begin
  select * into e from public.enquiries where id = p_enquiry_id for update;
  if not found or e.sender_id is distinct from (select auth.uid()) or not private.is_active_user() then
    raise exception 'Enquiry not found.' using errcode = '42501';
  end if;
  if not ('cancelled' = any (private.enquiry_next_statuses(e.status::text, 'visitor'))) then
    raise exception 'This request can no longer be cancelled here. Please contact the business directly.' using errcode = 'P0001';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.' using errcode = 'P0001';
  end if;

  update public.enquiries set status = 'cancelled', status_changed_at = now() where id = e.id;
  insert into public.enquiry_events (enquiry_id, actor_id, actor, from_status, to_status, message)
  values (e.id, (select auth.uid()), 'visitor', e.status, 'cancelled', v_reason);
  select l.title into v_title from public.listings l where l.id = e.listing_id;
  perform private.notify_business(e.business_id, 'enquiry_cancelled',
    'Request cancelled by the traveller: ' || coalesce(v_title, 'your listing'), 'Reference ' || e.reference, e.id);
  return 'cancelled';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Staff access: masked by default, contact reveal is audited
-- ---------------------------------------------------------------------------
-- Staff no longer read raw enquiry rows (and so raw visitor contact details) directly.
alter policy "Enquiries: sender, business and authorised staff read" on public.enquiries
  using ((sender_id = (select auth.uid())) or private.is_business_member(business_id));

create function private.mask_phone(_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when _phone is null then null
    else '••••••' || right(regexp_replace(_phone, '[^0-9]', '', 'g'), 3) end;
$$;

create function private.mask_email(_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when _email is null or position('@' in _email) = 0 then null
    else left(_email, 1) || '•••@' || split_part(_email, '@', 2) end;
$$;

create function private.mask_name(_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when _name is null then null
    when position(' ' in btrim(_name)) = 0 then btrim(_name)
    else split_part(btrim(_name), ' ', 1) || ' ' || left(regexp_replace(btrim(_name), '^.* ', ''), 1) || '.' end;
$$;

create function private.require_enquiry_staff()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('enquiries.view') or not private.is_active_user() then
    raise exception 'Your account does not have the "View enquiries" permission.' using errcode = '42501';
  end if;
end;
$$;

create function public.admin_list_enquiries(
  p_status text default null, p_reference text default null, p_limit integer default 50, p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ref text := upper(nullif(btrim(coalesce(p_reference, '')), ''));
  v_result jsonb;
begin
  perform private.require_enquiry_staff();
  with filtered as (
    select e.*, l.title as listing_title, l.slug as listing_slug, b.name as business_name
    from public.enquiries e
    left join public.listings l on l.id = e.listing_id
    left join public.businesses b on b.id = e.business_id
    where (p_status is null or p_status = '' or e.status::text = p_status)
      and (v_ref is null or e.reference like '%' || replace(replace(v_ref, '%', ''), '_', '') || '%'
           or b.name ilike '%' || replace(replace(v_ref, '%', ''), '_', '') || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((select jsonb_agg(r order by r.created_at desc) from (
      select f.id, f.reference, f.status, f.enquiry_type, f.created_at, f.responded_at,
             f.check_in, f.check_out, f.requested_date, f.guests,
             f.listing_title, f.listing_slug, f.business_name,
             private.mask_name(f.sender_name) as sender
      from filtered f order by f.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
    ) r), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create function public.admin_get_enquiry(p_enquiry_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_enquiry_staff();
  select jsonb_build_object(
    'id', e.id, 'reference', e.reference, 'status', e.status, 'enquiry_type', e.enquiry_type,
    'created_at', e.created_at, 'updated_at', e.updated_at, 'responded_at', e.responded_at,
    'check_in', e.check_in, 'check_out', e.check_out, 'requested_date', e.requested_date,
    'requested_time', e.requested_time, 'guests', e.guests, 'rooms', e.rooms, 'experience', e.experience,
    'message', e.message, 'business_response', e.business_response,
    'sender', private.mask_name(e.sender_name), 'phone_masked', private.mask_phone(e.sender_phone),
    'email_masked', private.mask_email(e.sender_email),
    'listing_title', l.title, 'listing_slug', l.slug, 'listing_status', l.status,
    'business_id', b.id, 'business_name', b.name,
    'events', coalesce((select jsonb_agg(jsonb_build_object('actor', ev.actor, 'from_status', ev.from_status,
        'to_status', ev.to_status, 'message', ev.message, 'created_at', ev.created_at) order by ev.created_at)
      from public.enquiry_events ev where ev.enquiry_id = e.id), '[]'::jsonb)
  ) into v_result
  from public.enquiries e
  left join public.listings l on l.id = e.listing_id
  left join public.businesses b on b.id = e.business_id
  where e.id = p_enquiry_id;
  if v_result is null then
    raise exception 'Enquiry not found.' using errcode = 'P0001';
  end if;
  return v_result;
end;
$$;

create function public.admin_reveal_enquiry_contact(p_enquiry_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_result jsonb;
begin
  perform private.require_enquiry_staff();
  if char_length(v_reason) < 10 or char_length(v_reason) > 500 then
    raise exception 'Give a reason of at least 10 characters. It is recorded in the audit log.' using errcode = 'P0001';
  end if;
  select jsonb_build_object('name', e.sender_name, 'phone', e.sender_phone, 'email', e.sender_email)
  into v_result from public.enquiries e where e.id = p_enquiry_id;
  if v_result is null then
    raise exception 'Enquiry not found.' using errcode = 'P0001';
  end if;
  perform private.write_audit('enquiry.contact_revealed', 'enquiry', p_enquiry_id::text, jsonb_build_object('reason', v_reason));
  return v_result;
end;
$$;

create function public.admin_enquiry_overview(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  perform private.require_enquiry_staff();
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'Choose a date range of up to one year.' using errcode = 'P0001';
  end if;
  v_from := (p_from::timestamp at time zone 'Asia/Kolkata');
  v_to := ((p_to + 1)::timestamp at time zone 'Asia/Kolkata');
  with e as (
    select en.*, c.slug as category
    from public.enquiries en
    left join public.listings l on l.id = en.listing_id
    left join public.listing_categories c on c.id = l.category_id
    where en.created_at >= v_from and en.created_at < v_to
  )
  select jsonb_build_object(
    'total', (select count(*) from e),
    'responded', (select count(*) from e where responded_at is not null),
    'median_response_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from responded_at - created_at)) / 3600)::numeric, 1)
                              from e where responded_at is not null),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status::text, count(*) n from e group by 1) s), '{}'::jsonb),
    'by_type', coalesce((select jsonb_object_agg(enquiry_type, n) from (select enquiry_type, count(*) n from e group by 1) s), '{}'::jsonb),
    'by_category', coalesce((select jsonb_object_agg(coalesce(category, 'unknown'), n) from (select category, count(*) n from e group by 1) s), '{}'::jsonb),
    'top_businesses', coalesce((select jsonb_agg(t) from (
        select b.name, count(*) as enquiries, count(*) filter (where e.responded_at is not null) as responded
        from e join public.businesses b on b.id = e.business_id
        group by b.name order by count(*) desc, b.name limit 10) t), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(d order by d.day) from (
        select (created_at at time zone 'Asia/Kolkata')::date as day, count(*) as n from e group by 1) d), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Function privileges
-- ---------------------------------------------------------------------------
revoke all on function public.business_update_enquiry(uuid, public.enquiry_status, text) from public, anon;
revoke all on function public.cancel_my_enquiry(uuid, text) from public, anon;
revoke all on function public.admin_list_enquiries(text, text, integer, integer) from public, anon;
revoke all on function public.admin_get_enquiry(uuid) from public, anon;
revoke all on function public.admin_reveal_enquiry_contact(uuid, text) from public, anon;
revoke all on function public.admin_enquiry_overview(date, date) from public, anon;
grant execute on function public.business_update_enquiry(uuid, public.enquiry_status, text) to authenticated;
grant execute on function public.cancel_my_enquiry(uuid, text) to authenticated;
grant execute on function public.admin_list_enquiries(text, text, integer, integer) to authenticated;
grant execute on function public.admin_get_enquiry(uuid) to authenticated;
grant execute on function public.admin_reveal_enquiry_contact(uuid, text) to authenticated;
grant execute on function public.admin_enquiry_overview(date, date) to authenticated;

revoke all on function private.enquiry_kind(text, text) from public, anon;
revoke all on function private.enquiry_next_statuses(text, text) from public, anon;
revoke all on function private.enquiries_validate() from public, anon, authenticated;
revoke all on function private.enquiries_after_insert() from public, anon, authenticated;
revoke all on function private.notify_business(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function private.require_enquiry_staff() from public, anon;
revoke all on function private.mask_phone(text) from public, anon;
revoke all on function private.mask_email(text) from public, anon;
revoke all on function private.mask_name(text) from public, anon;
