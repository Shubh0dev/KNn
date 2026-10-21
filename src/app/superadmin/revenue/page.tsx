import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, StatCard } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { formatDate } from '@/lib/business/format';

export const metadata: Metadata = { title: 'Revenue | Super Admin | KashiNagri', robots: { index: false } };

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function Page() {
  const { supabase } = await getSuperContext();
  const now = new Date();
  const from = iso(new Date(now.getTime() - 29 * 86_400_000));

  const [paymentsResult, subsResult, placementsResult, settingsResult, analyticsResult, enquiriesResult] = await Promise.all([
    supabase.from('payments').select('amount, currency, status, paid_at, created_at, provider').order('created_at', { ascending: false }).limit(500),
    supabase.from('subscriptions').select('status, current_period_end, plan_id'),
    supabase.from('featured_placements').select('id, is_sponsored, ends_at'),
    supabase.from('platform_settings').select('key, value').in('key', ['affiliate', 'sponsored_placements']),
    supabase.rpc('superadmin_analytics', { p_from: from, p_to: iso(now) }),
    supabase.from('enquiries').select('id', { count: 'exact', head: true }).gte('created_at', `${from}T00:00:00Z`),
  ]);

  const payments = (paymentsResult.data ?? []) as { amount: number; status: string; paid_at: string | null; created_at: string; provider: string | null }[];
  const succeeded = payments.filter(p => p.status === 'succeeded');
  const last30 = succeeded.filter(p => new Date(p.paid_at ?? p.created_at) >= new Date(`${from}T00:00:00Z`));
  const activeSubs = (subsResult.data ?? []).filter(s => ['active', 'trialing'].includes(s.status)).length;
  const providerConfigured = Boolean(process.env.PAYMENT_PROVIDER);
  const settings = new Map((settingsResult.data ?? []).map(s => [s.key as string, s.value as any]));
  const sponsoredOn = Boolean(settings.get('sponsored_placements')?.enabled);
  const activeSponsored = (placementsResult.data ?? []).filter(p => p.is_sponsored && (!p.ends_at || new Date(p.ends_at) > now)).length;

  const programs = ((settings.get('affiliate')?.programs ?? []) as { name: string; website?: string }[]);
  const affiliateHosts = new Map(programs.flatMap(p => {
    try { return p.website ? [[new URL(p.website).hostname.replace(/^www\./, '').toLowerCase(), p.name] as [string, string]] : []; } catch { return []; }
  }));
  const outbound = ((analyticsResult.data as any)?.outbound ?? []) as { host: string; clicks: number }[];
  const affiliateClicks = outbound.filter(o => affiliateHosts.has(o.host));

  return <>
    <PageHeader title="Revenue and monetisation" crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'Revenue' }]}
      lede="Actual money comes only from verified payment records. Everything under “Opportunity indicators” is activity, not revenue." />

    <h2 className="serif cc-section-title">Actual revenue (verified payment records only)</h2>
    {!providerConfigured && payments.length === 0
      ? <section className="bp-card cc-setup">
          <h3>Setup required: no payment provider is connected</h3>
          <p className="bp-muted">KashiNagri has subscription plans and sponsored-placement settings, but nothing can be charged yet, so revenue is ₹0 and no subscription is paid. To enable it: integrate a provider (e.g. Razorpay or Stripe) on the server, verify its webhook signatures, write confirmed payments into the payments and subscriptions tables using a server-only secret key, then set <code>PAYMENT_PROVIDER</code>. Card details must never be stored by KashiNagri.</p>
        </section>
      : <section className="bp-stats">
          <StatCard label="Revenue, last 30 days" value={rupees(last30.reduce((n, p) => n + p.amount, 0))} hint={`${last30.length} succeeded payments`} />
          <StatCard label="Revenue, all time (recorded)" value={rupees(succeeded.reduce((n, p) => n + p.amount, 0))} />
          <StatCard label="Active subscriptions" value={activeSubs} />
          <StatCard label="Failed or refunded payments" value={payments.filter(p => ['failed', 'refunded'].includes(p.status)).length} />
        </section>}
    {payments.length > 0 && <section className="bp-card"><h3>Latest payments</h3><ul className="bp-plain-list">{payments.slice(0, 10).map((p, i) => <li key={i}>{formatDate(p.paid_at ?? p.created_at)} · {rupees(p.amount)} · {p.status} · {p.provider ?? 'unknown provider'}</li>)}</ul></section>}

    <h2 className="serif cc-section-title">Opportunity indicators (not revenue)</h2>
    <div className="bp-two-col">
      <section className="bp-card">
        <h3>Sponsored placements</h3>
        <p>{sponsoredOn ? <><strong>{activeSponsored}</strong> active sponsored placement{activeSponsored === 1 ? '' : 's'}.</> : <>Sponsored placements are switched off in <Link href="/superadmin/settings/">settings</Link>.</>}</p>
        <p className="bp-muted">No payment is linked to a placement yet. Sponsorship revenue will appear above only once payments are recorded.</p>
      </section>
      <section className="bp-card">
        <h3>Affiliate referrals (last 30 days)</h3>
        {programs.length === 0
          ? <p className="bp-muted">No affiliate programmes are configured. Add them in <Link href="/superadmin/settings/">settings</Link> (name and website).</p>
          : affiliateClicks.length === 0
            ? <p className="bp-muted">No outbound clicks to configured partners yet.</p>
            : <ul className="bp-plain-list">{affiliateClicks.map(a => <li key={a.host}>{affiliateHosts.get(a.host)} ({a.host}): <strong>{a.clicks}</strong> clicks</li>)}</ul>}
        <p className="bp-muted">Clicks are not commissions. Commission income must be reconciled from each affiliate network's own reports.</p>
      </section>
      <section className="bp-card">
        <h3>Enquiries (last 30 days)</h3>
        <p><strong>{enquiriesResult.count ?? 0}</strong> enquiries sent to businesses.</p>
        <p className="bp-muted">KashiNagri has no booking or lead-fee integration, so enquiries are not counted as qualifying bookings or revenue.</p>
      </section>
    </div>
  </>;
}
