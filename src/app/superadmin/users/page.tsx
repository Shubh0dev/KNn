import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { ACCOUNT_STATUS, ROLE_LABELS, type UserRow } from '@/lib/admin/constants';
import { formatDate, sanitizeSearch } from '@/lib/business/format';
import { FilterForm } from '@/components/loading/FilterForm';

export const metadata: Metadata = { title: 'Users | Super Admin | KashiNagri', robots: { index: false } };
const PAGE_SIZE = 25;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await getSuperContext();
  const params = await searchParams;
  const q = sanitizeSearch(first(params.q));
  const role = first(params.role);
  const status = first(params.status);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const { data, error } = await supabase.rpc('superadmin_list_users', {
    p_search: q || undefined,
    p_role: ROLE_LABELS[role] ? role : undefined,
    p_status: ACCOUNT_STATUS[status] ? status : undefined,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  const rows = (data ?? []) as UserRow[];
  const total = rows[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `/superadmin/users/?${new URLSearchParams({ ...(q && { q }), ...(role && { role }), ...(status && { status }), page: String(p) })}`;

  return <>
    <PageHeader title="Users" crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'Users' }]}
      lede="Registered accounts. Passwords and sign-in tokens are never shown or stored here." />
    <FlashNotice params={params} />
    <FilterForm action="/superadmin/users/" className="bp-filters" ariaLabel="Filter accounts">
      <input name="q" defaultValue={q} placeholder="Name or email" aria-label="Search accounts" />
      <select name="role" defaultValue={role} aria-label="Role"><option value="">All roles</option>{Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select name="status" defaultValue={status} aria-label="Account status"><option value="">All statuses</option>{Object.entries(ACCOUNT_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}</select>
      <button className="bp-btn-secondary" type="submit">Apply</button>
    </FilterForm>

    {error ? <p className="auth-notice auth-error" role="alert">Accounts could not be loaded.</p> : rows.length === 0 ? <EmptyState title="No accounts match" /> : <div className="bp-table-wrap"><table className="bp-table">
      <thead><tr><th>Account</th><th>Roles</th><th>Status</th><th>Businesses</th><th>Joined</th><th>Last sign-in</th><th><span className="sr-only">Open</span></th></tr></thead>
      <tbody>{rows.map(u => {
        const s = ACCOUNT_STATUS[u.account_status];
        return <tr key={u.id}>
          <td data-label="Account"><Link className="bp-row-title" href={`/superadmin/users/${u.id}/`}>{u.full_name || u.email}</Link><small>{u.email}{u.email_confirmed ? '' : ' · unconfirmed'}</small></td>
          <td data-label="Roles">{u.roles.filter(r => r !== 'visitor').map(r => ROLE_LABELS[r]).join(', ') || 'Visitor'}</td>
          <td data-label="Status"><StatusBadge label={s?.label ?? u.account_status} tone={s?.tone ?? 'neutral'} /></td>
          <td data-label="Businesses">{u.business_count}</td>
          <td data-label="Joined">{formatDate(u.created_at)}</td>
          <td data-label="Last sign-in">{formatDate(u.last_sign_in_at)}</td>
          <td className="bp-row-actions"><Link href={`/superadmin/users/${u.id}/`}>Open</Link></td>
        </tr>;
      })}</tbody>
    </table></div>}

    {pages > 1 && <nav className="bp-pager" aria-label="Pagination">
      {page > 1 ? <Link href={link(page - 1)}>← Previous</Link> : <span />}
      <span>Page {page} of {pages} · {total} accounts</span>
      {page < pages ? <Link href={link(page + 1)}>Next →</Link> : <span />}
    </nav>}
  </>;
}
