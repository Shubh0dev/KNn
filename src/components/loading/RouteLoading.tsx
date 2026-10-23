import { LOADING_CONFIG } from '@/lib/loading/config';
import { CircularLoader } from './CircularLoader';

export type RouteLoadingVariant = 'dashboard' | 'list' | 'detail' | 'form' | 'page';

const Skel = ({ className = '' }: { className?: string }) => <span className={`bp-skel ${className}`} />;

/** Placeholder shapes that roughly match each kind of page, so content does not jump in. */
function Shapes({ variant }: { variant: RouteLoadingVariant }) {
  switch (variant) {
    case 'list':
      return <>
        <Skel className="bp-skel-title" />
        <Skel className="kn-skel-bar" />
        {Array.from({ length: 6 }, (_, i) => <Skel key={i} className="kn-skel-line" />)}
      </>;
    case 'detail':
      return <>
        <Skel className="bp-skel-title" />
        <div className="kn-skel-two"><Skel className="kn-skel-card" /><Skel className="kn-skel-card" /></div>
        <Skel className="kn-skel-card" />
      </>;
    case 'form':
      return <>
        <Skel className="bp-skel-title" />
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="kn-skel-field"><Skel className="kn-skel-label" /><Skel className="kn-skel-input" /></div>)}
        <Skel className="kn-skel-button" />
      </>;
    case 'page':
      return <>
        <Skel className="kn-skel-eyebrow" />
        <Skel className="bp-skel-title" />
        <Skel className="kn-skel-line kn-skel-short" />
        <div className="kn-skel-grid">{Array.from({ length: 3 }, (_, i) => <Skel key={i} className="kn-skel-tile" />)}</div>
      </>;
    default:
      return <>
        <Skel className="bp-skel-title" />
        <div className="bp-skel-row"><Skel /><Skel /><Skel /><Skel /></div>
        <Skel className="bp-skel-block" />
      </>;
  }
}

/**
 * Route loading screen (used by loading.tsx). Header and sidebar layouts stay on
 * screen; only the content area shows this. It takes its space at once (no layout
 * jump) but only becomes visible after LOADING_CONFIG.spinnerDelay, so a page that
 * arrives quickly never flashes a loading state. Next.js removes it as soon as the
 * page is ready.
 */
export function RouteLoading({ variant = 'dashboard', label = 'Loading…', mode = LOADING_CONFIG.routeFallback }: {
  variant?: RouteLoadingVariant; label?: string; mode?: 'skeleton' | 'spinner';
}) {
  if (mode === 'spinner') {
    return <div className="route-loading kn-fade-delayed" role="status" aria-live="polite" data-testid="route-loading">
      <CircularLoader size={variant === 'page' ? LOADING_CONFIG.sizes.page : LOADING_CONFIG.sizes.section} />
      <span>{label}</span>
    </div>;
  }
  return <div className={`bp-skeleton kn-skeleton-${variant} kn-fade-delayed`} role="status" aria-live="polite" aria-busy="true" data-testid="route-loading">
    <span className="kn-sr-only">{label}</span>
    <Shapes variant={variant} />
  </div>;
}
