-- Subscription plans, subscriptions and payments (future-compatible; no provider wired yet).
--
-- Clients can only read. Subscription and payment rows are written by a
-- trusted server process (e.g. a payment-provider webhook using the secret
-- key), never directly by a browser.

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$' and char_length(code) <= 40),
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 1000),
  price_amount integer not null check (price_amount >= 0), -- smallest currency unit (paise)
  currency char(3) not null default 'INR',
  billing_interval text not null check (billing_interval in ('month', 'year')),
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function private.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  plan_id uuid not null references public.subscription_plans (id) on delete restrict,
  status public.subscription_status not null,
  provider text check (char_length(provider) <= 40),
  provider_customer_id text check (char_length(provider_customer_id) <= 200),
  provider_subscription_id text unique check (char_length(provider_subscription_id) <= 200),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_business_idx on public.subscriptions (business_id);
create index subscriptions_plan_idx on public.subscriptions (plan_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  amount integer not null check (amount >= 0),
  currency char(3) not null default 'INR',
  status public.payment_status not null default 'pending',
  provider text check (char_length(provider) <= 40),
  provider_payment_id text unique check (char_length(provider_payment_id) <= 200),
  description text check (char_length(description) <= 300),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_business_idx on public.payments (business_id, created_at desc);
create index payments_subscription_idx on public.payments (subscription_id);

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

revoke all on public.subscription_plans, public.subscriptions, public.payments from anon, authenticated;

grant select on public.subscription_plans to anon, authenticated;
grant select on public.subscriptions, public.payments to authenticated;

create policy "Plans: public read active"
  on public.subscription_plans for select to anon, authenticated
  using (is_active or private.has_permission('payments.view'));

create policy "Subscriptions: business owners and finance staff read"
  on public.subscriptions for select to authenticated
  using (private.is_business_owner(business_id) or private.has_permission('payments.view'));

create policy "Payments: business owners and finance staff read"
  on public.payments for select to authenticated
  using (private.is_business_owner(business_id) or private.has_permission('payments.view'));
