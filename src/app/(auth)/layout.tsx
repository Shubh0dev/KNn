import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="auth-page">
    <aside className="auth-art" aria-hidden="true">
      <span className="sun-disc" />
      <span className="auth-art-stamp">काशी</span>
      <p className="auth-art-note">A city best explored<br />one moment at a time.</p>
    </aside>
    <main className="auth-main">
      <Link href="/" className="brand-lockup auth-brand" aria-label="KashiNagri home" data-testid="link-auth-brand">
        <span className="brand-mark" aria-hidden="true"><span>क</span></span>
        <span className="brand-copy"><strong>KashiNagri</strong><small>Your Complete Guide to Kashi</small></span>
      </Link>
      <div className="auth-card fade-up">{children}</div>
      <Link href="/" className="auth-back" data-testid="link-auth-back">← Keep browsing Kashi without an account</Link>
    </main>
  </div>;
}
