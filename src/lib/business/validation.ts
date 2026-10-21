import { z } from 'zod';
import { BUSINESS_TYPE_VALUES, DAYS, PRICE_BANDS, type BusinessHours } from './constants';

export type FieldErrors = Record<string, string>;
export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors: FieldErrors };

const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GST = /^[0-9A-Z]{15}$/;

/** Empty or whitespace-only form values become undefined. */
const blankToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim() : v;
const text = (max: number) => z.preprocess(blankToUndefined, z.string().max(max).optional());
const requiredText = (max: number, min: number, message?: string) =>
  z.preprocess(
    v => (typeof v === 'string' ? v.trim() : v),
    z.string({ error: message ?? 'This field is required.' }).min(min, message ?? `Enter at least ${min} characters.`).max(max, `Use at most ${max} characters.`),
  );
const phone = z.preprocess(
  v => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim() : v),
  z.string().regex(PHONE, 'Enter a valid phone number, e.g. +91 98765 43210').optional(),
);
const email = z.preprocess(
  v => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.string().max(254).regex(EMAIL, 'Enter a valid email address').optional(),
);
const website = z.preprocess(
  v => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim() : v),
  z.string().max(300).regex(/^https?:\/\/[^\s]+$/i, 'Start the web address with http:// or https://').optional(),
);
const optionalNumber = (min: number, max: number, message: string) =>
  z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? Number(v) : v),
    z.number({ error: message }).min(min, message).max(max, message).optional(),
  );
const optionalInt = (max: number, message: string) =>
  z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? Number(v) : v),
    z.number({ error: message }).int(message).min(0, message).max(max, message).optional(),
  );

function toResult<T>(parsed: z.ZodSafeParseResult<T>): ParseResult<T> {
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    fieldErrors[key] ??= issue.message;
  }
  const first = Object.values(fieldErrors)[0] ?? 'Please check the form and try again.';
  return { ok: false, error: first, fieldErrors };
}

const formValue = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : undefined;
};

/** Both coordinates, or neither. */
function coordinatePair<T extends { latitude?: number; longitude?: number }>(value: T, ctx: z.RefinementCtx) {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) {
    ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Enter both latitude and longitude, or leave both empty.' });
  }
}

// ---------------------------------------------------------------------------
// Business onboarding and settings
// ---------------------------------------------------------------------------
export const businessProfileSchema = z
  .object({
    name: requiredText(120, 2, 'Enter your business name (at least 2 characters).'),
    business_type: z.enum(BUSINESS_TYPE_VALUES, { error: 'Choose what kind of business this is.' }),
    area: requiredText(80, 2, 'Enter the locality or area of Kashi.'),
    address: text(300),
    description: text(2000),
    website,
    public_phone: phone,
    public_email: email,
    latitude: optionalNumber(-90, 90, 'Latitude must be between -90 and 90.'),
    longitude: optionalNumber(-180, 180, 'Longitude must be between -180 and 180.'),
  })
  .superRefine(coordinatePair);
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

export const businessSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'The web address needs at least 3 characters.')
  .max(80, 'The web address can be at most 80 characters.')
  .regex(SLUG, 'Use lowercase letters, numbers and single hyphens.');

export const privateDetailsSchema = z.object({
  legal_name: text(200),
  registration_number: text(60),
  gst_number: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim().toUpperCase() : v),
    z.string().regex(GST, 'A GST number has 15 letters and digits.').optional(),
  ),
  contact_email: email,
  contact_phone: phone,
  registered_address: text(500),
});
export type PrivateDetailsInput = z.infer<typeof privateDetailsSchema>;

export const profileSchema = z.object({
  full_name: requiredText(120, 2, 'Enter your business name (at least 2 characters).'),
  phone,
  preferred_language: z.enum(['en', 'hi'], { error: 'Choose a language.' }),
});

export const notificationSchema = z.object({
  enquiry_email: z.boolean(),
  listing_status_email: z.boolean(),
  product_updates: z.boolean(),
});

