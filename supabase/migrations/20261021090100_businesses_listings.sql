-- Businesses, verification, categories, listings, images and moderation history.
--
-- Business verification status (is this a real, vetted business?) is kept
-- separate from listing publication status (is this listing live?). A listing
-- is publicly visible only when it is `published` AND its business is
-- `verified` (or it is a platform-curated listing with no business).
--
-- Status columns are never granted to `authenticated`; they change only via
-- the moderation functions in 20261021090400_workflow_functions.sql.

create type public.business_verification_status as enum ('unverified', 'pending', 'verified', 'rejected', 'suspended');
create type public.business_member_role as enum ('owner', 'manager');
create type public.document_review_status as enum ('pending', 'accepted', 'rejected');
create type public.listing_status as enum ('draft', 'pending_review', 'changes_requested', 'published', 'rejected', 'archived');

-- ---------------------------------------------------------------------------
-- Businesses
-- ---------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description text check (char_length(description) <= 2000),
  area text check (char_length(area) <= 80),
  website text check (website ~* '^https?://' and char_length(website) <= 300),
  logo_path text check (char_length(logo_path) <= 300),
  verification_status public.business_verification_status not null default 'unverified',
  verified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_verification_status_idx on public.businesses (verification_status);
create index businesses_created_by_idx on public.businesses (created_by);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function private.set_updated_at();

-- Private, non-public business details (members and verifiers only).
create table public.business_private_details (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  legal_name text check (char_length(legal_name) <= 200),
  registration_number text check (char_length(registration_number) <= 60),
  gst_number text check (gst_number ~ '^[0-9A-Z]{15}$'),
  contact_email text check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone text check (contact_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  registered_address text check (char_length(registered_address) <= 500),
  updated_at timestamptz not null default now()
);

create trigger business_private_details_set_updated_at
  before update on public.business_private_details
  for each row execute function private.set_updated_at();

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_role public.business_member_role not null default 'manager',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_idx on public.business_members (user_id);
create unique index business_members_one_owner_idx
  on public.business_members (business_id) where member_role = 'owner';

create table public.business_verification_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  document_type text not null check (document_type in ('identity', 'business_registration', 'gst_certificate', 'address_proof', 'other')),
  storage_path text not null unique check (char_length(storage_path) <= 400),
  review_status public.document_review_status not null default 'pending',
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  -- Files must live under the business's own folder in the private bucket.
  constraint verification_documents_path_matches_business
    check (storage_path like business_id::text || '/%')
);

create index business_verification_documents_business_idx on public.business_verification_documents (business_id);

create table public.business_verification_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  from_status public.business_verification_status,
  to_status public.business_verification_status not null,
  actor_id uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index business_verification_events_business_idx
  on public.business_verification_events (business_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table public.listing_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 500),
  parent_id uuid references public.listing_categories (id) on delete restrict,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listing_categories_parent_idx on public.listing_categories (parent_id);

create trigger listing_categories_set_updated_at
  before update on public.listing_categories
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade, -- null = platform-curated
  category_id uuid not null references public.listing_categories (id) on delete restrict,
  title text not null check (char_length(title) between 3 and 140),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  summary text check (char_length(summary) <= 300),
  description text check (char_length(description) <= 10000),
  area text check (char_length(area) <= 80),
  address text check (char_length(address) <= 300),
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  price_band text check (price_band in ('free', 'budget', 'mid', 'premium', 'luxury')),
  contact_phone text check (contact_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  contact_email text check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website text check (website ~* '^https?://' and char_length(website) <= 300),
  status public.listing_status not null default 'draft',
  submitted_at timestamptz,
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_business_idx on public.listings (business_id);
create index listings_category_status_idx on public.listings (category_id, status);
create index listings_status_idx on public.listings (status);
create index listings_published_idx on public.listings (published_at desc) where status = 'published';
create index listings_created_by_idx on public.listings (created_by);

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function private.set_updated_at();

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 400),
  alt_text text check (char_length(alt_text) <= 200),
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  constraint listing_images_path_matches_listing
    check (storage_path like listing_id::text || '/%')
);

create index listing_images_listing_idx on public.listing_images (listing_id, sort_order);
create unique index listing_images_one_cover_idx on public.listing_images (listing_id) where is_cover;

