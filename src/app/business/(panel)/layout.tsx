import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { PanelShell } from '@/components/PanelShell';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Business Panel | KashiNagri', robots: { index: false } };

export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const access = await requireRole(['business_owner'], '/business/');
  return <PanelShell access={access} panel="Business Panel">{children}</PanelShell>;
}
