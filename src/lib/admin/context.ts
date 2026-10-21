import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole, type Access } from '../auth/session';
import { createClient } from '../supabase/server';
import { ADMIN_PERMISSION_KEYS, permissionLabel, type AdminPermission } from './constants';

export type StaffContext = {
  access: Access;
  supabase: Awaited<ReturnType<typeof createClient>>;
  isSuper: boolean;
  permissions: AdminPermission[];
  can: (permission: AdminPermission) => boolean;
};

/**
 * Authorisation boundary for the Admin Panel. Re-reads the role and the
 * explicit permissions from the database on every request. The database
 * functions check the same permissions again, so this is defence in depth,
 * not the only gate.
 */
export const getStaffContext = cache(async (): Promise<StaffContext> => {
  const access = await requireRole(['admin', 'super_admin'], '/admin/');
  const supabase = await createClient();
  const isSuper = access.roles.includes('super_admin');

  let permissions: AdminPermission[] = ADMIN_PERMISSION_KEYS;
  if (!isSuper) {
    const { data } = await supabase.from('admin_permissions').select('permission').eq('user_id', access.user.id);
    permissions = (data ?? []).map(row => row.permission as AdminPermission);
  }
  return { access, supabase, isSuper, permissions, can: p => isSuper || permissions.includes(p) };
});

/** Page/action guard for a single permission. */
export async function requirePermission(permission: AdminPermission): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx.can(permission)) {
    redirect(`/admin/?error=${encodeURIComponent(`Your account does not have the "${permissionLabel(permission)}" permission.`)}`);
  }
  return ctx;
}

export type SuperContext = { access: Access; supabase: Awaited<ReturnType<typeof createClient>> };

/** Super Admin Panel boundary. The database functions require super_admin too. */
export const getSuperContext = cache(async (): Promise<SuperContext> => {
  const access = await requireRole(['super_admin'], '/superadmin/');
  return { access, supabase: await createClient() };
});

/** Public pages are statically cached; refresh them after moderation or content changes. */
export function revalidatePublic() {
  revalidatePath('/', 'layout');
}
