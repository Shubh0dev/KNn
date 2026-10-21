'use client';

import { startTransition, useActionState, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AMENITIES, DAYS, PRICE_BANDS, SUBTYPES, type BusinessHours } from '@/lib/business/constants';
import type { ActionState } from '@/lib/business/state';

export type ListingDefaults = {
  title?: string | null; category_id?: string | null; subtype?: string | null; summary?: string | null;
  description?: string | null; area?: string | null; address?: string | null;
  latitude?: number | string | null; longitude?: number | string | null;
  contact_phone?: string | null; contact_email?: string | null; website?: string | null;
  price_band?: string | null; price_from?: number | null; price_to?: number | null; price_note?: string | null;
  amenities?: string[] | null; business_hours?: BusinessHours | null;
};

type Category = { id: string; slug: string; name: string };

function Field({ label, name, hint, error, children, wide }: { label: string; name: string; hint?: string; error?: string; children: ReactNode; wide?: boolean }) {
  return <div className={`bp-field ${wide ? 'bp-field-wide' : ''}`}>
    <label htmlFor={`f-${name}`}>{label}</label>
    {children}
    {hint && !error && <small>{hint}</small>}
    {error && <small className="bp-field-error" role="alert">{error}</small>}
  </div>;
}

const PublicTag = () => <span className="bp-tag bp-tag-public">Public</span>;

