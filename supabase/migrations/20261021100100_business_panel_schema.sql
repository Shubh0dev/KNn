-- Business Panel (Part 2): extra profile/listing fields, review rules,
-- image guards, owner workflow functions and the analytics summary.

-- ---------------------------------------------------------------------------
-- Businesses: type and public contact details
-- ---------------------------------------------------------------------------
alter table public.businesses
  add column business_type text
    check (business_type in ('stay', 'food', 'shop', 'guide', 'boat', 'spiritual', 'experience', 'other')),
  add column public_phone text check (public_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  add column public_email text
    check (public_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(public_email) <= 254),
  add column address text check (char_length(address) <= 300),
  add column latitude numeric(9, 6) check (latitude between -90 and 90),
  add column longitude numeric(9, 6) check (longitude between -180 and 180);

grant update (business_type, public_phone, public_email, address, latitude, longitude)
  on public.businesses to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: notification preferences (a preference record; no email is sent yet)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column notification_preferences jsonb not null
    default '{"enquiry_email": true, "listing_status_email": true, "product_updates": false}'::jsonb
    check (jsonb_typeof(notification_preferences) = 'object');

grant update (notification_preferences) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Listings: subtype, hours, indicative pricing, amenities
-- ---------------------------------------------------------------------------
alter table public.listings
  add column subtype text check (char_length(subtype) <= 60),
  add column business_hours jsonb
    check (business_hours is null or jsonb_typeof(business_hours) = 'object'),
  add column price_from integer check (price_from between 0 and 10000000),
  add column price_to integer check (price_to between 0 and 10000000),
  add column price_note text check (char_length(price_note) <= 200),
  add column amenities text[] not null default '{}' check (cardinality(amenities) <= 20),
  add constraint listings_price_range
    check (price_from is null or price_to is null or price_to >= price_from);

grant insert (subtype, business_hours, price_from, price_to, price_note, amenities)
  on public.listings to authenticated;
grant update (subtype, business_hours, price_from, price_to, price_note, amenities)
  on public.listings to authenticated;

-- Owners cannot edit a listing that moderators have suspended or archived.
create policy "Listings: members cannot edit suspended or archived"
  on public.listings as restrictive for update to authenticated
  using (status not in ('suspended', 'archived'));

-- ---------------------------------------------------------------------------
-- Review policy for edits to a published listing
--   Sensitive fields (identity, description, location, contact, amenities,
--   images) send the listing back to review. Hours and pricing do not.
-- ---------------------------------------------------------------------------
create or replace function private.listings_require_review_on_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'published'
     and new.status = 'published'
     and (select auth.uid()) is not null
     and not private.has_permission('listings.moderate')
     and (old.title, old.slug, old.summary, old.description, old.category_id, old.subtype,
          old.area, old.address, old.latitude, old.longitude,
          old.contact_phone, old.contact_email, old.website, old.amenities)
         is distinct from
         (new.title, new.slug, new.summary, new.description, new.category_id, new.subtype,
          new.area, new.address, new.latitude, new.longitude,
          new.contact_phone, new.contact_email, new.website, new.amenities)
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
-- Image guards: at most 10 per listing; new photos on a published listing
-- send it back to review.
-- ---------------------------------------------------------------------------
create function private.listing_images_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.listing_images i where i.listing_id = new.listing_id) >= 10 then
    raise exception 'A listing can have at most 10 images' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger listing_images_limit
  before insert on public.listing_images
  for each row execute function private.listing_images_limit();

create function private.listing_images_require_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.listing_status;
begin
  if (select auth.uid()) is null or private.has_permission('listings.moderate') then
    return new;
  end if;

  select status into v_status from public.listings where id = new.listing_id for update;
  if v_status = 'published' then
    update public.listings set status = 'pending_review', submitted_at = now() where id = new.listing_id;
    insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id, note)
    values (new.listing_id, 'published', 'pending_review', (select auth.uid()), 'Images changed by business; re-review required');
  end if;
  return new;
end;
$$;

create trigger listing_images_require_review
  after insert or update of alt_text on public.listing_images
  for each row execute function private.listing_images_require_review();

revoke all on function private.listing_images_limit(), private.listing_images_require_review() from public;

-- ---------------------------------------------------------------------------
-- Owner workflow functions
-- ---------------------------------------------------------------------------
create or replace function public.submit_listing_for_review(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_business_status public.business_verification_status;
begin
  if not private.can_manage_listing(p_listing_id) then
    raise exception 'Not allowed to manage this listing' using errcode = '42501';
  end if;

  select * into v_listing from public.listings where id = p_listing_id for update;
  if v_listing.status not in ('draft', 'changes_requested', 'rejected') then
    raise exception 'A listing with status % cannot be submitted', v_listing.status using errcode = 'P0001';
  end if;

  select verification_status into v_business_status
  from public.businesses where id = v_listing.business_id;
  if v_business_status not in ('pending', 'verified') then
    raise exception 'Request business verification before submitting listings' using errcode = 'P0001';
  end if;

  if char_length(trim(coalesce(v_listing.description, ''))) < 30 then
    raise exception 'Add a description of at least 30 characters' using errcode = 'P0001';
  end if;
  if trim(coalesce(v_listing.area, '')) = '' then
    raise exception 'Add the locality or area of this listing' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.listing_images i where i.listing_id = p_listing_id) then
    raise exception 'Add at least one image before submitting' using errcode = 'P0001';
  end if;

  update public.listings set status = 'pending_review', submitted_at = now() where id = p_listing_id;

  insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id)
  values (p_listing_id, v_listing.status, 'pending_review', (select auth.uid()));
  perform private.write_audit('listing.submitted', 'listing', p_listing_id::text);
