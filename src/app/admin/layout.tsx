import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { PanelShell } from '@/components/PanelShell';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Admin Panel | KashiNagri', robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await requireRole(['admin', 'super_admin'], '/admin/');
  return <PanelShell access={access} panel="Admin Panel">{children}</PanelShell>;
}
