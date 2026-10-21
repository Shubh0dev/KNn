import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabaseEnv } from '@/lib/supabase/env';
import { items } from '../discovery-data';

export const revalidate = 3600;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.kashinagri.com').replace(/\/$/, '');
const STATIC = ['/', '/temples/', '/ghats/', '/stays/', '/food/', '/travel/', '/shopping/', '/spiritual-services/', '/guides/', '/events/', '/areas/', '/local-businesses/', '/explore/', '/plan-my-trip/'];

/** Public pages only. Panels, auth and API routes are excluded (see robots.ts). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC.map(path => ({ url: `${SITE}${path}`, changeFrequency: 'weekly', priority: path === '/' ? 1 : 0.7 }));

  for (const item of items) {
    const route = item.category === 'food' ? 'food' : item.category === 'stays' ? 'stays' : item.category === 'guides' ? 'guides' : 'places';
    entries.push({ url: `${SITE}/${route}/${item.slug}/`, changeFrequency: 'monthly', priority: 0.5 });
  }

  if (isSupabaseConfigured()) {
    try {
      const { url, publishableKey } = supabaseEnv();
      const client = createClient(url, publishableKey, { auth: { persistSession: false } });
      const { data } = await client.from('listings').select('slug, updated_at').eq('status', 'published').limit(5000);
      for (const listing of data ?? []) {
        entries.push({ url: `${SITE}/listings/${listing.slug}/`, lastModified: listing.updated_at, changeFrequency: 'weekly', priority: 0.6 });
      }
    } catch { /* sitemap still lists the static pages */ }
  }
  return entries;
}