end;
$$;

create or replace function public.request_business_verification(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.business_verification_status;
begin
  if not private.is_business_owner(p_business_id) then
    raise exception 'Only the business owner can request verification' using errcode = '42501';
  end if;

  select verification_status into v_from from public.businesses where id = p_business_id for update;
  if v_from not in ('unverified', 'rejected') then
    raise exception 'Verification cannot be requested from status %', v_from using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.business_verification_documents d where d.business_id = p_business_id
  ) then
    raise exception 'Upload at least one verification document first' using errcode = 'P0001';
  end if;

  update public.businesses set verification_status = 'pending' where id = p_business_id;
  insert into public.business_verification_events (business_id, from_status, to_status, actor_id)
  values (p_business_id, v_from, 'pending', (select auth.uid()));
  perform private.write_audit('business.verification_requested', 'business', p_business_id::text);
end;
$$;

create or replace function public.admin_moderate_listing(
  p_listing_id uuid,
  p_status public.listing_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_business_status public.business_verification_status;
begin
  if not private.has_permission('listings.moderate') then
    raise exception 'listings.moderate permission required' using errcode = '42501';
  end if;

  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  -- No self-approval, even for staff who also manage a business.
  if private.is_business_member(v_listing.business_id) then
    raise exception 'You cannot moderate a listing for a business you belong to' using errcode = '42501';
  end if;

  if p_status not in ('published', 'changes_requested', 'rejected', 'archived', 'suspended') then
    raise exception 'Unsupported moderation status %', p_status using errcode = 'P0001';
  end if;
  if p_status in ('changes_requested', 'rejected') and v_listing.status <> 'pending_review' then
    raise exception 'Only listings pending review can be %', p_status using errcode = 'P0001';
  end if;
  if p_status = 'published' and v_listing.status not in ('pending_review', 'suspended') then
    raise exception 'Only listings pending review or suspended can be published' using errcode = 'P0001';
  end if;
  if p_status = 'suspended' and v_listing.status <> 'published' then
    raise exception 'Only published listings can be suspended' using errcode = 'P0001';
  end if;
  if p_status in ('changes_requested', 'rejected', 'suspended') and coalesce(trim(p_note), '') = '' then
    raise exception 'A note is required for this decision' using errcode = 'P0001';
  end if;

  if p_status = 'published' and v_listing.business_id is not null then
    select verification_status into v_business_status from public.businesses where id = v_listing.business_id;
    if v_business_status <> 'verified' then
      raise exception 'The business must be verified before its listings can be published' using errcode = 'P0001';
    end if;
  end if;

  update public.listings
  set status = p_status,
      published_at = case when p_status = 'published' then now() else published_at end
  where id = p_listing_id;

  insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id, note)
  values (p_listing_id, v_listing.status, p_status, (select auth.uid()), nullif(trim(p_note), ''));
  perform private.write_audit('listing.moderated', 'listing', p_listing_id::text,
                              jsonb_build_object('from', v_listing.status, 'to', p_status));
end;
$$;

create function public.archive_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.listing_status;
begin
  if not private.can_manage_listing(p_listing_id) then
    raise exception 'Not allowed to manage this listing' using errcode = '42501';
  end if;

  select status into v_from from public.listings where id = p_listing_id for update;
  if v_from not in ('draft', 'pending_review', 'changes_requested', 'rejected', 'published') then
    raise exception 'A listing with status % cannot be archived', v_from using errcode = 'P0001';
  end if;

  update public.listings set status = 'archived' where id = p_listing_id;
  insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id, note)
  values (p_listing_id, v_from, 'archived', (select auth.uid()), 'Archived by business');
  perform private.write_audit('listing.archived', 'listing', p_listing_id::text);
end;
$$;

-- Restoring brings a listing back as a draft; it must be submitted and approved again.
create function public.restore_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_listing(p_listing_id) then
    raise exception 'Not allowed to manage this listing' using errcode = '42501';
  end if;

  if not exists (select 1 from public.listings where id = p_listing_id and status = 'archived') then
    raise exception 'Only archived listings can be restored' using errcode = 'P0001';
  end if;

  update public.listings set status = 'draft' where id = p_listing_id;
  insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id, note)
  values (p_listing_id, 'archived', 'draft', (select auth.uid()), 'Restored by business');
  perform private.write_audit('listing.restored', 'listing', p_listing_id::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Analytics: SECURITY INVOKER, so Row Level Security limits the rows to
-- listings the caller may manage.
-- ---------------------------------------------------------------------------
create function public.business_engagement_summary(p_business_id uuid, p_days integer default 30)
returns table (day date, listing_id uuid, event_type public.engagement_event_type, event_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.created_at::date as day, e.listing_id, e.event_type, count(*) as event_count
  from public.listing_engagement_events e
  join public.listings l on l.id = e.listing_id
  where l.business_id = p_business_id
    and e.created_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
  group by 1, 2, 3
  order by 1;
$$;

revoke all on function
  public.archive_listing(uuid),
  public.restore_listing(uuid),
  public.business_engagement_summary(uuid, integer)
from public, anon, authenticated;

grant execute on function
  public.archive_listing(uuid),
  public.restore_listing(uuid),
  public.business_engagement_summary(uuid, integer)
to authenticated;
