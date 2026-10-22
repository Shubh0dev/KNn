'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Phone } from 'lucide-react';
import { addDays, indiaNow, telHref, type EnquiryKind } from '@/lib/enquiries/rules';
import { sendEnquiry } from './actions';
import { LoadingButton } from '@/components/loading/LoadingButton';

type Props = {
  listingId: string; slug: string; kind: EnquiryKind; offered: EnquiryKind; businessName: string;
  signedIn: boolean; name: string; email: string;
};

const FIELDS = ['name', 'phone', 'email', 'message', 'checkIn', 'checkOut', 'date', 'time', 'guests', 'rooms', 'experience', 'contactWhatsapp'] as const;
const draftKey = (slug: string) => `kn_enquiry_draft:${slug}`;

/** The draft lives only in this tab (sessionStorage), never in a URL or on the server, until it is sent. */
function readDraft(slug: string): Record<string, string> | null {
  try { return JSON.parse(sessionStorage.getItem(draftKey(slug)) ?? 'null'); } catch { return null; }
}
function writeDraft(slug: string, form: HTMLFormElement) {
  const data = new FormData(form);
  const draft: Record<string, string> = {};
  for (const key of FIELDS) { const v = data.get(key); if (typeof v === 'string' && v) draft[key] = v; }
  try { sessionStorage.setItem(draftKey(slug), JSON.stringify(draft)); } catch { /* storage unavailable: the form keeps its values in place */ }
}
const clearDraft = (slug: string) => { try { sessionStorage.removeItem(draftKey(slug)); } catch { /* ignore */ } };

