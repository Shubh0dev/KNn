import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="route-not-found page-shell">
      <span className="eyebrow">A quiet turn in the lane</span>
      <h1 className="serif">This page isn’t on our map.</h1>
      <p>Try another discovery, or return to the KashiNagri homepage.</p>
      <Link href="/" className="button-primary" data-testid="link-not-found-home">
        Return home
      </Link>
    </main>
  );
}
