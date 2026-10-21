import { DAYS, type BusinessHours } from './constants';

export const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';

export const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '–';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function formatPrice(from?: number | null, to?: number | null, note?: string | null) {
  let range = '';
  if (from != null && to != null) range = from === to ? rupees(from) : `${rupees(from)} – ${rupees(to)}`;
  else if (from != null) range = `From ${rupees(from)}`;
  else if (to != null) range = `Up to ${rupees(to)}`;
  return [range, note].filter(Boolean).join(' · ');
}

export function hoursRows(hours: BusinessHours | null | undefined) {
  return DAYS.flatMap(({ key, label }) => {
    const day = hours?.[key];
    if (!day) return [];
    return [{ label, value: day.closed ? 'Closed' : `${day.open} – ${day.close}` }];
  });
}

/** Strips characters that act as wildcards or separators in PostgREST ilike/or filters. */
export const sanitizeSearch = (value: string) => value.replace(/[%_,()*\\]/g, ' ').trim().slice(0, 60);
