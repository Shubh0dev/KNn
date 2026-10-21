import 'server-only';

/**
 * Canonical site origin for links in auth emails and OAuth redirects.
 * Taken from configuration rather than the request Host header, so a forged
 * Host cannot redirect confirmation links to another domain.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  throw new Error('NEXT_PUBLIC_SITE_URL must be set in production.');
}
