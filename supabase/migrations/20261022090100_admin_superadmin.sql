-- Part 3: Admin and Super Admin control centres.
--   * platform settings (read by functions, edited only by super admins)
--   * content reports (user reports -> admin review; never auto-removal)
--   * featured / sponsored placements
--   * curated platform listings (business_id is null) managed with content.manage
--   * stricter verification decisions, document review, explicit suspend permission
--   * super admin functions: overview metrics, user directory, admin provisioning,
--     business membership assignment, audited listing override
--   * audit triggers for content and plan tables
-- Every mutation that changes state goes through a SECURITY DEFINER function that
-- re-checks the caller's role/permission and writes to the append-only audit log,
-- or through an RLS-protected table with an audit trigger.

-- ===========================================================================
-- Platform settings
-- ===========================================================================
create table public.platform_settings (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  description text check (char_length(description) <= 300),
  is_public boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to anon, authenticated;

create policy "Settings: public keys for everyone, all keys for super admins"
  on public.platform_settings for select to anon, authenticated
  using (is_public or private.has_role('super_admin'));

insert into public.platform_settings (key, value, description, is_public) values
  ('listing_rules', '{"min_description_length": 30, "require_image": true, "max_images": 10}',
   'Requirements a listing must meet before it can be submitted for review.', true),
  ('moderation', '{"report_daily_limit_per_user": 10, "auto_hide_on_reports": false}',
   'Content report limits. Reports never remove a listing automatically.', false),
  ('sponsored_placements', '{"enabled": false, "label": "Sponsored", "max_home_slots": 6}',
   'Whether paid/sponsored featured placements may be created, and how they are labelled.', true),
  ('affiliate', '{"programs": []}',
   'Affiliate programme metadata (names, websites, notes). Never store keys or secrets here.', false),
  ('platform', '{"site_name": "KashiNagri", "support_email": null, "announcement": null}',
   'General platform configuration.', true)
on conflict (key) do nothing;

create function private.setting(_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.platform_settings where key = _key;
$$;
revoke all on function private.setting(text) from public;

create function public.superadmin_update_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_int int;
begin
  if not private.has_role('super_admin') then
    raise exception 'Super admin required' using errcode = '42501';
  end if;

  select value into v_old from public.platform_settings where key = p_key for update;
  if not found then
    raise exception 'Unknown setting %', p_key using errcode = 'P0001';
  end if;
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    raise exception 'Setting value must be an object' using errcode = 'P0001';
  end if;
  -- Settings are configuration, not a secret store.
  if p_value::text ~* '"[^"]*(secret|token|password|api_?key|private_?key)[^"]*"\s*:' then
    raise exception 'Settings must not contain secrets, keys or passwords' using errcode = 'P0001';
  end if;

  if p_key = 'listing_rules' then
    v_int := (p_value ->> 'min_description_length')::int;
    if v_int is null or v_int not between 0 and 2000 then raise exception 'min_description_length must be 0-2000' using errcode = 'P0001'; end if;
    v_int := (p_value ->> 'max_images')::int;
    if v_int is null or v_int not between 1 and 20 then raise exception 'max_images must be 1-20' using errcode = 'P0001'; end if;
    if jsonb_typeof(p_value -> 'require_image') <> 'boolean' then raise exception 'require_image must be true or false' using errcode = 'P0001'; end if;
  elsif p_key = 'moderation' then
    v_int := (p_value ->> 'report_daily_limit_per_user')::int;
    if v_int is null or v_int not between 1 and 100 then raise exception 'report_daily_limit_per_user must be 1-100' using errcode = 'P0001'; end if;
    if coalesce((p_value ->> 'auto_hide_on_reports')::boolean, false) then
      raise exception 'Automatic removal on reports is not allowed; every report needs a human decision' using errcode = 'P0001';
    end if;
  elsif p_key = 'sponsored_placements' then
    if jsonb_typeof(p_value -> 'enabled') <> 'boolean' then raise exception 'enabled must be true or false' using errcode = 'P0001'; end if;
    if char_length(coalesce(p_value ->> 'label', '')) not between 1 and 30 then raise exception 'label must be 1-30 characters' using errcode = 'P0001'; end if;
    v_int := (p_value ->> 'max_home_slots')::int;
    if v_int is null or v_int not between 1 and 12 then raise exception 'max_home_slots must be 1-12' using errcode = 'P0001'; end if;
  elsif p_key = 'affiliate' then
    if jsonb_typeof(p_value -> 'programs') <> 'array' or jsonb_array_length(p_value -> 'programs') > 20 then
      raise exception 'programs must be a list of at most 20 entries' using errcode = 'P0001';
    end if;
  elsif p_key = 'platform' then
    if char_length(coalesce(p_value ->> 'site_name', '')) not between 2 and 60 then raise exception 'site_name must be 2-60 characters' using errcode = 'P0001'; end if;
    if (p_value ->> 'support_email') is not null and (p_value ->> 'support_email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'support_email is not a valid email' using errcode = 'P0001';
    end if;
    if char_length(coalesce(p_value ->> 'announcement', '')) > 200 then raise exception 'announcement must be at most 200 characters' using errcode = 'P0001'; end if;
  end if;

  update public.platform_settings
  set value = p_value, updated_by = (select auth.uid()), updated_at = now()
  where key = p_key;

  perform private.write_audit('settings.updated', 'platform_setting', p_key,
                              jsonb_build_object('before', v_old, 'after', p_value));
end;
$$;

-- Listing rules now come from settings (defaults keep Part 2 behaviour).
create or replace function public.submit_listing_for_review(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_business_status public.business_verification_status;
  v_rules jsonb := coalesce(private.setting('listing_rules'), '{}'::jsonb);
  v_min int := coalesce((v_rules ->> 'min_description_length')::int, 30);
  v_require_image boolean := coalesce((v_rules ->> 'require_image')::boolean, true);
begin
  if not private.can_manage_listing(p_listing_id) then
    raise exception 'Not allowed to manage this listing' using errcode = '42501';
  end if;

  select * into v_listing from public.listings where id = p_listing_id for update;
  if v_listing.status not in ('draft', 'changes_requested', 'rejected') then
    raise exception 'A listing with status % cannot be submitted', v_listing.status using errcode = 'P0001';
  end if;

  select verification_status into v_business_status from public.businesses where id = v_listing.business_id;
  if v_business_status not in ('pending', 'verified') then
    raise exception 'Request business verification before submitting listings' using errcode = 'P0001';
  end if;

  if char_length(trim(coalesce(v_listing.description, ''))) < v_min then
    raise exception 'Add a description of at least % characters', v_min using errcode = 'P0001';
  end if;
  if trim(coalesce(v_listing.area, '')) = '' then
    raise exception 'Add the locality or area of this listing' using errcode = 'P0001';
  end if;
  if v_require_image and not exists (select 1 from public.listing_images i where i.listing_id = p_listing_id) then
    raise exception 'Add at least one image before submitting' using errcode = 'P0001';
  end if;

  update public.listings set status = 'pending_review', submitted_at = now() where id = p_listing_id;
  insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id)
  values (p_listing_id, v_listing.status, 'pending_review', (select auth.uid()));
  perform private.write_audit('listing.submitted', 'listing', p_listing_id::text);
end;
$$;

create or replace function private.listing_images_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int := least(20, greatest(1, coalesce((private.setting('listing_rules') ->> 'max_images')::int, 10)));
begin
  if (select count(*) from public.listing_images i where i.listing_id = new.listing_id) >= v_max then
    raise exception 'A listing can have at most % images', v_max using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- Business verification: corrections, document review, decision rules
-- ===========================================================================
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
  if v_from not in ('unverified', 'rejected', 'changes_requested') then
    raise exception 'Verification cannot be requested from status %', v_from using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.business_verification_documents d where d.business_id = p_business_id) then
    raise exception 'Upload at least one verification document first' using errcode = 'P0001';
  end if;

  update public.businesses set verification_status = 'pending' where id = p_business_id;
  insert into public.business_verification_events (business_id, from_status, to_status, actor_id)
  values (p_business_id, v_from, 'pending', (select auth.uid()));
  perform private.write_audit('business.verification_requested', 'business', p_business_id::text);
end;
$$;

create function public.admin_review_verification_document(
  p_document_id uuid,
  p_status public.document_review_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.business_verification_documents%rowtype;
begin
  if not private.has_permission('businesses.verify') then
    raise exception 'businesses.verify permission required' using errcode = '42501';
  end if;

  select * into v_doc from public.business_verification_documents where id = p_document_id for update;
  if not found then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  if private.is_business_member(v_doc.business_id) then
    raise exception 'You cannot review documents for a business you belong to' using errcode = '42501';
  end if;
  if p_status not in ('accepted', 'rejected') then
    raise exception 'Choose accept or reject' using errcode = 'P0001';
  end if;
  if p_status = 'rejected' and coalesce(trim(p_note), '') = '' then
    raise exception 'Explain why the document was not accepted' using errcode = 'P0001';
  end if;

  update public.business_verification_documents
  set review_status = p_status, reviewed_by = (select auth.uid()), reviewed_at = now(), review_note = nullif(trim(p_note), '')
  where id = p_document_id;

  perform private.write_audit('business.document_reviewed', 'business', v_doc.business_id::text,
                              jsonb_build_object('document_id', p_document_id, 'decision', p_status));
end;
$$;

create or replace function public.admin_set_business_verification(
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
  v_business public.businesses%rowtype;
begin
  if not private.has_permission('businesses.verify') then
    raise exception 'businesses.verify permission required' using errcode = '42501';
  end if;
  if private.is_business_member(p_business_id) then
    raise exception 'You cannot make decisions about a business you belong to' using errcode = '42501';
  end if;
  if p_status not in ('verified', 'changes_requested', 'rejected', 'suspended') then
    raise exception 'Unsupported verification decision %', p_status using errcode = 'P0001';
  end if;

  select * into v_business from public.businesses where id = p_business_id for update;
  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;
  if p_status in ('changes_requested', 'rejected', 'suspended') and coalesce(trim(p_note), '') = '' then
    raise exception 'A reason is required for this decision' using errcode = 'P0001';
  end if;

  if p_status in ('changes_requested', 'rejected') and v_business.verification_status <> 'pending' then
    raise exception 'Only businesses awaiting verification can receive this decision' using errcode = 'P0001';
  end if;
  if p_status = 'verified' and v_business.verification_status not in ('pending', 'suspended') then
    raise exception 'Only businesses awaiting verification (or suspended) can be verified' using errcode = 'P0001';
  end if;
  if p_status = 'suspended' and v_business.verification_status not in ('verified', 'pending') then
    raise exception 'Only verified or pending businesses can be suspended' using errcode = 'P0001';
  end if;

  if p_status = 'verified' then
    if v_business.business_type is null or trim(coalesce(v_business.area, '')) = '' then
      raise exception 'The business profile is incomplete: business type and area are required' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.business_verification_documents d where d.business_id = p_business_id and d.review_status = 'pending') then
      raise exception 'Review every pending document before verifying' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.business_verification_documents d where d.business_id = p_business_id and d.review_status = 'accepted') then
      raise exception 'Accept at least one verification document before verifying' using errcode = 'P0001';
    end if;
  end if;

  update public.businesses
  set verification_status = p_status,
      verified_at = case when p_status = 'verified' then now() else verified_at end
  where id = p_business_id;

  insert into public.business_verification_events (business_id, from_status, to_status, actor_id, note)
  values (p_business_id, v_business.verification_status, p_status, (select auth.uid()), nullif(trim(p_note), ''));
  perform private.write_audit('business.verification_set', 'business', p_business_id::text,
                              jsonb_build_object('from', v_business.verification_status, 'to', p_status));
end;
$$;

-- ===========================================================================
-- Listing moderation: suspend / unpublish need listings.suspend
-- ===========================================================================
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
  if p_status in ('suspended', 'archived') and not private.has_permission('listings.suspend') then
    raise exception 'listings.suspend permission required to suspend or unpublish' using errcode = '42501';
  end if;

  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
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
  if p_status = 'archived' and v_listing.status = 'archived' then
    raise exception 'This listing is already archived' using errcode = 'P0001';
  end if;
  if p_status in ('changes_requested', 'rejected', 'suspended', 'archived') and coalesce(trim(p_note), '') = '' then
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

-- Explicit, audited super admin override (e.g. restoring a wrongly rejected listing).
create function public.superadmin_override_listing(
  p_listing_id uuid,
  p_status public.listing_status,
  p_reason text
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
  if not private.has_role('super_admin') then
    raise exception 'Super admin required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'An override needs a reason of at least 10 characters' using errcode = 'P0001';
  end if;

  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if private.is_business_member(v_listing.business_id) then
    raise exception 'You cannot override decisions for a business you belong to' using errcode = '42501';
  end if;
  if p_status = v_listing.status then
    raise exception 'The listing already has status %', p_status using errcode = 'P0001';
  end if;
  if p_status = 'published' and v_listing.business_id is not null then
    select verification_status into v_business_status from public.businesses where id = v_listing.business_id;
    if v_business_status <> 'verified' then
      raise exception 'Even an override cannot publish a listing whose business is not verified' using errcode = 'P0001';
    end if;
  end if;

  update public.listings
  set status = p_status,
      published_at = case when p_status = 'published' then now() else published_at end
  where id = p_listing_id;

  insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id, note)
  values (p_listing_id, v_listing.status, p_status, (select auth.uid()), 'Super admin override: ' || trim(p_reason));
  perform private.write_audit('listing.override', 'listing', p_listing_id::text,
                              jsonb_build_object('from', v_listing.status, 'to', p_status, 'reason', trim(p_reason)));
end;
$$;

-- ===========================================================================
-- Content reports
-- ===========================================================================
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter_id uuid default auth.uid() references auth.users (id) on delete set null,
  reason text not null check (reason in ('incorrect_information', 'inappropriate_content', 'fraud_or_scam', 'closed_or_moved', 'duplicate', 'other')),
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  resolution text check (resolution in ('no_action', 'listing_updated', 'listing_suspended', 'owner_contacted')),
  reviewer_id uuid references auth.users (id) on delete set null,
  reviewer_note text check (char_length(reviewer_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index content_reports_status_idx on public.content_reports (status, created_at desc);
create index content_reports_listing_idx on public.content_reports (listing_id);
create index content_reports_reporter_idx on public.content_reports (reporter_id, created_at desc);
create index content_reports_reviewer_idx on public.content_reports (reviewer_id);
create unique index content_reports_one_open_per_reporter
  on public.content_reports (listing_id, reporter_id) where status in ('open', 'reviewing');

create trigger content_reports_set_updated_at
  before update on public.content_reports
  for each row execute function private.set_updated_at();

create function private.content_reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int := coalesce((private.setting('moderation') ->> 'report_daily_limit_per_user')::int, 10);
begin
  new.status := 'open';
  new.reporter_id := (select auth.uid());
  if (select count(*) from public.content_reports r
      where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day') >= v_limit then
    raise exception 'You have reached the daily limit for reports. Please try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger content_reports_before_insert
  before insert on public.content_reports
  for each row execute function private.content_reports_before_insert();

alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;
grant select on public.content_reports to authenticated;
grant insert (listing_id, reason, details) on public.content_reports to authenticated;

create policy "Reports: reporters read own, reviewers read all"
  on public.content_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or private.has_permission('reports.review'));

create policy "Reports: active users report public listings"
  on public.content_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and private.is_active_user()
    and private.listing_is_public(listing_id)
  );

create function public.admin_resolve_report(
  p_report_id uuid,
  p_status public.report_status,
  p_resolution text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.content_reports%rowtype;
  v_listing public.listings%rowtype;
begin
  if not private.has_permission('reports.review') then
    raise exception 'reports.review permission required' using errcode = '42501';
  end if;

  select * into v_report from public.content_reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  select * into v_listing from public.listings where id = v_report.listing_id;
  if private.is_business_member(v_listing.business_id) then
    raise exception 'You cannot review reports about a business you belong to' using errcode = '42501';
  end if;
  if v_report.status in ('resolved', 'dismissed') then
    raise exception 'This report is already closed' using errcode = 'P0001';
  end if;
  if p_status not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'Unsupported report status %', p_status using errcode = 'P0001';
  end if;
  if p_status in ('resolved', 'dismissed') and coalesce(trim(p_note), '') = '' then
    raise exception 'Add a reviewer note explaining the outcome' using errcode = 'P0001';
  end if;
  if p_status = 'resolved' and p_resolution is null then
    raise exception 'Choose the action that was taken' using errcode = 'P0001';
  end if;
  if p_resolution is not null and p_resolution not in ('no_action', 'listing_updated', 'listing_suspended', 'owner_contacted') then
    raise exception 'Unsupported resolution %', p_resolution using errcode = 'P0001';
  end if;
  -- A report can only claim the listing was suspended if a moderator actually suspended it.
  if p_resolution = 'listing_suspended' and v_listing.status <> 'suspended' then
    raise exception 'Suspend the listing first (with the listings.suspend permission), then resolve the report' using errcode = 'P0001';
  end if;

  update public.content_reports
  set status = p_status,
      resolution = case when p_status = 'resolved' then p_resolution when p_status = 'dismissed' then 'no_action' else resolution end,
      reviewer_id = (select auth.uid()),
      reviewer_note = coalesce(nullif(trim(p_note), ''), reviewer_note),
      resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end
  where id = p_report_id;

  perform private.write_audit('report.' || p_status::text, 'report', p_report_id::text,
                              jsonb_build_object('listing_id', v_report.listing_id, 'resolution', p_resolution));
end;
$$;

-- ===========================================================================
-- Curated platform listings (business_id is null), managed with content.manage
-- ===========================================================================
create function private.can_manage_curated(_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('content.manage')
    and exists (select 1 from public.listings l where l.id = _listing_id and l.business_id is null);
$$;
revoke all on function private.can_manage_curated(uuid) from public;
grant execute on function private.can_manage_curated(uuid) to anon, authenticated;

create policy "Listings: content managers read curated"
  on public.listings for select to authenticated
  using (business_id is null and private.has_permission('content.manage'));

create policy "Listings: content managers create curated"
  on public.listings for insert to authenticated
  with check (business_id is null and private.has_permission('content.manage') and created_by = (select auth.uid()));

create policy "Listings: content managers edit curated"
  on public.listings for update to authenticated
  using (business_id is null and private.has_permission('content.manage'))
  with check (business_id is null and private.has_permission('content.manage'));

create policy "Listings: content managers remove curated drafts"
  on public.listings for delete to authenticated
  using (business_id is null and private.has_permission('content.manage') and status in ('draft', 'archived'));

create policy "Listing images: content managers read curated"
  on public.listing_images for select to authenticated
  using (private.can_manage_curated(listing_id));
create policy "Listing images: content managers add curated"
  on public.listing_images for insert to authenticated
  with check (private.can_manage_curated(listing_id));
create policy "Listing images: content managers edit curated"
  on public.listing_images for update to authenticated
  using (private.can_manage_curated(listing_id))
  with check (private.can_manage_curated(listing_id));
create policy "Listing images: content managers remove curated"
  on public.listing_images for delete to authenticated
  using (private.can_manage_curated(listing_id));

create policy "listing-images: content managers read curated"
  on storage.objects for select to authenticated
  using (bucket_id = 'listing-images' and private.can_manage_curated(private.uuid_or_null((storage.foldername(name))[1])));
create policy "listing-images: content managers upload curated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images' and private.can_manage_curated(private.uuid_or_null((storage.foldername(name))[1])));
create policy "listing-images: content managers update curated"
  on storage.objects for update to authenticated
  using (bucket_id = 'listing-images' and private.can_manage_curated(private.uuid_or_null((storage.foldername(name))[1])))
  with check (bucket_id = 'listing-images' and private.can_manage_curated(private.uuid_or_null((storage.foldername(name))[1])));
create policy "listing-images: content managers remove curated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and private.can_manage_curated(private.uuid_or_null((storage.foldername(name))[1])));

-- Curated content is platform-authored: business re-review rules do not apply to it.
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

create or replace function private.listing_images_require_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.listing_status;
  v_business uuid;
begin
  if (select auth.uid()) is null or private.has_permission('listings.moderate') then
    return new;
  end if;

  select status, business_id into v_status, v_business from public.listings where id = new.listing_id for update;
  if v_status = 'published' and v_business is not null then
    update public.listings set status = 'pending_review', submitted_at = now() where id = new.listing_id;
    insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id, note)
    values (new.listing_id, 'published', 'pending_review', (select auth.uid()), 'Images changed by business; re-review required');
  end if;
  return new;
end;
$$;

create function public.content_set_curated_status(p_listing_id uuid, p_status public.listing_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
begin
  if not private.has_permission('content.manage') then
    raise exception 'content.manage permission required' using errcode = '42501';
  end if;
  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found or v_listing.business_id is not null then
    raise exception 'Curated listing not found' using errcode = 'P0002';
  end if;
  if p_status not in ('draft', 'published', 'archived') then
    raise exception 'Curated listings can be draft, published or archived' using errcode = 'P0001';
  end if;
  if p_status = v_listing.status then
    return;
  end if;
  if p_status = 'published' and char_length(trim(coalesce(v_listing.description, ''))) < 30 then
    raise exception 'Add a description of at least 30 characters before publishing' using errcode = 'P0001';
  end if;

  update public.listings
  set status = p_status,
      published_at = case when p_status = 'published' then now() else published_at end
  where id = p_listing_id;
  insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id, note)
  values (p_listing_id, v_listing.status, p_status, (select auth.uid()), 'Curated content status change');
  perform private.write_audit('content.listing_status', 'listing', p_listing_id::text,
                              jsonb_build_object('from', v_listing.status, 'to', p_status));
end;
$$;

-- ===========================================================================
-- Featured and sponsored placements
-- ===========================================================================
create table public.featured_placements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  placement text not null check (placement in ('home', 'category')),
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  is_sponsored boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (listing_id, placement),
  constraint featured_placements_window check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index featured_placements_placement_idx on public.featured_placements (placement, sort_order);
create index featured_placements_created_by_idx on public.featured_placements (created_by);

create function private.featured_placements_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_sponsored and not coalesce((private.setting('sponsored_placements') ->> 'enabled')::boolean, false) then
    raise exception 'Sponsored placements are switched off in platform settings' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and not private.listing_is_public(new.listing_id) then
    raise exception 'Only published listings can be featured' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger featured_placements_guard
  before insert or update on public.featured_placements
  for each row execute function private.featured_placements_guard();

alter table public.featured_placements enable row level security;
revoke all on public.featured_placements from anon, authenticated;
grant select on public.featured_placements to anon, authenticated;
grant insert (listing_id, placement, sort_order, is_sponsored, starts_at, ends_at) on public.featured_placements to authenticated;
grant update (sort_order, is_sponsored, starts_at, ends_at) on public.featured_placements to authenticated;
grant delete on public.featured_placements to authenticated;

create policy "Featured: public sees active placements of public listings"
  on public.featured_placements for select to anon, authenticated
  using (
    (private.listing_is_public(listing_id)
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now()))
    or private.has_permission('content.manage')
  );
create policy "Featured: content managers add"
  on public.featured_placements for insert to authenticated
  with check (private.has_permission('content.manage'));
create policy "Featured: content managers edit"
  on public.featured_placements for update to authenticated
  using (private.has_permission('content.manage'))
  with check (private.has_permission('content.manage'));
create policy "Featured: content managers remove"
  on public.featured_placements for delete to authenticated
  using (private.has_permission('content.manage'));

-- ===========================================================================
-- Subscription plans: super admins maintain the catalogue (no payments here)
-- ===========================================================================
grant insert (code, name, description, price_amount, currency, billing_interval, features, is_active)
  on public.subscription_plans to authenticated;
grant update (name, description, price_amount, features, is_active) on public.subscription_plans to authenticated;

create policy "Plans: super admins create"
  on public.subscription_plans for insert to authenticated
  with check (private.has_role('super_admin'));
create policy "Plans: super admins edit"
  on public.subscription_plans for update to authenticated
  using (private.has_role('super_admin'))
  with check (private.has_role('super_admin'));

-- ===========================================================================
-- Audit trigger for content and catalogue tables
-- ===========================================================================
create function private.audit_table_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
begin
  if tg_op = 'DELETE' then
    v_id := old.id::text;
  else
    v_id := new.id::text;
  end if;
  perform private.write_audit(tg_table_name || '.' || lower(tg_op), tg_table_name, v_id, '{}'::jsonb);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger listing_categories_audit
  after insert or update or delete on public.listing_categories
  for each row execute function private.audit_table_change();
create trigger featured_placements_audit
  after insert or update or delete on public.featured_placements
  for each row execute function private.audit_table_change();
create trigger subscription_plans_audit
  after insert or update or delete on public.subscription_plans
  for each row execute function private.audit_table_change();

revoke all on function
  private.content_reports_before_insert(),
  private.featured_placements_guard(),
  private.audit_table_change()
from public;

-- ===========================================================================
-- Super admin: people and admins
-- ===========================================================================
create function public.superadmin_list_users(
  p_search text default null,
  p_role public.app_role default null,
  p_status public.account_status default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, email text, full_name text, account_status public.account_status, roles public.app_role[],
  business_count bigint, created_at timestamptz, last_sign_in_at timestamptz, email_confirmed boolean, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.has_role('super_admin') then
    raise exception 'Super admin required' using errcode = '42501';
  end if;

  return query
  select p.id, p.email, p.full_name, p.account_status,
         coalesce((select array_agg(r.role order by r.role) from public.user_roles r where r.user_id = p.id), '{}'::public.app_role[]),
         (select count(*) from public.business_members m where m.user_id = p.id),
         p.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
         count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  where (p_search is null or p.email ilike '%' || p_search || '%' or p.full_name ilike '%' || p_search || '%')
    and (p_status is null or p.account_status = p_status)
    and (p_role is null or exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = p_role))
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$;

create function public.superadmin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not private.has_role('super_admin') then
    raise exception 'Super admin required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id, 'email', p.email, 'full_name', p.full_name, 'phone', p.phone,
    'account_status', p.account_status, 'status_reason', p.status_reason, 'created_at', p.created_at,
    'last_sign_in_at', u.last_sign_in_at, 'email_confirmed', u.email_confirmed_at is not null,
    'providers', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb),
    'roles', (select coalesce(jsonb_agg(r.role order by r.role), '[]'::jsonb) from public.user_roles r where r.user_id = p.id),
    'permissions', (select coalesce(jsonb_agg(a.permission order by a.permission), '[]'::jsonb) from public.admin_permissions a where a.user_id = p.id),
    'businesses', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'slug', b.slug,
                     'verification_status', b.verification_status, 'member_role', m.member_role) order by b.name), '[]'::jsonb)
                   from public.business_members m join public.businesses b on b.id = m.business_id where m.user_id = p.id)
  ) into v
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = p_user_id;

  if v is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  return v;
