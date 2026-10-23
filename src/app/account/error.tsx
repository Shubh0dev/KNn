'use client';

import { ErrorState } from '@/components/loading/ErrorState';

/** Account errors, with a working retry. Details are logged server-side, never shown. */
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-shell panel-main"><ErrorState reset={reset} homeHref="/" homeLabel="Return home" /></main>;
}
