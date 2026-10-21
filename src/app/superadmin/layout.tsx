import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { ConsoleChrome, type ConsoleNavItem } from '@/components/console/ConsoleChrome';
import { getSuperContext } from '@/lib/admin/context';

export const metadata: Metadata = { title: 'Super Admin | KashiNagri', robots: { index: false } };

const NAV: ConsoleNavItem[] = [
  { href: '/superadmin/', label: 'Overview', icon: 'dashboard', exact: true },
  { href: '/superadmin/analytics/', label: 'Analytics', icon: 'analytics' },
  { href: '/superadmin/revenue/', label: 'Revenue', icon: 'documents' },
  { href: '/superadmin/users/', label: 'Users', icon: 'users' },
  { href: '/superadmin/admins/', label: 'Admins', icon: 'admins' },
  { href: '/superadmin/businesses/', label: 'Businesses', icon: 'businesses' },
  { href: '/superadmin/listings/', label: 'All listings', icon: 'listings' },
  { href: '/superadmin/content/', label: 'Website content', icon: 'content' },
  { href: '/superadmin/settings/', label: 'Settings & plans', icon: 'settings' },
  { href: '/superadmin/audit/', label: 'Audit log', icon: 'audit' },
];

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { access } = await getSuperContext();
  return <ConsoleChrome
    panel="Super Admin"
    nav={NAV}
    footerLinks={[{ href: '/admin/', label: '→ Moderation (Admin Panel)' }]}
    userName={access.profile?.full_name || access.user.email || 'Super admin'}
    userEmail={access.user.email ?? ''}
    roleLabel="Super admin"
  >{children}</ConsoleChrome>;
}
