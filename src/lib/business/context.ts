import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireRole, type Access } from '../auth/session';
import { createClient } from '../supabase/server';

export const ACTIVE_BUSINESS_COOKIE = 'kn_business';

export type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  verification_status: string;
  business_type: string | null;
  member_role: string;
};

export type BusinessContext = {
  access: Access;
  supabase: Awaited<ReturnType<typeof createClient>>;
  businesses: BusinessSummary[];
  active: BusinessSummary;
};

/**
 * Authorisation boundary for every Business Panel page and Server Action.
 * Re-checks the business_owner role in the database, loads the businesses
 * this user belongs to (Row Level Security filters the rows) and picks the
 * active one. The cookie is only a preference: it is ignored unless the user
 * is still a member of that business.
 */
export const getBusinessContext = cache(async (): Promise<BusinessContext> => {
  const access = await requireRole(['business_owner'], '/business/');
  const supabase = await createClient();

  const { data } = await supabase
    .from('business_members')
    .select('member_role, businesses ( id, name, slug, verification_status, business_type )')
    .eq('user_id', access.user.id);

  const businesses: BusinessSummary[] = (data ?? []).flatMap(row => {
    const business = Array.isArray(row.businesses) ? row.businesses[0] : row.businesses;
    return business ? [{ ...business, member_role: row.member_role } as BusinessSummary] : [];
  });
  businesses.sort((a, b) => a.name.localeCompare(b.name));

  if (businesses.length === 0) redirect('/business/onboarding/');

  const preferred = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
  const active = businesses.find(b => b.id === preferred) ?? businesses[0];
  return { access, supabase, businesses, active };
});
