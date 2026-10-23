'use client';

import { LOADING_CONFIG, spinnersEnabled } from '@/lib/loading/config';
import { useDelayedLoading } from '@/lib/loading/useDelayedLoading';
import { CircularLoader } from './CircularLoader';

/** Spinner with a short visible label (no timing of its own). */
export function LoaderLabel({ label, className = '', testId }: { label: string; className?: string; testId?: string }) {
  return <span className={`kn-inline-loader ${className}`} data-testid={testId}><CircularLoader size={LOADING_CONFIG.sizes.inline} label={label} /><span aria-hidden="true">{label}</span></span>;
}

/** Spinner next to content that is updating; appears only if `active` lasts longer than the configured delay. */
export function InlineLoader({ active, label, className = '', testId }: { active: boolean; label: string; className?: string; testId?: string }) {
  const visible = useDelayedLoading(active, spinnersEnabled('inline'));
  return visible ? <LoaderLabel label={label} className={className} testId={testId} /> : null;
}
