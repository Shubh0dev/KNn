export type ActionState = { error?: string; message?: string; fieldErrors?: Record<string, string> } | undefined;

type DbError = { code?: string; message: string } | null | undefined;

/**
 * Turns a database error into text that is safe to show. Messages raised on
 * purpose by our workflow functions (SQLSTATE P0001 / 42501) are written for
 * users; anything else gets a generic message so internals do not leak.
 */
export function friendlyDbError(error: DbError, fallback: string): string {
  if (!error) return fallback;
  if (error.code === 'P0001' || error.code === '42501') return error.message;
  if (error.code === '23505') return 'That value is already in use. Please choose another.';
  if (error.code === '23514') return 'One of the values is not allowed. Please check the form.';
  return fallback;
}

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
