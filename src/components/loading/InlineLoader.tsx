'use client';

import { spinnersEnabled } from '@/lib/loading/config';
import { useDelayedLoading } from '@/lib/loading/useDelayedLoading';
import { CircularLoader } from './CircularLoader';

/** Spinner plus a short label next to content that is updating (search results, image actions). */
export function InlineLoader({ active, label, className = '', testId }: { active: boolean; label: string; className?: string; testId?: string }) {
  const visible = useDelayedLoading(active, spinnersEnabled('inline'));
  if (!visible) return null;
  return <span className={`kn-inline-loader ${className}`} data-testid={testId}><CircularLoader size="xs" label={label} /><span aria-hidden="true">{label}</span></span>;
}
