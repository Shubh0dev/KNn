import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const VERIFICATION_LABELS: Record<string, string> = {
  unverified: 'Not yet submitted for verification',
  pending: 'Verification in review',
  verified: 'Verified',
  rejected: 'Verification declined',
  suspended: 'Suspended',
};

export default async function Page() {
  // Layouts do not re-run on every navigation, so each page checks again.
  const access = await requireRole(['business_owner'], '/business/');
  const supabase = await createClient();
  // RLS limits this to businesses the user is a member of.
  const { data: memberships } = await supabase
    .from('business_members')
    .select('member_role, businesses ( id, name, slug, verification_status )')
    .eq('user_id', access.user.id);

  return <>
    <span className="eyebrow">Business Panel</span>
    <h1 className="serif panel-title">Your businesses</h1>
    <div className="panel-grid">
      {(memberships ?? []).map(m => {
        const business = Array.isArray(m.businesses) ? m.businesses[0] : m.businesses;
        if (!business) return null;
        return <section className="panel-card" key={business.id}>
          <h2>{business.name}</h2>
          <dl><dt>Your role</dt><dd>{m.member_role}</dd><dt>Verification</dt><dd>{VERIFICATION_LABELS[business.verification_status] ?? business.verification_status}</dd></dl>
        </section>;
      })}
      <section className="panel-card panel-placeholder">
        <h2>Listings, enquiries & insights</h2>
        <p>Listing management, verification documents and enquiries arrive in the next phase.</p>
        <p><Link href="/business/onboarding/">Add another business</Link></p>
      </section>
    </div>
  </>;
}
