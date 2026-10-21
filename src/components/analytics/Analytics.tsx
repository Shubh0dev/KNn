'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { CONSENT_KEY, hasAnalyticsConsent, trackEvent, trackingDisabled } from '@/lib/analytics/client';
import { normalizePath } from '@/lib/analytics/events';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const GA_ID_VALID = Boolean(GA_ID && /^G-[A-Z0-9]{4,12}$/.test(GA_ID));

/**
 * Site-wide analytics:
 *  - First-party, anonymous page views on public pages (no cookies, no user id).
 *  - Google Analytics 4 only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set AND the
 *    visitor has accepted analytics cookies. Nothing is loaded otherwise.
 *  - Do Not Track / Global Privacy Control turn both off.
 */
export function Analytics() {
  const pathname = usePathname();
  const first = useRef(true);
  const [consent, setConsent] = useState<'granted' | 'denied' | 'unset'>('denied');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      setConsent(stored === 'granted' || stored === 'denied' ? stored : 'unset');
    } catch {
      setConsent('denied');
    }
  }, []);

  useEffect(() => {
    if (!pathname || !normalizePath(pathname)) return;
    let referrerHost: string | null = null;
    let utmSource: string | null = null;
    if (first.current) {
      first.current = false;
      try {
        const ref = document.referrer ? new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, '') : '';
        if (ref && ref !== window.location.hostname.replace(/^www\./, '')) referrerHost = ref;
      } catch { /* ignore malformed referrers */ }
      utmSource = new URLSearchParams(window.location.search).get('utm_source');
    }
    trackEvent('page_view', { referrerHost, utmSource }, pathname);
    if (window.gtag && hasAnalyticsConsent()) window.gtag('event', 'page_view', { page_path: normalizePath(pathname) });
  }, [pathname]);

  const choose = (value: 'granted' | 'denied') => {
    try { localStorage.setItem(CONSENT_KEY, value); } catch { /* storage blocked: ask again next time */ }
    setConsent(value);
  };

  if (!GA_ID_VALID || trackingDisabledSafe()) return null;
  return <>
    {consent === 'granted' && <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', '${GA_ID}', { anonymize_ip: true, send_page_view: false });
        gtag('event', 'page_view', { page_path: window.location.pathname });
      `}</Script>
    </>}
    {consent === 'unset' && !isPrivateArea(pathname) && <div className="consent-banner" role="dialog" aria-live="polite" aria-label="Analytics cookies">
      <p>We would like to use Google Analytics cookies to understand how KashiNagri is used. Our own anonymous visit counts do not use cookies.</p>
      <div>
        <button type="button" className="partner-secondary" onClick={() => choose('denied')} data-testid="button-consent-decline">Decline</button>
        <button type="button" className="button-primary" onClick={() => choose('granted')} data-testid="button-consent-accept">Accept</button>
      </div>
    </div>}
  </>;
}

function trackingDisabledSafe() {
  return typeof navigator !== 'undefined' && trackingDisabled();
}
function isPrivateArea(pathname: string | null) {
  return !pathname || normalizePath(pathname) === null;
}
