'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getBusinessContext, type BusinessContext } from '@/lib/business/context';
import { IMAGE_LIMITS, LISTING_EDITABLE } from '@/lib/business/constants';
import { friendlyDbError, isUuid, type ActionState } from '@/lib/business/state';
import { parseListing, slugify, type ListingInput } from '@/lib/business/validation';

const editPath = (id: string) => `/business/listings/${id}/edit/`;
const withParam = (path: string, key: string, value: string) => `${path}?${key}=${encodeURIComponent(value)}`;

/** Fetches a listing only if it belongs to the active business. */
async function loadOwnListing({ supabase, active }: BusinessContext, id: unknown) {
  if (!isUuid(id)) return null;
  const { data } = await supabase
    .from('listings')
    .select('id, status, business_id, slug')
    .eq('id', id)
    .eq('business_id', active.id)
    .maybeSingle();
  return data as { id: string; status: string; business_id: string; slug: string } | null;
}

function toRow(input: ListingInput) {
  return {
    category_id: input.category_id,
    title: input.title,
    subtype: input.subtype ?? null,
    summary: input.summary ?? null,
    description: input.description ?? null,
    area: input.area ?? null,
    address: input.address ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    contact_phone: input.contact_phone ?? null,
    contact_email: input.contact_email ?? null,
    website: input.website ?? null,
    price_band: input.price_band ?? null,
    price_from: input.price_from ?? null,
    price_to: input.price_to ?? null,
    price_note: input.price_note ?? null,
    amenities: input.amenities,
    business_hours: input.business_hours ?? null,
  };
}

export async function createListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getBusinessContext();
  const parsed = parseListing(formData);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };

  const base = slugify(parsed.data.title) || 'listing';
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = `${base.slice(0, 100)}-${randomBytes(3).toString('hex')}`;
    const { data, error } = await ctx.supabase
      .from('listings')
      .insert({ ...toRow(parsed.data), business_id: ctx.active.id, slug })
      .select('id')
      .single();
    if (!error && data) redirect(withParam(editPath(data.id), 'notice', 'created'));
    if (error?.code !== '23505') return { error: friendlyDbError(error, 'We could not save your listing. Please try again.') };
  }
  return { error: 'We could not create a unique address for this listing. Please try again.' };
}

export async function updateListing(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getBusinessContext();
  const listing = await loadOwnListing(ctx, listingId);
  if (!listing) return { error: 'Listing not found.' };
  if (!LISTING_EDITABLE.includes(listing.status)) return { error: 'This listing can no longer be edited in its current status.' };

  const parsed = parseListing(formData);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };

  const { data, error } = await ctx.supabase
    .from('listings')
    .update(toRow(parsed.data))
    .eq('id', listing.id)
    .eq('business_id', ctx.active.id)
    .select('id, status')
    .maybeSingle();
  if (error || !data) return { error: friendlyDbError(error, 'We could not save your changes. Please try again.') };

  revalidatePath('/business', 'layout');
  if (listing.status === 'published' && data.status === 'pending_review') {
    return { message: 'Saved. Because you changed public details, the listing is back in review and hidden until it is approved again.' };
  }
  return { message: 'Changes saved.' };
}

async function workflow(formData: FormData, rpc: 'submit_listing_for_review' | 'archive_listing' | 'restore_listing', notice: string) {
  const ctx = await getBusinessContext();
  const listing = await loadOwnListing(ctx, formData.get('listingId'));
  if (!listing) redirect(withParam('/business/listings/', 'error', 'Listing not found.'));

  const { error } = await ctx.supabase.rpc(rpc, { p_listing_id: listing.id });
  revalidatePath('/business', 'layout');
  if (error) redirect(withParam(editPath(listing.id), 'error', friendlyDbError(error, 'That action could not be completed.')));
  redirect(withParam(rpc === 'submit_listing_for_review' ? editPath(listing.id) : '/business/listings/', 'notice', notice));
}

export async function submitListing(formData: FormData) {
  await workflow(formData, 'submit_listing_for_review', 'submitted');
}
export async function archiveListing(formData: FormData) {
  await workflow(formData, 'archive_listing', 'archived');
}
export async function restoreListing(formData: FormData) {
  await workflow(formData, 'restore_listing', 'restored');
}

export async function deleteDraftListing(formData: FormData) {
  const ctx = await getBusinessContext();
  const listing = await loadOwnListing(ctx, formData.get('listingId'));
  if (!listing) redirect(withParam('/business/listings/', 'error', 'Listing not found.'));
  if (listing.status !== 'draft') redirect(withParam(editPath(listing.id), 'error', 'Only drafts can be deleted. Archive this listing instead.'));

  // Files go first: Storage policies only allow the owner to remove them while
  // the listing still exists. After the listing row is gone nobody can.
  const { data: images } = await ctx.supabase.from('listing_images').select('storage_path').eq('listing_id', listing.id);
  const paths = (images ?? []).map(i => i.storage_path as string);
  if (paths.length) {
    const { error: storageError } = await ctx.supabase.storage.from('listing-images').remove(paths);
    if (storageError) redirect(withParam(editPath(listing.id), 'error', 'The photos could not be removed, so the draft was kept. Please try again.'));
    await ctx.supabase.from('listing_images').delete().eq('listing_id', listing.id);
  }

  const { data: removed, error } = await ctx.supabase.from('listings').delete().eq('id', listing.id).eq('status', 'draft').select('id');
  if (error || !removed?.length) redirect(withParam(editPath(listing.id), 'error', 'The draft could not be deleted.'));

  revalidatePath('/business', 'layout');
  redirect(withParam('/business/listings/', 'notice', 'deleted'));
}