export function EnquiryForm({ listingId, slug, kind, offered, businessName, signedIn, name, email }: Props) {
  const [state, action, pending] = useActionState(sendEnquiry, undefined);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [token] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : ''));
  const [restored, setRestored] = useState(false);
  const { date: today } = indiaNow();
  const next = `/listings/${slug}/enquire/${kind === 'general' && offered !== 'general' ? '?type=general' : ''}`;

  // Restore a draft saved before signing in.
  useEffect(() => {
    const draft = readDraft(slug);
    const form = formRef.current;
    if (!draft || !form) return;
    for (const [key, value] of Object.entries(draft)) {
      const el = form.elements.namedItem(key);
      if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = value === 'on';
      else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = value;
    }
    setRestored(true);
  }, [slug]);

  useEffect(() => {
    if (state?.sent) clearDraft(slug);
    if (state && 'needsSignIn' in state && state.needsSignIn && formRef.current) {
      writeDraft(slug, formRef.current);
      router.push(`/login/?next=${encodeURIComponent(next)}`);
    }
  }, [state, slug, next, router]);

  if (state?.sent) {
    const s = state.sent;
    return <section className="enquiry-success" role="status" data-testid="enquiry-sent">
      <CheckCircle2 size={28} aria-hidden="true" />
      <h2 className="serif">Request sent to {s.businessName}</h2>
      <p className="enquiry-ref">Reference <strong data-testid="enquiry-reference">{s.reference}</strong></p>
      <p><strong>Awaiting confirmation.</strong> {s.kind === 'general'
        ? 'The business will reply to you directly.'
        : 'This is not a confirmed booking yet. The business will contact you about availability.'}</p>
      {s.phone
        ? <p>You can also contact the business directly: <a href={telHref(s.phone)} data-testid="success-business-phone"><Phone size={14} /> {s.phone}</a></p>
        : <p>The business has not published a phone number; they will contact you.</p>}
      <p className="bp-muted">We have not sent an email or SMS. Follow the status in your account.</p>
      <div className="enquiry-success-actions">
        <Link href={`/account/enquiries/${s.id}/`} className="button-primary" data-testid="link-view-enquiry">Track this request</Link>
        <Link href={`/listings/${s.slug}/`} className="partner-secondary">Back to {s.title}</Link>
      </div>
    </section>;
  }

  const err = (k: string) => state && 'fieldErrors' in state ? state.fieldErrors?.[k] : undefined;
  const fieldError = (k: string) => err(k) && <small className="bp-field-error" id={`err-${k}`}>{err(k)}</small>;
  const aria = (k: string) => (err(k) ? { 'aria-invalid': true, 'aria-describedby': `err-${k}` } : {});

  return <form ref={formRef} className="auth-form enquiry-form" noValidate onSubmit={event => {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    if (!signedIn) {
      writeDraft(slug, form);
      router.push(`/login/?next=${encodeURIComponent(next)}`);
      return;
    }
    const data = new FormData(form);
    startTransition(() => action(data));
  }}>
    {state && 'error' in state && state.error && <p className="auth-notice auth-error" role="alert" data-testid="enquiry-error">{state.error}</p>}
    {restored && !state && <p className="auth-notice" role="status">We restored the details you entered before signing in. Check them and send your request.</p>}
    <input type="hidden" name="listingId" value={listingId} />
    <input type="hidden" name="slug" value={slug} />
    <input type="hidden" name="kind" value={kind} />
    <input type="hidden" name="clientToken" value={token} />

    {kind === 'stay' && <fieldset className="enquiry-grid">
      <legend>Your stay</legend>
      <label>Check-in<input name="checkIn" type="date" min={today} max={addDays(today, 365)} required data-testid="input-enquiry-checkin" {...aria('checkIn')} />{fieldError('checkIn')}</label>
      <label>Check-out<input name="checkOut" type="date" min={addDays(today, 1)} required data-testid="input-enquiry-checkout" {...aria('checkOut')} />{fieldError('checkOut')}</label>
      <label>Guests<input name="guests" type="number" inputMode="numeric" min={1} max={50} defaultValue={2} required data-testid="input-enquiry-guests" {...aria('guests')} />{fieldError('guests')}</label>
      <label>Rooms<input name="rooms" type="number" inputMode="numeric" min={1} max={20} defaultValue={1} required data-testid="input-enquiry-rooms" {...aria('rooms')} />{fieldError('rooms')}</label>
    </fieldset>}
    {kind === 'table' && <fieldset className="enquiry-grid">
      <legend>Your reservation</legend>
      <label>Date<input name="date" type="date" min={today} max={addDays(today, 180)} required data-testid="input-enquiry-date" {...aria('date')} />{fieldError('date')}</label>
      <label>Time<input name="time" type="time" required data-testid="input-enquiry-time" {...aria('time')} />{fieldError('time')}</label>
      <label>Party size<input name="guests" type="number" inputMode="numeric" min={1} max={50} defaultValue={2} required data-testid="input-enquiry-guests" {...aria('guests')} />{fieldError('guests')}</label>
    </fieldset>}
    {kind === 'experience' && <fieldset className="enquiry-grid">
      <legend>Your booking</legend>
      <label className="enquiry-wide">Experience or service<input name="experience" maxLength={200} placeholder="e.g. Sunrise boat ride, heritage walk" data-testid="input-enquiry-experience" {...aria('experience')} />{fieldError('experience')}</label>
      <label>Preferred date<input name="date" type="date" min={today} max={addDays(today, 365)} required data-testid="input-enquiry-date" {...aria('date')} />{fieldError('date')}</label>
      <label>Participants<input name="guests" type="number" inputMode="numeric" min={1} max={50} defaultValue={2} required data-testid="input-enquiry-guests" {...aria('guests')} />{fieldError('guests')}</label>
    </fieldset>}

    <fieldset className="enquiry-grid">
      <legend>Your contact details</legend>
      <label className="enquiry-wide">Full name<input name="name" defaultValue={name} maxLength={120} autoComplete="name" required data-testid="input-enquiry-name" {...aria('name')} />{fieldError('name')}</label>
      <label>Contact number<input name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" required data-testid="input-enquiry-phone" {...aria('phone')} />{fieldError('phone')}</label>
      <label>Email<input name="email" type="email" defaultValue={email} autoComplete="email" required data-testid="input-enquiry-email" {...aria('email')} />{fieldError('email')}</label>
      <label className="bp-check enquiry-wide"><input type="checkbox" name="contactWhatsapp" data-testid="input-enquiry-whatsapp" /> The business may message me on WhatsApp at this number</label>
    </fieldset>
    <label>{kind === 'general' ? 'Message' : 'Message or special requirements (optional)'}
      <textarea name="message" rows={4} maxLength={2000} placeholder={kind === 'general' ? 'Your question for the business…' : 'Arrival time, accessibility needs, questions…'} data-testid="input-enquiry-message" {...aria('message')} />
      {fieldError('message')}
    </label>
    <small className="bp-muted">Only {businessName} sees your name, number and email. They are never shown publicly.</small>
    <LoadingButton loading={pending} loadingLabel="Sending…" className="button-primary auth-submit" testId="button-send-enquiry">
      {signedIn ? 'Send request' : 'Sign in to send'}
    </LoadingButton>
    {!signedIn && <p className="bp-muted">You need a free account so you can follow the reply. Your details stay on this device while you sign in. <Link href={`/register/?next=${encodeURIComponent(next)}`} onClick={() => { if (formRef.current) writeDraft(slug, formRef.current); }} data-testid="link-enquiry-register">Create an account</Link></p>}
    {kind !== 'general' && offered !== 'general' && <p className="bp-muted"><Link href={`/listings/${slug}/enquire/?type=general`}>Just have a question? Send a message instead</Link></p>}
  </form>;
}
