import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/auth/session';
import { homeForRoles, safeNextPath } from '@/lib/auth/roles';
import { LoginForm } from '../forms';
import { GoogleButton } from '../GoogleButton';

export const metadata: Metadata = { title: 'Sign in | KashiNagri', robots: { index: false } };

const ERRORS: Record<string, string> = {
  link: 'That link is invalid or has expired. Please try again.',
  provider: 'That sign-in method is not available right now.',
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next) ?? undefined;
  const access = await getAccess();
  if (access) redirect(next ?? homeForRoles(access.roles));

  const error = typeof params.error === 'string' ? ERRORS[params.error] : undefined;
  const registerHref = next ? `/register/?next=${encodeURIComponent(next)}` : '/register/';
  return <>
    <span className="eyebrow">Welcome back</span>
    <h1 className="serif">Sign in</h1>
    <p className="auth-lede">Save places, plan your trip, or manage your business listing.</p>
    {error && <p className="auth-notice auth-error" role="alert">{error}</p>}
    <LoginForm next={next} />
    <GoogleButton next={next} />
    <div className="auth-links">
      <Link href="/forgot-password/" data-testid="link-forgot-password">Forgot your password?</Link>
      <span>New here? <Link href={registerHref} data-testid="link-register">Create an account</Link></span>
    </div>
  </>;
}
