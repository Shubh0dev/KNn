'use server';

import { requirePermission } from '@/lib/admin/context';
import { friendlyDbError, isUuid } from '@/lib/business/state';

export type RevealState = { error?: string; contact?: { name: string; phone: string | null; email: string } } | undefined;

/**
 * Shows a visitor's contact details to staff for a support case. The database
 * requires enquiries.view and a reason, and writes the reveal to the audit log.
 * The details are returned to this page only; they never go into a URL.
 */
export async function revealContact(_prev: RevealState, formData: FormData): Promise<RevealState> {
  const { supabase } = await requirePermission('enquiries.view');
  const id = formData.get('enquiryId');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!isUuid(id)) return { error: 'Enquiry not found.' };
  if (reason.length < 10) return { error: 'Give a reason of at least 10 characters. It is recorded in the audit log.' };
  const { data, error } = await supabase.rpc('admin_reveal_enquiry_contact', { p_enquiry_id: id, p_reason: reason.slice(0, 500) });
  if (error || !data) return { error: friendlyDbError(error, 'The contact details could not be shown.') };
  return { contact: data as { name: string; phone: string | null; email: string } };
}
