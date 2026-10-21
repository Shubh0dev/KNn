import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, StatCard } from '@/components/business/ui';
import { getBusinessContext } from '@/lib/business/context';
import { ENGAGEMENT_LABELS } from '@/lib/business/constants';

export const metadata: Metadata = { title: 'Analytics | Business Panel | KashiNagri', robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Row = { day: string; listing_id: string; event_type: string; event_count: number | string };

const PERIODS = [7, 30, 90];
const CLICK_TYPES = ['contact_click', 'website_click', 'direction_click'];

function lastDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, active } = await getBusinessContext();
  const raw = (await searchParams).days;
  const days = PERIODS.includes(Number(raw)) ? Number(raw) : 30;
  // Fetch twice the range so the current period can be compared with the one before it.
  const since = new Date(Date.now() - 2 * days * 86_400_000).toISOString();

  const [eventsResult, listingsResult, enquiriesResult] = await Promise.all([
    supabase.rpc('business_engagement_summary', { p_business_id: active.id, p_days: days * 2 }),
    supabase.from('listings').select('id, title').eq('business_id', active.id),
    supabase.from('enquiries').select('created_at').eq('business_id', active.id).gte('created_at', since).limit(5000),
  ]);

  const currentStart = lastDays(days)[0];
  const allEvents = (eventsResult.data ?? []) as Row[];
  const events = allEvents.filter(r => r.day >= currentStart);
  const previous = allEvents.filter(r => r.day < currentStart);
  const titles = new Map((listingsResult.data ?? []).map(l => [l.id as string, l.title as string]));
  const allEnquiryDates = (enquiriesResult.data ?? []).map(e => (e.created_at as string).slice(0, 10));
  const enquiryDates = allEnquiryDates.filter(d => d >= currentStart);
  const previousEnquiries = allEnquiryDates.length - enquiryDates.length;
  const sum = (types: string[], rows = events) => rows.filter(r => types.includes(r.event_type)).reduce((n, r) => n + Number(r.event_count), 0);
  // Comparison only when the previous period actually had activity.
  const compare = (current: number, before: number) => {
    if (before === 0) return `Last ${days} days`;
    const change = Math.round(((current - before) / before) * 100);
    return `${change >= 0 ? '+' : ''}${change}% vs previous ${days} days (${before})`;
  };

  const series = lastDays(days).map(day => ({
    day,
    views: sum(['view'], events.filter(r => r.day === day)),
    clicks: sum(CLICK_TYPES, events.filter(r => r.day === day)),
    enquiries: enquiryDates.filter(d => d === day).length,
  }));
  const daysWithViews = series.filter(s => s.views > 0).length;
  const maxViews = Math.max(1, ...series.map(s => s.views));

  const perListing = [...titles].map(([id, title]) => {
    const rows = events.filter(r => r.listing_id === id);
    return { id, title, views: sum(['view'], rows), clicks: sum(CLICK_TYPES, rows), saves: sum(['favourite'], rows) };
  }).filter(r => r.views || r.clicks || r.saves).sort((a, b) => b.views - a.views);

  const typeTotals = Object.keys(ENGAGEMENT_LABELS).map(type => ({ type, total: sum([type]) })).filter(t => t.total > 0);

  return <>
    <PageHeader
      title="Analytics"
      crumbs={[{ label: 'Business', href: '/business/' }, { label: 'Analytics' }]}
      lede="Real activity recorded on your published listings. Nothing here is estimated."
      actions={<nav className="bp-segment" aria-label="Time range">{PERIODS.map(p => <Link key={p} href={`/business/analytics/?days=${p}`} className={p === days ? 'is-active' : ''} aria-current={p === days ? 'true' : undefined}>{p} days</Link>)}</nav>}
    />

    <section className="bp-stats" aria-label={`Summary, last ${days} days`}>
      <StatCard label="Listing views" value={events.length ? sum(['view']) : '–'} hint={events.length ? compare(sum(['view']), sum(['view'], previous)) : 'No tracked views yet'} />
      <StatCard label="Contact and direction clicks" value={events.length ? sum(CLICK_TYPES) : '–'} hint={events.length ? compare(sum(CLICK_TYPES), sum(CLICK_TYPES, previous)) : 'No tracked clicks yet'} />
      <StatCard label="Enquiries received" value={enquiryDates.length} hint={compare(enquiryDates.length, previousEnquiries)} href="/business/enquiries/" />
      <StatCard label="Saves" value={events.length ? sum(['favourite']) : '–'} hint={events.length ? `Last ${days} days` : 'No tracked saves yet'} />
    </section>

    {events.length === 0
      ? <section className="bp-card bp-no-data">
          <h2 className="serif">No activity recorded yet</h2>
          <p>Views and clicks are recorded when travellers open a <strong>published</strong> listing, through the <code>track_listing_event</code> database function. Until one of your listings is published and visited, these numbers stay empty rather than showing made-up values. Visitors who use Do Not Track or Global Privacy Control are not counted.</p>
          <p className="bp-muted">Enquiry counts above are always real, because they come directly from the enquiry inbox.</p>
        </section>
      : <>
          <section className="bp-card">
            <h2 className="serif">Views over time</h2>
            {daysWithViews < 2
              ? <p className="bp-muted">Trends appear once views are recorded on at least two different days.</p>
              : <div className="bp-bars" role="img" aria-label={`Daily listing views for the last ${days} days. Peak: ${maxViews} views in one day.`}>
                  {series.map(s => <span key={s.day} className="bp-bar" style={{ height: `${Math.max(2, (s.views / maxViews) * 100)}%` }} title={`${s.day}: ${s.views} views`} />)}
                </div>}
            <details className="bp-details">
              <summary>View daily numbers</summary>
              <div className="bp-table-wrap"><table className="bp-table">
                <thead><tr><th>Date</th><th>Views</th><th>Clicks</th><th>Enquiries</th></tr></thead>
                <tbody>{series.filter(s => s.views || s.clicks || s.enquiries).reverse().map(s => <tr key={s.day}><td>{s.day}</td><td>{s.views}</td><td>{s.clicks}</td><td>{s.enquiries}</td></tr>)}</tbody>
              </table></div>
            </details>
          </section>

          <div className="bp-two-col">
            <section className="bp-card">
              <h2 className="serif">By listing</h2>
              <div className="bp-table-wrap"><table className="bp-table">
                <thead><tr><th>Listing</th><th>Views</th><th>Clicks</th><th>Saves</th></tr></thead>
                <tbody>{perListing.map(r => <tr key={r.id}><td data-label="Listing"><Link href={`/business/listings/${r.id}/edit/`}>{r.title}</Link></td><td data-label="Views">{r.views}</td><td data-label="Clicks">{r.clicks}</td><td data-label="Saves">{r.saves}</td></tr>)}</tbody>
              </table></div>
            </section>
            <section className="bp-card">
              <h2 className="serif">By activity type</h2>
              <ul className="bp-plain-list">{typeTotals.map(t => <li key={t.type}>{ENGAGEMENT_LABELS[t.type]}: <strong>{t.total}</strong></li>)}</ul>
            </section>
          </div>
        </>}
  </>;
}
