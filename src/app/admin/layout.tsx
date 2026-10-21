import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { ConsoleChrome, type ConsoleNavItem } from '@/components/console/ConsoleChrome';
import { getStaffContext } from '@/lib/admin/context';

export const metadata: Metadata = { title: 'Admin Panel | KashiNagri', robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { access, supabase, isSuper, can } = await getStaffContext();

  // Counts are read under RLS: each one only works with the matching permission.
  const head = { count: 'exact' as const, head: true };
  const [verifications, listings, reports] = await Promise.all([
    can('businesses.verify') ? supabase.from('businesses').select('id', head).eq('verification_status', 'pending') : null,
    can('listings.moderate') ? supabase.from('listings').select('id', head).eq('status', 'pending_review') : null,
    can('reports.review') ? supabase.from('content_reports').select('id', head).in('status', ['open', 'reviewing']) : null,
  ]);

  const nav: ConsoleNavItem[] = [{ href: '/admin/', label: 'Dashboard', icon: 'dashboard', exact: true }];
  if (can('businesses.verify')) nav.push({ href: '/admin/verifications/', label: 'Verifications', icon: 'verify', badge: verifications?.count ?? 0 });
  if (can('listings.moderate')) {
    nav.push({ href: '/admin/listings/', label: 'Listing reviews', icon: 'listings', badge: listings?.count ?? 0 });
    nav.push({ href: '/admin/published/', label: 'Published listings', icon: 'published' });
  }
  if (can('reports.review')) nav.push({ href: '/admin/reports/', label: 'Reports', icon: 'reports', badge: reports?.count ?? 0 });

  return <ConsoleChrome
    panel="Admin Panel"
    nav={nav}
    footerLinks={isSuper ? [{ href: '/superadmin/', label: '→ Super Admin Panel' }] : undefined}
    userName={access.profile?.full_name || access.user.email || 'Admin'}
    userEmail={access.user.email ?? ''}
    roleLabel={isSuper ? 'Super admin' : 'Admin'}
  >{children}</ConsoleChrome>;
}
