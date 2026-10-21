'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getBusinessContext } from '@/lib/business/context';
import { DOCUMENT_TYPES } from '@/lib/business/constants';
import { friendlyDbError, isUuid } from '@/lib/business/state';
import { DOCUMENT_MIME, sniffMime } from '@/lib/files';

type Result = { ok: true } | { ok: false; error: string };
const go = (key: 'notice' | 'error', value: string) => redirect(`/business/verification/?${key}=${encodeURIComponent(value)}`);

/** Records a document the browser has already uploaded to the private bucket. */
export async function addVerificationDocument(input: { documentType: string; path: string }): Promise<Result> {
  const { supabase, active } = await getBusinessContext();
  if (active.member_role !== 'owner') return { ok: false, error: 'Only the business owner can upload verification documents.' };
  if (active.verification_status === 'verified') return { ok: false, error: 'This business is already verified.' };
  if (!DOCUMENT_TYPES.some(t => t.value === input.documentType)) return { ok: false, error: 'Choose a document type.' };

  const path = String(input.path ?? '');
  if (!path.startsWith(`${active.id}/`) || path.includes('..') || !/\.(pdf|jpe?g|png)$/i.test(path)) {
    return { ok: false, error: 'Invalid document path.' };
  }
  // Server-side content check (the browser check can be bypassed).
  const { data: blob } = await supabase.storage.from('verification-documents').download(path);
  if (!blob) return { ok: false, error: 'The uploaded file could not be found. Please try again.' };
  const mime = sniffMime(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
  if (!mime || !DOCUMENT_MIME.includes(mime)) {
    await supabase.storage.from('verification-documents').remove([path]);
    return { ok: false, error: 'Only PDF, JPEG or PNG files are accepted.' };
  }

  const { error } = await supabase.from('business_verification_documents').insert({
    business_id: active.id,
    document_type: input.documentType,
    storage_path: path,
  });
  if (error) {
    await supabase.storage.from('verification-documents').remove([path]);
    return { ok: false, error: friendlyDbError(error, 'The document could not be saved.') };
  }
  revalidatePath('/business', 'layout');
  return { ok: true };
}

export async function removeVerificationDocument(formData: FormData) {
  const { supabase, active } = await getBusinessContext();
  const id = formData.get('documentId');
  if (!isUuid(id)) go('error', 'Document not found.');

  const { data: doc } = await supabase
    .from('business_verification_documents')
    .select('id, storage_path, review_status')
    .eq('id', id)
    .eq('business_id', active.id)
    .maybeSingle();
  if (!doc) go('error', 'Document not found.');
  if (doc!.review_status !== 'pending') go('error', 'Reviewed documents cannot be removed.');

  const { data: removed, error } = await supabase
    .from('business_verification_documents')
    .delete()
    .eq('id', doc!.id)
    .eq('review_status', 'pending')
    .select('id');
  if (error || !removed?.length) go('error', 'The document could not be removed.');

  await supabase.storage.from('verification-documents').remove([doc!.storage_path]);
  revalidatePath('/business', 'layout');
  go('notice', 'document-removed');
}

export async function requestVerification() {
  const { supabase, active } = await getBusinessContext();
  const { error } = await supabase.rpc('request_business_verification', { p_business_id: active.id });
  revalidatePath('/business', 'layout');
  if (error) go('error', friendlyDbError(error, 'Verification could not be requested.'));
  go('notice', 'verification-requested');
}
