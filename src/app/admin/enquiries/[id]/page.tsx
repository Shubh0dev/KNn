import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/business/ui';
import { EnquiryStatus, RequestDetails, Timeline, type EnquiryEvent, type EnquiryRow } from '@/components/enquiries/EnquiryParts';
import { requirePermission } from '@/lib/admin/context';
import { isUuid } from '@/lib/business/state';
import { RevealContact } from './RevealContact';

export const metadata: Metadata = { title: 'Enquiry | Admin | KashiNagri', robots: { index: false } };

type Detail = EnquiryRow & {
  sender: string | null; phone_masked: string | null; email_masked: string | null;
  listing_title: string | null; listing_slug: string | null; listing_status: string | null;
  business_id: string | null; business_name: string | null; events: EnquiryEvent[];
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requirePermission('enquiries.view');
  const { data, error } = await supabase.rpc('admin_get_enquiry', { p_enquiry_id: id });
  if (error || !data) notFound();
  const e = data as Detail;

  return <>
    <PageHeader title={e.reference} crumbs={[{ label: 'Admin', href: '/admin/' }, { label: 'Enquiries', href: '/admin/enquiries/' }, { label: e.reference }]}
      lede={`${e.business_name ?? 'Unknown business'} · ${e.listing_title ?? 'listing removed'}`} />
    <div className="bp-enquiry-detail">
      <section className="bp-card">
        <div className="bp-card-head"><h2 className="serif">Request</h2><EnquiryStatus status={e.status} /></div>
        <RequestDetails e={e} />
        {e.message && <><h3>Visitor message</h3><p className="enquiry-message">{e.message}</p></>}
        {e.business_response && <><h3>Latest business response</h3><p className="enquiry-message">{e.business_response}</p></>}
        <p className="bp-links">
          {e.listing_slug && e.listing_status === 'published' && <Link href={`/listings/${e.listing_slug}/`}>Public listing</Link>}
          {e.business_id && <Link href={`/admin/verifications/${e.business_id}/`}>Business verification</Link>}
        </p>
      </section>
      <section className="bp-card">
        <h2 className="serif">Visitor</h2>
        <p data-testid="admin-enquiry-sender">{e.sender ?? '–'}</p>
        <RevealContact enquiryId={e.id} masked={{ phone: e.phone_masked, email: e.email_masked }} />
      </section>
    </div>
    <section className="bp-card">
      <h2 className="serif">History</h2>
      <Timeline events={e.events} viewer="staff" />
    </section>
  </>;
}
