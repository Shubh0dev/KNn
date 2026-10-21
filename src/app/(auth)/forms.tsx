'use client';

import { useActionState } from 'react';
import { ArrowRight } from 'lucide-react';
import { requestPasswordReset, signIn, signUp, updatePassword, type FormState } from '../auth/actions';

function Notice({ state }: { state: FormState }) {
  if (state?.error) return <p className="auth-notice auth-error" role="alert">{state.error}</p>;
  if (state?.message) return <p className="auth-notice auth-success" role="status">{state.message}</p>;
  return null;
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return <button type="submit" className="button-primary auth-submit" disabled={pending} data-testid="button-auth-submit">
    {pending ? 'Please wait…' : label} {!pending && <ArrowRight size={15} />}
  </button>;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return <form action={action} className="auth-form" noValidate>
    <Notice state={state} />
    <input type="hidden" name="next" value={next ?? ''} />
    <label>Email<input name="email" type="email" autoComplete="email" required data-testid="input-email" /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required data-testid="input-password" /></label>
    <Submit pending={pending} label="Sign in" />
  </form>;
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUp, undefined);
  if (state?.message) return <Notice state={state} />;
  return <form action={action} className="auth-form" noValidate>
    <Notice state={state} />
    <input type="hidden" name="next" value={next ?? ''} />
    <label>Your name<input name="full_name" autoComplete="name" maxLength={120} required data-testid="input-full-name" /></label>
    <label>Email<input name="email" type="email" autoComplete="email" required data-testid="input-email" /></label>
    <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required data-testid="input-password" /><small>At least 8 characters.</small></label>
    <label>Confirm password<input name="confirm_password" type="password" autoComplete="new-password" required data-testid="input-confirm-password" /></label>
    <Submit pending={pending} label="Create account" />
  </form>;
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return <form action={action} className="auth-form" noValidate>
    <Notice state={state} />
    <label>Email<input name="email" type="email" autoComplete="email" required data-testid="input-email" /></label>
    <Submit pending={pending} label="Send reset link" />
  </form>;
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return <form action={action} className="auth-form" noValidate>
    <Notice state={state} />
    <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required data-testid="input-password" /></label>
    <label>Confirm new password<input name="confirm_password" type="password" autoComplete="new-password" required data-testid="input-confirm-password" /></label>
    <Submit pending={pending} label="Update password" />
  </form>;
}
