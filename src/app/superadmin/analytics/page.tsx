import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, StatCard } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { LISTING_STATUS } from '@/lib/business/constants';

export const metadata: Metadata = { title: 'Analytics | Super Admin | KashiNagri', robots: { index: false } };

type Day = { day: string; page_views: number; sessions: number; listing_views: number; enquiries: number; new_businesses: number; submissions: number };
type Analytics = {
  range: { from: string; to: string };
  totals: Record<'page_views' | 'sessions' | 'signed_in_page_views' | 'searches' | 'listing_views' | 'contact_clicks' | 'enquiries' | 'new_accounts' | 'new_businesses' | 'submissions' | 'accounts_total', number>;
  daily: Day[];
  top_pages: { path: string; views: number; sessions: number }[];
  top_listings: { id: string; title: string; slug: string; status: string; views: number; contact_clicks: number; enquiries: number }[];
  searches: { term: string; count: number }[];
  sources: { source: string; sessions: number }[];
  categories: Record<string, number>;
  trips: Record<string, number>;
  outbound: { host: string; clicks: number }[];
  listings_now: Record<string, number>;
};

const MIN_VIEWS_FOR_RATE = 10;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const pct = (part: number, whole: number) => (whole >= MIN_VIEWS_FOR_RATE ? `${((part / whole) * 100).toFixed(1)}%` : '–');