end;
$$;

-- Provision an admin: the person must already have a confirmed, active account.
create function public.superadmin_grant_admin(p_user_id uuid, p_permissions public.admin_permission[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role('super_admin') then
    raise exception 'Super admin required' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own roles' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = p_user_id and p.account_status = 'active' and u.email_confirmed_at is not null
  ) then
    raise exception 'Admins must have an active account with a confirmed email' using errcode = 'P0001';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (p_user_id, 'admin', (select auth.uid()))
  on conflict (user_id, role) do nothing;

  insert into public.admin_permissions (user_id, permission, granted_by)
  select p_user_id, perm, (select auth.uid()) from unnest(coalesce(p_permissions, '{}')) as perm
  on conflict (user_id, permission) do nothing;

  perform private.write_audit('role.admin_granted', 'user', p_user_id::text,
                              jsonb_build_object('permissions', coalesce(p_permissions, '{}')));
end;
$$;

-- Approved workflow for giving someone access to an existing business.
create function public.superadmin_add_business_member(
  p_business_id uuid,
  p_user_id uuid,
  p_member_role public.business_member_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role('super_admin') then
    raise exception 'Super admin required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.businesses where id = p_business_id) then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = p_user_id and p.account_status = 'active' and u.email_confirmed_at is not null
  ) then
    raise exception 'The person must have an active account with a confirmed email' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.business_members where business_id = p_business_id and user_id = p_user_id) then
    raise exception 'This person is already a member of the business' using errcode = 'P0001';
  end if;
  if p_member_role = 'owner' and exists (select 1 from public.business_members where business_id = p_business_id and member_role = 'owner') then
    raise exception 'This business already has an owner; add the person as a manager' using errcode = 'P0001';
  end if;

  insert into public.business_members (business_id, user_id, member_role) values (p_business_id, p_user_id, p_member_role);
  insert into public.user_roles (user_id, role, granted_by)
  values (p_user_id, 'business_owner', (select auth.uid()))
  on conflict (user_id, role) do nothing;

  perform private.write_audit('business.member_added', 'business', p_business_id::text,
                              jsonb_build_object('user_id', p_user_id, 'member_role', p_member_role));
