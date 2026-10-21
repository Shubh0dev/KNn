import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured, supabaseEnv } from './env';

const PROTECTED_PREFIXES = ['/account', '/business', '/admin', '/superadmin'];

/**
 * Refreshes the Supabase session cookie on every matched request and does an
 * optimistic signed-in check for protected areas. This is NOT the
 * authorization boundary: role checks happen server-side in each protected
 * layout/page (src/lib/auth/session.ts) and in the database via RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const { url, publishableKey } = supabaseEnv();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it validates
  // the JWT and refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));

  if (isProtected && !signedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login/';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', path + request.nextUrl.search);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
