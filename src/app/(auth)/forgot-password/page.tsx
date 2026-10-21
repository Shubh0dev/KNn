import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Reset your password | KashiNagri', robots: { index: false } };

export default function Page() {
  return <>
    <span className="eyebrow">Account recovery</span>
    <h1 className="serif">Forgot your password?</h1>
    <p className="auth-lede">Enter your email and we will send you a link to choose a new one.</p>
    <ForgotPasswordForm />
    <div className="auth-links"><Link href="/login/">Back to sign in</Link></div>
  </>;
}
