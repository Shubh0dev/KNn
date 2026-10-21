import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/business/ConfirmButton';
import { FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { ACCOUNT_STATUS, permissionLabel, ROLE_LABELS } from '@/lib/admin/constants';
import { VERIFICATION_STATUS } from '@/lib/business/constants';
import { formatDateTime } from '@/lib/business/format';
import { isUuid } from '@/lib/business/state';
import { addBusinessMember, setAccountStatus } from '../actions';

export const metadata: Metadata = { title: 'Account | Super Admin | KashiNagri', robots: { index: false } };

type Detail = {
  id: string; email: string | null; full_name: string | null; phone: string | null; account_status: string; status_reason: string | null;
  created_at: string; last_sign_in_at: string | null; email_confirmed: boolean; providers: string[]; roles: string[]; permissions: string[];
  businesses: { id: string; name: string; slug: string; verification_status: string; member_role: string }[];
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ params, searchParams }: Props) {
  const { supabase, access } = await getSuperContext();
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();

  const { data, error } = await supabase.rpc('superadmin_user_detail', { p_user_id: id });
  if (error || !data) notFound();
  const u = data as Detail;

  const { data: activity } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, actor_id, created_at')
    .or(`actor_id.eq.${id},entity_id.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(30);

  const s = ACCOUNT_STATUS[u.account_status];
  const isSelf = id === access.user.id;
  const isSuper = u.roles.includes('super_admin');

  return <>
    <PageHeader title={u.full_name || u.email || 'Account'} crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'Users', href: '/superadmin/users/' }, { label: u.email ?? 'Account' }]}
      actions={<StatusBadge label={s?.label ?? u.account_status} tone={s?.tone ?? 'neutral'} />} />
    <FlashNotice params={query} />

    <div className="bp-edit-grid">
      <div className="bp-stack">
        <section className="bp-card">
          <h2 className="serif">Profile</h2>
          <dl className="bp-readonly cc-dl">
            <div><dt>Email</dt><dd>{u.email}{u.email_confirmed ? ' (confirmed)' : ' (not confirmed)'}</dd></div>
            <div><dt>Phone</dt><dd>{u.phone || '–'}</dd></div>
            <div><dt>Sign-in methods</dt><dd>{u.providers.join(', ') || '–'}</dd></div>
            <div><dt>Joined</dt><dd>{formatDateTime(u.created_at)}</dd></div>
            <div><dt>Last sign-in</dt><dd>{formatDateTime(u.last_sign_in_at)}</dd></div>
            <div><dt>Roles</dt><dd>{u.roles.map(r => ROLE_LABELS[r] ?? r).join(', ')}</dd></div>
          </dl>
          {u.permissions.length > 0 && <p className="bp-muted">Admin permissions: {u.permissions.map(permissionLabel).join(', ')}</p>}
          {u.status_reason && <p className="bp-review-note-inline"><strong>Status reason:</strong> {u.status_reason}</p>}
          <p className="bp-muted">Passwords and session tokens are never readable. <Link href="/superadmin/admins/">Admin roles are managed on the Admins page.</Link></p>
        </section>

        <section className="bp-card">
          <h2 className="serif">Businesses</h2>
          {u.businesses.length === 0 ? <p className="bp-muted">Not a member of any business.</p> : <ul className="bp-plain-list">{u.businesses.map(b => {
            const vs = VERIFICATION_STATUS[b.verification_status];
            return <li key={b.id}><Link href={`/admin/verifications/${b.id}/`}>{b.name}</Link> ({b.member_role}) <StatusBadge label={vs?.label ?? b.verification_status} tone={vs?.tone ?? 'neutral'} /></li>;
          })}</ul>}
          <form action={addBusinessMember} className="cc-inline-form">
            <input type="hidden" name="userId" value={id} />
            <input name="businessSlug" placeholder="Business web address (slug)" aria-label="Business web address" required />
            <select name="memberRole" defaultValue="manager" aria-label="Member role"><option value="manager">Manager</option><option value="owner">Owner (only if none)</option></select>
            <ConfirmButton className="bp-btn-secondary bp-btn-small" title="Give business access?" message="This person will be able to manage the business's listings and will receive the business owner role. Recorded in the audit log." confirmLabel="Assign access" testId="button-add-member">Assign access</ConfirmButton>
          </form>
          <small className="bp-muted">Business owners normally get access by registering their own business. Use this for transfers or adding staff.</small>
        </section>

        <section className="bp-card">
          <h2 className="serif">Recent activity</h2>
          {(activity ?? []).length === 0 ? <p className="bp-muted">No audited activity.</p> : <ul className="bp-plain-list cc-audit-list">{(activity ?? []).map(a => <li key={a.id}>
            <code>{a.action}</code> {a.actor_id === id ? 'by this account' : 'on this account'} · {formatDateTime(a.created_at)}
          </li>)}</ul>}
        </section>
      </div>

      <aside className="bp-stack">
        <section className="bp-card">
          <h2 className="serif">Account access</h2>
          {isSelf || isSuper
            ? <p className="bp-muted">{isSelf ? 'You cannot change your own account status.' : 'Super admin accounts can only be changed by a database operator. This protects the platform from losing its last super admin.'}</p>
            : u.account_status === 'active'
              ? <form action={setAccountStatus} className="bp-form">
                  <input type="hidden" name="userId" value={id} />
                  <input type="hidden" name="status" value="suspended" />
                  <div className="bp-field"><label htmlFor="reason">Reason</label><textarea id="reason" name="reason" rows={2} maxLength={500} required data-testid="input-suspend-reason" /></div>
                  <ConfirmButton title="Suspend this account?" message="The person keeps their data but loses access to every protected action until reactivated. Their businesses' listings cannot be managed meanwhile." confirmLabel="Suspend account" testId="button-suspend-account">Suspend account</ConfirmButton>
                </form>
              : <form action={setAccountStatus}>
                  <input type="hidden" name="userId" value={id} />
                  <input type="hidden" name="status" value="active" />
                  <ConfirmButton className="bp-btn-secondary" title="Reactivate this account?" message="The person regains access immediately." confirmLabel="Reactivate" testId="button-reactivate-account">Reactivate account</ConfirmButton>
                </form>}
          <p className="bp-muted">Accounts are never permanently deleted from this panel. Deletion needs a separate retention and erasure process.</p>
        </section>
      </aside>
    </div>
  </>;
}
