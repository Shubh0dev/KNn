// Analytics event definitions and sanitisers. Dependency-free so it can be
// unit tested directly; the database function public.track_event applies the
// same rules again, so these are a first line of defence, not the only one.

export const SITE_EVENTS = ['page_view', 'search', 'category_click', 'trip_created', 'trip_saved', 'trip_shared', 'outbound_click'] as const;
export type SiteEvent = (typeof SITE_EVENTS)[number];

export const LISTING_EVENTS = ['view', 'contact_click', 'website_click', 'direction_click', 'share'] as const;
export type ListingEvent = (typeof LISTING_EVENTS)[number];

/** Areas that are never tracked (signed-in tools, auth flows, APIs). */
const PRIVATE_PATH = /^\/(admin|superadmin|business|account|auth|api)(\/|$)/;

export const isSiteEvent = (value: string): value is SiteEvent => (SITE_EVENTS as readonly string[]).includes(value);

/** Lower-cased path without query string or fragment, or null if it must not be tracked. */
export function normalizePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.split('#')[0].split('?')[0].toLowerCase();
  if (!/^\/[a-z0-9/_.-]{0,199}$/.test(path)) return null;
  if (PRIVATE_PATH.test(path)) return null;
  return path;
}

/** Removes e-mail addresses and phone-like numbers; returns null if too short to be useful. */
export function sanitizeSearchTerm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const term = raw
    .toLowerCase()
    .replace(/[^\s@]+@[^\s@]+/g, ' ')
    .replace(/\+?[0-9][0-9 +()-]{4,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
  return term.length >= 2 ? term : null;
}

const HOST = /^[a-z0-9]([a-z0-9.-]{0,118}[a-z0-9])?$/;

/** Host of an external http(s) URL, or null for same-site, invalid or non-web links. */
export function externalHost(url: string | null | undefined, ownHost: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!HOST.test(host) || host === ownHost.toLowerCase().replace(/^www\./, '')) return null;
    return host;
  } catch {
    return null;
  }
}

/** utm_source value if it is a plain token; anything else is dropped. */
export function cleanUtmSource(raw: string | null | undefined): string | null {
  const value = raw?.toLowerCase().trim() ?? '';
  return /^[a-z0-9._-]{1,60}$/.test(value) ? value : null;
}

export const isCategorySlug = (value: string) => /^[a-z0-9-]{1,60}$/.test(value);
