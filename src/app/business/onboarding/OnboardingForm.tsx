'use client';

import { useActionState, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { createBusiness } from './actions';

const slugify = (value: string) =>
  value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createBusiness, undefined);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);

  return <form action={action} className="auth-form" noValidate>
    {state?.error && <p className="auth-notice auth-error" role="alert">{state.error}</p>}
    <label>Business name
      <input name="name" value={name} maxLength={120} required data-testid="input-business-name"
        onChange={e => { setName(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }} />
    </label>
    <label>Web address
      <input name="slug" value={slug} maxLength={80} required data-testid="input-business-slug"
        onChange={e => { setSlugEdited(true); setSlug(e.target.value.toLowerCase()); }} />
      <small>kashinagri.com/…/{slug || 'your-business'}</small>
    </label>
    <label>Area of Kashi<input name="area" maxLength={80} placeholder="e.g. Assi, Godowlia, Sarnath" data-testid="input-business-area" /></label>
    <label>About your business<textarea name="description" maxLength={2000} rows={4} data-testid="input-business-description" /></label>
    <button type="submit" className="button-primary auth-submit" disabled={pending} data-testid="button-create-business">
      {pending ? 'Saving…' : 'Create business profile'} {!pending && <ArrowRight size={15} />}
    </button>
  </form>;
}
