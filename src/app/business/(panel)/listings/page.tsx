import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { EmptyState, FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { getBusinessContext } from '@/lib/business/context';
import { LISTING_STATUS } from '@/lib/business/constants';
import { formatDate, sanitizeSearch } from '@/lib/business/format';
import { FilterForm } from '@/components/loading/FilterForm';

export const metadata: Metadata = { title: 'Listings | Business Panel | KashiNagri', robots: { index: false } };

const PAGE_SIZE = 20;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, active } = await getBusinessContext();
  const params = await searchParams;
  const q = sanitizeSearch(first(params.q));
  const status = first(params.status);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  let query = supabase
    .from('listings')
    .select('id, title, status, updated_at, area, listing_categories ( name )', { count: 'exact' })
    .eq('business_id', active.id)
    .order('updated_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike('title', `%${q}%`);
  if (status === 'attention') query = query.in('status', ['changes_requested', 'rejected', 'suspended']);
  else if (LISTING_STATUS[status]) query = query.eq('status', status);

  const { data, count } = await query;
  const rows = (data ?? []) as any[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || status);
  const link = (p: number) => `/business/listings/?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), page: String(p) })}`;

  return <>
    <PageHeader
      title="Listings"
      crumbs={[{ label: 'Business', href: '/business/' }, { label: 'Listings' }]}
      actions={<Link href="/business/listings/new/" className="button-primary" data-testid="link-new-listing"><Plus size={15} /> New listing</Link>}
    />
    <FlashNotice params={params} />

    <FilterForm action="/business/listings/" className="bp-filters" ariaLabel="Filter listings">
      <input name="q" defaultValue={q} placeholder="Search by title" aria-label="Search listings by title" />
      <select name="status" defaultValue={status} aria-label="Filter by status">
        <option value="">All statuses</option>
        <option value="attention">Needs attention</option>
        {Object.entries(LISTING_STATUS).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
      </select>
      <button type="submit" className="bp-btn-secondary">Apply</button>
      {filtered && <Link href="/business/listings/" className="bp-link">Clear</Link>}
    </FilterForm>

    {rows.length === 0
      ? filtered
        ? <EmptyState title="No listings match">Try a different search or status.</EmptyState>
        : <EmptyState title="No listings yet" action={<Link href="/business/listings/new/" className="button-primary">Create your first listing</Link>}>Add a draft, upload photos and submit it for review.</EmptyState>
      : <div className="bp-table-wrap"><table className="bp-table">
          <thead><tr><th>Listing</th><th>Category</th><th>Status</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{rows.map(row => {
            const category = Array.isArray(row.listing_categories) ? row.listing_categories[0] : row.listing_categories;
            const s = LISTING_STATUS[row.status];
            return <tr key={row.id}>
              <td data-label="Listing"><Link href={`/business/listings/${row.id}/edit/`} className="bp-row-title">{row.title}</Link><small>{row.area}</small></td>
              <td data-label="Category">{category?.name ?? '–'}</td>
              <td data-label="Status"><StatusBadge label={s?.label ?? row.status} tone={s?.tone ?? 'neutral'} /></td>
              <td data-label="Updated">{formatDate(row.updated_at)}</td>
              <td className="bp-row-actions"><Link href={`/business/listings/${row.id}/edit/`}>Edit</Link><Link href={`/business/listings/${row.id}/preview/`}>Preview</Link></td>
            </tr>;
          })}</tbody>
        </table></div>}

    {pages > 1 && <nav className="bp-pager" aria-label="Pagination">
      {page > 1 ? <Link href={link(page - 1)}>← Previous</Link> : <span />}
      <span>Page {page} of {pages}</span>
      {page < pages ? <Link href={link(page + 1)}>Next →</Link> : <span />}
    </nav>}
  </>;
}
