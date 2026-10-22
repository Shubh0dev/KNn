import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { EmptyState, FlashNotice, PageHeader } from '@/components/business/ui';
import { EnquiryStatus } from '@/components/enquiries/EnquiryParts';
import { getBusinessContext } from '@/lib/business/context';
import { formatDateTime, sanitizeSearch } from '@/lib/business/format';
import { isUuid } from '@/lib/business/state';
import { ENQUIRY_STATUS, KIND_COPY, requestSummary, telHref, whatsappHref, type EnquiryKind } from '@/lib/enquiries/rules';
import { FilterForm } from '@/components/loading/FilterForm';

export const metadata: Metadata = { title: 'Enquiries | Business Panel | KashiNagri', robots: { index: false } };

const PAGE_SIZE = 25;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

const VIEWS: Record<string, { label: string; statuses?: string[] }> = {
  open: { label: 'Needs action', statuses: ['new', 'read', 'replied', 'contacted', 'alternative_proposed', 'accepted'] },
  upcoming: { label: 'Confirmed', statuses: ['confirmed'] },
  all: { label: 'All' },
};

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, active } = await getBusinessContext();
  const params = await searchParams;
  const q = sanitizeSearch(first(params.q)).replace(/[.:"']/g, ' ').trim();
  const status = first(params.status);
  const view = status ? 'all' : (first(params.view) in VIEWS ? first(params.view) : 'open');
  const listingId = first(params.listing);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const { data: listingOptions } = await supabase.from('listings').select('id, title').eq('business_id', active.id).order('title');

  let query = supabase
    .from('enquiries')
    .select('id, reference, sender_name, sender_phone, sender_email, contact_whatsapp, status, enquiry_type, created_at, check_in, check_out, requested_date, requested_time, guests, rooms, experience, listing_id, listings ( title )', { count: 'exact' })
    .eq('business_id', active.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status in ENQUIRY_STATUS) query = query.eq('status', status);
  else if (VIEWS[view].statuses) query = query.in('status', VIEWS[view].statuses!);
  if (isUuid(listingId)) query = query.eq('listing_id', listingId);
  if (q) query = query.or(`sender_name.ilike.%${q}%,sender_email.ilike.%${q}%,sender_phone.ilike.%${q}%,reference.ilike.%${q}%`);

  const { data, count, error } = await query;
  const rows = (data ?? []) as any[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const filtered = Boolean(q || status || listingId);

  const keep = new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(isUuid(listingId) && { listing: listingId }), ...(!status && { view }) });
  const link = (p: number) => `/business/enquiries/?${new URLSearchParams({ ...Object.fromEntries(keep), page: String(p) })}`;

  return <>
    <PageHeader
      title="Enquiries"
      crumbs={[{ label: 'Business', href: '/business/' }, { label: 'Enquiries' }]}
      lede="Requests and questions from travellers. Contact details are private to your business. Nothing is booked until you confirm it with the traveller."
    />
    <FlashNotice params={params} />

    <nav className="bp-tabs" aria-label="Enquiry views">{Object.entries(VIEWS).map(([key, v]) =>
      <Link key={key} href={`/business/enquiries/?view=${key}`} className={!status && view === key ? 'is-active' : ''} aria-current={!status && view === key ? 'page' : undefined} data-testid={`tab-enquiries-${key}`}>{v.label}</Link>)}
    </nav>

    <FilterForm action="/business/enquiries/" className="bp-filters" ariaLabel="Filter enquiries">
      <input type="hidden" name="view" value={view} />
      <input name="q" defaultValue={q} placeholder="Name, phone, email or reference" aria-label="Search enquiries" />
      <select name="status" defaultValue={status} aria-label="Filter by status">
        <option value="">Any status</option>
        {Object.entries(ENQUIRY_STATUS).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
      </select>
      <select name="listing" defaultValue={listingId} aria-label="Filter by listing">
        <option value="">All listings</option>
        {(listingOptions ?? []).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
      </select>
      <button type="submit" className="bp-btn-secondary">Apply</button>
      {filtered && <Link href="/business/enquiries/" className="bp-link">Clear</Link>}
    </FilterForm>

    {error
      ? <p className="auth-notice auth-error" role="alert">We could not load your enquiries. Please refresh to try again.</p>
      : rows.length === 0
        ? <EmptyState title={filtered ? 'No enquiries match' : view === 'open' ? 'Nothing needs action' : 'No enquiries yet'}>
            {filtered ? 'Try a different search or filter.' : 'When a traveller sends a request about one of your published listings, it appears here with their name and contact number.'}
          </EmptyState>
        : <ul className="bp-enquiries">{rows.map(row => {
            const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings;
            const kind = (row.enquiry_type in KIND_COPY ? row.enquiry_type : 'general') as EnquiryKind;
            const wa = row.contact_whatsapp ? whatsappHref(row.sender_phone) : null;
            return <li key={row.id} className={`bp-enquiry ${row.status === 'new' ? 'is-new' : ''}`} data-testid={`business-enquiry-${row.reference}`}>
              <div className="bp-enquiry-head">
                <div>
                  <Link href={`/business/enquiries/${row.id}/`} className="bp-enquiry-name"><strong>{row.sender_name}</strong></Link>
                  <small>{KIND_COPY[kind].label} · {listing?.title ?? 'a listing'} · {row.reference} · {formatDateTime(row.created_at)}</small>
                </div>
                <EnquiryStatus status={row.status} />
              </div>
              <p className="bp-enquiry-summary">{requestSummary(row)}</p>
              <p className="bp-enquiry-contact">
                {row.sender_phone && <a href={telHref(row.sender_phone)}><Phone size={13} /> {row.sender_phone}</a>}
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} /> WhatsApp</a>}
                {row.sender_email && <a href={`mailto:${row.sender_email}`}><Mail size={13} /> {row.sender_email}</a>}
                <Link href={`/business/enquiries/${row.id}/`} className="bp-btn-secondary bp-btn-small" data-testid={`open-enquiry-${row.reference}`}>Open</Link>
              </p>
            </li>;
          })}</ul>}

    {pages > 1 && <nav className="bp-pager" aria-label="Pagination">
      {page > 1 ? <Link href={link(page - 1)}>← Previous</Link> : <span />}
      <span>Page {page} of {pages}</span>
      {page < pages ? <Link href={link(page + 1)}>Next →</Link> : <span />}
    </nav>}
  </>;
}
