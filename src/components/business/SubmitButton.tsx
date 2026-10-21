'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

export function SubmitButton({ children, pendingLabel = 'Saving…', className = 'button-primary', disabled, testId }: {
  children: ReactNode; pendingLabel?: string; className?: string; disabled?: boolean; testId?: string;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending} data-testid={testId}>
    {pending ? pendingLabel : children}
  </button>;
}
