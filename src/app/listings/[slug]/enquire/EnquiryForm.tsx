'use client';

import { startTransition, useActionState } from 'react';
import { sendEnquiry } from './actions';

export function EnquiryForm({ listingId, slug, name, email }: { listingId: string; slug: string; name: string; email: string }) {
  const [state, action, pending] = useActionState(sendEnquiry, undefined);
  if (state?.message) return <p className="auth-notice auth-success" role="status" data-testid="enquiry-sent">{state.message}</p>;
  const err = (k: string) => state?.fieldErrors?.[k];
  return <form className="auth-form" noValidate onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }}>
    {state?.error && <p className="auth-notice auth-error" role="alert">{state.error}</p>}
    <input type="hidden" name="listingId" value={listingId} />
    <input type="hidden" name="slug" value={slug} />
    <label>Your name<input name="name" defaultValue={name} maxLength={120} autoComplete="name" data-testid="input-enquiry-name" />{err('name') && <small className="bp-field-error">{err('name')}</small>}</label>
    <label>Email for the reply<input name="email" type="email" defaultValue={email} autoComplete="email" data-testid="input-enquiry-email" />{err('email') && <small className="bp-field-error">{err('email')}</small>}</label>
    <label>Phone (optional)<input name="phone" type="tel" autoComplete="tel" data-testid="input-enquiry-phone" />{err('phone') && <small className="bp-field-error">{err('phone')}</small>}</label>
    <label>Message<textarea name="message" rows={5} maxLength={2000} placeholder="Dates, number of people, questions…" data-testid="input-enquiry-message" />{err('message') && <small className="bp-field-error">{err('message')}</small>}</label>
    <small className="bp-muted">Only this business and authorised KashiNagri staff can read your enquiry.</small>
    <button type="submit" className="button-primary auth-submit" disabled={pending} data-testid="button-send-enquiry">{pending ? 'Sending…' : 'Send enquiry'}</button>
  </form>;
}
