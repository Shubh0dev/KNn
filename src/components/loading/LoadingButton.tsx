'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LOADING_CONFIG, spinnersEnabled } from '@/lib/loading/config';
import { useDelayedLoading } from '@/lib/loading/useDelayedLoading';
import { CircularLoader } from './CircularLoader';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** The operation this button started is running. */
  loading: boolean;
  /** Shown next to the spinner, e.g. "Saving…". */
  loadingLabel?: string;
  children: ReactNode;
  testId?: string;
};

/**
 * Button for asynchronous actions. It is disabled the moment `loading` becomes
 * true (no duplicate submissions); the spinner and label appear only if the
 * operation is still running after LOADING_CONFIG.spinnerDelay.
 */
export function LoadingButton({ loading, loadingLabel = 'Saving…', children, disabled, testId, type = 'submit', className = 'button-primary', ...rest }: Props) {
  const showSpinner = useDelayedLoading(loading, spinnersEnabled('button'));
  return <button {...rest} type={type} className={className} disabled={disabled || loading || showSpinner} aria-busy={loading} data-testid={testId}>
    {showSpinner
      ? <span className="kn-btn-loading" data-testid={testId ? `${testId}-loading` : undefined}><CircularLoader size={LOADING_CONFIG.sizes.button} /><span>{loadingLabel}</span></span>
      : children}
  </button>;
}
