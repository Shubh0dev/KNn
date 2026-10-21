'use client';

import { startTransition, useActionState, type ReactNode } from 'react';
import type { ActionState } from '@/lib/business/state';

/**
 * Wraps server-rendered inputs in a form that reports success/errors inline.
 * Submits through a handler so typed values survive a validation error.
 */
export function SettingsForm({ action, children, submitLabel = 'Save changes', disabled, testId }: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel?: string;
  disabled?: boolean;
  testId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return <form
    className="bp-form"
    noValidate
    onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      startTransition(() => formAction(data));
    }}
  >
    {state?.error && <div className="auth-notice auth-error" role="alert">
      {state.error}
      {state.fieldErrors && Object.keys(state.fieldErrors).length > 1 && <ul>{Object.entries(state.fieldErrors).map(([k, v]) => <li key={k}>{v}</li>)}</ul>}
    </div>}
    {state?.message && <p className="auth-notice auth-success" role="status">{state.message}</p>}
    {children}
    {!disabled && <div className="bp-form-actions">
      <button type="submit" className="button-primary" disabled={pending} aria-busy={pending} data-testid={testId}>{pending ? 'Saving…' : submitLabel}</button>
    </div>}
  </form>;
}
