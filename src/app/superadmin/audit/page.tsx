import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { formatDateTime } from '@/lib/business/format';
import { FilterForm } from '@/components/loading/FilterForm';

export const metadata: Metadata = { title: 'Audit log | Super Admin | KashiNagri', robots: { index: false } };
const PAGE_SIZE = 50;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const ENTITY_TYPES = ['listing', 'business', 'user', 'report', 'platform_setting', 'listing_categories', 'featured_placements', 'subscription_plans'];
const ACTION_GROUPS: Record<string, string> = {
  'business.verification': 'Business verification decisions',
  'business.document': 'Document reviews',
  'listing.moderated': 'Listing decisions',
  'listing.override': 'Super admin overrides',
  'role.': 'Role grants and revocations',
  'permission.': 'Permission changes',
  'user.status': 'Account suspensions and reactivations',
  'settings.': 'Platform configuration',
  'report.': 'Report outcomes',
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await getSuperContext();
  const params = await searchParams;
  const action = first(params.action);
  const entity = first(params.entity);
  const actor = first(params.actor).trim().toLowerCase();
  const from = first(params.from);
  const to = first(params.to);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  let actorId: string | null = null;
  if (actor) {
    const { data } = await supabase.from('profiles').select('id').ilike('email', actor.replace(/[%_\\]/g, '')).maybeSingle();
    actorId = data?.id ?? '00000000-0000-0000-0000-000000000000';
  }

  let query = supabase.from('audit_logs').select('id, actor_id, action, entity_type, entity_id, details, created_at', { count: 'exact' })
    .order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (ACTION_GROUPS[action]) query = query.like('action', `${action}%`);
  if (ENTITY_TYPES.includes(entity)) query = query.eq('entity_type', entity);
  if (actorId) query = query.eq('actor_id', actorId);
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte('created_at', `${from}T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte('created_at', `${to}T23:59:59Z`);
  const { data, count } = await query;
  const rows = (data ?? []) as any[];

  const actorIds = [...new Set(rows.map(r => r.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length ? await supabase.from('profiles').select('id, email').in('id', actorIds) : { data: [] };
  const emailOf = new Map((actors ?? []).map(a => [a.id as string, a.email as string]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const keep = { ...(action && { action }), ...(entity && { entity }), ...(actor && { actor }), ...(from && { from }), ...(to && { to }) };
  const link = (p: number) => `/superadmin/audit/?${new URLSearchParams({ ...keep, page: String(p) })}`;
  const target = (r: any) => r.entity_type === 'listing' ? `/admin/listings/${r.entity_id}/` : r.entity_type === 'business' ? `/admin/verifications/${r.entity_id}/` : r.entity_type === 'user' ? `/superadmin/users/${r.entity_id}/` : null;

  return <>
    <PageHeader title="Audit log" crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'Audit log' }]}
      lede="Append-only record of sensitive actions: who, what, on which record and when. Entries cannot be edited or deleted by anyone through the app or the API." />
    <FilterForm action="/superadmin/audit/" className="bp-filters" ariaLabel="Filter the audit log">
      <select name="action" defaultValue={action} aria-label="Action"><option value="">All actions</option>{Object.entries(ACTION_GROUPS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select name="entity" defaultValue={entity} aria-label="Record type"><option value="">All record types</option>{ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
      <input name="actor" defaultValue={actor} placeholder="Actor email" aria-label="Actor email" />
      <input name="from" type="date" defaultValue={from} aria-label="From date" />
      <input name="to" type="date" defaultValue={to} aria-label="To date" />
      <button className="bp-btn-secondary" type="submit">Apply</button>
    </FilterForm>
    {rows.length === 0 ? <EmptyState title="No entries match" /> : <div className="bp-table-wrap"><table className="bp-table cc-audit-table">
      <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
      <tbody>{rows.map(r => {
        const href = target(r);
        return <tr key={r.id}>
          <td data-label="When">{formatDateTime(r.created_at)}</td>
          <td data-label="Actor">{r.actor_id ? (emailOf.get(r.actor_id) ?? r.actor_id.slice(0, 8)) : <em>system / operator</em>}</td>
          <td data-label="Action"><code>{r.action}</code></td>
          <td data-label="Target">{href ? <Link href={href}>{r.entity_type}</Link> : r.entity_type} <small>{String(r.entity_id ?? '').slice(0, 8)}</small></td>
          <td data-label="Details"><code className="cc-json">{Object.keys(r.details ?? {}).length ? JSON.stringify(r.details).slice(0, 160) : '–'}</code></td>
        </tr>;
      })}</tbody>
    </table></div>}
    {pages > 1 && <nav className="bp-pager" aria-label="Pagination">
      {page > 1 ? <Link href={link(page - 1)}>← Newer</Link> : <span />}
      <span>Page {page} of {pages} · {count} entries</span>
      {page < pages ? <Link href={link(page + 1)}>Older →</Link> : <span />}
    </nav>}
  </>;
}
