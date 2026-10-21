import type { Metadata } from 'next';
import { Lock } from 'lucide-react';
import { PageHeader, StatusBadge } from '@/components/business/ui';
import { getBusinessContext } from '@/lib/business/context';
import { BUSINESS_TYPES, VERIFICATION_STATUS } from '@/lib/business/constants';
import { SettingsForm } from './SettingsForm';
import { updateBusinessProfile, updateNotifications, updatePrivateDetails, updateProfile } from './actions';

export const metadata: Metadata = { title: 'Settings | Business Panel | KashiNagri', robots: { index: false } };

const Field = ({ label, name, hint, wide, children }: { label: string; name: string; hint?: string; wide?: boolean; children: React.ReactNode }) =>
  <div className={`bp-field ${wide ? 'bp-field-wide' : ''}`}><label htmlFor={`s-${name}`}>{label}</label>{children}{hint && <small>{hint}</small>}</div>;

export default async function Page() {
  const { supabase, access, active } = await getBusinessContext();
  const isOwner = active.member_role === 'owner';

  const [profileResult, businessResult, privateResult] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, preferred_language, notification_preferences').eq('id', access.user.id).maybeSingle(),
    supabase.from('businesses').select('*').eq('id', active.id).maybeSingle(),
    supabase.from('business_private_details').select('*').eq('business_id', active.id).maybeSingle(),
  ]);
  const profile = profileResult.data;
  const business = businessResult.data;
  const details = privateResult.data;
  const prefs = (profile?.notification_preferences ?? {}) as Record<string, boolean>;
  const status = VERIFICATION_STATUS[active.verification_status];
  const nameLocked = active.verification_status === 'verified';

  return <>
    <PageHeader title="Settings" crumbs={[{ label: 'Business', href: '/business/' }, { label: 'Settings' }]} lede="Manage your profile, your public business details and your preferences." />

    <div className="bp-settings">
      <section className="bp-card">
        <h2 className="serif">Your profile <span className="bp-tag bp-tag-private"><Lock size={11} /> Private</span></h2>
        <dl className="bp-readonly">
          <div><dt>Email</dt><dd>{access.user.email}</dd></div>
          <div><dt>Your role here</dt><dd>{isOwner ? 'Business owner' : 'Manager'}</dd></div>
        </dl>
        <SettingsForm action={updateProfile} testId="button-save-profile">
          <Field label="Full name" name="full_name"><input id="s-full_name" name="full_name" defaultValue={profile?.full_name ?? ''} maxLength={120} /></Field>
          <Field label="Phone" name="phone" hint="Only used by our team to reach you."><input id="s-phone" name="phone" type="tel" defaultValue={profile?.phone ?? ''} /></Field>
          <Field label="Language" name="preferred_language">
            <select id="s-preferred_language" name="preferred_language" defaultValue={profile?.preferred_language ?? 'en'}><option value="en">English</option><option value="hi">हिन्दी</option></select>
          </Field>
        </SettingsForm>
      </section>

      <section className="bp-card">
        <h2 className="serif">Notifications</h2>
        <p className="bp-muted">Choose what you want to hear about. Your choices are saved now; email delivery is not switched on yet, so for the moment check the panel for updates.</p>
        <SettingsForm action={updateNotifications} testId="button-save-notifications">
          <label className="bp-check"><input type="checkbox" name="enquiry_email" defaultChecked={prefs.enquiry_email ?? true} /> New enquiries</label>
          <label className="bp-check"><input type="checkbox" name="listing_status_email" defaultChecked={prefs.listing_status_email ?? true} /> Listing review decisions</label>
          <label className="bp-check"><input type="checkbox" name="product_updates" defaultChecked={prefs.product_updates ?? false} /> Product news and tips</label>
        </SettingsForm>
      </section>

      <section className="bp-card bp-card-wide">
        <h2 className="serif">Business profile <span className="bp-tag bp-tag-public">Public</span></h2>
        <p className="bp-muted">These details can appear on your public business page once you are verified.</p>
        <dl className="bp-readonly">
          <div><dt>Verification</dt><dd><StatusBadge label={status?.label ?? active.verification_status} tone={status?.tone ?? 'neutral'} /></dd></div>
          <div><dt>Web address</dt><dd>{business?.slug}</dd></div>
        </dl>
        <SettingsForm action={updateBusinessProfile} testId="button-save-business">
          <Field label="Business name" name="name" hint={nameLocked ? 'Verified names can only be changed by our team. Contact support.' : undefined}>
            <input id="s-name" name="name" defaultValue={business?.name ?? ''} maxLength={120} readOnly={nameLocked} />
          </Field>
          <Field label="Business type" name="business_type">
            <select id="s-business_type" name="business_type" defaultValue={business?.business_type ?? 'other'}>
              {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Locality or area" name="area"><input id="s-area" name="area" defaultValue={business?.area ?? ''} maxLength={80} /></Field>
          <Field label="Address" name="address"><input id="s-address" name="address" defaultValue={business?.address ?? ''} maxLength={300} /></Field>
          <Field label="Public phone" name="public_phone"><input id="s-public_phone" name="public_phone" type="tel" defaultValue={business?.public_phone ?? ''} /></Field>
          <Field label="Public email" name="public_email"><input id="s-public_email" name="public_email" type="email" defaultValue={business?.public_email ?? ''} /></Field>
          <Field label="Website" name="website" wide><input id="s-website" name="website" type="url" defaultValue={business?.website ?? ''} placeholder="https://" /></Field>
          <Field label="Latitude (optional)" name="latitude"><input id="s-latitude" name="latitude" inputMode="decimal" defaultValue={business?.latitude ?? ''} /></Field>
          <Field label="Longitude (optional)" name="longitude"><input id="s-longitude" name="longitude" inputMode="decimal" defaultValue={business?.longitude ?? ''} /></Field>
          <Field label="About your business" name="description" wide><textarea id="s-description" name="description" rows={4} defaultValue={business?.description ?? ''} maxLength={2000} /></Field>
        </SettingsForm>
      </section>

      <section className="bp-card bp-card-wide">
        <h2 className="serif">Private business details <span className="bp-tag bp-tag-private"><Lock size={11} /> Private</span></h2>
        <p className="bp-muted">Visible only to you and the KashiNagri verification team. Never shown to travellers. All fields are optional; share only what helps us verify you.</p>
        <SettingsForm action={updatePrivateDetails} disabled={!isOwner} testId="button-save-private">
          <Field label="Legal or registered name" name="legal_name"><input id="s-legal_name" name="legal_name" defaultValue={details?.legal_name ?? ''} maxLength={200} disabled={!isOwner} /></Field>
          <Field label="Registration number" name="registration_number"><input id="s-registration_number" name="registration_number" defaultValue={details?.registration_number ?? ''} maxLength={60} disabled={!isOwner} /></Field>
          <Field label="GST number" name="gst_number" hint="15 characters, if you are GST registered."><input id="s-gst_number" name="gst_number" defaultValue={details?.gst_number ?? ''} maxLength={15} disabled={!isOwner} /></Field>
          <Field label="Contact email" name="contact_email"><input id="s-contact_email" name="contact_email" type="email" defaultValue={details?.contact_email ?? ''} disabled={!isOwner} /></Field>
          <Field label="Contact phone" name="contact_phone"><input id="s-contact_phone" name="contact_phone" type="tel" defaultValue={details?.contact_phone ?? ''} disabled={!isOwner} /></Field>
          <Field label="Registered address" name="registered_address" wide><textarea id="s-registered_address" name="registered_address" rows={2} defaultValue={details?.registered_address ?? ''} maxLength={500} disabled={!isOwner} /></Field>
        </SettingsForm>
        {!isOwner && <p className="bp-muted">Only the business owner can edit these details.</p>}
      </section>
    </div>
  </>;
}
