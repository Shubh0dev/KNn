'use client';

import { startTransition, useActionState } from 'react';
import { revealContact } from '../actions';
import { LoadingButton } from '@/components/loading/LoadingButton';

export function RevealContact({ enquiryId, masked }: { enquiryId: string; masked: { phone: string | null; email: string | null } }) {
  const [state, action, pending] = useActionState(revealContact, undefined);
  if (state?.contact) {
    return <><dl className="enquiry-details" data-testid="revealed-contact">
      <div><dt>Name</dt><dd>{state.contact.name}</dd></div>
      <div><dt>Phone</dt><dd>{state.contact.phone ?? 'Not given'}</dd></div>
      <div><dt>Email</dt><dd>{state.contact.email}</dd></div>
    </dl><p className="bp-muted">This reveal was recorded in the audit log.</p></>;
  }
  return <form className="bp-form" noValidate onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }}>
    <dl className="enquiry-details">
      <div><dt>Phone</dt><dd>{masked.phone ?? 'Not given'}</dd></div>
      <div><dt>Email</dt><dd>{masked.email ?? 'Not given'}</dd></div>
    </dl>
    {state?.error && <p className="auth-notice auth-error" role="alert">{state.error}</p>}
    <input type="hidden" name="enquiryId" value={enquiryId} />
    <label className="bp-field">Reason for viewing the contact details (recorded in the audit log)
      <input name="reason" maxLength={500} placeholder="e.g. Visitor dispute, support ticket 123" data-testid="input-reveal-reason" />
    </label>
    <LoadingButton loading={pending} loadingLabel="Checking…" className="bp-btn-secondary" testId="button-reveal-contact">Show contact details</LoadingButton>
  </form>;
}
