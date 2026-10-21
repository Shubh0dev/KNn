'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireSignedIn } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ACTIVE_BUSINESS_COOKIE } from '@/lib/business/context';
import { friendlyDbError, type ActionState } from '@/lib/business/state';
import { parseBusinessProfile, parsePrivateDetails, parseSlug } from '@/lib/business/validation';

export async function createBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSignedIn('/business/onboarding/');

  const profile = parseBusinessProfile(formData);
  if (!profile.ok) return { error: profile.error, fieldErrors: profile.fieldErrors };
  const slug = parseSlug(String(formData.get('slug') ?? ''));
  if (!slug.ok) return { error: slug.error, fieldErrors: { slug: slug.error } };
  const details = parsePrivateDetails(formData);
  if (!details.ok) return { error: details.error, fieldErrors: details.fieldErrors };

  const supabase = await createClient();

  // The function re-checks the session, creates the business as `unverified`,
  // makes the caller its owner and grants the business_owner role.
  const { data: businessId, error } = await supabase.rpc('create_business', {
    p_name: profile.data.name,
    p_slug: slug.data,
    p_description: profile.data.description,
    p_area: profile.data.area,
  });
  if (error || !businessId) {
    if (error?.code === '23505') return { error: 'That web address is already taken. Try another.', fieldErrors: { slug: 'That web address is already taken.' } };
    if (error?.message?.includes('Business limit')) return { error: 'You have reached the limit of businesses for one account.' };
    return { error: friendlyDbError(error, 'We could not create your business. Please check the details and try again.') };
  }

  // Remaining profile details. Failure here is not fatal: the business exists.
  const p = profile.data;
  const d = details.data;
  const [extras, privateResult] = await Promise.all([
    supabase.from('businesses').update({
      business_type: p.business_type,
      address: p.address ?? null,
      website: p.website ?? null,
      public_phone: p.public_phone ?? null,
      public_email: p.public_email ?? null,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
    }).eq('id', businessId).select('id'),
    supabase.from('business_private_details').update({
      legal_name: d.legal_name ?? null,
      registration_number: d.registration_number ?? null,
      gst_number: d.gst_number ?? null,
    }).eq('business_id', businessId).select('business_id'),
  ]);

  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/business', maxAge: 60 * 60 * 24 * 365,
  });

  if (extras.error || privateResult.error) {
    redirect(`/business/settings/?error=${encodeURIComponent('Your business was created, but some details could not be saved. Please review them here.')}`);
  }
  redirect('/business/verification/?notice=business-created');
}