export function ListingForm({ action, categories, defaults = {}, submitLabel, cancelHref, republishWarning }: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  categories: Category[];
  defaults?: ListingDefaults;
  submitLabel: string;
  cancelHref: string;
  republishWarning?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [categoryId, setCategoryId] = useState(defaults.category_id ?? categories[0]?.id ?? '');
  const [selected, setSelected] = useState<string[]>(defaults.amenities ?? []);
  const slug = categories.find(c => c.id === categoryId)?.slug ?? '';
  const suggested = AMENITIES[slug] ?? [];
  const amenityOptions = [...suggested, ...selected.filter(a => !suggested.includes(a))];
  const err = (name: string) => state?.fieldErrors?.[name];
  const hours = defaults.business_hours ?? {};

  // Submitting through a handler (instead of <form action>) keeps what the
  // user typed when validation fails; React would otherwise reset the form.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  return <form onSubmit={onSubmit} className="bp-form" noValidate>
    {state?.error && <p className="auth-notice auth-error" role="alert">{state.error}</p>}
    {state?.message && <p className="auth-notice auth-success" role="status">{state.message}</p>}
    {republishWarning && <p className="bp-banner bp-banner-warn">This listing is published. Changing the title, description, location, contact details or amenities sends it back for review, and it stays hidden until approved. Hours and pricing can be updated freely.</p>}

    <fieldset className="bp-fieldset">
      <legend>Basics <PublicTag /></legend>
      <Field label="Listing title" name="title" error={err('title')} wide>
        <input id="f-title" name="title" defaultValue={defaults.title ?? ''} maxLength={140} required data-testid="input-listing-title" />
      </Field>
      <Field label="Category" name="category_id" error={err('category_id')}>
        <select id="f-category_id" name="category_id" value={categoryId} onChange={e => setCategoryId(e.target.value)} data-testid="select-listing-category">
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Type" name="subtype" hint="Pick a suggestion or type your own." error={err('subtype')}>
        <input id="f-subtype" name="subtype" list="subtype-options" defaultValue={defaults.subtype ?? ''} maxLength={60} />
        <datalist id="subtype-options">{(SUBTYPES[slug] ?? []).map(s => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="Short summary" name="summary" hint="One or two lines shown on cards. Up to 300 characters." error={err('summary')} wide>
        <input id="f-summary" name="summary" defaultValue={defaults.summary ?? ''} maxLength={300} />
      </Field>
      <Field label="Description" name="description" hint="At least 30 characters. Describe what visitors can expect." error={err('description')} wide>
        <textarea id="f-description" name="description" rows={6} defaultValue={defaults.description ?? ''} maxLength={10000} data-testid="input-listing-description" />
      </Field>
    </fieldset>

    <fieldset className="bp-fieldset">
      <legend>Location <PublicTag /></legend>
      <Field label="Locality or area" name="area" hint="For example Assi, Godowlia, Sarnath." error={err('area')}>
        <input id="f-area" name="area" defaultValue={defaults.area ?? ''} maxLength={80} data-testid="input-listing-area" />
      </Field>
      <Field label="Address" name="address" error={err('address')}>
        <input id="f-address" name="address" defaultValue={defaults.address ?? ''} maxLength={300} />
      </Field>
      <Field label="Latitude (optional)" name="latitude" hint="For the map pin, e.g. 25.3109." error={err('latitude')}>
        <input id="f-latitude" name="latitude" inputMode="decimal" defaultValue={defaults.latitude ?? ''} />
      </Field>
      <Field label="Longitude (optional)" name="longitude" hint="e.g. 83.0107." error={err('longitude')}>
        <input id="f-longitude" name="longitude" inputMode="decimal" defaultValue={defaults.longitude ?? ''} />
      </Field>
    </fieldset>

    <fieldset className="bp-fieldset">
      <legend>Contact <PublicTag /></legend>
      <p className="bp-muted bp-fieldset-note">Shown on your public listing once approved. Leave out anything you do not want visitors to see.</p>
      <Field label="Phone" name="contact_phone" error={err('contact_phone')}>
        <input id="f-contact_phone" name="contact_phone" type="tel" defaultValue={defaults.contact_phone ?? ''} placeholder="+91 98765 43210" />
      </Field>
      <Field label="Email" name="contact_email" error={err('contact_email')}>
        <input id="f-contact_email" name="contact_email" type="email" defaultValue={defaults.contact_email ?? ''} />
      </Field>
      <Field label="Website" name="website" error={err('website')} wide>
        <input id="f-website" name="website" type="url" defaultValue={defaults.website ?? ''} placeholder="https://" />
      </Field>
    </fieldset>

    <fieldset className="bp-fieldset">
      <legend>Opening hours <PublicTag /></legend>
      <p className="bp-muted bp-fieldset-note">Leave a day blank if you do not want to list hours for it. Times use the 24-hour clock.</p>
      {err('business_hours') && <small className="bp-field-error" role="alert">{err('business_hours')}</small>}
      <div className="bp-hours">
        {DAYS.map(({ key, label }) => {
          const day = hours[key];
          return <div className="bp-hours-row" key={key}>
            <span>{label}</span>
            <label className="bp-check"><input type="checkbox" name={`hours_${key}_closed`} defaultChecked={Boolean(day?.closed)} /> Closed</label>
            <input type="time" name={`hours_${key}_open`} defaultValue={day?.open ?? ''} aria-label={`${label} opens`} />
            <span aria-hidden="true">to</span>
            <input type="time" name={`hours_${key}_close`} defaultValue={day?.close ?? ''} aria-label={`${label} closes`} />
          </div>;
        })}
      </div>
    </fieldset>

    <fieldset className="bp-fieldset">
      <legend>Indicative pricing <PublicTag /></legend>
      <p className="bp-muted bp-fieldset-note">Guide prices in rupees help visitors plan. Always say if prices change by season.</p>
      <Field label="Price level" name="price_band" error={err('price_band')}>
        <select id="f-price_band" name="price_band" defaultValue={defaults.price_band ?? ''}>
          <option value="">Not specified</option>
          {PRICE_BANDS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>
      <Field label="From (₹)" name="price_from" error={err('price_from')}>
        <input id="f-price_from" name="price_from" inputMode="numeric" defaultValue={defaults.price_from ?? ''} />
      </Field>
      <Field label="To (₹)" name="price_to" error={err('price_to')}>
        <input id="f-price_to" name="price_to" inputMode="numeric" defaultValue={defaults.price_to ?? ''} />
      </Field>
      <Field label="Pricing note" name="price_note" hint="e.g. per night, per person, varies by season." error={err('price_note')} wide>
        <input id="f-price_note" name="price_note" defaultValue={defaults.price_note ?? ''} maxLength={200} />
      </Field>
    </fieldset>

    {amenityOptions.length > 0 && <fieldset className="bp-fieldset">
      <legend>Features and amenities <PublicTag /></legend>
      {err('amenities') && <small className="bp-field-error" role="alert">{err('amenities')}</small>}
      <div className="bp-checks">{amenityOptions.map(item => <label className="bp-check" key={item}>
        <input type="checkbox" name="amenities" value={item} checked={selected.includes(item)}
          onChange={e => setSelected(e.target.checked ? [...selected, item] : selected.filter(s => s !== item))} /> {item}
      </label>)}</div>
    </fieldset>}

    <div className="bp-form-actions">
      <button type="submit" className="button-primary" disabled={pending} aria-busy={pending} data-testid="button-save-listing">{pending ? 'Saving…' : submitLabel}</button>
      <Link href={cancelHref} className="bp-btn-secondary">Cancel</Link>
    </div>
  </form>;
}
