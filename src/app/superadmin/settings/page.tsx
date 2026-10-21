import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SubmitButton } from '@/components/business/SubmitButton';
import { FlashNotice, PageHeader } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { formatDateTime } from '@/lib/business/format';
import { createPlan, saveSetting, updatePlan } from './actions';

export const metadata: Metadata = { title: 'Settings | Super Admin | KashiNagri', robots: { index: false } };

function SettingCard({ k, title, description, updated, children }: { k: string; title: string; description?: string | null; updated?: string; children: ReactNode }) {
  return <section className="bp-card">
    <h2 className="serif">{title}</h2>
    {description && <p className="bp-muted">{description}</p>}
    <form action={saveSetting} className="bp-form cc-setting-form">
      <input type="hidden" name="key" value={k} />
      {children}
      <div className="bp-form-actions"><SubmitButton className="bp-btn-secondary" pendingLabel="Saving…" testId={`button-save-${k}`}>Save</SubmitButton>{updated && <small className="bp-muted">Last changed {formatDateTime(updated)}</small>}</div>
    </form>
  </section>;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await getSuperContext();
  const params = await searchParams;
  const [settingsResult, plansResult, paymentsResult, subsResult] = await Promise.all([
    supabase.from('platform_settings').select('key, value, description, updated_at'),
    supabase.from('subscription_plans').select('*').order('price_amount'),
    supabase.from('payments').select('id', { count: 'exact', head: true }),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }),
  ]);
  const settings = new Map((settingsResult.data ?? []).map(s => [s.key as string, s as { key: string; value: any; description: string | null; updated_at: string }]));
  const get = (k: string) => settings.get(k)?.value ?? {};
  const lr = get('listing_rules'), mod = get('moderation'), sp = get('sponsored_placements'), pf = get('platform'), af = get('affiliate');
  const plans = (plansResult.data ?? []) as any[];
  const hasBilling = (paymentsResult.count ?? 0) > 0 || (subsResult.count ?? 0) > 0;

  return <>
    <PageHeader title="Platform settings" crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'Settings & plans' }]}
      lede="Every change is validated by the database and written to the audit log. Never paste API keys or secrets here; those belong in server environment variables." />
    <FlashNotice params={params} />

    <div className="bp-settings">
      <SettingCard k="listing_rules" title="Business listing rules" description={settings.get('listing_rules')?.description} updated={settings.get('listing_rules')?.updated_at}>
        <div className="bp-field"><label htmlFor="min-desc">Minimum description length</label><input id="min-desc" name="min_description_length" type="number" min={0} max={2000} defaultValue={lr.min_description_length ?? 30} data-testid="input-min-description" /></div>
        <div className="bp-field"><label htmlFor="max-img">Maximum images per listing</label><input id="max-img" name="max_images" type="number" min={1} max={20} defaultValue={lr.max_images ?? 10} /></div>
        <label className="bp-check"><input type="checkbox" name="require_image" defaultChecked={lr.require_image ?? true} /> Require at least one image before submission</label>
      </SettingCard>

      <SettingCard k="moderation" title="Moderation" description={settings.get('moderation')?.description} updated={settings.get('moderation')?.updated_at}>
        <div className="bp-field"><label htmlFor="report-limit">Reports one person can file per day</label><input id="report-limit" name="report_daily_limit_per_user" type="number" min={1} max={100} defaultValue={mod.report_daily_limit_per_user ?? 10} /></div>
        <p className="bp-muted">Listings are never hidden automatically because of reports. A reviewer always decides.</p>
      </SettingCard>

      <SettingCard k="sponsored_placements" title="Sponsored placements" description={settings.get('sponsored_placements')?.description} updated={settings.get('sponsored_placements')?.updated_at}>
        <label className="bp-check"><input type="checkbox" name="enabled" defaultChecked={sp.enabled ?? false} data-testid="input-sponsored-enabled" /> Allow sponsored placements</label>
        <div className="bp-field"><label htmlFor="sp-label">Public label</label><input id="sp-label" name="label" maxLength={30} defaultValue={sp.label ?? 'Sponsored'} /></div>
        <div className="bp-field"><label htmlFor="sp-max">Homepage featured slots</label><input id="sp-max" name="max_home_slots" type="number" min={1} max={12} defaultValue={sp.max_home_slots ?? 6} /></div>
      </SettingCard>

      <SettingCard k="platform" title="Platform" description={settings.get('platform')?.description} updated={settings.get('platform')?.updated_at}>
        <div className="bp-field"><label htmlFor="pf-name">Site name</label><input id="pf-name" name="site_name" maxLength={60} defaultValue={pf.site_name ?? 'KashiNagri'} /></div>
        <div className="bp-field"><label htmlFor="pf-email">Support email</label><input id="pf-email" name="support_email" type="email" defaultValue={pf.support_email ?? ''} /></div>
        <div className="bp-field bp-field-wide"><label htmlFor="pf-ann">Announcement (optional)</label><input id="pf-ann" name="announcement" maxLength={200} defaultValue={pf.announcement ?? ''} /></div>
      </SettingCard>

      <SettingCard k="affiliate" title="Affiliate programmes" description={settings.get('affiliate')?.description} updated={settings.get('affiliate')?.updated_at}>
        <div className="bp-field bp-field-wide"><label htmlFor="af">One per line: Name | https://website | notes</label>
          <textarea id="af" name="programs" rows={4} defaultValue={(af.programs ?? []).map((p: any) => [p.name, p.website, p.notes].filter(x => x !== undefined).join(' | ')).join('\n')} /></div>
        <p className="bp-muted">Metadata only. Tracking keys and secrets are rejected.</p>
      </SettingCard>

      <section className="bp-card">
        <h2 className="serif">Payments and revenue</h2>
        {hasBilling
          ? <p className="bp-muted">Billing records exist. Revenue is summarised on the overview page.</p>
          : <p><strong>Setup required.</strong> <span className="bp-muted">No payment provider is connected, so no subscription is paid and no revenue is reported. To charge businesses, integrate a provider (for example Razorpay or Stripe) on the server, with webhooks writing to the subscriptions and payments tables. KashiNagri never stores card details.</span></p>}
      </section>
    </div>

    <h2 className="serif cc-section-title">Subscription plans</h2>
    <p className="bp-muted">Plans describe what businesses could buy. Defining a plan charges nobody until a payment provider is connected.</p>
    <div className="bp-stack">
      {plans.map(p => <section className="bp-card" key={p.id}>
        <form action={updatePlan} className="bp-form cc-setting-form">
          <input type="hidden" name="id" value={p.id} />
          <div className="bp-field"><label>Code</label><input value={p.code} readOnly /></div>
          <div className="bp-field"><label htmlFor={`pn-${p.id}`}>Name</label><input id={`pn-${p.id}`} name="name" defaultValue={p.name} maxLength={80} /></div>
          <div className="bp-field"><label htmlFor={`pp-${p.id}`}>Price (₹ per {p.billing_interval})</label><input id={`pp-${p.id}`} name="price_rupees" type="number" min={0} step="0.01" defaultValue={p.price_amount / 100} /></div>
          <div className="bp-field bp-field-wide"><label htmlFor={`pd-${p.id}`}>Description</label><input id={`pd-${p.id}`} name="description" defaultValue={p.description ?? ''} maxLength={1000} /></div>
          <div className="bp-field bp-field-wide"><label htmlFor={`pf-${p.id}`}>Features (one per line)</label><textarea id={`pf-${p.id}`} name="features" rows={3} defaultValue={(p.features?.list ?? []).join('\n')} /></div>
          <label className="bp-check"><input type="checkbox" name="is_active" defaultChecked={p.is_active} /> Offered to businesses</label>
          <div className="bp-form-actions"><SubmitButton className="bp-btn-secondary" pendingLabel="Saving…">Save plan</SubmitButton></div>
        </form>
      </section>)}
      <section className="bp-card">
        <h2 className="serif">New plan</h2>
        <form action={createPlan} className="bp-form cc-setting-form">
          <div className="bp-field"><label htmlFor="np-code">Code</label><input id="np-code" name="code" placeholder="basic_monthly" required data-testid="input-plan-code" /></div>
          <div className="bp-field"><label htmlFor="np-name">Name</label><input id="np-name" name="name" required maxLength={80} data-testid="input-plan-name" /></div>
          <div className="bp-field"><label htmlFor="np-price">Price (₹)</label><input id="np-price" name="price_rupees" type="number" min={0} step="0.01" required data-testid="input-plan-price" /></div>
          <div className="bp-field"><label htmlFor="np-int">Billing interval</label><select id="np-int" name="billing_interval"><option value="month">Monthly</option><option value="year">Yearly</option></select></div>
          <div className="bp-field bp-field-wide"><label htmlFor="np-desc">Description</label><input id="np-desc" name="description" maxLength={1000} /></div>
          <div className="bp-field bp-field-wide"><label htmlFor="np-feat">Features (one per line)</label><textarea id="np-feat" name="features" rows={3} /></div>
          <label className="bp-check"><input type="checkbox" name="is_active" /> Offered to businesses</label>
          <div className="bp-form-actions"><SubmitButton pendingLabel="Creating…" testId="button-create-plan">Create plan</SubmitButton></div>
        </form>
      </section>
    </div>
  </>;
}