create table public.listing_moderation_events (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  from_status public.listing_status,
  to_status public.listing_status not null,
  actor_id uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index listing_moderation_events_listing_idx
  on public.listing_moderation_events (listing_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers that depend on these tables
-- ---------------------------------------------------------------------------
create function private.uuid_or_null(_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when _value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then _value::uuid
  end;
$$;

create function private.is_business_member(_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _business_id is not null
    and private.is_active_user()
    and exists (
      select 1 from public.business_members m
      where m.business_id = _business_id and m.user_id = (select auth.uid())
    );
$$;

create function private.is_business_owner(_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _business_id is not null
    and private.is_active_user()
    and exists (
      select 1 from public.business_members m
      where m.business_id = _business_id
        and m.user_id = (select auth.uid())
        and m.member_role = 'owner'
    );
$$;

create function private.can_manage_listing(_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.listings l
    where l.id = _listing_id and private.is_business_member(l.business_id)
  );
$$;

create function private.listing_is_public(_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.listings l
    left join public.businesses b on b.id = l.business_id
    where l.id = _listing_id
      and l.status = 'published'
      and (l.business_id is null or b.verification_status = 'verified')
  );
$$;

-- Editing the content of a live (or rejected) listing sends it back to review,
-- so an approved listing cannot be silently replaced with unreviewed content.
-- Status changes made by the moderation functions are not affected.
create function private.listings_require_review_on_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = new.status
     and old.status in ('published', 'rejected')
     and (select auth.uid()) is not null
     and not private.has_permission('listings.moderate')
     and (old.title, old.slug, old.summary, old.description, old.category_id, old.area, old.address,
          old.latitude, old.longitude, old.price_band, old.contact_phone, old.contact_email, old.website)
         is distinct from
         (new.title, new.slug, new.summary, new.description, new.category_id, new.area, new.address,
          new.latitude, new.longitude, new.price_band, new.contact_phone, new.contact_email, new.website)
  then
    new.status := 'pending_review';
    new.submitted_at := now();
    insert into public.listing_moderation_events (listing_id, from_status, to_status, actor_id, note)
    values (new.id, old.status, 'pending_review', (select auth.uid()), 'Edited by business; re-review required');
  end if;
  return new;
end;
$$;

create trigger listings_require_review_on_edit
  before update on public.listings
  for each row execute function private.listings_require_review_on_edit();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.business_private_details enable row level security;
alter table public.business_members enable row level security;
alter table public.business_verification_documents enable row level security;
alter table public.business_verification_events enable row level security;
alter table public.listing_categories enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.listing_moderation_events enable row level security;

revoke all on
  public.businesses, public.business_private_details, public.business_members,
  public.business_verification_documents, public.business_verification_events,
  public.listing_categories, public.listings, public.listing_images,
  public.listing_moderation_events
from anon, authenticated;

-- Businesses: public sees verified businesses; members and verifiers see their own.
-- New businesses are created only through public.create_business().
grant select on public.businesses to anon, authenticated;
grant update (name, description, area, website, logo_path) on public.businesses to authenticated;

create policy "Businesses: public read verified, members and verifiers read all"
  on public.businesses for select to anon, authenticated
  using (
    verification_status = 'verified'
    or private.is_business_member(id)
    or private.has_permission('businesses.verify')
  );

create policy "Businesses: members update profile fields"
  on public.businesses for update to authenticated
  using (private.is_business_member(id))
  with check (private.is_business_member(id));

-- Private details
grant select on public.business_private_details to authenticated;
grant update (legal_name, registration_number, gst_number, contact_email, contact_phone, registered_address)
  on public.business_private_details to authenticated;

create policy "Business private details: members and verifiers read"
  on public.business_private_details for select to authenticated
  using (private.is_business_member(business_id) or private.has_permission('businesses.verify'));

create policy "Business private details: owners update"
  on public.business_private_details for update to authenticated
  using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));

-- Members
grant select on public.business_members to authenticated;

create policy "Business members: read own business teams"
  on public.business_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_business_member(business_id)
    or private.has_permission('businesses.verify')
  );

-- Verification documents (private)
grant select, delete on public.business_verification_documents to authenticated;
grant insert (business_id, document_type, storage_path) on public.business_verification_documents to authenticated;

create policy "Verification documents: members and verifiers read"
  on public.business_verification_documents for select to authenticated
  using (private.is_business_member(business_id) or private.has_permission('businesses.verify'));

create policy "Verification documents: owners upload"
  on public.business_verification_documents for insert to authenticated
  with check (private.is_business_owner(business_id) and uploaded_by = (select auth.uid()));

create policy "Verification documents: owners delete pending"
  on public.business_verification_documents for delete to authenticated
  using (private.is_business_owner(business_id) and review_status = 'pending');

-- Verification history
grant select on public.business_verification_events to authenticated;

create policy "Verification events: members and verifiers read"
  on public.business_verification_events for select to authenticated
  using (private.is_business_member(business_id) or private.has_permission('businesses.verify'));

-- Categories
grant select on public.listing_categories to anon, authenticated;
grant insert, update, delete on public.listing_categories to authenticated;

create policy "Categories: public read active"
  on public.listing_categories for select to anon, authenticated
  using (is_active or private.has_permission('categories.manage'));

create policy "Categories: managers insert"
  on public.listing_categories for insert to authenticated
  with check (private.has_permission('categories.manage'));

create policy "Categories: managers update"
  on public.listing_categories for update to authenticated
  using (private.has_permission('categories.manage'))
  with check (private.has_permission('categories.manage'));

create policy "Categories: managers delete"
  on public.listing_categories for delete to authenticated
  using (private.has_permission('categories.manage'));

-- Listings
grant select on public.listings to anon, authenticated;
grant insert (business_id, category_id, title, slug, summary, description, area, address,
              latitude, longitude, price_band, contact_phone, contact_email, website)
  on public.listings to authenticated;
grant update (category_id, title, slug, summary, description, area, address,
              latitude, longitude, price_band, contact_phone, contact_email, website)
  on public.listings to authenticated;
grant delete on public.listings to authenticated;

create policy "Listings: public read published, members and moderators read all"
  on public.listings for select to anon, authenticated
  using (
    (
      status = 'published'
      and (
        business_id is null
        or exists (
          select 1 from public.businesses b
          where b.id = listings.business_id and b.verification_status = 'verified'
        )
      )
    )
    or private.is_business_member(business_id)
    or private.has_permission('listings.moderate')
  );

create policy "Listings: members create drafts"
  on public.listings for insert to authenticated
  with check (private.is_business_member(business_id) and created_by = (select auth.uid()));

create policy "Listings: members edit"
  on public.listings for update to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));

