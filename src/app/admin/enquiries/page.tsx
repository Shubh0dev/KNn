import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, FlashNotice, PageHeader, StatCard } from '@/components/business/ui';
import { EnquiryStatus } from '@/components/enquiries/EnquiryParts';
import { requirePermission } from '@/lib/admin/context';
import { formatDateTime } from '@/lib/business/format';
import { ENQUIRY_STATUS, KIND_COPY, requestSummary, type EnquiryKind } from '@/lib/enquiries/rules';
import { FilterForm } from '@/components/loading/FilterForm';

export const metadata: Metadata = { title: 'Enquiries | Admin | KashiNagri', robots: { index: false } };

type Overview = {
  total: number; responded: number; median_response_hours: number | null;
  by_status: Record<string, number>; by_type: Record<string, number>; by_category: Record<string, number>;
  top_businesses: { name: string; enquiries: number; responded: number }[];
};
type Row = {
  id: string; reference: string; status: string; enquiry_type: string; created_at: string; responded_at: string | null;
  check_in: string | null; check_out: string | null; requested_date: string | null; guests: number | null;
  listing_title: string | null; listing_slug: string | null; business_name: string | null; sender: string | null;
};
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const PAGE_SIZE = 50;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requirePermission('enquiries.view');
  const params = await searchParams;
  const status = first(params.status) in ENQUIRY_STATUS ? first(params.status) : '';
  const q = first(params.q).replace(/[^A-Za-z0-9 &'-]/g, '').trim().slice(0, 60);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  const iso = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);

  // Both functions require enquiries.view in the database and never return visitor contact details.
  const [{ data: overview, error: oError }, { data: list, error: lError }] = await Promise.all([
    supabase.rpc('admin_enquiry_overview', { p_from: iso(from), p_to: iso(to) }),
    supabase.rpc('admin_list_enquiries', { p_status: status || undefined, p_reference: q || undefined, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
  ]);
  const o = overview as Overview | null;
  const rows = ((list as { rows?: Row[] } | null)?.rows ?? []);
  const total = (list as { total?: number } | null)?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const open = o ? ['new', 'read', 'replied', 'contacted', 'alternative_proposed', 'accepted'].reduce((n, s) => n + (o.by_status[s] ?? 0), 0) : 0;
  const link = (p: number) => `/admin/enquiries/?${new URLSearchParams({ ...(status && { status }), ...(q && { q }), page: String(p) })}`;

  return <>
    <PageHeader title="Enquiries" crumbs={[{ label: 'Admin', href: '/admin/' }, { label: 'Enquiries' }]}
      lede="Booking requests and questions across all businesses. Visitor contact details are masked; reveal them only for a support case. Every reveal is audited." />
    <FlashNotice params={params} />

    {oError || !o
      ? <p className="auth-notice auth-error" role="alert">The overview could not be loaded.</p>
      : <section className="bp-stats" aria-label="Last 30 days" data-testid="admin-enquiry-stats">
          <StatCard label="Enquiries, last 30 days" value={o.total} />
          <StatCard label="Still open" value={open} tone={open ? 'info' : 'neutral'} hint="New, seen, responded, proposed or accepted" />
          <StatCard label="Confirmed" value={o.by_status.confirmed ?? 0} tone="good" />
          <StatCard label="Responded" value={o.total ? `${Math.round((o.responded / o.total) * 100)}%` : '–'}
            hint={o.median_response_hours != null ? `Median first response ${o.median_response_hours} h` : 'No responses yet'} />
        </section>}
    {o && o.top_businesses.length > 0 && <section className="bp-card">
      <h2 className="serif">Busiest businesses (30 days)</h2>
      <table className="bp-table"><thead><tr><th>Business</th><th>Enquiries</th><th>Responded</th></tr></thead>
        <tbody>{o.top_businesses.map(b => <tr key={b.name}><td>{b.name}</td><td>{b.enquiries}</td><td>{b.responded}</td></tr>)}</tbody></table>
    </section>}

    <FilterForm action="/admin/enquiries/" className="bp-filters" ariaLabel="Filter enquiries">
      <input name="q" defaultValue={q} placeholder="Reference (KN-…) or business name" aria-label="Search" data-testid="input-admin-enquiry-search" />
      <select name="status" defaultValue={status} aria-label="Status">
        <option value="">Any status</option>
        {Object.entries(ENQUIRY_STATUS).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
      </select>
      <button type="submit" className="bp-btn-secondary">Apply</button>
      {(q || status) && <Link href="/admin/enquiries/" className="bp-link">Clear</Link>}
    </FilterForm>

    {lError
      ? <p className="auth-notice auth-error" role="alert">Enquiries could not be loaded.</p>
      : rows.length === 0
        ? <EmptyState title="No enquiries match">{q || status ? 'Try another reference, business or status.' : 'No enquiries have been sent yet.'}</EmptyState>
        : <table className="bp-table" data-testid="admin-enquiry-table">
            <thead><tr><th>Reference</th><th>Business / listing</th><th>Request</th><th>Visitor</th><th>Status</th></tr></thead>
            <tbody>{rows.map(r => <tr key={r.id}>
              <td><Link href={`/admin/enquiries/${r.id}/`} data-testid={`admin-enquiry-${r.reference}`}>{r.reference}</Link><br /><small>{formatDateTime(r.created_at)}</small></td>
              <td>{r.business_name ?? '–'}<br /><small>{r.listing_title ?? 'Listing removed'}</small></td>
              <td>{KIND_COPY[(r.enquiry_type in KIND_COPY ? r.enquiry_type : 'general') as EnquiryKind].label}<br /><small>{requestSummary(r)}</small></td>
              <td>{r.sender ?? '–'}</td>
              <td><EnquiryStatus status={r.status} /></td>
            </tr>)}</tbody>
          </table>}
    {pages > 1 && <nav className="bp-pager" aria-label="Pagination">
      {page > 1 ? <Link href={link(page - 1)}>← Previous</Link> : <span />}
      <span>Page {page} of {pages}</span>
      {page < pages ? <Link href={link(page + 1)}>Next →</Link> : <span />}
    </nav>}
  </>;
}
