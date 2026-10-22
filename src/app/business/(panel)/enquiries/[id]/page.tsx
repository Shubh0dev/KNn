import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, Mail, MessageCircle, Phone } from 'lucide-react';
import { FlashNotice, PageHeader } from '@/components/business/ui';
import { SubmitButton } from '@/components/business/SubmitButton';
import { EnquiryStatus, RequestDetails, Timeline, type EnquiryEvent, type EnquiryRow } from '@/components/enquiries/EnquiryParts';
import { getBusinessContext } from '@/lib/business/context';
import { isUuid } from '@/lib/business/state';
import { ACTION_LABELS, ENQUIRY_STATUS, isOpenStatus, messageRequired, nextStatuses, telHref, whatsappHref } from '@/lib/enquiries/rules';
import { updateEnquiry } from '../actions';
import { MarkSeen } from './MarkSeen';

export const metadata: Metadata = { title: 'Enquiry | Business Panel | KashiNagri', robots: { index: false } };

type Detail = EnquiryRow & {
  sender_name: string; sender_phone: string | null; sender_email: string; contact_whatsapp: boolean;
  responded_at: string | null; listing_id: string; listings: { title: string; slug: string; status: string } | { title: string; slug: string; status: string }[] | null;
};

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase, active, access } = await getBusinessContext();
  const flash = await searchParams;

  const load = () => supabase.from('enquiries')
    .select('id, reference, status, enquiry_type, created_at, updated_at, responded_at, check_in, check_out, requested_date, requested_time, guests, rooms, experience, message, business_response, sender_name, sender_phone, sender_email, contact_whatsapp, listing_id, listings ( title, slug, status )')
    .eq('id', id).eq('business_id', active.id).maybeSingle();
  const { data } = await load();
  if (!data) notFound();
  const e = data as unknown as Detail;
  const listing = Array.isArray(e.listings) ? e.listings[0] : e.listings;
  const { data: events } = await supabase.from('enquiry_events').select('actor, from_status, to_status, message, created_at').eq('enquiry_id', id).order('created_at');

  const wa = e.contact_whatsapp ? whatsappHref(e.sender_phone, `Namaste ${e.sender_name.split(' ')[0]}, this is ${active.name} on KashiNagri about your request ${e.reference}.`) : null;
  const options = nextStatuses(e.status, 'business');
  const open = isOpenStatus(e.status);

  return <>
    <PageHeader
      title={e.sender_name}
      crumbs={[{ label: 'Business', href: '/business/' }, { label: 'Enquiries', href: '/business/enquiries/' }, { label: e.reference }]}
      lede={`${listing?.title ?? 'Listing'} · reference ${e.reference}`}
    />
    <FlashNotice params={flash} />
    <MarkSeen enquiryId={e.id} />

    <div className="bp-enquiry-detail">
      <section className="bp-card" aria-labelledby="contact-heading">
        <div className="bp-card-head"><h2 id="contact-heading" className="serif">Traveller</h2><EnquiryStatus status={e.status} /></div>
        <dl className="enquiry-details">
          <div><dt>Name</dt><dd data-testid="enquiry-visitor-name">{e.sender_name}</dd></div>
          <div><dt>Contact number</dt><dd>{e.sender_phone ? <a href={telHref(e.sender_phone)} data-testid="enquiry-visitor-phone">{e.sender_phone}</a> : 'Not given'}</dd></div>
          <div><dt>Email</dt><dd>{e.sender_email ? <a href={`mailto:${e.sender_email}`} data-testid="enquiry-visitor-email">{e.sender_email}</a> : 'Not given'}</dd></div>
          <div><dt>WhatsApp</dt><dd>{e.contact_whatsapp ? (wa ? 'Allowed by the traveller' : 'Allowed, but this number cannot receive WhatsApp') : 'Not allowed; please call or email'}</dd></div>
        </dl>
        <div className="bp-actions">
          {e.sender_phone && <a href={telHref(e.sender_phone)} className="button-primary" data-testid="button-call-visitor"><Phone size={15} /> Call</a>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="bp-btn-secondary" data-testid="button-whatsapp-visitor"><MessageCircle size={15} /> WhatsApp</a>}
          {e.sender_email && <a href={`mailto:${e.sender_email}?subject=${encodeURIComponent(`Your request ${e.reference}`)}`} className="bp-btn-secondary"><Mail size={15} /> Email</a>}
        </div>
        <p className="bp-muted">Use these details only to handle this request.</p>
      </section>

      <section className="bp-card" aria-labelledby="request-heading">
        <h2 id="request-heading" className="serif">Request</h2>
        <RequestDetails e={e} />
        {e.message && <><h3>Message from the traveller</h3><p className="enquiry-message" data-testid="enquiry-visitor-message">{e.message}</p></>}
        {listing && <p className="bp-links">
          <Link href={`/business/listings/${e.listing_id}/edit/`}>Edit listing</Link>
          {listing.status === 'published' && <Link href={`/listings/${listing.slug}/`} target="_blank">Public page <ExternalLink size={12} /></Link>}
        </p>}
      </section>
    </div>

    <section className="bp-card" aria-labelledby="respond-heading">
      <h2 id="respond-heading" className="serif">Respond</h2>
      {open
        ? <form action={updateEnquiry} className="bp-form enquiry-respond">
            <input type="hidden" name="enquiryId" value={e.id} />
            <fieldset className="enquiry-status-options">
              <legend>Update the status</legend>
              <label className="bp-radio"><input type="radio" name="status" value={e.status} defaultChecked data-testid="status-option-message" /> Keep as {ENQUIRY_STATUS[e.status]?.label ?? e.status} and send a message</label>
              {options.map(s => <label key={s} className="bp-radio"><input type="radio" name="status" value={s} data-testid={`status-option-${s}`} /> {ACTION_LABELS[s] ?? s}{messageRequired(s) ? ' (message required)' : ''}</label>)}
            </fieldset>
            <label className="bp-field">Message to the traveller<textarea name="message" rows={4} maxLength={2000}
              placeholder="e.g. A double room is free for these dates at ₹2,500 per night. Please call to confirm." data-testid="input-enquiry-response" /></label>
            <p className="bp-muted">The traveller sees this message and the status in their KashiNagri account. No email or SMS is sent. Confirm the reservation only after you have agreed it with them.</p>
            <SubmitButton className="button-primary" pendingLabel="Saving…" testId="button-update-enquiry">Save update</SubmitButton>
          </form>
        : <p className="bp-muted">This enquiry is {ENQUIRY_STATUS[e.status]?.label.toLowerCase() ?? e.status} and can no longer be updated.</p>}
    </section>

    <section className="bp-card" aria-labelledby="history-heading">
      <h2 id="history-heading" className="serif">History</h2>
      <Timeline events={(events ?? []) as EnquiryEvent[]} viewer="business" />
    </section>
  </>;
}
