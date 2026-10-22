'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { LOADING_CONFIG, spinnersEnabled } from '@/lib/loading/config';
import { NAVIGATION_START_EVENT, getFormTarget } from '@/lib/loading/navigation';
import { useDelayedLoading } from '@/lib/loading/useDelayedLoading';
import { CircularLoader } from './CircularLoader';

const currentKey = () => window.location.pathname + window.location.search;

/**
 * Small indicator shown while the next page loads. A navigation starts on a
 * same-site link click, a GET form submission, back/forward, or an explicit
 * signalNavigationStart(); it ends when the URL changes (or after
 * LOADING_CONFIG.navigationTimeout, so it can never spin forever).
 * Render inside <Suspense> (it reads search params).
 */
export function NavigationProgress() {
  const enabled = spinnersEnabled('navigation');
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [navigating, setNavigating] = useState(false);
  const lastKey = useRef('');
  const visible = useDelayedLoading(navigating, enabled);

  // The URL changed: the new page is showing.
  useEffect(() => {
    lastKey.current = pathname + (search ? `?${search}` : '');
    setNavigating(false);
  }, [pathname, search]);

  // Safety net: never leave the indicator running.
  useEffect(() => {
    if (!navigating) return;
    const timer = setTimeout(() => setNavigating(false), LOADING_CONFIG.navigationTimeout);
    return () => clearTimeout(timer);
  }, [navigating]);

  useEffect(() => {
    if (!enabled) return;
    const startFor = (url: URL) => {
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === currentKey()) return; // same page (or only the #hash changes)
      setNavigating(true);
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href || href.startsWith('#') || !/^(https?:|\/|\.|[^:]*$)/i.test(href)) return; // skip tel:, mailto:, javascript:
      startFor(new URL(anchor.href, window.location.href));
    };
    // Bubble phase on window: forms handled in JavaScript (preventDefault) and
    // Server Action forms (POST) are skipped; their buttons show their own spinner.
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (event.defaultPrevented || !form || (form.getAttribute('method') ?? 'get').toLowerCase() !== 'get') return;
      if (form.target && form.target !== '_self') return;
      startFor(getFormTarget(form, event.submitter));
    };
    const onPopState = () => { if (currentKey() !== lastKey.current) setNavigating(true); };
    const onSignal = (event: Event) => {
      const href = (event as CustomEvent<string>).detail;
      if (typeof href === 'string' && href) startFor(new URL(href, window.location.href));
    };
    const onPageShow = () => setNavigating(false); // restored from the back/forward cache

    window.addEventListener('click', onClick, true);
    window.addEventListener('submit', onSubmit);
    window.addEventListener('popstate', onPopState);
    window.addEventListener(NAVIGATION_START_EVENT, onSignal);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('submit', onSubmit);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener(NAVIGATION_START_EVENT, onSignal);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div className={`kn-nav-indicator${visible ? ' is-visible' : ''}`} aria-live="polite" data-testid="navigation-indicator" data-visible={visible}>
    {visible && <><CircularLoader size="sm" /><span>Loading…</span></>}
  </div>;
}
