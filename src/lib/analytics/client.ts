'use client';

import { createClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/env';
import { cleanUtmSource, externalHost, isCategorySlug, normalizePath, sanitizeSearchTerm, type ListingEvent, type SiteEvent } from './events';

export const CONSENT_KEY = 'kn_analytics_consent';

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

/** Browser opt-outs (Do Not Track / Global Privacy Control) switch all analytics off. */
export function trackingDisabled() {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

/** Random per-tab id (sessionStorage, not a cookie) used only for de-duplication and session counts. */
export function sessionId(): string | undefined {
  try {
    let id = sessionStorage.getItem('kn_session');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('kn_session', id);
    }
    return id;
  } catch {
    return undefined;
  }
}

export function hasAnalyticsConsent() {
  try { return localStorage.getItem(CONSENT_KEY) === 'granted'; } catch { return false; }
}

function sendToGoogle(name: string, params: Record<string, unknown>) {
  if (window.gtag && hasAnalyticsConsent()) window.gtag('event', name, params);
}

type Props = { term?: string; category?: string; url?: string; referrerHost?: string | null; utmSource?: string | null };

/**
 * First-party anonymous event. Fire-and-forget: analytics must never break or
 * slow down the page. The database validates and de-duplicates again.
 */
export function trackEvent(name: SiteEvent, props: Props = {}, rawPath?: string) {
  if (!isSupabaseConfigured() || trackingDisabled()) return;
  const session = sessionId();
  if (!session) return;

  const payload: Record<string, string> = {};
  if (name === 'search') {
    const term = sanitizeSearchTerm(props.term);
    if (!term) return;
    payload.term = term;
    sendToGoogle('search', { search_term: term });
  } else if (name === 'category_click') {
    if (!props.category || !isCategorySlug(props.category)) return;
    payload.category = props.category;
  } else if (name === 'outbound_click') {
    const host = externalHost(props.url, window.location.hostname);
    if (!host) return;
    payload.host = host;
    sendToGoogle('click', { outbound: true, link_domain: host });
  } else if (name === 'page_view') {
    if (props.referrerHost) payload.referrer_host = props.referrerHost;
    const utm = cleanUtmSource(props.utmSource);
    if (utm) payload.utm_source = utm;
  } else {
    sendToGoogle(name, {});
  }

  const path = normalizePath(rawPath ?? window.location.pathname);
  if (name === 'page_view' && !path) return;
  createClient().rpc('track_event', { p_event: name, p_path: path ?? undefined, p_props: payload, p_session: session }).then(() => undefined, () => undefined);
}

/** Listing-level events (views, contact clicks) shown to the listing's own business. */
export function trackListing(listingId: string, type: ListingEvent) {
  if (!isSupabaseConfigured() || trackingDisabled()) return;
  const session = sessionId();
  if (!session) return;
  createClient().rpc('track_listing_event', { p_listing_id: listingId, p_event_type: type, p_session_id: session }).then(() => undefined, () => undefined);
}
