import 'server-only';

import type { createClient } from '../supabase/server';

export type ListingRules = { min_description_length: number; require_image: boolean; max_images: number };
export const DEFAULT_LISTING_RULES: ListingRules = { min_description_length: 30, require_image: true, max_images: 10 };

/** Listing rules from platform settings (public setting); the database enforces the same values. */
export async function getListingRules(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ListingRules> {
  const { data } = await supabase.from('platform_settings').select('value').eq('key', 'listing_rules').maybeSingle();
  const v = (data?.value ?? {}) as Partial<ListingRules>;
  return {
    min_description_length: Number.isFinite(v.min_description_length) ? Number(v.min_description_length) : DEFAULT_LISTING_RULES.min_description_length,
    require_image: typeof v.require_image === 'boolean' ? v.require_image : DEFAULT_LISTING_RULES.require_image,
    max_images: Number.isFinite(v.max_images) ? Math.min(20, Math.max(1, Number(v.max_images))) : DEFAULT_LISTING_RULES.max_images,
  };
}
