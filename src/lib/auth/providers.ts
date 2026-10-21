import 'server-only';

import { isSupabaseConfigured, supabaseEnv } from '../supabase/env';

/**
 * True only when Google is enabled (with credentials) in Supabase Auth.
 * Read from the project's public auth settings and cached for 5 minutes, so
 * the button appears or disappears without a redeploy.
 */
export async function isGoogleSignInEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { url, publishableKey } = supabaseEnv();
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
      next: { revalidate: 300 },
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