// ---------------------------------------------------------------------------
// Images (files are uploaded by the browser straight to Storage under RLS;
// these actions record, reorder and remove them)
// ---------------------------------------------------------------------------
type ImageResult = { ok: true } | { ok: false; error: string };

export async function registerListingImage(input: { listingId: string; path: string; alt?: string }): Promise<ImageResult> {
  const ctx = await getBusinessContext();
  const listing = await loadOwnListing(ctx, input.listingId);
  if (!listing) return { ok: false, error: 'Listing not found.' };
  if (!LISTING_EDITABLE.includes(listing.status)) return { ok: false, error: 'Images cannot be changed in this status.' };

  const path = String(input.path ?? '');
  if (!path.startsWith(`${listing.id}/`) || path.includes('..') || !/\.(jpe?g|png|webp|avif)$/i.test(path)) {
    return { ok: false, error: 'Invalid image path.' };
  }
  const { data: exists } = await ctx.supabase.storage.from('listing-images').exists(path);
  if (!exists) return { ok: false, error: 'The uploaded file could not be found. Please try again.' };

  const { data: existing } = await ctx.supabase
    .from('listing_images')
    .select('sort_order, is_cover')
    .eq('listing_id', listing.id);
  const rows = (existing ?? []) as { sort_order: number; is_cover: boolean }[];
  if (rows.length >= IMAGE_LIMITS.max) return { ok: false, error: `A listing can have at most ${IMAGE_LIMITS.max} images.` };

  const { error } = await ctx.supabase.from('listing_images').insert({
    listing_id: listing.id,
    storage_path: path,
    alt_text: input.alt?.trim().slice(0, 200) || null,
    sort_order: rows.reduce((max, r) => Math.max(max, r.sort_order), -1) + 1,
    is_cover: !rows.some(r => r.is_cover),
  });
  if (error) {
    await ctx.supabase.storage.from('listing-images').remove([path]);
    return { ok: false, error: friendlyDbError(error, 'The image could not be saved.') };
  }
  revalidatePath('/business', 'layout');
  return { ok: true };
}

async function ownImage(ctx: BusinessContext, listingId: string, imageId: string) {
  const listing = await loadOwnListing(ctx, listingId);
  if (!listing || !isUuid(imageId) || !LISTING_EDITABLE.includes(listing.status)) return null;
  const { data } = await ctx.supabase
    .from('listing_images')
    .select('id, storage_path, is_cover')
    .eq('id', imageId)
    .eq('listing_id', listing.id)
    .maybeSingle();
  return data ? { listing, image: data as { id: string; storage_path: string; is_cover: boolean } } : null;
}

export async function removeListingImage(input: { listingId: string; imageId: string }): Promise<ImageResult> {
  const ctx = await getBusinessContext();
  const found = await ownImage(ctx, input.listingId, input.imageId);
  if (!found) return { ok: false, error: 'Image not found.' };

  const { error } = await ctx.supabase.from('listing_images').delete().eq('id', found.image.id);
  if (error) return { ok: false, error: 'The image could not be removed.' };
  await ctx.supabase.storage.from('listing-images').remove([found.image.storage_path]);

  if (found.image.is_cover) {
    const { data: next } = await ctx.supabase
      .from('listing_images').select('id').eq('listing_id', found.listing.id).order('sort_order').limit(1).maybeSingle();
    if (next) await ctx.supabase.from('listing_images').update({ is_cover: true }).eq('id', next.id);
  }
  revalidatePath('/business', 'layout');
  return { ok: true };
}

export async function setCoverImage(input: { listingId: string; imageId: string }): Promise<ImageResult> {
  const ctx = await getBusinessContext();
  const found = await ownImage(ctx, input.listingId, input.imageId);
  if (!found) return { ok: false, error: 'Image not found.' };

  await ctx.supabase.from('listing_images').update({ is_cover: false }).eq('listing_id', found.listing.id).eq('is_cover', true);
  const { error } = await ctx.supabase.from('listing_images').update({ is_cover: true }).eq('id', found.image.id);
  if (error) return { ok: false, error: 'The cover image could not be changed.' };
  revalidatePath('/business', 'layout');
  return { ok: true };
}

export async function moveListingImage(input: { listingId: string; imageId: string; direction: 'up' | 'down' }): Promise<ImageResult> {
  const ctx = await getBusinessContext();
  const found = await ownImage(ctx, input.listingId, input.imageId);
  if (!found) return { ok: false, error: 'Image not found.' };

  const { data } = await ctx.supabase
    .from('listing_images').select('id').eq('listing_id', found.listing.id).order('sort_order').order('created_at');
  const ids = (data ?? []).map(r => r.id as string);
  const index = ids.indexOf(found.image.id);
  const target = input.direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return { ok: true };
  [ids[index], ids[target]] = [ids[target], ids[index]];

  const results = await Promise.all(ids.map((id, position) => ctx.supabase.from('listing_images').update({ sort_order: position }).eq('id', id)));
  if (results.some(r => r.error)) return { ok: false, error: 'The order could not be saved.' };
  revalidatePath('/business', 'layout');
  return { ok: true };
}
