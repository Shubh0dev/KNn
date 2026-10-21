-- Assign the FIRST KashiNagri super admin.
--
-- This is NOT a migration and must never be exposed through the app.
-- Run it once, by hand, in Supabase Dashboard -> SQL Editor (which runs as the
-- `postgres` database owner). It cannot be run through the Data API: the
-- user_roles_guard_super_admin trigger rejects super_admin grants made with a
-- user session.
--
-- Steps
--   1. Register your own account on the site (/register) and confirm the email.
--   2. Replace the email below with that exact address.
--   3. Run this script. It refuses to run if a super admin already exists, or
--      if the account is unconfirmed.
--   4. Sign out and sign back in; you will be redirected to /superadmin.

do $$
declare
  v_email constant text := 'REPLACE_WITH_YOUR_CONFIRMED_EMAIL';
  v_user_id uuid;
begin
  if v_email = 'REPLACE_WITH_YOUR_CONFIRMED_EMAIL' then
    raise exception 'Edit v_email before running this script';
  end if;

  if exists (select 1 from public.user_roles where role = 'super_admin') then
    raise exception 'A super admin already exists. Additional super admins must be added deliberately by a database operator.';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
    and email_confirmed_at is not null;

  if v_user_id is null then
    raise exception 'No confirmed account found for %', v_email;
  end if;

  insert into public.user_roles (user_id, role) values (v_user_id, 'super_admin');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (null, 'bootstrap.super_admin', 'user', v_user_id::text,
          jsonb_build_object('method', 'sql_editor', 'email', v_email));

  raise notice 'Super admin assigned to % (%)', v_email, v_user_id;
end;
$$;
