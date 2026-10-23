'use client';

import { ErrorState } from '@/components/loading/ErrorState';

/** Business Panel errors, with a working retry. The sidebar stays; details are logged server-side, never shown. */
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reset={reset} homeHref="/business/" homeLabel="Business overview" />;
}
