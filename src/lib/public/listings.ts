import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabaseEnv } from '../supabase/env';

/**
 * Cookie-less client for public pages. It reads as the anonymous role, so
 * Row Level Security returns only published listings of verified businesses
 * (or curated ones). Using no cookies keeps these pages statically cacheable.
 */
function publicClient() {
  const { url, publishableKey } = supabaseEnv();
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type PublicCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  subtype: string | null;
  area: string | null;
  category: string | null;
  cover: string | null;
  businessName: string | null;
  sponsoredLabel?: string | null;
};

const CARD_SELECT = 'id, slug, title, summary, subtype, area, business_id, listing_categories!inner ( slug, name ), businesses ( name ), listing_images ( storage_path, is_cover, sort_order )';

function toCard(row: any, client: ReturnType<typeof publicClient>): PublicCard {
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);
  const images = ((row.listing_images ?? []) as { storage_path: string; is_cover: boolean; sort_order: number }[]).sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
  return {
    id: row.id, slug: row.slug, title: row.title, summary: row.summary, subtype: row.subtype, area: row.area,
    category: one(row.listing_categories)?.name ?? null,
    cover: images[0] ? client.storage.from('listing-images').getPublicUrl(images[0].storage_path).data.publicUrl : null,
    businessName: one(row.businesses)?.name ?? null,
  };
}

async function sponsoredLabel(client: ReturnType<typeof publicClient>) {
  const { data } = await client.from('platform_settings').select('value').eq('key', 'sponsored_placements').maybeSingle();
  return ((data?.value ?? {}) as { label?: string }).label ?? 'Sponsored';
}

/** Published listings for public category pages; category-featured ones first. Never throws. */
export async function getDirectory(categorySlugs: string[] | 'all-businesses', limit = 12): Promise<PublicCard[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const client = publicClient();
    let query = client.from('listings').select(CARD_SELECT).eq('status', 'published').order('published_at', { ascending: false }).limit(limit);
    query = categorySlugs === 'all-businesses' ? query.not('business_id', 'is', null) : query.in('listing_categories.slug', categorySlugs);
    const [{ data, error }, placements, label] = await Promise.all([
      query,
      client.from('featured_placements').select('listing_id, sort_order, is_sponsored').eq('placement', 'category'),
      sponsoredLabel(client),
    ]);
    if (error || !data) return [];
    const featured = new Map((placements.data ?? []).map(p => [p.listing_id as string, p]));
    return data
      .map(row => ({ card: { ...toCard(row, client), sponsoredLabel: featured.get(row.id)?.is_sponsored ? label : null }, rank: featured.has(row.id) ? featured.get(row.id)!.sort_order : 10_000 }))
      .sort((a, b) => a.rank - b.rank)
      .map(x => x.card);
  } catch {
    return [];
  }
}

