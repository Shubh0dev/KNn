'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission, revalidatePublic } from '@/lib/admin/context';
import { friendlyDbError, isUuid } from '@/lib/business/state';

const back = (businessId: string, key: 'notice' | 'error', value: string) =>
  redirect(`/admin/verifications/${businessId}/?${key}=${encodeURIComponent(value)}`);

export async function reviewDocument(formData: FormData) {
  const { supabase } = await requirePermission('businesses.verify');
  const businessId = String(formData.get('businessId') ?? '');
  const documentId = formData.get('documentId');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000);
  if (!isUuid(businessId) || !isUuid(documentId) || !['accepted', 'rejected'].includes(decision)) redirect('/admin/verifications/?error=Invalid%20request');

  const { error } = await supabase.rpc('admin_review_verification_document', { p_document_id: documentId, p_status: decision, p_note: note || undefined });
  revalidatePath('/admin', 'layout');
  if (error) back(businessId, 'error', friendlyDbError(error, 'The document review could not be saved.'));
  back(businessId, 'notice', 'document-reviewed');
}

export async function decideVerification(formData: FormData) {
  const { supabase } = await requirePermission('businesses.verify');
  const businessId = String(formData.get('businessId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000);
  if (!isUuid(businessId) || !['verified', 'changes_requested', 'rejected', 'suspended'].includes(decision)) redirect('/admin/verifications/?error=Invalid%20request');

  const { error } = await supabase.rpc('admin_set_business_verification', { p_business_id: businessId, p_status: decision, p_note: note || undefined });
  revalidatePath('/admin', 'layout');
  revalidatePublic(); // verification controls whether the business's listings can be public
  if (error) back(businessId, 'error', friendlyDbError(error, 'The decision could not be saved.'));
  back(businessId, 'notice', 'decision-saved');
}
