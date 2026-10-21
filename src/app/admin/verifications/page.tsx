import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { requirePermission } from '@/lib/admin/context';
import { businessTypeLabel, VERIFICATION_STATUS } from '@/lib/business/constants';
import { formatDate, sanitizeSearch } from '@/lib/business/format';

export const metadata: Metadata = { title: 'Verifications | Admin | KashiNagri', robots: { index: false } };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requirePermission('businesses.verify');
  const params = await searchParams;
  const q = sanitizeSearch(first(params.q));
  const status = first(params.status) || 'pending';

  let query = supabase
    .from('businesses')
    .select('id, name, slug, business_type, area, verification_status, updated_at, business_verification_documents ( review_status )')
    .order('updated_at', { ascending: true })
    .limit(100);
  if (status !== 'all' && VERIFICATION_STATUS[status]) query = query.eq('verification_status', status);
  if (q) query = query.ilike('name', `%${q}%`);
  const { data } = await query;
  const rows = (data ?? []) as any[];

  return <>
    <PageHeader title="Business verifications" crumbs={[{ label: 'Admin', href: '/admin/' }, { label: 'Verifications' }]}
      lede="Oldest requests first. Verify only when a document proves who runs the business." />
    <FlashNotice params={params} />
    <form className="bp-filters" role="search">
      <input name="q" defaultValue={q} placeholder="Search business name" aria-label="Search businesses" />
      <select name="status" defaultValue={status} aria-label="Verification status">
        {Object.entries(VERIFICATION_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        <option value="all">All statuses</option>
      </select>
      <button className="bp-btn-secondary" type="submit">Apply</button>
    </form>

    {rows.length === 0
      ? <EmptyState title={status === 'pending' ? 'No businesses are waiting' : 'Nothing matches'}>{status === 'pending' ? 'New verification requests will appear here.' : 'Try another status or search.'}</EmptyState>
      : <div className="bp-table-wrap"><table className="bp-table">
          <thead><tr><th>Business</th><th>Type</th><th>Documents</th><th>Status</th><th>Last change</th><th><span className="sr-only">Open</span></th></tr></thead>
          <tbody>{rows.map(row => {
            const docs = (row.business_verification_documents ?? []) as { review_status: string }[];
            const pending = docs.filter(d => d.review_status === 'pending').length;
            const s = VERIFICATION_STATUS[row.verification_status];
            return <tr key={row.id}>
              <td data-label="Business"><Link className="bp-row-title" href={`/admin/verifications/${row.id}/`}>{row.name}</Link><small>{row.area}</small></td>
              <td data-label="Type">{businessTypeLabel(row.business_type).split(':')[0]}</td>
              <td data-label="Documents">{docs.length}{pending ? ` (${pending} to review)` : ''}</td>
              <td data-label="Status"><StatusBadge label={s?.label ?? row.verification_status} tone={s?.tone ?? 'neutral'} /></td>
              <td data-label="Last change">{formatDate(row.updated_at)}</td>
              <td className="bp-row-actions"><Link href={`/admin/verifications/${row.id}/`}>Review</Link></td>
            </tr>;
          })}</tbody>
        </table></div>}
  </>;
}
