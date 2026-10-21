-- KashiNagri foundation: enums, profiles, roles, admin permissions, audit log.
--
-- Authorization model
--   * Roles live in public.user_roles, never in profiles or JWT metadata.
--   * Authenticated clients have SELECT only on role/permission tables; every
--     write goes through SECURITY DEFINER functions that check the caller.
--   * Helper functions live in the `private` schema, which is not exposed by
--     the Data API, so they can be used in policies but not called over REST.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('visitor', 'business_owner', 'admin', 'super_admin');
create type public.account_status as enum ('active', 'suspended', 'deactivated');
create type public.admin_permission as enum (
  'users.view',
  'users.manage',
  'businesses.verify',
  'listings.moderate',
  'categories.manage',
  'enquiries.view',
  'payments.view',
  'audit.view'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (user-editable fields only; status is admin-controlled)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (char_length(full_name) <= 120),
  avatar_path text check (char_length(avatar_path) <= 300),
  phone text check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'hi')),
  account_status public.account_status not null default 'active',
  status_reason text check (char_length(status_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (lower(email));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Roles and admin permissions (server-controlled)
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role);

create table public.admin_permissions (
  user_id uuid not null references auth.users (id) on delete cascade,
  permission public.admin_permission not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, permission)
);

-- A super_admin can never be created from an API request made with a user
-- session (auth.uid() is set). The first super admin is bootstrapped from the
-- SQL editor, where auth.uid() is null. See supabase/bootstrap/.
create function private.guard_super_admin_grant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'super_admin' and auth.uid() is not null then
    raise exception 'super_admin can only be assigned by a trusted database operator'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger user_roles_guard_super_admin
  before insert or update on public.user_roles
  for each row execute function private.guard_super_admin_grant();

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid, -- no FK: entries must outlive deleted accounts
  action text not null check (char_length(action) between 1 and 100),
  entity_type text not null check (char_length(entity_type) between 1 and 60),
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

create function private.audit_logs_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function private.audit_logs_append_only();

create function private.write_audit(
  _action text,
  _entity_type text,
  _entity_id text,
  _details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), _action, _entity_type, _entity_id, coalesce(_details, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------
create function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_status = 'active'
  );
$$;

create function private.has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = (select auth.uid())
      and r.role = _role
      and p.account_status = 'active'
  );
$$;

create function private.has_permission(_permission public.admin_permission)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('super_admin')
    or (
      private.has_role('admin')
      and exists (
        select 1 from public.admin_permissions ap
        where ap.user_id = (select auth.uid()) and ap.permission = _permission
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- New-user provisioning: profile + baseline visitor role
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 120), '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'visitor');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.profiles, public.user_roles, public.admin_permissions, public.audit_logs
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, avatar_path, phone, preferred_language) on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.admin_permissions to authenticated;
grant select on public.audit_logs to authenticated;

create policy "Profiles: read own or with users.view"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.has_permission('users.view'));

create policy "Profiles: active users update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and private.is_active_user())
  with check (id = (select auth.uid()));

create policy "Roles: read own or with users.view"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.has_permission('users.view'));

create policy "Admin permissions: read own or super admin"
  on public.admin_permissions for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('super_admin'));

create policy "Audit logs: read with audit.view"
  on public.audit_logs for select to authenticated
  using (private.has_permission('audit.view'));

-- Function privileges: helpers are callable from policies only.
revoke all on all functions in schema private from public;
grant execute on function
  private.is_active_user(),
  private.has_role(public.app_role),
  private.has_permission(public.admin_permission)
  to anon, authenticated;
