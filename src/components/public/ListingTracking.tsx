'use client';

import { useEffect, type ReactNode } from 'react';
import { trackEvent, trackListing } from '@/lib/analytics/client';
import type { ListingEvent } from '@/lib/analytics/events';

/**
 * Listing engagement for the business's own analytics. Recorded through
 * track_listing_event, which only accepts events for published listings;
 * businesses never see who viewed or clicked.
 */
export function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => { trackListing(listingId, 'view'); }, [listingId]);
  return null;
}

export function TrackedLink({ listingId, type, href, children, className, 'data-testid': testId }: { listingId: string; type: ListingEvent; href: string; children: ReactNode; className?: string; 'data-testid'?: string }) {
  const external = /^https?:/.test(href);
  return <a href={href} className={className} data-testid={testId} onClick={() => {
    trackListing(listingId, type);
    if (external) trackEvent('outbound_click', { url: href }); // host only, for partner/affiliate reporting
  }} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>{children}</a>;
}