export const parseBusinessProfile = (formData: FormData) =>
  toResult(businessProfileSchema.safeParse(Object.fromEntries(formData)));
export const parsePrivateDetails = (formData: FormData) =>
  toResult(privateDetailsSchema.safeParse(Object.fromEntries(formData)));
export const parseProfile = (formData: FormData) =>
  toResult(profileSchema.safeParse(Object.fromEntries(formData)));
export const parseNotifications = (formData: FormData) =>
  toResult(
    notificationSchema.safeParse({
      enquiry_email: formData.get('enquiry_email') === 'on',
      listing_status_email: formData.get('listing_status_email') === 'on',
      product_updates: formData.get('product_updates') === 'on',
    }),
  );
export const parseSlug = (value: string | undefined) => {
  const parsed = businessSlugSchema.safeParse(value ?? '');
  return parsed.success ? ({ ok: true, data: parsed.data } as const) : ({ ok: false, error: parsed.error.issues[0].message } as const);
};

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------
export const listingSchema = z
  .object({
    title: requiredText(140, 3, 'Give the listing a title (at least 3 characters).'),
    category_id: z.string({ error: 'Choose a category.' }).uuid('Choose a category.'),
    subtype: text(60),
    summary: text(300),
    description: text(10000),
    area: text(80),
    address: text(300),
    latitude: optionalNumber(-90, 90, 'Latitude must be between -90 and 90.'),
    longitude: optionalNumber(-180, 180, 'Longitude must be between -180 and 180.'),
    contact_phone: phone,
    contact_email: email,
    website,
    price_band: z.preprocess(
      v => (typeof v === 'string' && v === '' ? undefined : v),
      z.enum(PRICE_BANDS.map(p => p.value) as [string, ...string[]], { error: 'Choose a price level.' }).optional(),
    ),
    price_from: optionalInt(10_000_000, 'Enter a whole amount in rupees.'),
    price_to: optionalInt(10_000_000, 'Enter a whole amount in rupees.'),
    price_note: text(200),
    amenities: z.array(z.string().trim().min(1).max(60)).max(20, 'Choose at most 20 amenities.'),
    business_hours: z.custom<BusinessHours | undefined>(),
  })
  .superRefine(coordinatePair)
  .superRefine((value, ctx) => {
    if (value.price_from !== undefined && value.price_to !== undefined && value.price_to < value.price_from) {
      ctx.addIssue({ code: 'custom', path: ['price_to'], message: 'The upper price must not be below the lower price.' });
    }
  });
export type ListingInput = z.infer<typeof listingSchema>;

/** Reads opening hours from fields named hours_<day>_open / _close / _closed. */
export function readHours(formData: FormData): { hours?: BusinessHours; error?: string } {
  const hours: BusinessHours = {};
  for (const { key, label } of DAYS) {
    const closed = formData.get(`hours_${key}_closed`) === 'on';
    const open = formatTime(formValue(formData, `hours_${key}_open`));
    const close = formatTime(formValue(formData, `hours_${key}_close`));
    if (closed) {
      hours[key] = { closed: true };
    } else if (open || close) {
      if (!open || !close || !TIME.test(open) || !TIME.test(close)) return { error: `Enter both opening and closing times for ${label}.` };
      hours[key] = { open, close };
    }
  }
  return { hours: Object.keys(hours).length ? hours : undefined };
}
const formatTime = (value: string | undefined) => (value && value.trim() ? value.trim().slice(0, 5) : undefined);

export function parseListing(formData: FormData): ParseResult<ListingInput> {
  const { hours, error } = readHours(formData);
  if (error) return { ok: false, error, fieldErrors: { business_hours: error } };
  const raw = {
    ...Object.fromEntries(formData),
    amenities: formData.getAll('amenities').filter((v): v is string => typeof v === 'string'),
    business_hours: hours,
  };
  return toResult(listingSchema.safeParse(raw));
}

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
