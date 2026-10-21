'use client';

import { startTransition, useActionState } from 'react';
import { REPORT_REASONS } from '@/lib/admin/constants';
import { reportListing } from './actions';

export function ReportForm({ listingId, slug }: { listingId: string; slug: string }) {
  const [state, action, pending] = useActionState(reportListing, undefined);
  if (state?.message) return <p className="auth-notice auth-success" role="status" data-testid="report-sent">{state.message}</p>;
  return <form className="auth-form" noValidate onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }}>
    {state?.error && <p className="auth-notice auth-error" role="alert">{state.error}</p>}
    <input type="hidden" name="listingId" value={listingId} />
    <input type="hidden" name="slug" value={slug} />
    <label>What is wrong?
      <select name="reason" defaultValue="" required data-testid="select-report-reason">
        <option value="" disabled>Choose a reason…</option>
        {Object.entries(REPORT_REASONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
    <label>Details (optional)<textarea name="details" rows={4} maxLength={1000} data-testid="input-report-details" /></label>
    <button type="submit" className="button-primary auth-submit" disabled={pending} data-testid="button-send-report">{pending ? 'Sending…' : 'Send report'}</button>
  </form>;
}
