/** Event name the navigation indicator listens to (detail: destination URL). */
export const NAVIGATION_START_EVENT = 'kn:navigation-start';

/**
 * Call right before a programmatic navigation (router.push / router.replace) so
 * the navigation indicator can appear. Pass the destination: nothing is shown
 * when it is the current page. Link clicks and GET forms are detected
 * automatically and do not need this.
 */
export function signalNavigationStart(href: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT, { detail: href }));
}

/** Destination of a GET form submission (action + fields as the query string). */
export function getFormTarget(form: HTMLFormElement, submitter?: HTMLElement | null): URL {
  const url = new URL(form.getAttribute('action') || window.location.href, window.location.href);
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form, submitter ?? undefined)) if (typeof value === 'string') params.append(key, value);
  url.search = params.toString();
  return url;
}
