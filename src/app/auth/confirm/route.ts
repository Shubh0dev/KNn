import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { homeForRoles, safeNextPath } from '@/lib/auth/roles';

const ALLOWED_TYPES: EmailOtpType[] = ['signup', 'email', 'recovery', 'invite', 'email_change', 'magiclink'];

/**
 * Token-hash confirmation endpoint. Works across devices (unlike the PKCE
 * callback) once the Supabase email templates link to:
 *   {{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&type=email
 *   {{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password/
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = type === 'recovery' ? '/reset-password/' : safeNextPath(searchParams.get('next'));

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
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
