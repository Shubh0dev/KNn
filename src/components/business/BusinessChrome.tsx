'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ChevronDown, ExternalLink, Inbox, LayoutDashboard, ListChecks, LogOut, Menu, Settings, ShieldCheck, X } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
import { setActiveBusiness } from '@/app/business/actions';
import { useFormStatus } from 'react-dom';
import { InlineLoader } from '@/components/loading/InlineLoader';
import { SubmitButton } from '@/components/business/SubmitButton';

type Props = {
  businesses: { id: string; name: string }[];
  activeId: string;
  userName: string;
  userEmail: string;
  newEnquiries: number;
  verificationStatus: string;
  children: ReactNode;
};

const NAV = [
  { href: '/business/', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/business/listings/', label: 'Listings', icon: ListChecks },
  { href: '/business/enquiries/', label: 'Enquiries', icon: Inbox, badge: 'enquiries' },
  { href: '/business/analytics/', label: 'Analytics', icon: BarChart3 },
  { href: '/business/verification/', label: 'Verification', icon: ShieldCheck, badge: 'verification' },
  { href: '/business/settings/', label: 'Settings', icon: Settings },
] as const;

/** Switching business runs a Server Action; the select is locked and a spinner shows while it runs. */
function BusinessSelect({ businesses, activeId }: { businesses: { id: string; name: string }[]; activeId: string }) {
  const { pending } = useFormStatus();
  return <>
    <select id="bp-business-select" name="businessId" defaultValue={activeId} disabled={pending} aria-busy={pending} onChange={e => e.currentTarget.form?.requestSubmit()} data-testid="select-business">
      {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
    <InlineLoader active={pending} label="Switching business…" testId="business-switching" />
  </>;
}

export function BusinessChrome({ businesses, activeId, userName, userEmail, newEnquiries, verificationStatus, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  return <div className="bp-app">
    {open && <button className="bp-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`bp-sidebar ${open ? 'is-open' : ''}`} aria-label="Business navigation">
      <div className="bp-sidebar-head">
        <Link href="/business/" className="brand-lockup" aria-label="KashiNagri business home">
          <span className="brand-mark" aria-hidden="true"><span>क</span></span>
          <span className="brand-copy"><strong>KashiNagri</strong><small>Business Panel</small></span>
        </Link>
        <button className="bp-icon-btn bp-only-mobile" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={18} /></button>
      </div>

      {businesses.length > 1
        ? <form action={setActiveBusiness} className="bp-switcher">
            <label htmlFor="bp-business-select">Business</label>
            <BusinessSelect businesses={businesses} activeId={activeId} />
          </form>
        : <p className="bp-business-name">{businesses[0]?.name}</p>}

      <nav className="bp-nav">
        {NAV.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href, 'exact' in item ? item.exact : undefined);
          return <Link key={item.href} href={item.href} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined} data-testid={`nav-${item.label.toLowerCase()}`}>
            <Icon size={17} strokeWidth={1.7} /><span>{item.label}</span>
            {'badge' in item && item.badge === 'enquiries' && newEnquiries > 0 && <b className="bp-count" aria-label={`${newEnquiries} new`}>{newEnquiries}</b>}
            {'badge' in item && item.badge === 'verification' && verificationStatus !== 'verified' && <i className="bp-dot" aria-label="Action needed" />}
          </Link>;
        })}
      </nav>

      <Link href="/" className="bp-sidebar-foot"><ExternalLink size={14} /> View public site</Link>
    </aside>

    <div className="bp-body">
      <header className="bp-topbar">
        <button className="bp-icon-btn bp-only-mobile" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}><Menu size={20} /></button>
        <span className="bp-topbar-title bp-only-mobile">Business Panel</span>
        <details className="bp-profile">
          <summary aria-label="Account menu" data-testid="button-profile-menu">
            <span className="bp-avatar" aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</span>
            <span className="bp-profile-name">{userName}</span><ChevronDown size={14} />
          </summary>
          <div className="bp-menu">
            <p><strong>{userName}</strong><small>{userEmail}</small></p>
            <Link href="/business/settings/">Settings</Link>
            <Link href="/account/">My account</Link>
            <form action={signOut}><SubmitButton className="" pendingLabel="Signing out…" testId="button-sign-out"><LogOut size={14} /> Sign out</SubmitButton></form>
          </div>
        </details>
      </header>
      <main className="bp-content" id="main">{children}</main>
    </div>
  </div>;
}
