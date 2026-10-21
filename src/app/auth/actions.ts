'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { homeForRoles, safeNextPath } from '@/lib/auth/roles';
import { isGoogleSignInEnabled } from '@/lib/auth/providers';
import { siteUrl } from '@/lib/site-url';

export type FormState = { error?: string; message?: string } | undefined;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const field = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters for your password.';
  if (password.length > 72) return 'Passwords can be at most 72 characters.';
  return null;
}

async function destinationFor(userId: string, next: string | null) {
  if (next) return next;
  const supabase = await createClient();
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  return homeForRoles((data ?? []).map(row => row.role));
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, 'email');
  const password = String(formData.get('password') ?? '');
  const next = safeNextPath(formData.get('next'));
  if (!EMAIL_PATTERN.test(email) || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === 'email_not_confirmed') {
      return { error: 'Please confirm your email first. Check your inbox for the confirmation link.' };
    }
    return { error: 'That email and password combination did not work.' };
  }

  redirect(await destinationFor(data.user.id, next));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = field(formData, 'full_name').slice(0, 120);
  const email = field(formData, 'email');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');
  const next = safeNextPath(formData.get('next'));

  if (!fullName) return { error: 'Tell us your name.' };
  if (!EMAIL_PATTERN.test(email)) return { error: 'Enter a valid email address.' };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  if (password !== confirm) return { error: 'The two passwords do not match.' };

  const callback = new URL('/auth/callback/', siteUrl());
  if (next) callback.searchParams.set('next', next);

  const supabase = await createClient();
  // full_name is display-only metadata. Roles are never read from metadata.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callback.toString(), data: { full_name: fullName } },
  });

  if (error) {
    if (error.code === 'weak_password') return { error: 'Choose a stronger password.' };
    if (error.code === 'over_email_send_rate_limit') return { error: 'Too many attempts. Please try again in a little while.' };
    return { error: 'We could not create your account. Please try again.' };
  }

  // Email confirmation disabled in the project: the user is signed in already.
  if (data.session) redirect(await destinationFor(data.user!.id, next));

  return { message: 'Check your inbox. We have sent a link to confirm your email address.' };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, 'email');
  if (!EMAIL_PATTERN.test(email)) return { error: 'Enter a valid email address.' };

  const callback = new URL('/auth/callback/', siteUrl());
  callback.searchParams.set('next', '/reset-password/');

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });

  // Same response whether or not the account exists, to avoid account enumeration.
  return { message: 'If an account exists for that email, a reset link is on its way.' };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  if (password !== confirm) return { error: 'The two passwords do not match.' };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: 'Your reset link has expired. Request a new one.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === 'same_password') return { error: 'Choose a password you have not used here before.' };
    if (error.code === 'weak_password') return { error: 'Choose a stronger password.' };
    return { error: 'We could not update your password. Please request a new link.' };
  }

  redirect(await destinationFor(claims.claims.sub, null));
}

export async function signInWithGoogle(formData: FormData) {
  if (!(await isGoogleSignInEnabled())) redirect('/login/?error=provider');

  const next = safeNextPath(formData.get('next'));
  const callback = new URL('/auth/callback/', siteUrl());
  if (next) callback.searchParams.set('next', next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callback.toString() },
  });
  if (error || !data.url) redirect('/login/?error=provider');
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
