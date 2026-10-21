'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3, Building2, ChevronDown, ExternalLink, FileText, Flag, LayoutDashboard, ListChecks, LogOut,
  Menu, Megaphone, ScrollText, Settings, ShieldCheck, Store, Users, UserCog, X,
} from 'lucide-react';
import { signOut } from '@/app/auth/actions';

const ICONS = {
  dashboard: LayoutDashboard, verify: ShieldCheck, listings: ListChecks, published: Store, reports: Flag,
  users: Users, admins: UserCog, businesses: Building2, content: Megaphone, settings: Settings,
  audit: ScrollText, analytics: BarChart3, documents: FileText,
} as const;

export type ConsoleNavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; exact?: boolean; match?: string };

/** Shared shell for the Admin and Super Admin panels (same visual system as the Business Panel). */
export function ConsoleChrome({ panel, nav, footerLinks, userName, userEmail, roleLabel, children }: {
  panel: string;
  nav: ConsoleNavItem[];
  footerLinks?: { href: string; label: string }[];
  userName: string;
  userEmail: string;
  roleLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const isActive = (item: ConsoleNavItem) => {
    const base = item.match ?? item.href.split('?')[0];
    return item.exact ? pathname === base : pathname.startsWith(base);
  };

  return <div className="bp-app">
    {open && <button className="bp-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`bp-sidebar ${open ? 'is-open' : ''}`} aria-label={`${panel} navigation`}>
      <div className="bp-sidebar-head">
        <Link href={nav[0]?.href ?? '/'} className="brand-lockup" aria-label={`KashiNagri ${panel}`}>
          <span className="brand-mark" aria-hidden="true"><span>क</span></span>
          <span className="brand-copy"><strong>KashiNagri</strong><small>{panel}</small></span>
        </Link>
        <button className="bp-icon-btn bp-only-mobile" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <p className="bp-business-name cc-role">{roleLabel}</p>
      <nav className="bp-nav">
        {nav.map(item => {
          const Icon = ICONS[item.icon];
          const active = isActive(item);
          return <Link key={item.href} href={item.href} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined} data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
            <Icon size={17} strokeWidth={1.7} /><span>{item.label}</span>
            {item.badge ? <b className="bp-count" aria-label={`${item.badge} waiting`}>{item.badge}</b> : null}
          </Link>;
        })}
      </nav>
      <div className="cc-foot">
        {footerLinks?.map(link => <Link key={link.href} href={link.href} className="bp-sidebar-foot">{link.label}</Link>)}
        <Link href="/" className="bp-sidebar-foot"><ExternalLink size={14} /> View public site</Link>
      </div>
    </aside>

    <div className="bp-body">
      <header className="bp-topbar">
        <button className="bp-icon-btn bp-only-mobile" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}><Menu size={20} /></button>
        <span className="bp-topbar-title bp-only-mobile">{panel}</span>
        <details className="bp-profile">
          <summary aria-label="Account menu" data-testid="button-profile-menu">
            <span className="bp-avatar" aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</span>
            <span className="bp-profile-name">{userName}</span><ChevronDown size={14} />
          </summary>
          <div className="bp-menu">
            <p><strong>{userName}</strong><small>{userEmail}</small></p>
            <Link href="/account/">My account</Link>
            <form action={signOut}><button type="submit" data-testid="button-sign-out"><LogOut size={14} /> Sign out</button></form>
          </div>
        </details>
      </header>
      <main className="bp-content" id="main">{children}</main>
    </div>
  </div>;
}
