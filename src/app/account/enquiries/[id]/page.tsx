import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Phone } from 'lucide-react';
import { PanelShell } from '@/components/PanelShell';
import { FlashNotice } from '@/components/business/ui';
import { ConfirmButton } from '@/components/business/ConfirmButton';
import { EnquiryStatus, RequestDetails, Timeline, type EnquiryEvent, type EnquiryRow } from '@/components/enquiries/EnquiryParts';
import { requireSignedIn } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/business/state';
import { ENQUIRY_STATUS, nextStatuses, telHref } from '@/lib/enquiries/rules';
import { cancelEnquiry } from '../actions';

export const metadata: Metadata = { title: 'Your request | KashiNagri', robots: { index: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const access = await requireSignedIn(`/account/enquiries/${id}/`);
  const flash = await searchParams;
  const supabase = await createClient();

  // RLS returns only the caller's own requests; the sender filter makes that explicit.
  const { data } = await supabase.from('enquiries')
    .select('id, reference, status, enquiry_type, created_at, updated_at, check_in, check_out, requested_date, requested_time, guests, rooms, experience, message, business_response, sender_name, sender_phone, sender_email, contact_whatsapp, listings ( title, slug, contact_phone, businesses ( name, public_phone ) )')
    .eq('id', id).eq('sender_id', access.user.id).maybeSingle();
  if (!data) notFound();
  const e = data as unknown as EnquiryRow & { sender_name: string; sender_phone: string | null; sender_email: string; contact_whatsapp: boolean; listings: any };
  const listing = Array.isArray(e.listings) ? e.listings[0] : e.listings;
  const business = listing ? (Array.isArray(listing.businesses) ? listing.businesses[0] : listing.businesses) : null;
  const phone: string | null = listing?.contact_phone ?? business?.public_phone ?? null;

  const [{ data: events }] = await Promise.all([
    supabase.from('enquiry_events').select('actor, from_status, to_status, message, created_at').eq('enquiry_id', id).order('created_at'),
    // Opening the request marks its notifications as read.
    supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', access.user.id).eq('enquiry_id', id).is('read_at', null),
  ]);
  const canCancel = nextStatuses(e.status, 'visitor').includes('cancelled');

  return <PanelShell access={access} panel="Your account">
    <span className="eyebrow"><Link href="/account/enquiries/">Your requests</Link></span>
    <h1 className="serif panel-title">{listing?.title ?? 'Your request'}</h1>
    <FlashNotice params={flash} />
    <div className="enquiry-status-banner" data-testid="visitor-enquiry-status">
      <EnquiryStatus status={e.status} />
      <p>{ENQUIRY_STATUS[e.status]?.visitor}</p>
      <small>Reference <strong data-testid="visitor-enquiry-reference">{e.reference}</strong></small>
    </div>

    <div className="panel-grid enquiry-detail-grid">
      <section className="panel-card">
        <h2>What you asked for</h2>
        <RequestDetails e={e} />
        {e.message && <><h3>Your message</h3><p className="enquiry-message">{e.message}</p></>}
        <h3>Details you shared with the business</h3>
        <p className="bp-muted">{e.sender_name} · {e.sender_phone} · {e.sender_email}{e.contact_whatsapp ? ' · WhatsApp allowed' : ''}</p>
      </section>
      <section className="panel-card">
        <h2>{business?.name ?? 'The business'}</h2>
        {e.business_response
          ? <><h3>Latest response</h3><p className="enquiry-message" data-testid="visitor-business-response">{e.business_response}</p></>
          : <p className="bp-muted">No response yet. Businesses usually reply by phone, WhatsApp or here.</p>}
        {phone
          ? <p>Contact them directly: <a href={telHref(phone)} className="public-listing-phone" data-testid="visitor-business-phone"><Phone size={15} /> {phone}</a></p>
          : <p className="bp-muted">This business has not published a phone number.</p>}
        {listing?.slug && <p><Link href={`/listings/${listing.slug}/`} data-testid="link-visitor-listing">View the listing</Link></p>}
      </section>
    </div>

    <section className="panel-card">
      <h2>History</h2>
      <Timeline events={(events ?? []) as EnquiryEvent[]} viewer="visitor" />
    </section>

    {canCancel && <section className="panel-card">
      <h2>Cancel this request</h2>
      <form action={cancelEnquiry} className="enquiry-cancel">
        <input type="hidden" name="enquiryId" value={e.id} />
        <label>Reason (optional, shared with the business)<input name="reason" maxLength={500} data-testid="input-cancel-reason" /></label>
        <ConfirmButton title="Cancel this request?" message="The business will see that you cancelled it. This cannot be undone." confirmLabel="Cancel request" testId="button-cancel-enquiry">Cancel request</ConfirmButton>
      </form>
    </section>}
    {e.status === 'confirmed' && <p className="bp-muted">To change or cancel a confirmed reservation, please contact the business directly.</p>}
  </PanelShell>;
}