create policy "Listings: members delete drafts"
  on public.listings for delete to authenticated
  using (private.is_business_member(business_id) and status = 'draft');

-- Listing images
grant select on public.listing_images to anon, authenticated;
grant insert (listing_id, storage_path, alt_text, sort_order, is_cover) on public.listing_images to authenticated;
grant update (alt_text, sort_order, is_cover) on public.listing_images to authenticated;
grant delete on public.listing_images to authenticated;

create policy "Listing images: visible with their listing"
  on public.listing_images for select to anon, authenticated
  using (
    private.listing_is_public(listing_id)
    or private.can_manage_listing(listing_id)
    or private.has_permission('listings.moderate')
  );

create policy "Listing images: members insert"
  on public.listing_images for insert to authenticated
  with check (private.can_manage_listing(listing_id));

create policy "Listing images: members update"
  on public.listing_images for update to authenticated
  using (private.can_manage_listing(listing_id))
  with check (private.can_manage_listing(listing_id));

create policy "Listing images: members delete"
  on public.listing_images for delete to authenticated
  using (private.can_manage_listing(listing_id));

-- Moderation history
grant select on public.listing_moderation_events to authenticated;

create policy "Moderation events: members and moderators read"
  on public.listing_moderation_events for select to authenticated
  using (private.can_manage_listing(listing_id) or private.has_permission('listings.moderate'));

revoke all on function
  private.uuid_or_null(text),
  private.is_business_member(uuid),
  private.is_business_owner(uuid),
  private.can_manage_listing(uuid),
  private.listing_is_public(uuid),
  private.listings_require_review_on_edit()
from public;
grant execute on function
  private.uuid_or_null(text),
  private.is_business_member(uuid),
  private.is_business_owner(uuid),
  private.can_manage_listing(uuid),
  private.listing_is_public(uuid)
to anon, authenticated;
