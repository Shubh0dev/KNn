import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '../supabase/server';
import type { AppRole } from './roles';

export type Access = {
  user: { id: string; email: string | null };
  roles: AppRole[];
  profile: { full_name: string | null; account_status: string } | null;
};

/**
 * The signed-in user, verified server-side (getClaims validates the JWT
 * signature; it never trusts the cookie contents blindly). Cached per request.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  return { id: sub, email: (data.claims.email as string | undefined) ?? null };
});

/**
 * Roles and account status read from the database (user_roles / profiles),
 * never from JWT user_metadata, so revocations apply on the next request.
 */
export const getAccess = cache(async (): Promise<Access | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const [rolesResult, profileResult] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user.id),
    supabase.from('profiles').select('full_name, account_status').eq('id', user.id).maybeSingle(),
  ]);

  return {
    user,
    roles: (rolesResult.data ?? []).map(row => row.role as AppRole),
    profile: profileResult.data ?? null,
  };
});

/**
 * Server-side gate for protected areas. Call it from every protected layout,
 * page and Server Action; hiding links in the UI is not a security control.
 */
export async function requireRole(allowed: readonly AppRole[], currentPath: string): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect(`/login/?next=${encodeURIComponent(currentPath)}`);
  if (access.profile?.account_status !== 'active') redirect('/account/?error=inactive');
  if (!allowed.some(role => access.roles.includes(role))) redirect('/account/?error=forbidden');
  return access;
}

export async function requireSignedIn(currentPath: string): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect(`/login/?next=${encodeURIComponent(currentPath)}`);
  return access;
}
