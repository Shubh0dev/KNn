import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { PanelShell } from '@/components/PanelShell';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Super Admin | KashiNagri', robots: { index: false } };

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const access = await requireRole(['super_admin'], '/superadmin/');
  return <PanelShell access={access} panel="Super Admin">{children}</PanelShell>;
}
