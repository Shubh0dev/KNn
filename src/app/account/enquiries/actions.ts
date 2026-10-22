'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireSignedIn } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { friendlyDbError, isUuid } from '@/lib/business/state';

export async function cancelEnquiry(formData: FormData) {
  const id = formData.get('enquiryId');
  if (!isUuid(id)) redirect('/account/enquiries/?error=That%20request%20was%20not%20found.');
  await requireSignedIn(`/account/enquiries/${id}/`);
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500);

  const supabase = await createClient();
  // The database checks that this is the caller's own request and that it can still be cancelled.
  const { error } = await supabase.rpc('cancel_my_enquiry', { p_enquiry_id: id, p_reason: reason || undefined });
  revalidatePath('/account', 'layout');
  if (error) redirect(`/account/enquiries/${id}/?error=${encodeURIComponent(friendlyDbError(error, 'The request could not be cancelled. Please try again.'))}`);
  redirect(`/account/enquiries/${id}/?notice=enquiry-cancelled`);
}
