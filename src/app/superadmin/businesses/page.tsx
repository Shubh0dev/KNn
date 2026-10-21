import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { businessTypeLabel, VERIFICATION_STATUS } from '@/lib/business/constants';
import { formatDate, sanitizeSearch } from '@/lib/business/format';

export const metadata: Metadata = { title: 'Businesses | Super Admin | KashiNagri', robots: { index: false } };
const PAGE_SIZE = 30;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await getSuperContext();
  const params = await searchParams;
  const q = sanitizeSearch(first(params.q));
  const status = first(params.status);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  let query = supabase
    .from('businesses')
    .select('id, name, slug, business_type, area, verification_status, created_at, listings ( status ), business_members ( user_id, member_role ), content_reports_count:listings ( content_reports ( id ) )', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (VERIFICATION_STATUS[status]) query = query.eq('verification_status', status);
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);
  const { data, count } = await query;
  const rows = (data ?? []) as any[];

  const ownerIds = rows.flatMap(r => (r.business_members ?? []).filter((m: any) => m.member_role === 'owner').map((m: any) => m.user_id));
  const { data: owners } = ownerIds.length ? await supabase.from('profiles').select('id, email').in('id', ownerIds) : { data: [] };
  const ownerEmail = new Map((owners ?? []).map(o => [o.id as string, o.email as string]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const link = (p: number) => `/superadmin/businesses/?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), page: String(p) })}`;

  return <>
    <PageHeader title="Businesses" crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'Businesses' }]}
      lede="Every business account with its verification status, owner and listings. Open one to see documents, history and decisions." />
    <FlashNotice params={params} />
    <form className="bp-filters" role="search">
      <input name="q" defaultValue={q} placeholder="Name or web address" aria-label="Search businesses" />
      <select name="status" defaultValue={status} aria-label="Verification status"><option value="">All statuses</option>{Object.entries(VERIFICATION_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}</select>
      <button className="bp-btn-secondary" type="submit">Apply</button>
    </form>

    {rows.length === 0 ? <EmptyState title="No businesses match" /> : <div className="bp-table-wrap"><table className="bp-table">
      <thead><tr><th>Business</th><th>Owner</th><th>Type</th><th>Listings</th><th>Reports</th><th>Status</th><th>Created</th><th><span className="sr-only">Open</span></th></tr></thead>
      <tbody>{rows.map(b => {
        const s = VERIFICATION_STATUS[b.verification_status];
        const statuses = (b.listings ?? []).map((l: any) => l.status as string);
        const owner = (b.business_members ?? []).find((m: any) => m.member_role === 'owner');
        const reports = (b.content_reports_count ?? []).reduce((n: number, l: any) => n + (l.content_reports ?? []).length, 0);
        return <tr key={b.id}>
          <td data-label="Business"><Link className="bp-row-title" href={`/admin/verifications/${b.id}/`}>{b.name}</Link><small>{b.slug}</small></td>
          <td data-label="Owner">{owner ? <Link href={`/superadmin/users/${owner.user_id}/`}>{ownerEmail.get(owner.user_id) ?? 'owner'}</Link> : '–'}</td>
          <td data-label="Type">{businessTypeLabel(b.business_type).split(':')[0]}</td>
          <td data-label="Listings">{statuses.length} ({statuses.filter((x: string) => x === 'published').length} live{statuses.includes('suspended') ? `, ${statuses.filter((x: string) => x === 'suspended').length} suspended` : ''})</td>
          <td data-label="Reports">{reports}</td>
          <td data-label="Status"><StatusBadge label={s?.label ?? b.verification_status} tone={s?.tone ?? 'neutral'} /></td>
          <td data-label="Created">{formatDate(b.created_at)}</td>
          <td className="bp-row-actions"><Link href={`/admin/verifications/${b.id}/`}>Open</Link></td>
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
