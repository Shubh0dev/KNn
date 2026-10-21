import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { ResetPasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Choose a new password | KashiNagri', robots: { index: false } };

export default async function Page() {
  // Reached through the recovery link, which signs the user in first.
  const user = await getSessionUser();
  if (!user) {
    return <>
      <span className="eyebrow">Account recovery</span>
      <h1 className="serif">Link expired</h1>
      <p className="auth-lede">Open the most recent reset link from your email, or request a new one.</p>
      <div className="auth-links"><Link href="/forgot-password/" className="button-primary">Request a new link</Link></div>
    </>;
  }
  return <>
    <span className="eyebrow">Account recovery</span>
    <h1 className="serif">Choose a new password</h1>
    <p className="auth-lede">For {user.email}</p>
    <ResetPasswordForm />
  </>;
}
