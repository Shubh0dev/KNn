import type { ReactNode } from 'react';
import Link from 'next/link';
import { signOut } from '@/app/auth/actions';
import type { Access } from '@/lib/auth/session';

const ROLE_LABELS: Record<string, string> = {
  visitor: 'Visitor',
  business_owner: 'Business owner',
  admin: 'Admin',
  super_admin: 'Super admin',
};

/** Shared frame for /account, /business, /admin and /superadmin. Authorization happens before this renders. */
export function PanelShell({ access, panel, children }: { access: Access; panel: string; children: ReactNode }) {
  const name = access.profile?.full_name || access.user.email;
  return <div className="panel-page">
    <header className="panel-header">
      <div className="page-shell panel-header-inner">
        <Link href="/" className="brand-lockup" aria-label="KashiNagri home" data-testid="link-panel-brand">
          <span className="brand-mark" aria-hidden="true"><span>क</span></span>
          <span className="brand-copy"><strong>KashiNagri</strong><small>{panel}</small></span>
        </Link>
        <nav className="panel-nav" aria-label="Your areas">
          <Link href="/account/">Account</Link>
          {access.roles.includes('business_owner') && <Link href="/business/">Business</Link>}
          {(access.roles.includes('admin') || access.roles.includes('super_admin')) && <Link href="/admin/">Admin</Link>}
          {access.roles.includes('super_admin') && <Link href="/superadmin/">Super Admin</Link>}
        </nav>
        <div className="panel-user">
          <span>{name}<small>{access.roles.filter(r => r !== 'visitor').map(r => ROLE_LABELS[r]).join(' · ') || ROLE_LABELS.visitor}</small></span>
          <form action={signOut}><button type="submit" className="partner-secondary" data-testid="button-sign-out">Sign out</button></form>
        </div>
      </div>
    </header>
    <main className="page-shell panel-main">{children}</main>
  </div>;
}
