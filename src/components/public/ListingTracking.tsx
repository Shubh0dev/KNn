'use client';

import { useEffect, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';

type EventType = 'view' | 'contact_click' | 'website_click' | 'direction_click' | 'share';

/** Anonymous per-tab session id, used only to de-duplicate repeated events. */
function sessionId() {
  try {
    let id = sessionStorage.getItem('kn_session');
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('kn_session', id); }
    return id;
  } catch {
    return undefined;
  }
}

/**
 * Records real engagement through the track_listing_event function, which only
 * accepts events for published listings and stores no personal data beyond
 * the signed-in user id (never shown to businesses).
 */
function track(listingId: string, type: EventType) {
  if (!isSupabaseConfigured()) return;
  createClient().rpc('track_listing_event', { p_listing_id: listingId, p_event_type: type, p_session_id: sessionId() }).then(() => undefined, () => undefined);
}

export function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => { track(listingId, 'view'); }, [listingId]);
  return null;
}

export function TrackedLink({ listingId, type, href, children, className }: { listingId: string; type: EventType; href: string; children: ReactNode; className?: string }) {
  const external = /^https?:/.test(href);
  return <a href={href} className={className} onClick={() => track(listingId, type)} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>{children}</a>;
}
