import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export default async function Page() {
  const access = await requireRole(['admin', 'super_admin'], '/admin/');
  const isSuperAdmin = access.roles.includes('super_admin');
  const supabase = await createClient();
  const { data: permissions } = await supabase
    .from('admin_permissions')
    .select('permission')
    .eq('user_id', access.user.id);

  return <>
    <span className="eyebrow">Admin Panel</span>
    <h1 className="serif panel-title">Operations</h1>
    <div className="panel-grid">
      <section className="panel-card">
        <h2>Your permissions</h2>
        {isSuperAdmin
          ? <p>As a super admin you hold every permission.</p>
          : permissions?.length
            ? <ul className="panel-list">{permissions.map(p => <li key={p.permission}>{p.permission}</li>)}</ul>
            : <p>No permissions granted yet. Ask a super admin to assign them.</p>}
      </section>
      <section className="panel-card panel-placeholder">
        <h2>Moderation queue</h2>
        <p>Business verification and listing moderation tools arrive in the next phase.</p>
      </section>
    </div>
  </>;
}
