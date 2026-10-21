'use client';

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="bp-empty" role="alert">
    <h2 className="serif">Something went wrong</h2>
    <p>We could not load this page. Your data is safe. Please try again.</p>
    <button className="button-primary" onClick={reset}>Try again</button>
  </div>;
}
