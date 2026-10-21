'use client';

import Link from 'next/link';

/** Fallback for unexpected errors on public pages. Details are logged server-side, never shown. */
export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="route-not-found page-shell">
    <span className="eyebrow">Something went wrong</span>
    <h1 className="serif">This page could not load.</h1>
    <p>Please try again. If it keeps happening, return to the homepage.</p>
    <div className="cc-button-row">
      <button className="button-primary" onClick={reset}>Try again</button>
      <Link href="/" className="partner-secondary">Return home</Link>
    </div>
  </main>;
}
