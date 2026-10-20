import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TripPlanner } from '../../PlannerExplore';

export const metadata: Metadata = {
  title: 'My Kashi Trip | KashiNagri',
  description: 'Build a flexible Varanasi itinerary outline from sample discoveries, then save, share, copy or print it.',
};

export default function Page() {
  return (
    <Suspense fallback={<div className="route-loading">Preparing your trip planner…</div>}>
      <TripPlanner />
    </Suspense>
  );
}