end;
$$;

-- ===========================================================================
-- Super admin: platform overview
-- ===========================================================================
create function public.superadmin_platform_metrics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
begin
  if not private.has_role('super_admin') then
    raise exception 'Super admin required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'days', v_days,
    'accounts', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'new_in_period', (select count(*) from public.profiles where created_at >= v_since),
      'by_status', (select coalesce(jsonb_object_agg(s, n), '{}'::jsonb) from (select account_status::text s, count(*) n from public.profiles group by 1) x),
      'by_role', (select coalesce(jsonb_object_agg(s, n), '{}'::jsonb) from (select role::text s, count(*) n from public.user_roles group by 1) x)
    ),
    'businesses', (select coalesce(jsonb_object_agg(s, n), '{}'::jsonb) from (select verification_status::text s, count(*) n from public.businesses group by 1) x),
    'listings', (select coalesce(jsonb_object_agg(s, n), '{}'::jsonb) from (select status::text s, count(*) n from public.listings group by 1) x),
    'enquiries', jsonb_build_object(
      'total', (select count(*) from public.enquiries),
      'in_period', (select count(*) from public.enquiries where created_at >= v_since)
    ),
    'engagement', jsonb_build_object(
      'day', (select count(*) from public.listing_engagement_events where created_at >= now() - interval '1 day'),
      'week', (select count(*) from public.listing_engagement_events where created_at >= now() - interval '7 days'),
      'month', (select count(*) from public.listing_engagement_events where created_at >= now() - interval '30 days'),
      'series', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'views', v, 'clicks', c) order by d), '[]'::jsonb) from (
        select e.created_at::date d,
               count(*) filter (where e.event_type = 'view') v,
               count(*) filter (where e.event_type in ('contact_click', 'website_click', 'direction_click')) c
        from public.listing_engagement_events e where e.created_at >= v_since group by 1) x)
    ),
    'reports', (select coalesce(jsonb_object_agg(s, n), '{}'::jsonb) from (select status::text s, count(*) n from public.content_reports group by 1) x),
    'pending', jsonb_build_object(
      'verifications', (select count(*) from public.businesses where verification_status = 'pending'),
      'listings', (select count(*) from public.listings where status = 'pending_review'),
      'reports', (select count(*) from public.content_reports where status in ('open', 'reviewing'))
    ),
    'billing', jsonb_build_object(
      'plans', (select count(*) from public.subscription_plans),
      'active_subscriptions', (select count(*) from public.subscriptions where status in ('active', 'trialing')),
      'payments_succeeded', (select count(*) from public.payments where status = 'succeeded'),
      'revenue_in_period', (select coalesce(sum(amount), 0) from public.payments where status = 'succeeded' and coalesce(paid_at, created_at) >= v_since)
    )
  );
