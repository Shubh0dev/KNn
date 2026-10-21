'use server';

import { requireSignedIn } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { REPORT_REASONS } from '@/lib/admin/constants';
import { friendlyDbError, isUuid, type ActionState } from '@/lib/business/state';

export async function reportListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  await requireSignedIn(`/listings/${slug}/report/`);
  const listingId = formData.get('listingId');
  const reason = String(formData.get('reason') ?? '');
  const details = String(formData.get('details') ?? '').trim().slice(0, 1000);
  if (!isUuid(listingId) || !REPORT_REASONS[reason]) return { error: 'Choose what is wrong with this listing.' };
  if (reason === 'other' && details.length < 10) return { error: 'Please describe the problem (at least 10 characters).' };

  const supabase = await createClient();
  // RLS: only active, signed-in users, only for public listings; a trigger applies the daily limit.
  const { error } = await supabase.from('content_reports').insert({ listing_id: listingId, reason, details: details || null });
  if (error) {
    if (error.code === '23505') return { error: 'You already have an open report about this listing. Our team will review it.' };
    return { error: friendlyDbError(error, 'Your report could not be sent. Please try again.') };
  }
  return { message: 'Thank you. Your report was sent to the KashiNagri team, who will review it.' };
}
