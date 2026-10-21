import type { Metadata } from 'next';
import Link from 'next/link';
import { PanelShell } from '@/components/PanelShell';
import { requireSignedIn } from '@/lib/auth/session';
import { homeForRoles } from '@/lib/auth/roles';

export const metadata: Metadata = { title: 'Your account | KashiNagri', robots: { index: false } };

const ERRORS: Record<string, string> = {
  forbidden: 'Your account does not have access to that area.',
  inactive: 'Your account is not active. Please contact KashiNagri support.',
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireSignedIn('/account/');
  const params = await searchParams;
  const error = typeof params.error === 'string' ? ERRORS[params.error] : undefined;
  const dashboard = homeForRoles(access.roles);

  return <PanelShell access={access} panel="Your account">
    <span className="eyebrow">Your account</span>
    <h1 className="serif panel-title">Namaste{access.profile?.full_name ? `, ${access.profile.full_name}` : ''}</h1>
    {error && <p className="auth-notice auth-error" role="alert">{error}</p>}
    <div className="panel-grid">
      <section className="panel-card">
        <h2>Profile</h2>
        <dl><dt>Email</dt><dd>{access.user.email}</dd><dt>Status</dt><dd>{access.profile?.account_status ?? 'unknown'}</dd></dl>
      </section>
      <section className="panel-card">
        <h2>Saved places & trips</h2>
        <p>Favourites and saved itineraries are coming soon. <Link href="/plan-my-trip/">Plan a trip</Link> in the meantime.</p>
      </section>
      {dashboard !== '/account/'
        ? <section className="panel-card"><h2>Your dashboard</h2><p><Link href={dashboard} className="button-primary">Open dashboard</Link></p></section>
        : <section className="panel-card"><h2>Own a local business?</h2><p>Add your business so travellers can find it after our team verifies it.</p><p><Link href="/business/onboarding/" className="button-primary" data-testid="link-start-onboarding">Register your business</Link></p></section>}
    </div>
  </PanelShell>;
}
