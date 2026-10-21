-- Server-controlled workflow functions (exposed as RPC).
--
-- Every status transition and role change goes through one of these
-- SECURITY DEFINER functions. Each one re-checks the caller's role from the
-- database, records history and writes an audit entry. Direct table grants
-- never include status or role columns.

-- ---------------------------------------------------------------------------
-- Business onboarding
-- ---------------------------------------------------------------------------
create function public.create_business(
  p_name text,
  p_slug text,
  p_description text default null,
  p_area text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_business_id uuid;
begin
  if v_uid is null or not private.is_active_user() then
    raise exception 'An active signed-in account is required' using errcode = '42501';
  end if;

  if (select count(*) from public.business_members m
      where m.user_id = v_uid and m.member_role = 'owner') >= 5 then
    raise exception 'Business limit reached for this account' using errcode = 'P0001';
  end if;

  insert into public.businesses (name, slug, description, area, created_by)
  values (trim(p_name), lower(trim(p_slug)), nullif(trim(p_description), ''), nullif(trim(p_area), ''), v_uid)
  returning id into v_business_id;

  insert into public.business_members (business_id, user_id, member_role)
  values (v_business_id, v_uid, 'owner');

  insert into public.business_private_details (business_id) values (v_business_id);

  insert into public.user_roles (user_id, role, granted_by)
  values (v_uid, 'business_owner', v_uid)
  on conflict (user_id, role) do nothing;

  insert into public.business_verification_events (business_id, from_status, to_status, actor_id, note)
  values (v_business_id, null, 'unverified', v_uid, 'Business created');

  perform private.write_audit('business.create', 'business', v_business_id::text,
                              jsonb_build_object('slug', lower(trim(p_slug))));
  return v_business_id;
end;
$$;

create function public.request_business_verification(p_business_id uuid)
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

  update public.businesses set verification_status = 'pending' where id = p_business_id;
  insert into public.business_verification_events (business_id, from_status, to_status, actor_id)
  values (p_business_id, v_from, 'pending', (select auth.uid()));
  perform private.write_audit('business.verification_requested', 'business', p_business_id::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Listing workflow
-- ---------------------------------------------------------------------------
create function public.submit_listing_for_review(p_listing_id uuid)
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
  if v_from not in ('draft', 'changes_requested', 'rejected') then
    raise exception 'Listing cannot be submitted from status %', v_from using errcode = 'P0001';
  end if;

  update public.listings
  set status = 'pending_review', submitted_at = now()
  where id = p_listing_id;

  insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id)
  values (p_listing_id, v_from, 'pending_review', (select auth.uid()));
  perform private.write_audit('listing.submitted', 'listing', p_listing_id::text);
end;
$$;

create function public.admin_moderate_listing(
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

  if p_status not in ('published', 'changes_requested', 'rejected', 'archived') then
    raise exception 'Unsupported moderation status %', p_status using errcode = 'P0001';
  end if;

  if p_status in ('published', 'changes_requested', 'rejected') and v_listing.status <> 'pending_review' then
    raise exception 'Only listings pending review can be %', p_status using errcode = 'P0001';
  end if;

  if p_status in ('changes_requested', 'rejected') and coalesce(trim(p_note), '') = '' then
    raise exception 'A note is required when requesting changes or rejecting' using errcode = 'P0001';
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

-- ---------------------------------------------------------------------------
-- Business verification (staff)
-- ---------------------------------------------------------------------------
create function public.admin_set_business_verification(
  p_business_id uuid,
  p_status public.business_verification_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.business_verification_status;
begin
  if not private.has_permission('businesses.verify') then
    raise exception 'businesses.verify permission required' using errcode = '42501';
  end if;

  if private.is_business_member(p_business_id) then
    raise exception 'You cannot verify a business you belong to' using errcode = '42501';
  end if;

  if p_status not in ('verified', 'rejected', 'suspended') then
    raise exception 'Unsupported verification status %', p_status using errcode = 'P0001';
  end if;

  if p_status in ('rejected', 'suspended') and coalesce(trim(p_note), '') = '' then
    raise exception 'A note is required when rejecting or suspending' using errcode = 'P0001';
  end if;

  select verification_status into v_from from public.businesses where id = p_business_id for update;
  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  update public.businesses
  set verification_status = p_status,
      verified_at = case when p_status = 'verified' then now() else verified_at end
  where id = p_business_id;

  insert into public.business_verification_events (business_id, from_status, to_status, actor_id, note)
  values (p_business_id, v_from, p_status, (select auth.uid()), nullif(trim(p_note), ''));
  perform private.write_audit('business.verification_set', 'business', p_business_id::text,
                              jsonb_build_object('from', v_from, 'to', p_status));
end;
$$;

-- ---------------------------------------------------------------------------
-- Account status (staff)
-- ---------------------------------------------------------------------------
create function public.admin_set_account_status(
  p_user_id uuid,
  p_status public.account_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_is_staff boolean;
begin
  if not private.has_permission('users.manage') then
    raise exception 'users.manage permission required' using errcode = '42501';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own account status' using errcode = '42501';
  end if;

  if exists (select 1 from public.user_roles where user_id = p_user_id and role = 'super_admin') then
    raise exception 'Super admin accounts can only be changed by a database operator' using errcode = '42501';
  end if;

  select exists (select 1 from public.user_roles where user_id = p_user_id and role = 'admin')
    into v_target_is_staff;
  if v_target_is_staff and not private.has_role('super_admin') then
    raise exception 'Only a super admin can change an admin account' using errcode = '42501';
  end if;

  update public.profiles
  set account_status = p_status, status_reason = nullif(trim(p_reason), '')
  where id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  perform private.write_audit('user.status_set', 'user', p_user_id::text,
                              jsonb_build_object('status', p_status));
end;
$$;

-- ---------------------------------------------------------------------------
-- Engagement tracking (anonymous allowed, public listings only, de-duplicated)
-- ---------------------------------------------------------------------------
create function public.track_listing_event(
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
  if not private.listing_is_public(p_listing_id) then
    return;
  end if;

  if v_session is not null and exists (
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

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke all on function
  public.create_business(text, text, text, text),
  public.request_business_verification(uuid),
  public.submit_listing_for_review(uuid),
  public.admin_moderate_listing(uuid, public.listing_status, text),
  public.admin_set_business_verification(uuid, public.business_verification_status, text),
  public.admin_set_account_status(uuid, public.account_status, text),
  public.track_listing_event(uuid, public.engagement_event_type, text)
from public, anon, authenticated;

grant execute on function
  public.create_business(text, text, text, text),
  public.request_business_verification(uuid),
  public.submit_listing_for_review(uuid),
  public.admin_moderate_listing(uuid, public.listing_status, text),
  public.admin_set_business_verification(uuid, public.business_verification_status, text),
  public.admin_set_account_status(uuid, public.account_status, text),
  public.track_listing_event(uuid, public.engagement_event_type, text)
to authenticated;

grant execute on function public.track_listing_event(uuid, public.engagement_event_type, text) to anon;

revoke all on function private.write_audit(text, text, text, jsonb) from public, anon, authenticated;
