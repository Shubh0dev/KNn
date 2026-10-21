import type { Metadata } from 'next';
import { PanelShell } from '@/components/PanelShell';
import { requireSignedIn } from '@/lib/auth/session';
import { OnboardingForm } from './OnboardingForm';

export const metadata: Metadata = { title: 'Register your business | KashiNagri', robots: { index: false } };

export default async function Page() {
  const access = await requireSignedIn('/business/onboarding/');
  return <PanelShell access={access} panel="Business onboarding">
    <div className="onboarding">
      <span className="eyebrow">For the people who make Kashi</span>
      <h1 className="serif panel-title">Register your business</h1>
      <p className="auth-lede">Your business starts as unverified. Our team reviews it before any of its listings can appear publicly.</p>
      <OnboardingForm />
    </div>
  </PanelShell>;
}
