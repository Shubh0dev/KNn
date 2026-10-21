'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSuperContext, requirePermission, revalidatePublic } from '@/lib/admin/context';
import { LISTING_STATUS } from '@/lib/business/constants';
import { friendlyDbError, isUuid } from '@/lib/business/state';

const back = (id: string, key: 'notice' | 'error', value: string) =>
  redirect(`/admin/listings/${id}/?${key}=${encodeURIComponent(value)}`);

export async function moderateListing(formData: FormData) {
  const { supabase } = await requirePermission('listings.moderate');
  const id = String(formData.get('listingId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000);
  if (!isUuid(id) || !['published', 'changes_requested', 'rejected', 'suspended', 'archived'].includes(decision)) {
    redirect('/admin/listings/?error=Invalid%20request');
  }

  const { error } = await supabase.rpc('admin_moderate_listing', { p_listing_id: id, p_status: decision, p_note: note || undefined });
  revalidatePath('/admin', 'layout');
  revalidatePublic();
  if (error) back(id, 'error', friendlyDbError(error, 'The decision could not be saved.'));
  back(id, 'notice', 'decision-saved');
}

export async function overrideListing(formData: FormData) {
  const { supabase } = await getSuperContext();
  const id = String(formData.get('listingId') ?? '');
  const status = String(formData.get('status') ?? '');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 1000);
  if (!isUuid(id) || !LISTING_STATUS[status]) redirect('/admin/listings/?error=Invalid%20request');

  const { error } = await supabase.rpc('superadmin_override_listing', { p_listing_id: id, p_status: status, p_reason: reason });
  revalidatePath('/admin', 'layout');
  revalidatePublic();
  if (error) back(id, 'error', friendlyDbError(error, 'The override could not be applied.'));
  back(id, 'notice', 'override-saved');
}
