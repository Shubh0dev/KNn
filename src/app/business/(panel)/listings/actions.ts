'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getBusinessContext, type BusinessContext } from '@/lib/business/context';
import { LISTING_EDITABLE } from '@/lib/business/constants';
import { friendlyDbError, isUuid, type ActionState } from '@/lib/business/state';
import { parseListing, slugify, type ListingInput } from '@/lib/business/validation';
import { moveImage, registerImage, removeAllImages, removeImage, setCover, type ImageResult } from '@/lib/listings/images';
import { getListingRules } from '@/lib/listings/rules';

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
    enquiry_mode: input.enquiry_mode,
    whatsapp_enabled: input.whatsapp_enabled,
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

  revalidatePath('/', 'layout');
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
  revalidatePath('/', 'layout');
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

  if (!(await removeAllImages(ctx.supabase, listing.id))) {
    redirect(withParam(editPath(listing.id), 'error', 'The photos could not be removed, so the draft was kept. Please try again.'));
  }
  const { data: removed, error } = await ctx.supabase.from('listings').delete().eq('id', listing.id).eq('status', 'draft').select('id');
  if (error || !removed?.length) redirect(withParam(editPath(listing.id), 'error', 'The draft could not be deleted.'));

  revalidatePath('/', 'layout');
  redirect(withParam('/business/listings/', 'notice', 'deleted'));
}

// ---------------------------------------------------------------------------
// Images (files are uploaded by the browser straight to Storage under RLS;
// these actions check ownership, then record, reorder and remove them)
// ---------------------------------------------------------------------------
async function editableListing(listingId: string) {
  const ctx = await getBusinessContext();
  const listing = await loadOwnListing(ctx, listingId);
  return listing && LISTING_EDITABLE.includes(listing.status) ? { ctx, listing } : null;
}
const done = (result: ImageResult) => {
  if (result.ok) revalidatePath('/', 'layout');
  return result;
};

export async function registerListingImage(input: { listingId: string; path: string; alt?: string }): Promise<ImageResult> {
  const found = await editableListing(input.listingId);
  if (!found) return { ok: false, error: 'Images cannot be changed for this listing.' };
  const rules = await getListingRules(found.ctx.supabase);
  return done(await registerImage(found.ctx.supabase, found.listing.id, String(input.path ?? ''), input.alt, rules.max_images));
}

export async function removeListingImage(input: { listingId: string; imageId: string }): Promise<ImageResult> {
  const found = await editableListing(input.listingId);
  if (!found) return { ok: false, error: 'Image not found.' };
  return done(await removeImage(found.ctx.supabase, found.listing.id, input.imageId));
}

export async function setCoverImage(input: { listingId: string; imageId: string }): Promise<ImageResult> {
  const found = await editableListing(input.listingId);
  if (!found) return { ok: false, error: 'Image not found.' };
  return done(await setCover(found.ctx.supabase, found.listing.id, input.imageId));
}

export async function moveListingImage(input: { listingId: string; imageId: string; direction: 'up' | 'down' }): Promise<ImageResult> {
  const found = await editableListing(input.listingId);
  if (!found) return { ok: false, error: 'Image not found.' };
  return done(await moveImage(found.ctx.supabase, found.listing.id, input.imageId, input.direction === 'up' ? 'up' : 'down'));
}