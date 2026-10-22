'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';
import { LoadingButton } from '@/components/loading/LoadingButton';

/** Submit button for Server Action forms: disabled while the action runs, spinner if it takes a moment. */
export function SubmitButton({ children, pendingLabel = 'Saving…', className = 'button-primary', disabled, testId }: {
  children: ReactNode; pendingLabel?: string; className?: string; disabled?: boolean; testId?: string;
}) {
  const { pending } = useFormStatus();
  return <LoadingButton loading={pending} loadingLabel={pendingLabel} className={className} disabled={disabled} testId={testId}>{children}</LoadingButton>;
}
