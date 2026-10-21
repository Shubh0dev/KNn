import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export default async function Page() {
  await requireRole(['super_admin'], '/superadmin/');
  const supabase = await createClient();
  // Readable here only because RLS grants super admins audit.view.
  const { data: recent } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  return <>
    <span className="eyebrow">Super Admin</span>
    <h1 className="serif panel-title">Platform control</h1>
    <div className="panel-grid">
      <section className="panel-card">
        <h2>Recent audit activity</h2>
        {recent?.length
          ? <ul className="panel-list">{recent.map(entry => <li key={entry.id}><strong>{entry.action}</strong> · {entry.entity_type} · {new Date(entry.created_at).toLocaleString('en-IN')}</li>)}</ul>
          : <p>No activity recorded yet.</p>}
      </section>
      <section className="panel-card panel-placeholder">
        <h2>Admins & permissions</h2>
        <p>Granting admin roles and permissions arrives in the next phase.</p>
      </section>
    </div>
  </>;
}