end;
$$;

-- ===========================================================================
-- Function privileges
-- ===========================================================================
revoke all on function
  public.superadmin_update_setting(text, jsonb),
  public.admin_review_verification_document(uuid, public.document_review_status, text),
  public.superadmin_override_listing(uuid, public.listing_status, text),
  public.admin_resolve_report(uuid, public.report_status, text, text),
  public.content_set_curated_status(uuid, public.listing_status),
  public.superadmin_list_users(text, public.app_role, public.account_status, integer, integer),
  public.superadmin_user_detail(uuid),
  public.superadmin_grant_admin(uuid, public.admin_permission[]),
  public.superadmin_add_business_member(uuid, uuid, public.business_member_role),
  public.superadmin_platform_metrics(integer)
from public, anon, authenticated;

grant execute on function
  public.superadmin_update_setting(text, jsonb),
  public.admin_review_verification_document(uuid, public.document_review_status, text),
  public.superadmin_override_listing(uuid, public.listing_status, text),
  public.admin_resolve_report(uuid, public.report_status, text, text),
  public.content_set_curated_status(uuid, public.listing_status),
  public.superadmin_list_users(text, public.app_role, public.account_status, integer, integer),
  public.superadmin_user_detail(uuid),
  public.superadmin_grant_admin(uuid, public.admin_permission[]),
  public.superadmin_add_business_member(uuid, uuid, public.business_member_role),
  public.superadmin_platform_metrics(integer)
to authenticated;
