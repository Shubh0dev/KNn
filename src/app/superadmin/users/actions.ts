'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSuperContext, revalidatePublic } from '@/lib/admin/context';
import { friendlyDbError, isUuid } from '@/lib/business/state';

const back = (userId: string, key: 'notice' | 'error', value: string) =>
  redirect(`/superadmin/users/${userId}/?${key}=${encodeURIComponent(value)}`);

export async function setAccountStatus(formData: FormData) {
  const { supabase } = await getSuperContext();
  const userId = String(formData.get('userId') ?? '');
  const status = String(formData.get('status') ?? '');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500);
  if (!isUuid(userId) || !['active', 'suspended'].includes(status)) redirect('/superadmin/users/?error=Invalid%20request');
  if (status === 'suspended' && reason.length < 5) back(userId, 'error', 'Give a reason (at least 5 characters) for the suspension.');

  const { error } = await supabase.rpc('admin_set_account_status', { p_user_id: userId, p_status: status, p_reason: reason || undefined });
  revalidatePath('/superadmin', 'layout');
  revalidatePublic(); // a suspended owner's listings stop being manageable
  if (error) back(userId, 'error', friendlyDbError(error, 'The account status could not be changed.'));
  back(userId, 'notice', 'account-updated');
}

export async function addBusinessMember(formData: FormData) {
  const { supabase } = await getSuperContext();
  const userId = String(formData.get('userId') ?? '');
  const slug = String(formData.get('businessSlug') ?? '').trim().toLowerCase();
  const role = String(formData.get('memberRole') ?? '');
  if (!isUuid(userId) || !['owner', 'manager'].includes(role) || !/^[a-z0-9-]{2,80}$/.test(slug)) back(userId, 'error', 'Enter a valid business web address and role.');

  const { data: business } = await supabase.from('businesses').select('id').eq('slug', slug).maybeSingle();
  if (!business) back(userId, 'error', 'No business has that web address.');
  const { error } = await supabase.rpc('superadmin_add_business_member', { p_business_id: business!.id, p_user_id: userId, p_member_role: role });
  revalidatePath('/superadmin', 'layout');
  if (error) back(userId, 'error', friendlyDbError(error, 'Business access could not be assigned.'));
  back(userId, 'notice', 'member-added');
}
