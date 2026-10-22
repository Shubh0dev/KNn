'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getBusinessContext } from '@/lib/business/context';
import { ENQUIRY_STATUS, messageRequired } from '@/lib/enquiries/rules';
import { friendlyDbError, isUuid } from '@/lib/business/state';

const detail = (id: string, key: 'notice' | 'error', value: string) => `/business/enquiries/${id}/?${key}=${encodeURIComponent(value)}`;

/**
 * Called once the enquiry page has loaded: a New request becomes Seen (recorded in its
 * history) and its notifications are cleared. Returns whether anything changed so the
 * page can refresh its badge and status.
 */
export async function markEnquirySeen(enquiryId: string): Promise<{ changed: boolean }> {
  const { supabase, active, access } = await getBusinessContext();
  if (!isUuid(enquiryId)) return { changed: false };
  const { data } = await supabase.from('enquiries').select('status').eq('id', enquiryId).eq('business_id', active.id).maybeSingle();
  if (!data) return { changed: false };
  let changed = false;
  if (data.status === 'new') {
    const { error } = await supabase.rpc('business_update_enquiry', { p_enquiry_id: enquiryId, p_status: 'read' });
    changed = !error;
  }
  const { data: cleared } = await supabase.from('notifications').update({ read_at: new Date().toISOString() })
    .eq('user_id', access.user.id).eq('enquiry_id', enquiryId).is('read_at', null).select('id');
  changed ||= (cleared ?? []).length > 0;
  if (changed) revalidatePath('/business', 'layout');
  return { changed };
}

/**
 * Status change and/or message to the traveller. business_update_enquiry checks
 * membership of the enquiry's business and the allowed transitions again.
 */
export async function updateEnquiry(formData: FormData) {
  const { supabase, active } = await getBusinessContext();
  const id = formData.get('enquiryId');
  const status = String(formData.get('status') ?? '');
  const message = String(formData.get('message') ?? '').trim();
  if (!isUuid(id) || !(status in ENQUIRY_STATUS) || status === 'new') redirect('/business/enquiries/?error=That%20update%20is%20not%20valid.');
  if (message.length > 2000) redirect(detail(id, 'error', 'Keep the message under 2000 characters.'));
  if (messageRequired(status) && message.length < 5) redirect(detail(id, 'error', 'Add a short message for the traveller explaining the decision or the alternative.'));

  // The enquiry must belong to the business selected in the panel.
  const { data: own } = await supabase.from('enquiries').select('id').eq('id', id).eq('business_id', active.id).maybeSingle();
  if (!own) redirect('/business/enquiries/?error=That%20enquiry%20was%20not%20found.');

  const { error } = await supabase.rpc('business_update_enquiry', { p_enquiry_id: id, p_status: status as never, p_message: message || undefined });
  revalidatePath('/business', 'layout');
  if (error) redirect(detail(id, 'error', friendlyDbError(error, 'The enquiry could not be updated. Please try again.')));
  redirect(detail(id, 'notice', 'status-updated'));
}
