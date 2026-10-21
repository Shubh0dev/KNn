import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { homeForRoles, safeNextPath } from '@/lib/auth/roles';

/**
 * PKCE callback for email confirmation, password recovery and OAuth.
 * Supabase redirects here with ?code=...; the code verifier cookie set when
 * the flow started must be present (same browser).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      let destination = next;
      if (!destination) {
        const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', data.user.id);
        destination = homeForRoles((roles ?? []).map(row => row.role));
      }
      return NextResponse.redirect(new URL(destination, request.nextUrl.origin));
    }
  }

  return NextResponse.redirect(new URL('/login/?error=link', request.nextUrl.origin));
}
