'use client';

import { useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoadingButton } from './LoadingButton';

/**
 * Error boundary content with a working retry: it re-fetches the page from the
 * server (router.refresh) and resets the boundary. The button shows a spinner
 * only while that retry is actually running. Error details are never shown.
 */
export function ErrorState({ reset, title = 'Something went wrong', message = 'We could not load this page. Your data is safe. Please try again.', homeHref, homeLabel = 'Go back', className = 'bp-empty' }: {
  reset: () => void; title?: string; message?: ReactNode; homeHref?: string; homeLabel?: string; className?: string;
}) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  return <div className={className} role="alert" data-testid="error-state">
    <h2 className="serif">{title}</h2>
    <p>{message}</p>
    <div className="cc-button-row">
      <LoadingButton type="button" loading={retrying} loadingLabel="Retrying…" testId="button-error-retry"
        onClick={() => startRetry(() => { router.refresh(); reset(); })}>Try again</LoadingButton>
      {homeHref && <Link href={homeHref} className="bp-btn-secondary">{homeLabel}</Link>}
    </div>
  </div>;
}
