'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';
import { LoadingButton } from '@/components/loading/LoadingButton';

/**
 * Submit button for Server Action forms: disabled while the action runs, spinner if it takes a moment.
 * With `name`/`value` (several buttons in one form), every button is locked while the form is
 * submitting but only the one that was clicked shows the spinner.
 */
export function SubmitButton({ children, pendingLabel = 'Saving…', className = 'button-primary', disabled, testId, name, value }: {
  children: ReactNode; pendingLabel?: string; className?: string; disabled?: boolean; testId?: string; name?: string; value?: string;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === value);
  return <LoadingButton loading={mine} loadingLabel={pendingLabel} className={className} disabled={disabled || pending} testId={testId} name={name} value={value}>{children}</LoadingButton>;
}
