// Enquiry-based booking rules shared by the forms, server actions and panels.
// Pure and import-free (unit-tested). The database enforces the same rules in
// private.enquiries_validate / private.enquiry_next_statuses.

export type EnquiryKind = 'general' | 'stay' | 'table' | 'experience';
export type EnquiryMode = 'booking' | 'message' | 'contact_only';
export type Tone = 'neutral' | 'info' | 'warn' | 'good' | 'bad';

export const ENQUIRY_MODES: { value: EnquiryMode; label: string; help: string }[] = [
  { value: 'booking', label: 'Booking requests', help: 'Travellers send a request with dates and group size. You confirm availability yourself.' },
  { value: 'message', label: 'Questions only', help: 'Travellers can send a message, but no booking request form is shown.' },
  { value: 'contact_only', label: 'Phone and email only', help: 'No form. Travellers see your published contact details.' },
];

/** Request type a listing offers ('none' when it takes no enquiries). */
export function enquiryKind(categorySlug: string | null | undefined, mode: string | null | undefined): EnquiryKind | 'none' {
  if (mode === 'contact_only') return 'none';
  if (mode === 'message') return 'general';
  if (categorySlug === 'stays') return 'stay';
  if (categorySlug === 'food') return 'table';
  if (categorySlug && ['guides', 'events', 'travel', 'spiritual-services'].includes(categorySlug)) return 'experience';
  return 'general';
}

export const KIND_COPY: Record<EnquiryKind, { cta: string; title: string; notice: string; label: string }> = {
  stay: {
    cta: 'Request a room', title: 'Request a stay', label: 'Stay request',
    notice: 'This is a reservation request, not a booking. Submitting it does not guarantee availability; the property will contact you to confirm.',
  },
  table: {
    cta: 'Request a table', title: 'Request a table', label: 'Table request',
    notice: 'The restaurant must confirm your reservation. Until they do, your table is not reserved.',
  },
  experience: {
    cta: 'Request to book', title: 'Request to book', label: 'Booking request',
    notice: 'This is a request to the provider. It is only booked once they confirm it with you.',
  },
  general: {
    cta: 'Send an enquiry', title: 'Send an enquiry', label: 'Enquiry',
    notice: 'Your message goes to the business. KashiNagri does not take bookings or payments.',
  },
};

export const ENQUIRY_STATUS: Record<string, { label: string; tone: Tone; visitor: string }> = {
  new: { label: 'New', tone: 'info', visitor: 'Sent. Waiting for the business to respond.' },
  read: { label: 'Seen', tone: 'neutral', visitor: 'The business has seen your request but has not responded yet.' },
  replied: { label: 'Replied', tone: 'good', visitor: 'The business has responded.' },
  contacted: { label: 'Responded', tone: 'good', visitor: 'The business has responded. Check their message below or contact them directly.' },
  accepted: { label: 'Accepted', tone: 'good', visitor: 'The business accepted your request. It is not confirmed until they confirm the reservation.' },
  alternative_proposed: { label: 'Alternative proposed', tone: 'warn', visitor: 'The business proposed an alternative. Contact them to agree the details.' },
  confirmed: { label: 'Confirmed', tone: 'good', visitor: 'The business has confirmed your reservation.' },
  declined: { label: 'Declined', tone: 'bad', visitor: 'The business could not accept this request.' },
  completed: { label: 'Completed', tone: 'neutral', visitor: 'This booking is completed.' },
  cancelled: { label: 'Cancelled', tone: 'neutral', visitor: 'This request was cancelled.' },
  closed: { label: 'Closed', tone: 'neutral', visitor: 'This enquiry is closed.' },
  spam: { label: 'Spam', tone: 'bad', visitor: 'This enquiry is closed.' },
};

/** Labels for the business's status buttons. */
export const ACTION_LABELS: Record<string, string> = {
  read: 'Mark as seen',
  contacted: 'I have contacted the traveller',
  accepted: 'Accept request',
  alternative_proposed: 'Propose an alternative',
  declined: 'Decline',
  confirmed: 'Confirm reservation',
  completed: 'Mark as completed',
  cancelled: 'Cancel reservation',
  closed: 'Close enquiry',
  spam: 'Mark as spam',
};

