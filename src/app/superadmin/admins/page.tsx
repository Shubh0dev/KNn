import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfirmButton } from '@/components/business/ConfirmButton';
import { SubmitButton } from '@/components/business/SubmitButton';
import { EmptyState, FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { ACCOUNT_STATUS, ADMIN_PERMISSIONS, type UserRow } from '@/lib/admin/constants';
import { formatDateTime } from '@/lib/business/format';
import { grantAdmin, revokeAdmin, savePermissions } from './actions';

export const metadata: Metadata = { title: 'Admins | Super Admin | KashiNagri', robots: { index: false } };

function PermissionChecks({ selected, prefix }: { selected: string[]; prefix: string }) {
  return <div className="cc-perm-grid">{ADMIN_PERMISSIONS.map(p => <label className="bp-check cc-perm" key={p.key} title={p.help}>
    <input type="checkbox" name="permissions" value={p.key} defaultChecked={selected.includes(p.key)} data-testid={`${prefix}-${p.key}`} />
    <span>{p.label}<small>{p.help}</small></span>
  </label>)}</div>;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await getSuperContext();
  const params = await searchParams;

  const [adminsResult, supersResult] = await Promise.all([
    supabase.rpc('superadmin_list_users', { p_role: 'admin', p_limit: 100, p_offset: 0 }),
    supabase.rpc('superadmin_list_users', { p_role: 'super_admin', p_limit: 20, p_offset: 0 }),
  ]);
  const admins = ((adminsResult.data ?? []) as UserRow[]).filter(a => !a.roles.includes('super_admin'));
  const supers = (supersResult.data ?? []) as UserRow[];
  const ids = admins.map(a => a.id);

  const [permsResult, activityResult] = await Promise.all([
    ids.length ? supabase.from('admin_permissions').select('user_id, permission').in('user_id', ids) : null,
    ids.length ? supabase.from('audit_logs').select('id, actor_id, action, entity_type, created_at').in('actor_id', ids).order('created_at', { ascending: false }).limit(25) : null,
  ]);
  const perms = new Map<string, string[]>();
  for (const row of permsResult?.data ?? []) perms.set(row.user_id, [...(perms.get(row.user_id) ?? []), row.permission]);
  const emailOf = new Map(admins.map(a => [a.id, a.email ?? a.id]));

  return <>
    <PageHeader title="Admin management" crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'Admins' }]}
      lede="Admins only get the permissions you tick. Every change is recorded in the audit log." />
    <FlashNotice params={params} />

    <section className="bp-card">
      <h2 className="serif">Add an admin</h2>
      <p className="bp-muted">The person must first register on KashiNagri and confirm their email; that proves they control the address. Then enter it here.</p>
      <form action={grantAdmin} className="bp-form cc-stack-form">
        <div className="bp-field"><label htmlFor="admin-email">Account email</label><input id="admin-email" name="email" type="email" required data-testid="input-admin-email" /></div>
        <PermissionChecks selected={['businesses.verify', 'listings.moderate']} prefix="new-perm" />
        <ConfirmButton className="button-primary" title="Grant admin access?" message="This account will be able to use the Admin Panel with the permissions you ticked." confirmLabel="Grant access" testId="button-grant-admin">Grant admin access</ConfirmButton>
      </form>
    </section>

    <h2 className="serif cc-section-title">Admins ({admins.length})</h2>
    {admins.length === 0 ? <EmptyState title="No admins yet">Add one above.</EmptyState> : admins.map(admin => {
      const s = ACCOUNT_STATUS[admin.account_status];
      return <section className="bp-card cc-admin" key={admin.id} data-testid="admin-card">
        <div className="bp-enquiry-head">
          <div><strong><Link href={`/superadmin/users/${admin.id}/`}>{admin.full_name || admin.email}</Link></strong><small>{admin.email} · last sign-in {formatDateTime(admin.last_sign_in_at)}</small></div>
          <StatusBadge label={s?.label ?? admin.account_status} tone={s?.tone ?? 'neutral'} />
        </div>
        <form action={savePermissions} className="bp-form cc-stack-form">
          <input type="hidden" name="userId" value={admin.id} />
          <PermissionChecks selected={perms.get(admin.id) ?? []} prefix={`perm-${admin.email}`} />
          <SubmitButton className="bp-btn-secondary" pendingLabel="Saving…" testId="button-save-permissions">Save permissions</SubmitButton>
        </form>
        <form action={revokeAdmin} className="bp-mt">
          <input type="hidden" name="userId" value={admin.id} />
          <ConfirmButton title="Remove admin access?" message="All admin permissions are removed. The account itself stays active as a normal account." confirmLabel="Remove access" testId="button-revoke-admin">Remove admin access</ConfirmButton>
        </form>
      </section>;
    })}

    <div className="bp-two-col">
      <section className="bp-card">
        <h2 className="serif">Recent admin activity</h2>
        {(activityResult?.data ?? []).length === 0 ? <p className="bp-muted">No admin activity recorded.</p> : <ul className="bp-plain-list cc-audit-list">{(activityResult?.data ?? []).map(a => <li key={a.id}>
          <strong>{emailOf.get(a.actor_id) ?? 'admin'}</strong> <code>{a.action}</code> · {formatDateTime(a.created_at)}
        </li>)}</ul>}
        <Link className="bp-link" href="/superadmin/audit/">Full audit log</Link>
      </section>
      <section className="bp-card">
        <h2 className="serif">Super admins ({supers.length})</h2>
        <ul className="bp-plain-list">{supers.map(s => <li key={s.id}>{s.full_name || s.email} <small className="bp-muted">{s.email}</small></li>)}</ul>
        <p className="bp-muted">Super admins cannot be added, removed or suspended from the app, by anyone. That keeps the last super admin from being locked out by mistake and stops an admin from promoting themselves. Changes need a database operator (see supabase/bootstrap).</p>
      </section>
    </div>
  </>;
}
