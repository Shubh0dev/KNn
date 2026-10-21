import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BusinessChrome } from '@/components/business/BusinessChrome';
import { getBusinessContext } from '@/lib/business/context';

export const metadata: Metadata = { title: 'Business Panel | KashiNagri', robots: { index: false } };

export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const { access, supabase, businesses, active } = await getBusinessContext();

  const { count: newEnquiries } = await supabase
    .from('enquiries')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', active.id)
    .eq('status', 'new');

  const userName = access.profile?.full_name || access.user.email || 'Account';
  return <BusinessChrome
    businesses={businesses.map(b => ({ id: b.id, name: b.name }))}
    activeId={active.id}
    userName={userName}
    userEmail={access.user.email ?? ''}
    newEnquiries={newEnquiries ?? 0}
    verificationStatus={active.verification_status}
  >
    {active.verification_status !== 'verified' && <p className={`bp-banner bp-banner-${active.verification_status === 'pending' ? 'info' : 'warn'}`}>
      {active.verification_status === 'pending'
        ? 'Your business is in verification. You can submit listings, but none can go public until it is verified.'
        : active.verification_status === 'unverified'
          ? <>Your business is not verified yet. <Link href="/business/verification/">Upload a document and request verification</Link> to publish listings.</>
          : <>Your business verification status needs attention. <Link href="/business/verification/">Review details</Link>.</>}
    </p>}
    {children}
  </BusinessChrome>;
}