/** Text search over published listings (title, summary, area, type). Never throws. */
export async function searchListings(rawQuery: string, limit = 12): Promise<PublicCard[]> {
  const q = rawQuery.replace(/[%_,()*\\.:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!isSupabaseConfigured() || q.length < 2) return [];
  try {
    const client = publicClient();
    const pattern = `%${q}%`;
    const { data, error } = await client.from('listings').select(CARD_SELECT).eq('status', 'published')
      .or(`title.ilike.${pattern},summary.ilike.${pattern},area.ilike.${pattern},subtype.ilike.${pattern}`)
      .order('published_at', { ascending: false }).limit(limit);
    if (error || !data) return [];
    return data.map(row => toCard(row, client));
  } catch {
    return [];
  }
}

export type DirectoryFilters = { q: string; category: string; area: string };

/** Verified business listings with search, category and area filters (the /directory/ page). Never throws. */
export async function getFilteredDirectory(filters: DirectoryFilters, limit = 48): Promise<{ cards: PublicCard[]; areas: string[] }> {
  if (!isSupabaseConfigured()) return { cards: [], areas: [] };
  try {
    const client = publicClient();
    const q = filters.q.replace(/[%_,()*\\.:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    let query = client.from('listings').select(CARD_SELECT).eq('status', 'published').not('business_id', 'is', null)
      .order('published_at', { ascending: false }).limit(limit);
    if (/^[a-z-]{2,40}$/.test(filters.category)) query = query.eq('listing_categories.slug', filters.category);
    if (filters.area) query = query.eq('area', filters.area.slice(0, 80));
    if (q.length >= 2) query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%,area.ilike.%${q}%,subtype.ilike.%${q}%`);
    const [{ data }, areaRows] = await Promise.all([
      query,
      client.from('listings').select('area').eq('status', 'published').not('business_id', 'is', null).not('area', 'is', null).limit(1000),
    ]);
    const areas = Array.from(new Set((areaRows.data ?? []).map(r => (r.area as string).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return { cards: (data ?? []).map(row => toCard(row, client)), areas };
  } catch {
    return { cards: [], areas: [] };
  }
}

/** Homepage featured placements (active window, public listings only). Never throws. */
export async function getHomeFeatured(): Promise<PublicCard[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const client = publicClient();
    const [{ data }, label] = await Promise.all([
      client.from('featured_placements').select(`sort_order, is_sponsored, listings ( ${CARD_SELECT} )`).eq('placement', 'home').order('sort_order').limit(12),
      sponsoredLabel(client),
    ]);
    return (data ?? []).flatMap((p: any) => {
      const listing = Array.isArray(p.listings) ? p.listings[0] : p.listings;
      return listing ? [{ ...toCard(listing, client), sponsoredLabel: p.is_sponsored ? label : null }] : [];
    });
  } catch {
    return [];
  }
}

export type PublicListing = PublicCard & {
  description: string | null; address: string | null; latitude: number | null; longitude: number | null;
  contact_phone: string | null; contact_email: string | null; website: string | null;
  price_band: string | null; price_from: number | null; price_to: number | null; price_note: string | null;
  amenities: string[]; business_hours: Record<string, { open?: string; close?: string; closed?: boolean }> | null;
  images: { url: string; alt: string }[]; businessVerified: boolean;
  categorySlug: string | null; enquiryMode: string; whatsappEnabled: boolean;
  /** Listing number, or the business's published number when the listing has none. */
  publicPhone: string | null;
};

export async function getPublicListing(slug: string): Promise<PublicListing | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,140}$/.test(slug)) return null;
  try {
    const client = publicClient();
    const { data } = await client.from('listings')
      // Explicit columns: the anonymous role is not granted internal ids such as created_by.
      .select(`id, slug, title, summary, subtype, area, description, address, latitude, longitude, contact_phone, contact_email, website,
        price_band, price_from, price_to, price_note, amenities, business_hours, business_id, enquiry_mode, whatsapp_enabled,
        listing_categories ( slug, name ), businesses ( name, verification_status, public_phone ), listing_images ( storage_path, alt_text, is_cover, sort_order )`)
      .eq('slug', slug).eq('status', 'published').maybeSingle();
    if (!data) return null;
    const card = toCard({ ...data, listing_categories: data.listing_categories }, client);
    const images = ((data.listing_images ?? []) as any[]).sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)
      .map(i => ({ url: client.storage.from('listing-images').getPublicUrl(i.storage_path).data.publicUrl, alt: i.alt_text ?? data.title }));
    const business = Array.isArray(data.businesses) ? data.businesses[0] : data.businesses;
    const category = Array.isArray(data.listing_categories) ? data.listing_categories[0] : data.listing_categories;
    return {
      ...card,
      description: data.description, address: data.address, latitude: data.latitude, longitude: data.longitude,
      contact_phone: data.contact_phone, contact_email: data.contact_email, website: data.website,
      price_band: data.price_band, price_from: data.price_from, price_to: data.price_to, price_note: data.price_note,
      amenities: data.amenities ?? [], business_hours: data.business_hours, images,
      businessVerified: business?.verification_status === 'verified',
      categorySlug: category?.slug ?? null, enquiryMode: data.enquiry_mode ?? 'booking', whatsappEnabled: Boolean(data.whatsapp_enabled),
      publicPhone: data.contact_phone ?? business?.public_phone ?? null,
    };
  } catch {
    return null;
  }
}
