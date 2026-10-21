'use server';

import { requireSignedIn } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { friendlyDbError, isUuid, type ActionState } from '@/lib/business/state';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

export async function sendEnquiry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  await requireSignedIn(`/listings/${slug}/enquire/`);

  const listingId = formData.get('listingId');
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const fieldErrors: Record<string, string> = {};
  if (!name || name.length > 120) fieldErrors.name = 'Enter your name.';
  if (!EMAIL.test(email) || email.length > 254) fieldErrors.email = 'Enter a valid email address so the business can reply.';
  if (phone && !PHONE.test(phone)) fieldErrors.phone = 'Enter a valid phone number or leave it empty.';
  if (message.length < 10 || message.length > 2000) fieldErrors.message = 'Write a message of 10 to 2000 characters.';
  if (!isUuid(listingId)) return { error: 'This listing is not available.' };
  if (Object.keys(fieldErrors).length) return { error: Object.values(fieldErrors)[0], fieldErrors };

  const supabase = await createClient();
  // RLS: only active signed-in users, only for published listings; a trigger limits volume.
  const { error } = await supabase.from('enquiries').insert({
    listing_id: listingId, sender_name: name, sender_email: email, sender_phone: phone || null, message,
  });
  if (error) return { error: friendlyDbError(error, 'Your enquiry could not be sent. Please try again.') };
  return { message: 'Your enquiry was sent to the business. They will reply to the email you gave.' };
}
