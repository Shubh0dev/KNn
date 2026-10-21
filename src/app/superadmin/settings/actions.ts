'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSuperContext, revalidatePublic } from '@/lib/admin/context';
import { friendlyDbError, isUuid } from '@/lib/business/state';

const go = (key: 'notice' | 'error', value: string) => redirect(`/superadmin/settings/?${key}=${encodeURIComponent(value)}`);
const int = (v: FormDataEntryValue | null) => Number.parseInt(String(v ?? ''), 10);
const text = (v: FormDataEntryValue | null) => String(v ?? '').trim();

function buildValue(key: string, f: FormData): Record<string, unknown> | string {
  switch (key) {
    case 'listing_rules':
      return { min_description_length: int(f.get('min_description_length')), require_image: f.get('require_image') === 'on', max_images: int(f.get('max_images')) };
    case 'moderation':
      return { report_daily_limit_per_user: int(f.get('report_daily_limit_per_user')), auto_hide_on_reports: false };
    case 'sponsored_placements':
      return { enabled: f.get('enabled') === 'on', label: text(f.get('label')).slice(0, 30), max_home_slots: int(f.get('max_home_slots')) };
    case 'platform':
      return { site_name: text(f.get('site_name')), support_email: text(f.get('support_email')) || null, announcement: text(f.get('announcement')) || null };
    case 'affiliate': {
      const programs = text(f.get('programs')).split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const [name = '', website = '', notes = ''] = line.split('|').map(p => p.trim());
        return { name: name.slice(0, 80), website: website.slice(0, 300), notes: notes.slice(0, 300) };
      });
      if (programs.length > 20) return 'At most 20 affiliate programmes.';
      if (programs.some(p => !p.name || (p.website && !/^https?:\/\/\S+$/i.test(p.website)))) return 'Each line needs a name, and websites must start with http:// or https://.';
      return { programs };
    }
    default:
      return 'Unknown setting.';
  }
}

export async function saveSetting(formData: FormData) {
  const { supabase } = await getSuperContext();
  const key = text(formData.get('key'));
  const value = buildValue(key, formData);
  if (typeof value === 'string') go('error', value);
  // The database function validates ranges again, refuses secrets, and writes the audit entry.
  const { error } = await supabase.rpc('superadmin_update_setting', { p_key: key, p_value: value });
  revalidatePath('/superadmin', 'layout');
  revalidatePath('/business', 'layout');
  revalidatePublic();
  if (error) go('error', friendlyDbError(error, 'The setting could not be saved.'));
  go('notice', 'setting-saved');
}

function planFields(f: FormData) {
  const rupees = Number(text(f.get('price_rupees')));
  const features = text(f.get('features')).split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20);
  return {
    name: text(f.get('name')),
    description: text(f.get('description')).slice(0, 1000) || null,
    price_amount: Number.isFinite(rupees) && rupees >= 0 ? Math.round(rupees * 100) : -1,
    features: { list: features },
    is_active: f.get('is_active') === 'on',
  };
}

export async function createPlan(formData: FormData) {
  const { supabase } = await getSuperContext();
  const code = text(formData.get('code')).toLowerCase();
  const interval = text(formData.get('billing_interval'));
  const fields = planFields(formData);
  if (!/^[a-z0-9_]{2,40}$/.test(code)) go('error', 'Plan code: lowercase letters, numbers and underscores.');
  if (fields.name.length < 2 || fields.price_amount < 0 || !['month', 'year'].includes(interval)) go('error', 'Check the plan name, price and billing interval.');
  const { error } = await supabase.from('subscription_plans').insert({ ...fields, code, billing_interval: interval, currency: 'INR' });
  revalidatePath('/superadmin', 'layout');
  if (error) go('error', friendlyDbError(error, 'The plan could not be created.'));
  go('notice', 'plan-saved');
}

export async function updatePlan(formData: FormData) {
  const { supabase } = await getSuperContext();
  const id = text(formData.get('id'));
  const fields = planFields(formData);
  if (!isUuid(id) || fields.name.length < 2 || fields.price_amount < 0) go('error', 'Check the plan name and price.');
  const { data, error } = await supabase.from('subscription_plans').update(fields).eq('id', id).select('id');
  revalidatePath('/superadmin', 'layout');
  if (error || !data?.length) go('error', friendlyDbError(error, 'The plan could not be saved.'));
  go('notice', 'plan-saved');
}
