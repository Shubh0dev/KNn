import { signInWithGoogle } from '../auth/actions';

/** Rendered only when NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true and the provider is configured in Supabase. */
export function GoogleButton({ next }: { next?: string }) {
  if (process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED !== 'true') return null;
  return <>
    <div className="auth-divider"><span>or</span></div>
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next ?? ''} />
      <button type="submit" className="partner-secondary auth-oauth" data-testid="button-google">Continue with Google</button>
    </form>
  </>;
}
