export type AppRole = 'visitor' | 'business_owner' | 'admin' | 'super_admin';

/** Where a user lands after sign-in, highest privilege first. */
export function homeForRoles(roles: readonly string[]): string {
  if (roles.includes('super_admin')) return '/superadmin/';
  if (roles.includes('admin')) return '/admin/';
  if (roles.includes('business_owner')) return '/business/';
  return '/account/';
}

/**
 * Accepts only same-site relative paths ("/business/") for post-auth
 * redirects. Rejects absolute URLs, protocol-relative "//evil.com",
 * backslash tricks and anything that resolves to another origin.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (/[\u0000-\u001f\\]/.test(value)) return null;
  try {
    const base = 'https://kashinagri.invalid';
    const resolved = new URL(value, base);
    if (resolved.origin !== base) return null;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return null;
  }
}
