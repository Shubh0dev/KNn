import Link from 'next/link';
import { EmptyState, StatusBadge } from '@/components/business/ui';
import type { StaffContext } from '@/lib/admin/context';
import { LISTING_STATUS, VERIFICATION_STATUS } from '@/lib/business/constants';
import { formatDate, sanitizeSearch } from '@/lib/business/format';
import { FilterForm } from '@/components/loading/FilterForm';

const PAGE_SIZE = 25;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Shared queue for "Listing reviews" and "Published listings". */
export async function ListingQueue({ ctx, params, basePath, defaultStatus, statusOptions }: {
  ctx: StaffContext;
  params: Record<string, string | string[] | undefined>;
  basePath: string;
  defaultStatus: string;
  statusOptions: string[];
}) {
  const { supabase } = ctx;
  const q = sanitizeSearch(first(params.q));
  const biz = sanitizeSearch(first(params.business));
  const category = first(params.category);
  const status = first(params.status) || defaultStatus;
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const { data: categories } = await supabase.from('listing_categories').select('id, name').order('sort_order');

  const businessEmbed = biz ? 'businesses!inner ( id, name, verification_status )' : 'businesses ( id, name, verification_status )';
  let query = supabase
    .from('listings')
    .select(`id, title, subtype, status, submitted_at, published_at, updated_at, business_id, ${businessEmbed}, listing_categories ( name )`, { count: 'exact' })
    .order(status === 'published' ? 'published_at' : 'submitted_at', { ascending: status === 'pending_review', nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status === 'attention') query = query.in('status', ['changes_requested', 'rejected']);
  else if (status !== 'all' && LISTING_STATUS[status]) query = query.eq('status', status);
  if (q) query = query.ilike('title', `%${q}%`);
  if (biz) query = query.ilike('businesses.name', `%${biz}%`);
  if (/^[0-9a-f-]{36}$/i.test(category)) query = query.eq('category_id', category);

  const { data, count } = await query;
  const rows = (data ?? []) as any[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const keep = { ...(q && { q }), ...(biz && { business: biz }), ...(category && { category }), status };
  const link = (p: number) => `${basePath}?${new URLSearchParams({ ...keep, page: String(p) })}`;
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);

  return <>
    <FilterForm action={basePath} className="bp-filters" ariaLabel="Filter listings">
      <input name="q" defaultValue={q} placeholder="Listing title" aria-label="Search by listing title" />
      <input name="business" defaultValue={biz} placeholder="Business name" aria-label="Search by business name" />
      <select name="category" defaultValue={category} aria-label="Category">
        <option value="">All categories</option>
        {(categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select name="status" defaultValue={status} aria-label="Status">
        {statusOptions.map(v => <option key={v} value={v}>{v === 'all' ? 'All statuses' : v === 'attention' ? 'Rejected or changes requested' : LISTING_STATUS[v]?.label ?? v}</option>)}
      </select>
      <button className="bp-btn-secondary" type="submit">Apply</button>
    </FilterForm>

    {rows.length === 0
      ? <EmptyState title="Nothing here">{status === 'pending_review' ? 'No listings are waiting for review.' : 'No listings match these filters.'}</EmptyState>
      : <div className="bp-table-wrap"><table className="bp-table">
          <thead><tr><th>Listing</th><th>Business</th><th>Category</th><th>{status === 'published' ? 'Published' : 'Submitted'}</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
          <tbody>{rows.map(row => {
            const business = one(row.businesses);
            const vs = business ? VERIFICATION_STATUS[business.verification_status] : null;
            const ls = LISTING_STATUS[row.status];
            return <tr key={row.id}>
              <td data-label="Listing"><Link className="bp-row-title" href={`/admin/listings/${row.id}/`}>{row.title}</Link><small>{row.subtype ?? ''}</small></td>
              <td data-label="Business">{business ? <>{business.name} <StatusBadge label={vs?.label ?? business.verification_status} tone={vs?.tone ?? 'neutral'} /></> : <em>KashiNagri curated</em>}</td>
              <td data-label="Category">{one(row.listing_categories)?.name ?? '–'}</td>
              <td data-label="Date">{formatDate(status === 'published' ? row.published_at : row.submitted_at ?? row.updated_at)}</td>
              <td data-label="Status"><StatusBadge label={ls?.label ?? row.status} tone={ls?.tone ?? 'neutral'} /></td>
              <td className="bp-row-actions"><Link href={`/admin/listings/${row.id}/`}>Open</Link></td>
            </tr>;
          })}</tbody>
        </table></div>}

    {pages > 1 && <nav className="bp-pager" aria-label="Pagination">
      {page > 1 ? <Link href={link(page - 1)}>← Previous</Link> : <span />}
      <span>Page {page} of {pages} · {count} listings</span>
      {page < pages ? <Link href={link(page + 1)}>Next →</Link> : <span />}
    </nav>}
  </>;
}
