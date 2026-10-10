import { Suspense } from 'react';
import { ExplorePage } from '../../App';

export default function Page() {
  return (
    <Suspense fallback={<div className="route-loading">Opening Kashi discoveries…</div>}>
      <ExplorePage />
    </Suspense>
  );
}
