'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { LoadingButton } from '@/components/loading/LoadingButton';
import { BUSINESS_TYPES } from '@/lib/business/constants';
import { slugify } from '@/lib/business/validation';
import { createBusiness } from './actions';

const STEPS = ['About your business', 'Contact and location', 'Details for verification'];
const STEP_OF_FIELD: Record<string, number> = {
  name: 0, business_type: 0, slug: 0, area: 0,
  public_phone: 1, public_email: 1, website: 1, address: 1, latitude: 1, longitude: 1,
  description: 2, legal_name: 2, registration_number: 2, gst_number: 2,
};

function Field({ label, name, hint, error, children, wide }: { label: string; name: string; hint?: string; error?: string; children: ReactNode; wide?: boolean }) {
  return <div className={`bp-field ${wide ? 'bp-field-wide' : ''}`}>
    <label htmlFor={`o-${name}`}>{label}</label>{children}
    {hint && !error && <small>{hint}</small>}
    {error && <small className="bp-field-error" role="alert">{error}</small>}
  </div>;
}

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createBusiness, undefined);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const err = (n: string) => state?.fieldErrors?.[n];

  // Jump to the step that holds the first server-reported error.
  useEffect(() => {
    const first = Object.keys(state?.fieldErrors ?? {})[0];
    if (first && first in STEP_OF_FIELD) setStep(STEP_OF_FIELD[first]);
  }, [state]);

  const stepIsValid = () => {
    const fields = panels.current[step]?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea') ?? [];
    for (const field of fields) {
      if (!field.checkValidity()) { field.reportValidity(); return false; }
    }
    return true;
  };

  return <form
    className="bp-form bp-wizard"
    noValidate
    onSubmit={event => {
      event.preventDefault();
      if (step < STEPS.length - 1) { if (stepIsValid()) setStep(step + 1); return; }
      const data = new FormData(event.currentTarget);
      startTransition(() => action(data));
    }}
  >
    <ol className="bp-wizard-steps" aria-label="Progress">
      {STEPS.map((label, i) => <li key={label} className={i === step ? 'is-current' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
        <span>{i + 1}</span>{label}
      </li>)}
    </ol>

    {state?.error && <p className="auth-notice auth-error" role="alert">{state.error}</p>}

    <div ref={el => { panels.current[0] = el; }} hidden={step !== 0} className="bp-step-panel">
      <p className="bp-muted"><span className="bp-tag bp-tag-public">Public</span> These details can appear on your business page once verified.</p>
      <Field label="What kind of business is it?" name="business_type" error={err('business_type')} wide>
        <select id="o-business_type" name="business_type" defaultValue="" required data-testid="select-business-type">
          <option value="" disabled>Choose one…</option>
          {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>
      <Field label="Business name" name="name" error={err('name')} wide>
        <input id="o-name" name="name" value={name} maxLength={120} minLength={2} required data-testid="input-business-name"
          onChange={e => { setName(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }} />
      </Field>
      <Field label="Web address" name="slug" hint={`kashinagri.com/…/${slug || 'your-business'}`} error={err('slug')}>
        <input id="o-slug" name="slug" value={slug} maxLength={80} minLength={3} required pattern="[a-z0-9]+(-[a-z0-9]+)*" data-testid="input-business-slug"
          onChange={e => { setSlugEdited(true); setSlug(e.target.value.toLowerCase()); }} />
      </Field>
      <Field label="Locality or area of Kashi" name="area" hint="e.g. Assi, Godowlia, Sarnath" error={err('area')}>
        <input id="o-area" name="area" maxLength={80} minLength={2} required data-testid="input-business-area" />
      </Field>
    </div>

    <div ref={el => { panels.current[1] = el; }} hidden={step !== 1} className="bp-step-panel">
      <p className="bp-muted"><span className="bp-tag bp-tag-public">Public</span> Add only the contact details you want travellers to see. All fields here are optional.</p>
      <Field label="Public phone" name="public_phone" error={err('public_phone')}><input id="o-public_phone" name="public_phone" type="tel" placeholder="+91 98765 43210" /></Field>
      <Field label="Public email" name="public_email" error={err('public_email')}><input id="o-public_email" name="public_email" type="email" /></Field>
      <Field label="Website" name="website" error={err('website')} wide><input id="o-website" name="website" type="url" placeholder="https://" /></Field>
      <Field label="Address" name="address" error={err('address')} wide><input id="o-address" name="address" maxLength={300} /></Field>
      <Field label="Latitude (optional)" name="latitude" error={err('latitude')}><input id="o-latitude" name="latitude" inputMode="decimal" /></Field>
      <Field label="Longitude (optional)" name="longitude" error={err('longitude')}><input id="o-longitude" name="longitude" inputMode="decimal" /></Field>
    </div>

    <div ref={el => { panels.current[2] = el; }} hidden={step !== 2} className="bp-step-panel">
      <p className="bp-muted"><span className="bp-tag bp-tag-public">Public</span> A short description helps travellers understand what you offer.</p>
      <Field label="About your business" name="description" error={err('description')} wide><textarea id="o-description" name="description" rows={4} maxLength={2000} /></Field>
      <p className="bp-muted bp-wide"><span className="bp-tag bp-tag-private"><Lock size={11} /> Private</span> Optional. Seen only by you and our verification team, never by travellers. You can add or change these later in Settings.</p>
      <Field label="Legal or registered name" name="legal_name" error={err('legal_name')}><input id="o-legal_name" name="legal_name" maxLength={200} /></Field>
      <Field label="Registration number" name="registration_number" error={err('registration_number')}><input id="o-registration_number" name="registration_number" maxLength={60} /></Field>
      <Field label="GST number" name="gst_number" hint="Only if you are GST registered." error={err('gst_number')}><input id="o-gst_number" name="gst_number" maxLength={15} /></Field>
      <p className="bp-muted bp-wide">Creating your profile does not verify it. In the next step you can upload a document and request verification; our team makes the decision.</p>
    </div>

    <div className="bp-form-actions">
      {step > 0 && <button type="button" className="bp-btn-secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Back</button>}
      <LoadingButton loading={pending} loadingLabel="Creating…" testId="button-create-business">
        {step < STEPS.length - 1 ? <>Continue <ArrowRight size={15} /></> : 'Create business profile'}
      </LoadingButton>
    </div>
  </form>;
}
