-- Customer enquiries, favourites, itineraries and listing engagement events.

create type public.enquiry_status as enum ('new', 'read', 'replied', 'closed', 'spam');
create type public.engagement_event_type as enum ('view', 'contact_click', 'website_click', 'direction_click', 'share', 'favourite');

-- ---------------------------------------------------------------------------
-- Enquiries (private between sender, the business and authorised staff)
-- ---------------------------------------------------------------------------
create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade, -- copied from listing by trigger
  sender_id uuid default auth.uid() references auth.users (id) on delete set null,
  sender_name text not null check (char_length(sender_name) between 1 and 120),
  sender_email text not null check (sender_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(sender_email) <= 254),
  sender_phone text check (sender_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  message text not null check (char_length(message) between 10 and 2000),
  status public.enquiry_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index enquiries_business_idx on public.enquiries (business_id, created_at desc);
create index enquiries_listing_idx on public.enquiries (listing_id);
create index enquiries_sender_idx on public.enquiries (sender_id);

create function private.enquiries_set_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select l.business_id into new.business_id from public.listings l where l.id = new.listing_id;
  return new;
end;
$$;

create trigger enquiries_set_business
  before insert on public.enquiries
  for each row execute function private.enquiries_set_business();

create trigger enquiries_set_updated_at
  before update on public.enquiries
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Favourites and itineraries (owner-only)
-- ---------------------------------------------------------------------------
create table public.favourites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index favourites_listing_idx on public.favourites (listing_id);

create table public.itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  notes text check (char_length(notes) <= 4000),
  start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index itineraries_user_idx on public.itineraries (user_id);

create trigger itineraries_set_updated_at
  before update on public.itineraries
  for each row execute function private.set_updated_at();

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  day_number smallint not null default 1 check (day_number between 1 and 60),
  position smallint not null default 0,
  title text not null check (char_length(title) between 1 and 140),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index itinerary_items_itinerary_idx on public.itinerary_items (itinerary_id, day_number, position);
create index itinerary_items_listing_idx on public.itinerary_items (listing_id);

create function private.owns_itinerary(_itinerary_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.itineraries i
    where i.id = _itinerary_id and i.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Engagement events (written only through public.track_listing_event)
-- ---------------------------------------------------------------------------
create table public.listing_engagement_events (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  event_type public.engagement_event_type not null,
  user_id uuid references auth.users (id) on delete set null,
  session_id text check (char_length(session_id) <= 64),
  created_at timestamptz not null default now()
);

create index listing_engagement_events_listing_idx
  on public.listing_engagement_events (listing_id, created_at desc);
create index listing_engagement_events_dedupe_idx
  on public.listing_engagement_events (listing_id, session_id, event_type, created_at desc);
create index listing_engagement_events_user_idx on public.listing_engagement_events (user_id);

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------
alter table public.enquiries enable row level security;
alter table public.favourites enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.listing_engagement_events enable row level security;

revoke all on
  public.enquiries, public.favourites, public.itineraries,
  public.itinerary_items, public.listing_engagement_events
from anon, authenticated;

-- Enquiries: signed-in senders only in Part 1 (anonymous enquiries need
-- server-side rate limiting / captcha first).
grant select on public.enquiries to authenticated;
grant insert (listing_id, sender_name, sender_email, sender_phone, message) on public.enquiries to authenticated;
grant update (status) on public.enquiries to authenticated;

create policy "Enquiries: sender, business and authorised staff read"
  on public.enquiries for select to authenticated
  using (
    sender_id = (select auth.uid())
    or private.is_business_member(business_id)
    or private.has_permission('enquiries.view')
  );

create policy "Enquiries: active users send to public listings"
  on public.enquiries for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.is_active_user()
    and private.listing_is_public(listing_id)
  );

create policy "Enquiries: business members update status"
  on public.enquiries for update to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));

-- Favourites
grant select, delete on public.favourites to authenticated;
grant insert (listing_id) on public.favourites to authenticated;

create policy "Favourites: read own"
  on public.favourites for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Favourites: add public listings"
  on public.favourites for insert to authenticated
  with check (user_id = (select auth.uid()) and private.listing_is_public(listing_id));

create policy "Favourites: remove own"
  on public.favourites for delete to authenticated
  using (user_id = (select auth.uid()));

-- Itineraries
grant select, delete on public.itineraries to authenticated;
grant insert (title, notes, start_date), update (title, notes, start_date) on public.itineraries to authenticated;

create policy "Itineraries: read own"
  on public.itineraries for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Itineraries: create own"
  on public.itineraries for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Itineraries: update own"
  on public.itineraries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Itineraries: delete own"
  on public.itineraries for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, delete on public.itinerary_items to authenticated;
grant insert (itinerary_id, listing_id, day_number, position, title, note),
      update (listing_id, day_number, position, title, note)
  on public.itinerary_items to authenticated;

create policy "Itinerary items: read own"
  on public.itinerary_items for select to authenticated
  using (private.owns_itinerary(itinerary_id));

create policy "Itinerary items: create own"
  on public.itinerary_items for insert to authenticated
  with check (
    private.owns_itinerary(itinerary_id)
    and (listing_id is null or private.listing_is_public(listing_id))
  );

create policy "Itinerary items: update own"
  on public.itinerary_items for update to authenticated
  using (private.owns_itinerary(itinerary_id))
  with check (
    private.owns_itinerary(itinerary_id)
    and (listing_id is null or private.listing_is_public(listing_id))
  );

create policy "Itinerary items: delete own"
  on public.itinerary_items for delete to authenticated
  using (private.owns_itinerary(itinerary_id));

-- Engagement: businesses see events for their own listings; moderators see all.
-- user_id and session_id are not granted, so viewers stay anonymous to businesses.
grant select (id, listing_id, event_type, created_at) on public.listing_engagement_events to authenticated;

create policy "Engagement events: business members and moderators read"
  on public.listing_engagement_events for select to authenticated
  using (private.can_manage_listing(listing_id) or private.has_permission('listings.moderate'));

revoke all on function private.enquiries_set_business(), private.owns_itinerary(uuid) from public;
grant execute on function private.owns_itinerary(uuid) to authenticated;
