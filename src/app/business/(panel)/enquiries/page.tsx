import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import { EmptyState, FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { SubmitButton } from '@/components/business/SubmitButton';
import { getBusinessContext } from '@/lib/business/context';
import { ENQUIRY_STATUS } from '@/lib/business/constants';
import { formatDateTime, sanitizeSearch } from '@/lib/business/format';
import { isUuid } from '@/lib/business/state';
import { setEnquiryStatus } from './actions';

export const metadata: Metadata = { title: 'Enquiries | Business Panel | KashiNagri', robots: { index: false } };

const PAGE_SIZE = 25;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

const ACTIONS = [
  { status: 'read', label: 'Mark as read' },
  { status: 'replied', label: 'Mark as replied' },
  { status: 'closed', label: 'Close' },
  { status: 'spam', label: 'Spam' },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, active } = await getBusinessContext();
  const params = await searchParams;
  const q = sanitizeSearch(first(params.q));
  const status = first(params.status);
  const listingId = first(params.listing);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const { data: listingOptions } = await supabase.from('listings').select('id, title').eq('business_id', active.id).order('title');

  let query = supabase
    .from('enquiries')
    .select('id, sender_name, sender_email, sender_phone, message, status, created_at, listing_id, listings ( title )', { count: 'exact' })
    .eq('business_id', active.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status in ENQUIRY_STATUS) query = query.eq('status', status);
  if (isUuid(listingId)) query = query.eq('listing_id', listingId);
  if (q) query = query.or(`sender_name.ilike.%${q}%,sender_email.ilike.%${q}%`);

  const { data, count, error } = await query;
  const rows = (data ?? []) as any[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const filtered = Boolean(q || status || listingId);

  const keep = new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(isUuid(listingId) && { listing: listingId }) });
  const link = (p: number) => `/business/enquiries/?${new URLSearchParams({ ...Object.fromEntries(keep), page: String(p) })}`;

  return <>
    <PageHeader
      title="Enquiries"
      crumbs={[{ label: 'Business', href: '/business/' }, { label: 'Enquiries' }]}
      lede="Messages from travellers about your listings. Contact details are private to you."
    />
    <FlashNotice params={params} />

    <form className="bp-filters" role="search" aria-label="Filter enquiries">
      <input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search enquiries" />
      <select name="status" defaultValue={status} aria-label="Filter by status">
        <option value="">All statuses</option>
        {Object.entries(ENQUIRY_STATUS).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
      </select>
      <select name="listing" defaultValue={listingId} aria-label="Filter by listing">
        <option value="">All listings</option>
        {(listingOptions ?? []).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
      </select>
      <button type="submit" className="bp-btn-secondary">Apply</button>
      {filtered && <Link href="/business/enquiries/" className="bp-link">Clear</Link>}
    </form>

    {error
      ? <p className="auth-notice auth-error" role="alert">We could not load your enquiries. Please refresh to try again.</p>
      : rows.length === 0
        ? <EmptyState title={filtered ? 'No enquiries match' : 'No enquiries yet'}>
            {filtered ? 'Try a different search or filter.' : 'When a traveller contacts you about a published listing, their message will appear here.'}
          </EmptyState>
        : <ul className="bp-enquiries">{rows.map(row => {
            const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings;
            const s = ENQUIRY_STATUS[row.status];
            return <li key={row.id} className={`bp-enquiry ${row.status === 'new' ? 'is-new' : ''}`}>
              <div className="bp-enquiry-head">
                <div>
                  <strong>{row.sender_name}</strong>
                  <small>About <Link href={`/business/listings/${row.listing_id}/edit/`}>{listing?.title ?? 'a listing'}</Link> · {formatDateTime(row.created_at)}</small>
                </div>
                <StatusBadge label={s?.label ?? row.status} tone={s?.tone ?? 'neutral'} />
              </div>
              <p className="bp-enquiry-message">{row.message}</p>
              <p className="bp-enquiry-contact">
                <a href={`mailto:${row.sender_email}`}><Mail size={13} /> {row.sender_email}</a>
                {row.sender_phone && <a href={`tel:${row.sender_phone}`}><Phone size={13} /> {row.sender_phone}</a>}
              </p>
              <div className="bp-enquiry-actions">
                {ACTIONS.filter(a => a.status !== row.status).map(action => <form action={setEnquiryStatus} key={action.status}>
                  <input type="hidden" name="enquiryId" value={row.id} />
                  <input type="hidden" name="status" value={action.status} />
                  <input type="hidden" name="back" value="/business/enquiries/" />
                  <input type="hidden" name="search" value={keep.toString()} />
                  <SubmitButton className="bp-btn-secondary bp-btn-small" pendingLabel="Saving…" testId={`button-enquiry-${action.status}`}>{action.label}</SubmitButton>
                </form>)}
              </div>
            </li>;
          })}</ul>}

    {pages > 1 && <nav className="bp-pager" aria-label="Pagination">
      {page > 1 ? <Link href={link(page - 1)}>← Previous</Link> : <span />}
      <span>Page {page} of {pages}</span>
      {page < pages ? <Link href={link(page + 1)}>Next →</Link> : <span />}
    </nav>}
  </>;
}
