import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TripPlanner } from '../../PlannerExplore';
import { CircularLoader } from '@/components/loading/CircularLoader';

export const metadata: Metadata = {
  title: 'My Kashi Trip | KashiNagri',
  description: 'Build a flexible Varanasi itinerary outline from sample discoveries, then save, share, copy or print it.',
};

export default function Page() {
  return (
    <Suspense fallback={<div className="route-loading"><CircularLoader size="md" delayed /><span>Preparing your trip planner…</span></div>}>
      <TripPlanner />
    </Suspense>
  );
}
