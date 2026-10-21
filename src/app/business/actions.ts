'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ACTIVE_BUSINESS_COOKIE, getBusinessContext } from '@/lib/business/context';

/** Switches the active business. Only businesses the user belongs to are accepted. */
export async function setActiveBusiness(formData: FormData) {
  const { businesses } = await getBusinessContext();
  const id = String(formData.get('businessId') ?? '');
  const target = businesses.find(b => b.id === id);
  if (target) {
    (await cookies()).set(ACTIVE_BUSINESS_COOKIE, target.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/business',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  revalidatePath('/business', 'layout');
  redirect('/business/');
}