function Bars({ series, field, label }: { series: Day[]; field: keyof Day; label: string }) {
  const values = series.map(d => Number(d[field]));
  const active = values.filter(v => v > 0).length;
  if (active < 2) return <p className="bp-muted">Not enough data for a trend yet ({active} day{active === 1 ? '' : 's'} with {label}). A chart appears once there is activity on at least two days.</p>;
  const max = Math.max(1, ...values);
  return <div className="bp-bars" role="img" aria-label={`${label} per day; peak ${max}`}>{series.map(d => <span key={d.day} className="bp-bar" style={{ height: `${Math.max(2, (Number(d[field]) / max) * 100)}%` }} title={`${d.day}: ${d[field]} ${label}`} />)}</div>;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await getSuperContext();
  const params = await searchParams;
  const today = new Date();
  const preset = Number(first(params.days)) || 30;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(first(params.to)) ? first(params.to) : iso(today);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(first(params.from)) ? first(params.from) : iso(new Date(today.getTime() - (preset - 1) * 86_400_000));

  const { data, error } = await supabase.rpc('superadmin_analytics', { p_from: from, p_to: to });
  const gaConfigured = /^G-[A-Z0-9]{4,12}$/.test(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '');

  const header = <PageHeader title="Analytics" crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'Analytics' }]}
    lede="Real, first-party measurements from KashiNagri's own database. Nothing here is estimated or imported."
    actions={<form className="bp-filters cc-range" role="search">
      <nav className="bp-segment" aria-label="Quick ranges">{[7, 30, 90].map(d => <Link key={d} href={`/superadmin/analytics/?days=${d}`}>{d} days</Link>)}</nav>
      <input type="date" name="from" defaultValue={from} aria-label="From" />
      <input type="date" name="to" defaultValue={to} aria-label="To" />
      <button className="bp-btn-secondary" type="submit">Apply</button>
    </form>} />;

  if (error || !data) return <>{header}<p className="auth-notice auth-error" role="alert">{error?.message?.includes('one year') ? 'Choose a date range of up to one year, with the end after the start.' : 'Analytics could not be loaded.'}</p></>;
  const a = data as Analytics;
  const t = a.totals;
  const none = t.page_views === 0 && t.listing_views === 0;

  return <>
    {header}

    <section className="bp-card cc-sources">
      <h2 className="serif">Where these numbers come from</h2>
      <ul className="bp-plain-list">
        <li><strong>First-party (Supabase):</strong> anonymous page views, browser sessions, searches, category clicks, trip actions and outbound clicks on public pages. No cookies, user ids, IP addresses or query strings are stored. Do Not Track / Global Privacy Control opt out.</li>
        <li><strong>Listing engagement:</strong> listing views and contact/website/direction clicks, recorded only for published listings.</li>
        <li><strong>Records:</strong> enquiries, new accounts, businesses and listing submissions are counted from the actual tables.</li>
        <li><strong>Google Analytics 4:</strong> {gaConfigured
          ? 'configured, but only for visitors who accept cookies. GA reports (traffic sources, devices, geography) live in Google Analytics. They are not imported or added to the numbers here, because the two sources count different people and would double count.'
          : 'not configured (set NEXT_PUBLIC_GA_MEASUREMENT_ID to enable it with a consent banner).'}</li>
        <li><strong>Sessions are not people.</strong> A session is one browser tab; the same person on two devices or tabs counts twice, and blocked trackers count zero. Registered accounts are counted separately.</li>
      </ul>
    </section>

    {none && <p className="bp-banner bp-banner-info">No visits have been recorded in this range yet. Data appears as soon as people browse the public site.</p>}

    <section className="bp-stats" aria-label="Traffic">
      <StatCard label="Page views" value={t.page_views} hint={`${t.signed_in_page_views} by signed-in visitors`} />
      <StatCard label="Browser sessions" value={t.sessions} hint="Tabs, not unique people" />
      <StatCard label="Searches" value={t.searches} />
      <StatCard label="Registered accounts" value={t.accounts_total} hint={`${t.new_accounts} new in range`} href="/superadmin/users/" />
    </section>
    <section className="bp-stats" aria-label="Listings and conversion">
      <StatCard label="Listing views" value={t.listing_views} />
      <StatCard label="Contact clicks" value={t.contact_clicks} hint={`Click rate ${pct(t.contact_clicks, t.listing_views)}`} />
      <StatCard label="Enquiries" value={t.enquiries} hint={`Enquiry rate ${pct(t.enquiries, t.listing_views)}`} />
      <StatCard label="New businesses / submissions" value={`${t.new_businesses} / ${t.submissions}`} hint="Registrations and listings sent for review" />
    </section>

    <div className="bp-two-col">
      <section className="bp-card"><h2 className="serif">Page views per day</h2><Bars series={a.daily} field="page_views" label="page views" /></section>
      <section className="bp-card"><h2 className="serif">Business activity per day</h2>
        <Bars series={a.daily} field="submissions" label="listing submissions" />
        <p className="bp-muted">{a.daily.reduce((n, d) => n + d.new_businesses, 0)} business registrations in this range.</p>
      </section>
    </div>

    <div className="bp-two-col">
      <section className="bp-card">
        <h2 className="serif">Most-viewed pages</h2>
        {a.top_pages.length === 0 ? <p className="bp-muted">No page views yet.</p> : <div className="bp-table-wrap"><table className="bp-table">
          <thead><tr><th>Page</th><th>Views</th><th>Sessions</th></tr></thead>
          <tbody>{a.top_pages.map(p => <tr key={p.path}><td data-label="Page"><code>{p.path}</code></td><td data-label="Views">{p.views}</td><td data-label="Sessions">{p.sessions}</td></tr>)}</tbody>
        </table></div>}
      </section>
      <section className="bp-card">
        <h2 className="serif">Traffic sources</h2>
        {a.sources.length === 0 ? <p className="bp-muted">No sessions yet.</p> : <ul className="bp-plain-list">{a.sources.map(s => <li key={s.source}>{s.source}: <strong>{s.sessions}</strong> sessions</li>)}</ul>}
        <p className="bp-muted">From the referring website or utm_source on a session's first page. Many apps hide referrers, so "direct / unknown" is usually large.</p>
      </section>
    </div>

    <section className="bp-card">
      <h2 className="serif">Most-viewed listings and conversion</h2>
      {a.top_listings.length === 0 ? <p className="bp-muted">No listing views yet.</p> : <div className="bp-table-wrap"><table className="bp-table">
        <thead><tr><th>Listing</th><th>Views</th><th>Contact clicks</th><th>Enquiries</th><th>Click rate</th><th>Enquiry rate</th></tr></thead>
        <tbody>{a.top_listings.map(l => <tr key={l.id}>
          <td data-label="Listing"><Link href={`/admin/listings/${l.id}/`}>{l.title}</Link> <small>{LISTING_STATUS[l.status]?.label ?? l.status}</small></td>
          <td data-label="Views">{l.views}</td><td data-label="Contact clicks">{l.contact_clicks}</td><td data-label="Enquiries">{l.enquiries}</td>
          <td data-label="Click rate">{pct(l.contact_clicks, l.views)}</td><td data-label="Enquiry rate">{pct(l.enquiries, l.views)}</td>
        </tr>)}</tbody>
      </table></div>}
      <p className="bp-muted">Rates are shown only for listings with at least {MIN_VIEWS_FOR_RATE} views.</p>
    </section>

    <div className="bp-two-col">
      <section className="bp-card">
        <h2 className="serif">Popular searches</h2>
        {a.searches.length === 0 ? <p className="bp-muted">No search term has been used at least twice yet.</p> : <ul className="bp-chips">{a.searches.map(s => <li key={s.term}>{s.term} · {s.count}</li>)}</ul>}
        <p className="bp-muted">Only terms searched two or more times are shown, so one person's unique query is never displayed. E-mails and phone numbers are removed before storage.</p>
      </section>
      <section className="bp-card">
        <h2 className="serif">Interactions</h2>
        <ul className="bp-plain-list">
          <li>My Kashi Trip outlines refreshed: <strong>{a.trips.trip_created ?? 0}</strong>, saved: <strong>{a.trips.trip_saved ?? 0}</strong>, shared: <strong>{a.trips.trip_shared ?? 0}</strong></li>
          {Object.entries(a.categories).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([c, n]) => <li key={c}>Homepage shortcut <code>{c}</code>: <strong>{n}</strong></li>)}
          {a.outbound.slice(0, 8).map(o => <li key={o.host}>Outbound to {o.host}: <strong>{o.clicks}</strong></li>)}
        </ul>
        <p className="bp-muted">Published listings now: <strong>{a.listings_now.published ?? 0}</strong> · pending review: <strong>{a.listings_now.pending_review ?? 0}</strong> · suspended: <strong>{a.listings_now.suspended ?? 0}</strong></p>
      </section>
    </div>
  </>;
}
