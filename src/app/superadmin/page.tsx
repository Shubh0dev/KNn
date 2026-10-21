import Link from 'next/link';
import { FlashNotice, PageHeader, StatCard } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { ROLE_LABELS } from '@/lib/admin/constants';
import { LISTING_STATUS, VERIFICATION_STATUS } from '@/lib/business/constants';

type Metrics = {
  days: number;
  accounts: { total: number; new_in_period: number; by_status: Record<string, number>; by_role: Record<string, number> };
  businesses: Record<string, number>;
  listings: Record<string, number>;
  enquiries: { total: number; in_period: number };
  engagement: { day: number; week: number; month: number; series: { day: string; views: number; clicks: number }[] };
  reports: Record<string, number>;
  pending: { verifications: number; listings: number; reports: number };
  billing: { plans: number; active_subscriptions: number; payments_succeeded: number; revenue_in_period: number };
};

const PERIODS = [7, 30, 90];
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + Number(b), 0);

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await getSuperContext();
  const params = await searchParams;
  const days = PERIODS.includes(Number(params.days)) ? Number(params.days) : 30;
  const { data, error } = await supabase.rpc('superadmin_platform_metrics', { p_days: days });
  if (error || !data) return <p className="auth-notice auth-error" role="alert">Platform metrics could not be loaded. Please refresh.</p>;
  const m = data as Metrics;
  // Exact "visitor only" count: accounts that hold no role besides visitor.
  const { data: elevated } = await supabase.from('user_roles').select('user_id').neq('role', 'visitor');
  const visitorsOnly = m.accounts.total - new Set((elevated ?? []).map(r => r.user_id)).size;
  const pendingTotal = m.pending.verifications + m.pending.listings + m.pending.reports;
  const maxViews = Math.max(1, ...m.engagement.series.map(s => s.views));
  const billingConnected = m.billing.payments_succeeded > 0;

  return <>
    <PageHeader title="Platform overview" crumbs={[{ label: 'Super Admin' }, { label: 'Overview' }]}
      lede="Real counts from the database. Nothing is estimated."
      actions={<nav className="bp-segment" aria-label="Time range">{PERIODS.map(p => <Link key={p} href={`/superadmin/?days=${p}`} className={p === days ? 'is-active' : ''} aria-current={p === days ? 'true' : undefined}>{p} days</Link>)}</nav>} />
    <FlashNotice params={params} />

    <section className="bp-stats" aria-label="Accounts">
      <StatCard label="Registered accounts" value={m.accounts.total} hint={`${m.accounts.new_in_period} new in ${days} days`} href="/superadmin/users/" />
      <StatCard label="Visitors" value={visitorsOnly} hint="Accounts with no business or staff role" href="/superadmin/users/" />
      <StatCard label="Business owners" value={m.accounts.by_role.business_owner ?? 0} href="/superadmin/users/?role=business_owner" />
      <StatCard label="Total businesses" value={sum(m.businesses)} hint={`${m.businesses.verified ?? 0} verified`} href="/superadmin/businesses/" />
    </section>

    <section className="bp-stats" aria-label="Listings and activity">
      <StatCard label="Published listings" value={m.listings.published ?? 0} tone="good" href="/superadmin/listings/?status=published" />
      <StatCard label="Pending review" value={m.listings.pending_review ?? 0} tone={(m.listings.pending_review ?? 0) ? 'info' : 'neutral'} href="/admin/listings/" />
      <StatCard label="Suspended listings" value={m.listings.suspended ?? 0} tone={(m.listings.suspended ?? 0) ? 'bad' : 'neutral'} href="/superadmin/listings/?status=suspended" />
      <StatCard label="Enquiries" value={m.enquiries.total} hint={`${m.enquiries.in_period} in ${days} days`} />
    </section>

    <div className="bp-two-col">
      <section className="bp-card">
        <h2 className="serif">Engagement</h2>
        <div className="bp-stats cc-mini-stats">
          <StatCard label="Last 24 hours" value={m.engagement.day} />
          <StatCard label="Last 7 days" value={m.engagement.week} />
          <StatCard label="Last 30 days" value={m.engagement.month} />
        </div>
        {m.engagement.series.length < 2
          ? <p className="bp-muted">A trend appears once activity is recorded on at least two days. Events come from public listing pages (views and contact clicks).</p>
          : <div className="bp-bars" role="img" aria-label={`Daily listing views over ${days} days`}>{m.engagement.series.map(s => <span key={s.day} className="bp-bar" style={{ height: `${Math.max(2, (s.views / maxViews) * 100)}%` }} title={`${s.day}: ${s.views} views, ${s.clicks} clicks`} />)}</div>}
      </section>

      <div className="bp-stack">
        <section className="bp-card">
          <h2 className="serif">Pending tasks ({pendingTotal})</h2>
          <ul className="bp-plain-list">
            <li><Link href="/admin/verifications/">Business verifications: <strong>{m.pending.verifications}</strong></Link></li>
            <li><Link href="/admin/listings/">Listings awaiting review: <strong>{m.pending.listings}</strong></Link></li>
            <li><Link href="/admin/reports/">Open content reports: <strong>{m.pending.reports}</strong></Link></li>
          </ul>
        </section>
        <section className="bp-card">
          <h2 className="serif">Revenue and subscriptions</h2>
          {billingConnected
            ? <dl className="bp-readonly cc-dl"><div><dt>Active subscriptions</dt><dd>{m.billing.active_subscriptions}</dd></div><div><dt>Revenue ({days} days)</dt><dd>₹{(m.billing.revenue_in_period / 100).toLocaleString('en-IN')}</dd></div></dl>
            : <p className="bp-muted"><strong>Setup required.</strong> No payment provider is connected, so there are no paid subscriptions or revenue to report. {m.billing.plans} plan{m.billing.plans === 1 ? '' : 's'} defined. <Link href="/superadmin/settings/">Settings &amp; plans</Link></p>}
        </section>
      </div>
    </div>

    <div className="bp-two-col">
      <section className="bp-card">
        <h2 className="serif">Listings by status</h2>
        <ul className="bp-plain-list">{Object.entries(LISTING_STATUS).map(([k, s]) => <li key={k}>{s.label}: <strong>{m.listings[k] ?? 0}</strong></li>)}</ul>
      </section>
      <section className="bp-card">
        <h2 className="serif">Businesses and accounts</h2>
        <ul className="bp-plain-list">{Object.entries(VERIFICATION_STATUS).map(([k, s]) => <li key={k}>{s.label}: <strong>{m.businesses[k] ?? 0}</strong></li>)}</ul>
        <ul className="bp-plain-list">{Object.entries(m.accounts.by_role).map(([k, n]) => <li key={k}>{ROLE_LABELS[k] ?? k}: <strong>{n}</strong></li>)}</ul>
        <ul className="bp-plain-list">{Object.entries(m.accounts.by_status).map(([k, n]) => <li key={k}>Accounts {k}: <strong>{n}</strong></li>)}</ul>
      </section>
    </div>
  </>;
}