/** Allowed next statuses. Must match private.enquiry_next_statuses. */
export function nextStatuses(from: string, actor: 'business' | 'visitor'): string[] {
  if (actor === 'visitor') return ['new', 'read', 'replied', 'contacted', 'accepted', 'alternative_proposed'].includes(from) ? ['cancelled'] : [];
  switch (from) {
    case 'new': return ['read', 'contacted', 'accepted', 'declined', 'alternative_proposed', 'spam'];
    case 'read':
    case 'replied': return ['contacted', 'accepted', 'declined', 'alternative_proposed', 'closed', 'spam'];
    case 'contacted': return ['accepted', 'declined', 'alternative_proposed', 'closed'];
    case 'alternative_proposed': return ['contacted', 'accepted', 'declined', 'closed'];
    case 'accepted': return ['confirmed', 'cancelled'];
    case 'confirmed': return ['completed', 'cancelled'];
    default: return [];
  }
}
export const isOpenStatus = (status: string) => nextStatuses(status, 'business').length > 0;
export const messageRequired = (status: string) => status === 'declined' || status === 'alternative_proposed';

// ---------------------------------------------------------------------------
// Validation (mirrors private.enquiries_validate)
// ---------------------------------------------------------------------------
export type EnquiryInput = {
  kind: EnquiryKind; name: string; phone: string; email: string; message: string;
  checkIn?: string; checkOut?: string; date?: string; time?: string; guests?: string; rooms?: string; experience?: string;
};
export type EnquiryValues = {
  enquiry_type: EnquiryKind; sender_name: string; sender_phone: string; sender_email: string; message: string;
  check_in: string | null; check_out: string | null; requested_date: string | null; requested_time: string | null;
  guests: number | null; rooms: number | null; experience: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const digits = (value: string) => value.replace(/\D/g, '');
export const isValidPhone = (value: string) => PHONE.test(value) && digits(value).length >= 7 && digits(value).length <= 15;

/** Days between two ISO dates (b - a); NaN when either is invalid. */
export function daysBetween(a: string, b: string): number {
  if (!DATE.test(a) || !DATE.test(b)) return Number.NaN;
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((tb - ta) / 86_400_000);
}
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
/** Current date and time in India (the platform's local time). */
export function indiaNow(now = new Date()): { date: string; time: string } {
  const local = new Date(now.getTime() + 330 * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

function count(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined || value.trim() === '' || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return n >= min && n <= max ? n : null;
}

export function validateEnquiry(input: EnquiryInput, now = new Date()):
  { ok: true; values: EnquiryValues } | { ok: false; fieldErrors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const { date: today, time: nowTime } = indiaNow(now);
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const message = input.message.trim();

  if (name.length < 2 || name.length > 120) errors.name = 'Enter your full name.';
  if (!isValidPhone(phone)) errors.phone = 'Enter a valid contact number, e.g. +91 98765 43210.';
  if (!EMAIL.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  if (message.length > 2000) errors.message = 'Keep the message under 2000 characters.';

  const values: EnquiryValues = {
    enquiry_type: input.kind, sender_name: name, sender_phone: phone, sender_email: email, message,
    check_in: null, check_out: null, requested_date: null, requested_time: null, guests: null, rooms: null, experience: null,
  };

  if (input.kind === 'stay') {
    const checkIn = (input.checkIn ?? '').trim();
    const checkOut = (input.checkOut ?? '').trim();
    if (!DATE.test(checkIn)) errors.checkIn = 'Choose a check-in date.';
    else if (checkIn < today) errors.checkIn = 'Check-in cannot be in the past.';
    else if (daysBetween(today, checkIn) > 365) errors.checkIn = 'Check-in must be within the next 12 months.';
    if (!DATE.test(checkOut)) errors.checkOut = 'Choose a check-out date.';
    else if (DATE.test(checkIn) && checkOut <= checkIn) errors.checkOut = 'Check-out must be after check-in.';
    else if (DATE.test(checkIn) && daysBetween(checkIn, checkOut) > 60) errors.checkOut = 'Requests can cover at most 60 nights.';
    const guests = count(input.guests, 1, 50);
    const rooms = count(input.rooms, 1, 20);
    if (guests === null) errors.guests = 'Enter between 1 and 50 guests.';
    if (rooms === null) errors.rooms = 'Enter between 1 and 20 rooms.';
    else if (guests !== null && rooms > guests) errors.rooms = 'The number of rooms cannot be more than the number of guests.';
    Object.assign(values, { check_in: checkIn, check_out: checkOut, guests, rooms });
  } else if (input.kind === 'table') {
    const date = (input.date ?? '').trim();
    const time = (input.time ?? '').trim().slice(0, 5);
    if (!DATE.test(date)) errors.date = 'Choose a date.';
    else if (date < today) errors.date = 'The date cannot be in the past.';
    else if (daysBetween(today, date) > 180) errors.date = 'Reservations can be requested up to 6 months ahead.';
    if (!TIME.test(time)) errors.time = 'Choose a time.';
    else if (date === today && time < nowTime) errors.time = 'The time cannot be in the past.';
    const guests = count(input.guests, 1, 50);
    if (guests === null) errors.guests = 'Enter a party size between 1 and 50.';
    Object.assign(values, { requested_date: date, requested_time: time, guests });
  } else if (input.kind === 'experience') {
    const date = (input.date ?? '').trim();
    if (!DATE.test(date)) errors.date = 'Choose your preferred date.';
    else if (date < today || daysBetween(today, date) > 365) errors.date = 'Choose a date within the next 12 months.';
    const guests = count(input.guests, 1, 50);
    if (guests === null) errors.guests = 'Enter between 1 and 50 participants.';
    const experience = (input.experience ?? '').trim();
    if (experience.length > 200) errors.experience = 'Keep this under 200 characters.';
    Object.assign(values, { requested_date: date, guests, experience: experience || null });
  } else if (message.length < 10) {
    errors.message = 'Write a message of 10 to 2000 characters.';
  }

  return Object.keys(errors).length ? { ok: false, fieldErrors: errors } : { ok: true, values };
}

// ---------------------------------------------------------------------------
// Contact links
// ---------------------------------------------------------------------------
/** tel: target with only digits and a leading +. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, '')}`;

/**
 * WhatsApp number in international form (digits only), or null when the
 * number cannot be a WhatsApp number. Ten-digit Indian mobile numbers
 * (starting 6-9) get the +91 country code.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  let d = digits(trimmed);
  if (!trimmed.startsWith('+')) {
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 10 && /^[6-9]/.test(d)) d = `91${d}`;
    else if (!(d.length === 12 && d.startsWith('91'))) return null;
  }
  if (d.startsWith('91') && !(d.length === 12 && /^91[6-9]/.test(d))) return null;
  return d.length >= 10 && d.length <= 15 ? d : null;
}
export const whatsappHref = (phone: string | null | undefined, text?: string) => {
  const n = whatsappNumber(phone);
  return n ? `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null;
};

/** Short human summary of what was requested (no contact details). */
export function requestSummary(e: {
  enquiry_type: string; check_in?: string | null; check_out?: string | null; requested_date?: string | null;
  requested_time?: string | null; guests?: number | null; rooms?: number | null; experience?: string | null;
}): string {
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (e.enquiry_type === 'stay' && e.check_in && e.check_out) {
    const nights = daysBetween(e.check_in, e.check_out);
    return [`${fmt(e.check_in)} → ${fmt(e.check_out)}`, plural(nights, 'night', 'nights'),
      e.guests ? plural(e.guests, 'guest', 'guests') : '', e.rooms ? plural(e.rooms, 'room', 'rooms') : ''].filter(Boolean).join(' · ');
  }
  if (e.enquiry_type === 'table' && e.requested_date) {
    return [fmt(e.requested_date), e.requested_time?.slice(0, 5) ?? '', e.guests ? `party of ${e.guests}` : ''].filter(Boolean).join(' · ');
  }
  if (e.enquiry_type === 'experience' && e.requested_date) {
    return [e.experience ?? '', fmt(e.requested_date), e.guests ? plural(e.guests, 'participant', 'participants') : ''].filter(Boolean).join(' · ');
  }
  return 'General enquiry';
}
