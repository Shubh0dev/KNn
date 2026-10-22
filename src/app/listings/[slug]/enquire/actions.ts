'use server';

import { getAccess } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { friendlyDbError, isUuid } from '@/lib/business/state';
import { getPublicListing } from '@/lib/public/listings';
import { enquiryKind, validateEnquiry, type EnquiryKind } from '@/lib/enquiries/rules';

export type EnquiryState =
  | { error?: string; fieldErrors?: Record<string, string>; needsSignIn?: boolean; sent?: undefined }
  | { sent: { id: string; reference: string; businessName: string; phone: string | null; slug: string; title: string; kind: EnquiryKind } }
  | undefined;

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

export async function sendEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const access = await getAccess();
  if (!access) return { error: 'Please sign in to send your request. Your details are kept on this device.', needsSignIn: true };
  if (access.profile?.account_status !== 'active') return { error: 'Your account is not active, so it cannot send requests. Please contact KashiNagri support.' };

  const slug = field(formData, 'slug');
  const listing = await getPublicListing(slug);
  if (!listing || listing.id !== field(formData, 'listingId') || !listing.businessName) return { error: 'This listing is no longer available.' };

  // The request type comes from the listing, not the browser; a general question is always allowed.
  const offered = enquiryKind(listing.categorySlug, listing.enquiryMode);
  if (offered === 'none') return { error: 'This business takes requests by phone or email only.' };
  const kind: EnquiryKind = field(formData, 'kind') === 'general' ? 'general' : offered;

  const checked = validateEnquiry({
    kind, name: field(formData, 'name'), phone: field(formData, 'phone'), email: field(formData, 'email'), message: field(formData, 'message'),
    checkIn: field(formData, 'checkIn'), checkOut: field(formData, 'checkOut'), date: field(formData, 'date'), time: field(formData, 'time'),
    guests: field(formData, 'guests'), rooms: field(formData, 'rooms'), experience: field(formData, 'experience'),
  });
  if (!checked.ok) return { error: Object.values(checked.fieldErrors)[0], fieldErrors: checked.fieldErrors };

  const token = field(formData, 'clientToken');
  const clientToken = isUuid(token) ? token : null;
  const supabase = await createClient();
  const success = (row: { id: string; reference: string }): EnquiryState => ({
    sent: { id: row.id, reference: row.reference, businessName: listing.businessName!, phone: listing.publicPhone, slug: listing.slug, title: listing.title, kind },
  });
  const existing = async () => clientToken
    ? (await supabase.from('enquiries').select('id, reference').eq('sender_id', access.user.id).eq('client_token', clientToken).maybeSingle()).data
    : null;

  // A repeated submit of the same form (e.g. after a network retry) returns the original request.
  const before = await existing();
  if (before) return success(before);

  // RLS: only active signed-in users, only for public listings. The database
  // re-validates every field, sets the status to New and rejects duplicates.
  const { data, error } = await supabase.from('enquiries').insert({
    listing_id: listing.id, client_token: clientToken, contact_whatsapp: formData.get('contactWhatsapp') === 'on', ...checked.values,
  }).select('id, reference').single();
  if (error?.code === '23505') {
    const again = await existing();
    if (again) return success(again);
  }
  if (error || !data) return { error: friendlyDbError(error, 'Your request could not be sent. Nothing was saved; please try again.') };
  return success(data);
}
