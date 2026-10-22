'use client';

import { useEffect, useRef, useState } from 'react';
import { LOADING_CONFIG } from './config';
import { createSpinnerController, type SpinnerController } from './controller';

/**
 * Whether a spinner should be visible for an operation that is `active`.
 * Follows LOADING_CONFIG: nothing for fast operations, no flash for slow ones.
 */
export function useDelayedLoading(active: boolean, enabled = true): boolean {
  const [visible, setVisible] = useState(false);
  const controller = useRef<SpinnerController | null>(null);

  useEffect(() => {
    controller.current = createSpinnerController({
      delay: LOADING_CONFIG.spinnerDelay,
      minimum: LOADING_CONFIG.minimumSpinnerDuration,
      onChange: setVisible,
    });
    return () => { controller.current?.dispose(); controller.current = null; };
  }, []);

  useEffect(() => {
    if (active && enabled) controller.current?.start();
    else controller.current?.stop();
  }, [active, enabled]);

  return enabled && visible;
}
