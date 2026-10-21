'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSuperContext } from '@/lib/admin/context';
import { ADMIN_PERMISSION_KEYS, type AdminPermission } from '@/lib/admin/constants';
import { friendlyDbError, isUuid } from '@/lib/business/state';

const go = (key: 'notice' | 'error', value: string) => redirect(`/superadmin/admins/?${key}=${encodeURIComponent(value)}`);
const readPermissions = (formData: FormData) =>
  formData.getAll('permissions').map(String).filter((p): p is AdminPermission => (ADMIN_PERMISSION_KEYS as string[]).includes(p));

/** Provision an admin: the person must already have a confirmed account (they prove they own the email). */
export async function grantAdmin(formData: FormData) {
  const { supabase } = await getSuperContext();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) go('error', 'Enter the email of an existing account.');

  const { data: matches } = await supabase.rpc('superadmin_list_users', { p_search: email, p_limit: 10, p_offset: 0 });
  const target = ((matches ?? []) as { id: string; email: string | null }[]).find(u => u.email?.toLowerCase() === email);
  if (!target) go('error', 'No account uses that email. Ask the person to register and confirm their email first.');

  const { error } = await supabase.rpc('superadmin_grant_admin', { p_user_id: target!.id, p_permissions: readPermissions(formData) });
  revalidatePath('/superadmin', 'layout');
  if (error) go('error', friendlyDbError(error, 'Admin access could not be granted.'));
  go('notice', 'admin-granted');
}

export async function savePermissions(formData: FormData) {
  const { supabase } = await getSuperContext();
  const userId = String(formData.get('userId') ?? '');
  if (!isUuid(userId)) go('error', 'Invalid request.');
  const wanted = new Set(readPermissions(formData));

  const { data: current } = await supabase.from('admin_permissions').select('permission').eq('user_id', userId);
  const have = new Set((current ?? []).map(r => r.permission as string));
  const changes = [
    ...[...wanted].filter(p => !have.has(p)).map(p => ({ p, grant: true })),
    ...[...have].filter(p => !wanted.has(p as AdminPermission)).map(p => ({ p, grant: false })),
  ];
  for (const change of changes) {
    const { error } = await supabase.rpc('superadmin_set_admin_permission', { p_user_id: userId, p_permission: change.p, p_grant: change.grant });
    if (error) go('error', friendlyDbError(error, 'Permissions could not be fully saved. Please review and try again.'));
  }
  revalidatePath('/superadmin', 'layout');
  go('notice', 'permissions-saved');
}

export async function revokeAdmin(formData: FormData) {
  const { supabase } = await getSuperContext();
  const userId = String(formData.get('userId') ?? '');
  if (!isUuid(userId)) go('error', 'Invalid request.');
  const { error } = await supabase.rpc('superadmin_set_admin_role', { p_user_id: userId, p_grant: false });
  revalidatePath('/superadmin', 'layout');
  if (error) go('error', friendlyDbError(error, 'Admin access could not be removed.'));
  go('notice', 'admin-revoked');
}
