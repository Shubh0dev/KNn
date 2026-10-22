'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markEnquirySeen } from '../actions';

/** Marks the enquiry as seen after the page loads (never during rendering), then refreshes counts. */
export function MarkSeen({ enquiryId }: { enquiryId: string }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    markEnquirySeen(enquiryId).then(result => { if (active && result.changed) router.refresh(); }).catch(() => {});
    return () => { active = false; };
  }, [enquiryId, router]);
  return null;
}
