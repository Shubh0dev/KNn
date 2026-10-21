'use server';

import { redirect } from 'next/navigation';
import { requireSignedIn } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/app/auth/actions';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function createBusiness(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSignedIn('/business/onboarding/');

  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const area = String(formData.get('area') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (name.length < 2 || name.length > 120) return { error: 'Business name should be 2–120 characters.' };
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) return { error: 'Web address may use lowercase letters, numbers and single hyphens.' };
  if (area.length > 80) return { error: 'Area should be at most 80 characters.' };
  if (description.length > 2000) return { error: 'Description should be at most 2000 characters.' };

  const supabase = await createClient();
  // The RPC re-checks the session, creates the business as `unverified`,
  // makes the caller its owner and grants the business_owner role.
  const { error } = await supabase.rpc('create_business', {
    p_name: name,
    p_slug: slug,
    p_description: description || undefined,
    p_area: area || undefined,
  });

  if (error) {
    if (error.code === '23505') return { error: 'That web address is already taken. Try another.' };
    if (error.code === '42501') return { error: 'Your account is not able to register a business.' };
    if (error.message.includes('Business limit')) return { error: 'You have reached the limit of businesses for one account.' };
    return { error: 'We could not save your business. Please check the details and try again.' };
  }

  redirect('/business/');
}
