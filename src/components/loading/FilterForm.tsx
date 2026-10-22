'use client';

import Form from 'next/form';
import type { ReactNode } from 'react';
import { getFormTarget, signalNavigationStart } from '@/lib/loading/navigation';

/**
 * Search/filter form (GET). Uses next/form, so applying filters is a client-side
 * navigation instead of a full page reload, and shows the navigation indicator
 * while the filtered page loads.
 */
export function FilterForm({ action, children, className, ariaLabel, testId }: {
  action: string; children: ReactNode; className?: string; ariaLabel?: string; testId?: string;
}) {
  return <Form action={action} className={className} role="search" aria-label={ariaLabel} data-testid={testId}
    onSubmit={event => signalNavigationStart(getFormTarget(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter).href)}>
    {children}
  </Form>;
}
