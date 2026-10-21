'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSuperContext, revalidatePublic } from '@/lib/admin/context';
import { friendlyDbError, isUuid, type ActionState } from '@/lib/business/state';
import { listingRow, parseListing, slugify } from '@/lib/business/validation';
import { moveImage, registerImage, removeAllImages, removeImage, setCover, type ImageResult } from '@/lib/listings/images';
import { getListingRules } from '@/lib/listings/rules';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const go = (path: string, key: 'notice' | 'error', value: string) => redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`);
const refresh = () => { revalidatePath('/superadmin', 'layout'); revalidatePublic(); };

// ---------------------------------------------------------------- categories
export async function createCategory(formData: FormData) {
  const { supabase } = await getSuperContext();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const sort = Number(formData.get('sort_order') ?? 0);
  const back = '/superadmin/content/?tab=categories';
  if (!SLUG.test(slug) || slug.length > 60) go(back, 'error', 'Slug: lowercase letters, numbers and single hyphens (max 60).');
  if (name.length < 2 || name.length > 80) go(back, 'error', 'Name must be 2-80 characters.');
  const { error } = await supabase.from('listing_categories').insert({
    slug, name, description: description.slice(0, 500) || null, sort_order: Number.isFinite(sort) ? Math.round(sort) : 0,
  });
  refresh();
  if (error) go(back, 'error', friendlyDbError(error, 'The category could not be created.'));
  go(back, 'notice', 'category-saved');
}

export async function saveCategory(formData: FormData) {
  const { supabase } = await getSuperContext();
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const sort = Number(formData.get('sort_order') ?? 0);
  const back = '/superadmin/content/?tab=categories';
  if (!isUuid(id) || name.length < 2 || name.length > 80) go(back, 'error', 'Name must be 2-80 characters.');
  const { data, error } = await supabase.from('listing_categories').update({
    name, description: description.slice(0, 500) || null, sort_order: Number.isFinite(sort) ? Math.round(sort) : 0,
    is_active: formData.get('is_active') === 'on',
  }).eq('id', id).select('id');
  refresh();
  if (error || !data?.length) go(back, 'error', friendlyDbError(error, 'The category could not be saved.'));
  go(back, 'notice', 'category-saved');
}

// ---------------------------------------------------------------- curated listings
async function curatedListing(id: unknown) {
  const { supabase } = await getSuperContext();
  if (!isUuid(id)) return null;
  const { data } = await supabase.from('listings').select('id, status, slug').eq('id', id).is('business_id', null).maybeSingle();
  return data ? { supabase, listing: data as { id: string; status: string; slug: string } } : null;
}

export async function createCurated(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await getSuperContext();
  const parsed = parseListing(formData);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };
  const base = slugify(parsed.data.title) || 'place';
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = `${base.slice(0, 100)}-${randomBytes(3).toString('hex')}`;
    const { data, error } = await supabase.from('listings').insert({ ...listingRow(parsed.data), business_id: null, slug }).select('id').single();
    if (!error && data) redirect(`/superadmin/content/curated/${data.id}/?notice=curated-saved`);
    if (error?.code !== '23505') return { error: friendlyDbError(error, 'The curated listing could not be saved.') };
  }
  return { error: 'Could not create a unique web address. Please try again.' };
}

export async function updateCurated(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await curatedListing(listingId);
  if (!found) return { error: 'Curated listing not found.' };
  if (found.listing.status === 'archived') return { error: 'Restore this listing to draft before editing.' };
  const parsed = parseListing(formData);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };
  const { data, error } = await found.supabase.from('listings').update(listingRow(parsed.data)).eq('id', found.listing.id).is('business_id', null).select('id');
  if (error || !data?.length) return { error: friendlyDbError(error, 'Changes could not be saved.') };
  refresh();
  return { message: found.listing.status === 'published' ? 'Saved. The public page updates within a few minutes.' : 'Saved.' };
}

export async function setCuratedStatus(formData: FormData) {
  const found = await curatedListing(formData.get('listingId'));
  if (!found) redirect('/superadmin/content/?error=Curated%20listing%20not%20found');
  const status = String(formData.get('status') ?? '');
  const back = `/superadmin/content/curated/${found!.listing.id}/`;
  if (!['draft', 'published', 'archived'].includes(status)) go(back, 'error', 'Invalid status.');
  const { error } = await found!.supabase.rpc('content_set_curated_status', { p_listing_id: found!.listing.id, p_status: status });
  refresh();
  if (error) go(back, 'error', friendlyDbError(error, 'The status could not be changed.'));
  go(back, 'notice', 'curated-status');
}

export async function deleteCurated(formData: FormData) {
  const found = await curatedListing(formData.get('listingId'));
  if (!found) redirect('/superadmin/content/?error=Curated%20listing%20not%20found');
  const back = `/superadmin/content/curated/${found!.listing.id}/`;
  if (!['draft', 'archived'].includes(found!.listing.status)) go(back, 'error', 'Only draft or archived curated listings can be deleted.');
  if (!(await removeAllImages(found!.supabase, found!.listing.id))) go(back, 'error', 'Photos could not be removed; nothing was deleted.');
  const { data, error } = await found!.supabase.from('listings').delete().eq('id', found!.listing.id).is('business_id', null).select('id');
  refresh();
  if (error || !data?.length) go(back, 'error', 'The listing could not be deleted.');
  go('/superadmin/content/?tab=curated', 'notice', 'deleted');
}

async function curatedEditable(listingId: string) {
  const found = await curatedListing(listingId);
  return found && found.listing.status !== 'archived' ? found : null;
}
const done = (r: ImageResult) => { if (r.ok) refresh(); return r; };

export async function curatedRegisterImage(input: { listingId: string; path: string; alt?: string }): Promise<ImageResult> {
  const found = await curatedEditable(input.listingId);
  if (!found) return { ok: false, error: 'Images cannot be changed for this listing.' };
  const rules = await getListingRules(found.supabase);
  return done(await registerImage(found.supabase, found.listing.id, String(input.path ?? ''), input.alt, rules.max_images));
}
export async function curatedRemoveImage(input: { listingId: string; imageId: string }): Promise<ImageResult> {
  const found = await curatedEditable(input.listingId);
  return found ? done(await removeImage(found.supabase, found.listing.id, input.imageId)) : { ok: false, error: 'Image not found.' };
}
export async function curatedSetCover(input: { listingId: string; imageId: string }): Promise<ImageResult> {
  const found = await curatedEditable(input.listingId);
  return found ? done(await setCover(found.supabase, found.listing.id, input.imageId)) : { ok: false, error: 'Image not found.' };
}
export async function curatedMoveImage(input: { listingId: string; imageId: string; direction: 'up' | 'down' }): Promise<ImageResult> {
  const found = await curatedEditable(input.listingId);
  return found ? done(await moveImage(found.supabase, found.listing.id, input.imageId, input.direction === 'up' ? 'up' : 'down')) : { ok: false, error: 'Image not found.' };
}

// ---------------------------------------------------------------- featured placements
const toIso = (value: FormDataEntryValue | null) => {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export async function addPlacement(formData: FormData) {
  const { supabase } = await getSuperContext();
  const back = '/superadmin/content/?tab=featured';
  const listingId = String(formData.get('listingId') ?? '');
  const placement = String(formData.get('placement') ?? '');
  const sort = Number(formData.get('sort_order') ?? 0);
  const starts = toIso(formData.get('starts_at'));
  const ends = toIso(formData.get('ends_at'));
  if (!isUuid(listingId) || !['home', 'category'].includes(placement) || starts === undefined || ends === undefined) go(back, 'error', 'Check the listing, placement and dates.');

  if (placement === 'home') {
    const { data: setting } = await supabase.from('platform_settings').select('value').eq('key', 'sponsored_placements').maybeSingle();
    const max = Number((setting?.value as { max_home_slots?: number } | undefined)?.max_home_slots ?? 6);
    const { count } = await supabase.from('featured_placements').select('id', { count: 'exact', head: true }).eq('placement', 'home');
    if ((count ?? 0) >= max) go(back, 'error', `The homepage already has ${max} featured slots (change the limit in Settings).`);
  }
  const { error } = await supabase.from('featured_placements').insert({
    listing_id: listingId, placement, sort_order: Number.isFinite(sort) ? Math.min(1000, Math.max(0, Math.round(sort))) : 0,
    is_sponsored: formData.get('is_sponsored') === 'on', starts_at: starts, ends_at: ends,
  });
  refresh();
  if (error) go(back, 'error', friendlyDbError(error, 'The placement could not be added.'));
  go(back, 'notice', 'placement-saved');
}

export async function updatePlacement(formData: FormData) {
  const { supabase } = await getSuperContext();
  const back = '/superadmin/content/?tab=featured';
  const id = String(formData.get('id') ?? '');
  const sort = Number(formData.get('sort_order') ?? 0);
  if (!isUuid(id)) go(back, 'error', 'Invalid request.');
  const { data, error } = await supabase.from('featured_placements').update({
    sort_order: Number.isFinite(sort) ? Math.min(1000, Math.max(0, Math.round(sort))) : 0,
    is_sponsored: formData.get('is_sponsored') === 'on',
  }).eq('id', id).select('id');
  refresh();
  if (error || !data?.length) go(back, 'error', friendlyDbError(error, 'The placement could not be saved.'));
  go(back, 'notice', 'placement-saved');
}

export async function removePlacement(formData: FormData) {
  const { supabase } = await getSuperContext();
  const back = '/superadmin/content/?tab=featured';
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) go(back, 'error', 'Invalid request.');
  const { data, error } = await supabase.from('featured_placements').delete().eq('id', id).select('id');
  refresh();
  if (error || !data?.length) go(back, 'error', 'The placement could not be removed.');
  go(back, 'notice', 'placement-removed');
}
