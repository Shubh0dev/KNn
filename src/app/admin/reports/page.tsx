import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/business/SubmitButton';
import { EmptyState, FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { requirePermission } from '@/lib/admin/context';
import { REPORT_REASONS, REPORT_RESOLUTIONS, REPORT_STATUS } from '@/lib/admin/constants';
import { LISTING_STATUS } from '@/lib/business/constants';
import { formatDateTime } from '@/lib/business/format';
import { isUuid } from '@/lib/business/state';
import { updateReport } from './actions';

export const metadata: Metadata = { title: 'Reports | Admin | KashiNagri', robots: { index: false } };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, can } = await requirePermission('reports.review');
  const params = await searchParams;
  const status = first(params.status) || 'active';
  const listing = first(params.listing);

  let query = supabase
    .from('content_reports')
    .select('id, listing_id, reporter_id, reason, details, status, resolution, reviewer_note, created_at, resolved_at, listings ( title, status, slug )')
    .order('created_at', { ascending: status === 'active' })
    .limit(100);
  if (status === 'active') query = query.in('status', ['open', 'reviewing']);
  else if (REPORT_STATUS[status]) query = query.eq('status', status);
  if (isUuid(listing)) query = query.eq('listing_id', listing);
  const { data } = await query;
  const rows = (data ?? []) as any[];

  // Reporter identity is personal data: only with users.view.
  let reporters = new Map<string, string>();
  if (can('users.view') && rows.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', rows.map(r => r.reporter_id).filter(Boolean));
    reporters = new Map((profiles ?? []).map(p => [p.id as string, p.email as string]));
  }
  const keep = `/admin/reports/?${new URLSearchParams({ status, ...(isUuid(listing) && { listing }) })}`;
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);

  return <>
    <PageHeader title="Content reports" crumbs={[{ label: 'Admin', href: '/admin/' }, { label: 'Reports' }]}
      lede="Reports from signed-in visitors. A report never removes a listing on its own: check the listing, take any action from its page, then record the outcome here." />
    <FlashNotice params={params} />
    <form className="bp-filters">
      <select name="status" defaultValue={status} aria-label="Report status">
        <option value="active">Open and under review</option>
        {Object.entries(REPORT_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        <option value="all">All</option>
      </select>
      {isUuid(listing) && <input type="hidden" name="listing" value={listing} />}
      <button className="bp-btn-secondary" type="submit">Apply</button>
      {isUuid(listing) && <Link className="bp-link" href="/admin/reports/">Show all listings</Link>}
    </form>

    {rows.length === 0 ? <EmptyState title="No reports">Nothing needs attention here.</EmptyState> : <ul className="bp-enquiries">{rows.map(r => {
      const rs = REPORT_STATUS[r.status];
      const l = one(r.listings);
      const ls = l ? LISTING_STATUS[l.status] : null;
      const open = ['open', 'reviewing'].includes(r.status);
      return <li key={r.id} className={`bp-enquiry ${r.status === 'open' ? 'is-new' : ''}`}>
        <div className="bp-enquiry-head">
          <div>
            <strong>{REPORT_REASONS[r.reason] ?? r.reason}</strong>
            <small>About <Link href={`/admin/listings/${r.listing_id}/`}>{l?.title ?? 'a listing'}</Link> {ls && <StatusBadge label={ls.label} tone={ls.tone} />} · {formatDateTime(r.created_at)} · {reporters.get(r.reporter_id) ?? 'signed-in visitor'}</small>
          </div>
          <StatusBadge label={rs?.label ?? r.status} tone={rs?.tone ?? 'neutral'} />
        </div>
        {r.details && <p className="bp-enquiry-message">{r.details}</p>}
        {!open && <p className="bp-muted">Outcome: {REPORT_RESOLUTIONS[r.resolution] ?? r.resolution ?? '–'}{r.reviewer_note ? ` — ${r.reviewer_note}` : ''} ({formatDateTime(r.resolved_at)})</p>}
        {open && <form action={updateReport} className="cc-inline-form cc-report-form">
          <input type="hidden" name="reportId" value={r.id} />
          <input type="hidden" name="back" value={keep} />
          <select name="outcome" aria-label="Outcome" defaultValue={r.status === 'open' ? 'reviewing' : 'resolved:no_action'} data-testid="select-report-outcome">
            {r.status === 'open' && <option value="reviewing">Start review</option>}
            {Object.entries(REPORT_RESOLUTIONS).map(([v, label]) => <option key={v} value={`resolved:${v}`}>Resolve: {label}</option>)}
            <option value="dismissed">Dismiss (not a valid report)</option>
          </select>
          <input name="note" placeholder="Reviewer note (required to close)" aria-label="Reviewer note" maxLength={1000} data-testid="input-report-note" />
          <SubmitButton className="bp-btn-secondary bp-btn-small" pendingLabel="Saving…" testId="button-save-report">Save</SubmitButton>
        </form>}
      </li>;
    })}</ul>}
  </>;
}
