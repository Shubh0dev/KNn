'use client';

import { useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { LoadingButton } from '@/components/loading/LoadingButton';

/**
 * Button that asks for confirmation in a modal <dialog> before submitting its
 * parent form. Use for destructive actions.
 */
export function ConfirmButton({ children, title, message, confirmLabel = 'Confirm', className = 'bp-btn-danger', testId, pendingLabel = 'Saving…' }: {
  children: ReactNode; title: string; message: string; confirmLabel?: string; className?: string; testId?: string; pendingLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { pending } = useFormStatus();
  return <>
    {/* The trigger shows the progress once confirmed (the dialog closes on submit). */}
    <LoadingButton type="button" loading={pending} loadingLabel={pendingLabel} className={className} onClick={() => dialog.current?.showModal()} testId={testId}>{children}</LoadingButton>
    <dialog ref={dialog} className="bp-dialog" aria-labelledby="bp-dialog-title">
      <h2 id="bp-dialog-title" className="serif">{title}</h2>
      <p>{message}</p>
      <div className="bp-dialog-actions">
        <button type="button" className="bp-btn-secondary" onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="submit" className={className} onClick={() => dialog.current?.close()} data-testid={testId ? `${testId}-confirm` : undefined}>{confirmLabel}</button>
      </div>
    </dialog>
  </>;
}
