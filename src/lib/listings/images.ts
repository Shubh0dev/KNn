import 'server-only';

import type { createClient } from '../supabase/server';
import { friendlyDbError, isUuid } from '../business/state';

type Client = Awaited<ReturnType<typeof createClient>>;
export type ImageResult = { ok: true } | { ok: false; error: string };

/**
 * Image operations shared by the Business Panel and curated content.
 * Callers must first check that the user may manage `listingId`; Row Level
 * Security enforces the same rule again on every statement here.
 */
export async function registerImage(supabase: Client, listingId: string, path: string, alt: string | undefined, maxImages: number): Promise<ImageResult> {
  if (!path.startsWith(`${listingId}/`) || path.includes('..') || !/\.(jpe?g|png|webp|avif)$/i.test(path)) {
    return { ok: false, error: 'Invalid image path.' };
  }
  const { data: exists } = await supabase.storage.from('listing-images').exists(path);
  if (!exists) return { ok: false, error: 'The uploaded file could not be found. Please try again.' };

  const { data: existing } = await supabase.from('listing_images').select('sort_order, is_cover').eq('listing_id', listingId);
  const rows = (existing ?? []) as { sort_order: number; is_cover: boolean }[];
  if (rows.length >= maxImages) return { ok: false, error: `A listing can have at most ${maxImages} images.` };

  const { error } = await supabase.from('listing_images').insert({
    listing_id: listingId,
    storage_path: path,
    alt_text: alt?.trim().slice(0, 200) || null,
    sort_order: rows.reduce((max, r) => Math.max(max, r.sort_order), -1) + 1,
    is_cover: !rows.some(r => r.is_cover),
  });
  if (error) {
    await supabase.storage.from('listing-images').remove([path]);
    return { ok: false, error: friendlyDbError(error, 'The image could not be saved.') };
  }
  return { ok: true };
}

async function findImage(supabase: Client, listingId: string, imageId: string) {
  if (!isUuid(imageId)) return null;
  const { data } = await supabase.from('listing_images').select('id, storage_path, is_cover').eq('id', imageId).eq('listing_id', listingId).maybeSingle();
  return data as { id: string; storage_path: string; is_cover: boolean } | null;
}

export async function removeImage(supabase: Client, listingId: string, imageId: string): Promise<ImageResult> {
  const image = await findImage(supabase, listingId, imageId);
  if (!image) return { ok: false, error: 'Image not found.' };
  const { error } = await supabase.from('listing_images').delete().eq('id', image.id);
  if (error) return { ok: false, error: 'The image could not be removed.' };
  await supabase.storage.from('listing-images').remove([image.storage_path]);
  if (image.is_cover) {
    const { data: next } = await supabase.from('listing_images').select('id').eq('listing_id', listingId).order('sort_order').limit(1).maybeSingle();
    if (next) await supabase.from('listing_images').update({ is_cover: true }).eq('id', next.id);
  }
  return { ok: true };
}

export async function setCover(supabase: Client, listingId: string, imageId: string): Promise<ImageResult> {
  const image = await findImage(supabase, listingId, imageId);
  if (!image) return { ok: false, error: 'Image not found.' };
  await supabase.from('listing_images').update({ is_cover: false }).eq('listing_id', listingId).eq('is_cover', true);
  const { error } = await supabase.from('listing_images').update({ is_cover: true }).eq('id', image.id);
  return error ? { ok: false, error: 'The cover image could not be changed.' } : { ok: true };
}

export async function moveImage(supabase: Client, listingId: string, imageId: string, direction: 'up' | 'down'): Promise<ImageResult> {
  const image = await findImage(supabase, listingId, imageId);
  if (!image) return { ok: false, error: 'Image not found.' };
  const { data } = await supabase.from('listing_images').select('id').eq('listing_id', listingId).order('sort_order').order('created_at');
  const ids = (data ?? []).map(r => r.id as string);
  const index = ids.indexOf(image.id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return { ok: true };
  [ids[index], ids[target]] = [ids[target], ids[index]];
  const results = await Promise.all(ids.map((id, position) => supabase.from('listing_images').update({ sort_order: position }).eq('id', id)));
  return results.some(r => r.error) ? { ok: false, error: 'The order could not be saved.' } : { ok: true };
}

/** Files must go before rows: Storage only lets managers remove them while the listing exists. */
export async function removeAllImages(supabase: Client, listingId: string): Promise<boolean> {
  const { data: images } = await supabase.from('listing_images').select('storage_path').eq('listing_id', listingId);
  const paths = (images ?? []).map(i => i.storage_path as string);
  if (!paths.length) return true;
  const { error } = await supabase.storage.from('listing-images').remove(paths);
  if (error) return false;
  await supabase.from('listing_images').delete().eq('listing_id', listingId);
  return true;
}
