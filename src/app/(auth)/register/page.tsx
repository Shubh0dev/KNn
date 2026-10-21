import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/auth/session';
import { homeForRoles, safeNextPath } from '@/lib/auth/roles';
import { RegisterForm } from '../forms';
import { GoogleButton } from '../GoogleButton';

export const metadata: Metadata = { title: 'Create an account | KashiNagri', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next) ?? undefined;
  const access = await getAccess();
  if (access) redirect(next ?? homeForRoles(access.roles));

  const forBusiness = next?.startsWith('/business/onboarding');
  return <>
    <span className="eyebrow">{forBusiness ? 'For local businesses' : 'Join KashiNagri'}</span>
    <h1 className="serif">Create an account</h1>
    <p className="auth-lede">{forBusiness
      ? 'Start with a personal account. Next, you will add your business details for our team to verify.'
      : 'An account is optional. You can browse everything without one.'}</p>
    <RegisterForm next={next} />
    <GoogleButton next={next} />
    <div className="auth-links">
      <span>Already registered? <Link href={next ? `/login/?next=${encodeURIComponent(next)}` : '/login/'} data-testid="link-login">Sign in</Link></span>
      {!forBusiness && <span>Own a local business? <Link href="/register/?next=%2Fbusiness%2Fonboarding%2F" data-testid="link-register-business">Register it here</Link></span>}
    </div>
  </>;
}
