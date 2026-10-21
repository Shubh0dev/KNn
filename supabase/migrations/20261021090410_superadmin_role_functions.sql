-- Super-admin-only RPCs for granting and revoking the admin role and admin
-- permissions. Kept in a separate migration because the revoke branches
-- contain DELETE statements (they run only when a super admin revokes access;
-- applying this migration deletes nothing).
--
-- super_admin itself can never be granted here: see the
-- user_roles_guard_super_admin trigger and supabase/bootstrap/.

create function public.superadmin_set_admin_role(p_user_id uuid, p_grant boolean)
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

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  if p_grant then
    insert into public.user_roles (user_id, role, granted_by)
    values (p_user_id, 'admin', (select auth.uid()))
    on conflict (user_id, role) do nothing;
  else
    delete from public.admin_permissions where user_id = p_user_id;
    delete from public.user_roles where user_id = p_user_id and role = 'admin';
  end if;

  perform private.write_audit(case when p_grant then 'role.admin_granted' else 'role.admin_revoked' end,
                              'user', p_user_id::text);
end;
$$;

create function public.superadmin_set_admin_permission(
  p_user_id uuid,
  p_permission public.admin_permission,
  p_grant boolean
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

  if not exists (select 1 from public.user_roles where user_id = p_user_id and role = 'admin') then
    raise exception 'Permissions can only be granted to admins' using errcode = 'P0001';
  end if;

  if p_grant then
    insert into public.admin_permissions (user_id, permission, granted_by)
    values (p_user_id, p_permission, (select auth.uid()))
    on conflict (user_id, permission) do nothing;
  else
    delete from public.admin_permissions where user_id = p_user_id and permission = p_permission;
  end if;

  perform private.write_audit(case when p_grant then 'permission.granted' else 'permission.revoked' end,
                              'user', p_user_id::text, jsonb_build_object('permission', p_permission));
end;
$$;

revoke all on function
  public.superadmin_set_admin_role(uuid, boolean),
  public.superadmin_set_admin_permission(uuid, public.admin_permission, boolean)
from public, anon, authenticated;

grant execute on function
  public.superadmin_set_admin_role(uuid, boolean),
  public.superadmin_set_admin_permission(uuid, public.admin_permission, boolean)
to authenticated;
