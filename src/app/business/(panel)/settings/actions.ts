'use server';

import { revalidatePath } from 'next/cache';
import { getBusinessContext } from '@/lib/business/context';
import { friendlyDbError, type ActionState } from '@/lib/business/state';
import { parseBusinessProfile, parseNotifications, parsePrivateDetails, parseProfile } from '@/lib/business/validation';

const saved = (): ActionState => {
  revalidatePath('/business', 'layout');
  return { message: 'Saved.' };
};

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getBusinessContext();
  const parsed = parseProfile(formData);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };

  // Only these columns are writable by the user; role and status are not.
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone ?? null, preferred_language: parsed.data.preferred_language })
    .eq('id', access.user.id)
    .select('id');
  if (error || !data?.length) return { error: friendlyDbError(error, 'We could not save your profile.') };
  return saved();
}

export async function updateNotifications(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getBusinessContext();
  const parsed = parseNotifications(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { data, error } = await supabase
    .from('profiles')
    .update({ notification_preferences: parsed.data })
    .eq('id', access.user.id)
    .select('id');
  if (error || !data?.length) return { error: friendlyDbError(error, 'We could not save your preferences.') };
  return saved();
}

export async function updateBusinessProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, active } = await getBusinessContext();
  const parsed = parseBusinessProfile(formData);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;

  const { data, error } = await supabase
    .from('businesses')
    .update({
      name: d.name,
      business_type: d.business_type,
      area: d.area ?? null,
      address: d.address ?? null,
      description: d.description ?? null,
      website: d.website ?? null,
      public_phone: d.public_phone ?? null,
      public_email: d.public_email ?? null,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
    })
    .eq('id', active.id)
    .select('id');
  if (error || !data?.length) return { error: friendlyDbError(error, 'We could not save your business profile.') };
  return saved();
}

export async function updatePrivateDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, active } = await getBusinessContext();
  if (active.member_role !== 'owner') return { error: 'Only the business owner can change these details.' };
  const parsed = parsePrivateDetails(formData);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;

  const { data, error } = await supabase
    .from('business_private_details')
    .update({
      legal_name: d.legal_name ?? null,
      registration_number: d.registration_number ?? null,
      gst_number: d.gst_number ?? null,
      contact_email: d.contact_email ?? null,
      contact_phone: d.contact_phone ?? null,
      registered_address: d.registered_address ?? null,
    })
    .eq('business_id', active.id)
    .select('business_id');
  if (error || !data?.length) return { error: friendlyDbError(error, 'We could not save these details.') };
  return saved();
}
