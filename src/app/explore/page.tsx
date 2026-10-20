import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExploreDiscovery } from '../../PlannerExplore';

export const metadata: Metadata = {
  title: 'Explore Kashi | KashiNagri',
  description: 'Search illustrative places and experiences across Varanasi, browse by topic, or choose an area for nearby ideas.',
};

export default function Page() {
  return (
    <Suspense fallback={<div className="route-loading">Opening Kashi discoveries…</div>}>
      <ExploreDiscovery />
    </Suspense>
  );
}
