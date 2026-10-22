import type { Metadata } from 'next';
import Link from 'next/link';
import { PanelShell } from '@/components/PanelShell';
import { requireSignedIn } from '@/lib/auth/session';
import { homeForRoles } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';

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
  const supabase = await createClient();
  const [{ count: requests }, { data: updates }] = await Promise.all([
    supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('sender_id', access.user.id),
    supabase.from('notifications').select('id, title, body, link, created_at').eq('user_id', access.user.id).is('read_at', null)
      .order('created_at', { ascending: false }).limit(5),
  ]);

  return <PanelShell access={access} panel="Your account">
    <span className="eyebrow">Your account</span>
    <h1 className="serif panel-title">Namaste{access.profile?.full_name ? `, ${access.profile.full_name}` : ''}</h1>
    {error && <p className="auth-notice auth-error" role="alert">{error}</p>}
    <div className="panel-grid">
      <section className="panel-card">
        <h2>Profile</h2>
        <dl><dt>Email</dt><dd>{access.user.email}</dd><dt>Status</dt><dd>{access.profile?.account_status ?? 'unknown'}</dd></dl>
      </section>
      <section className="panel-card" data-testid="account-requests">
        <h2>Your requests</h2>
        {updates && updates.length > 0
          ? <ul className="account-updates">{updates.map(u => <li key={u.id}><Link href={u.link ?? '/account/enquiries/'}>{u.title}</Link><small>{u.body}</small></li>)}</ul>
          : <p>{requests ? `${requests} request${requests === 1 ? '' : 's'} sent. No new updates.` : 'Booking requests and questions you send to businesses appear here.'}</p>}
        <p><Link href="/account/enquiries/" className="button-primary" data-testid="link-account-enquiries">View your requests</Link></p>
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
