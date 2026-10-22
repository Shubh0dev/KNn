export const BUSINESS_TYPES = [
  { value: 'stay', label: 'Stay: hotel, guest house, dharamshala, homestay', category: 'stays' },
  { value: 'food', label: 'Food: restaurant, café, sweets, street food', category: 'food' },
  { value: 'shop', label: 'Shop or craft: sarees, handicrafts, markets', category: 'shopping' },
  { value: 'guide', label: 'Tour guide or walking experience', category: 'guides' },
  { value: 'boat', label: 'Boat, taxi or transport operator', category: 'travel' },
  { value: 'spiritual', label: 'Spiritual service: puja, pandit, jyotish', category: 'spiritual-services' },
  { value: 'experience', label: 'Event or cultural experience', category: 'events' },
  { value: 'other', label: 'Other local business or service', category: 'local-services' },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]['value'];
export const BUSINESS_TYPE_VALUES = BUSINESS_TYPES.map(t => t.value) as [BusinessType, ...BusinessType[]];
export const businessTypeLabel = (value: string | null | undefined) =>
  BUSINESS_TYPES.find(t => t.value === value)?.label ?? 'Not set';
export const defaultCategorySlug = (type: string | null | undefined) =>
  BUSINESS_TYPES.find(t => t.value === type)?.category ?? 'local-services';

/** Listing subtypes by category slug. */
export const SUBTYPES: Record<string, string[]> = {
  stays: ['Budget room', 'Hotel', 'Guest house', 'Dharamshala', 'Homestay', 'Hostel or PG', 'Long-stay rental', 'Heritage stay'],
  food: ['Street food', 'Restaurant', 'Café', 'Thali', 'Sweets and mithai', 'Bakery', 'Juice and lassi'],
  shopping: ['Banarasi sarees', 'Handicrafts', 'Brassware and metalwork', 'Books and music', 'General market', 'Souvenirs'],
  guides: ['Heritage walk', 'Food walk', 'Temple tour', 'Photography walk', 'Day trip', 'Private guide'],
  travel: ['Boat ride', 'Taxi or cab', 'E-rickshaw', 'Airport transfer', 'Car rental'],
  'spiritual-services': ['Puja and path', 'Pandit and purohit', 'Jyotish', 'Ritual guidance'],
  events: ['Festival experience', 'Cultural performance', 'Workshop', 'Class'],
  'local-services': ['Laundry', 'Tailoring', 'Repair', 'Pharmacy', 'Other service'],
};

/** Amenity suggestions by category slug. */
export const AMENITIES: Record<string, string[]> = {
  stays: ['Air conditioning', 'Wi-Fi', 'Hot water', 'Breakfast', 'River view', 'Parking', 'Family rooms', 'Lift', 'Pickup service'],
  food: ['Vegetarian only', 'Vegan options', 'Jain options', 'Seating', 'Takeaway', 'Delivery', 'Card payments', 'Family friendly'],
  shopping: ['Fixed prices', 'Card payments', 'Shipping available', 'Custom orders', 'Workshop visit'],
  guides: ['English spoken', 'Hindi spoken', 'Small groups', 'Private tours', 'Pickup service'],
  travel: ['Life jackets', 'Fixed fares', 'Card payments', 'Advance booking', 'Group bookings'],
  'spiritual-services': ['English spoken', 'Hindi spoken', 'Home visits', 'Advance booking'],
  events: ['Family friendly', 'Advance booking', 'Seasonal'],
  'local-services': ['Card payments', 'Home service', 'Same-day service'],
};
export const ALL_AMENITIES = Array.from(new Set(Object.values(AMENITIES).flat()));

export const PRICE_BANDS = [
  { value: 'free', label: 'Free' },
  { value: 'budget', label: 'Budget' },
  { value: 'mid', label: 'Mid-range' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
] as const;

export const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
] as const;
export type DayKey = (typeof DAYS)[number]['key'];
export type DayHours = { closed?: boolean; open?: string; close?: string };
export type BusinessHours = Partial<Record<DayKey, DayHours>>;

export const DOCUMENT_TYPES = [
  { value: 'identity', label: 'Owner identity (e.g. Aadhaar, passport)' },
  { value: 'business_registration', label: 'Business registration or licence' },
  { value: 'gst_certificate', label: 'GST certificate' },
  { value: 'address_proof', label: 'Proof of business address' },
  { value: 'other', label: 'Other supporting document' },
] as const;
export const documentTypeLabel = (value: string) => DOCUMENT_TYPES.find(t => t.value === value)?.label ?? value;

export type Tone = 'neutral' | 'info' | 'warn' | 'good' | 'bad';

export const LISTING_STATUS: Record<string, { label: string; tone: Tone; help: string }> = {
  draft: { label: 'Draft', tone: 'neutral', help: 'Only you can see this. Submit it for review when it is ready.' },
  pending_review: { label: 'In review', tone: 'info', help: 'Our team is reviewing this listing. It is not public yet.' },
  changes_requested: { label: 'Changes requested', tone: 'warn', help: 'Update the listing as described below, then resubmit.' },
  published: { label: 'Published', tone: 'good', help: 'Visible to travellers on KashiNagri.' },
  rejected: { label: 'Rejected', tone: 'bad', help: 'This listing was not approved. Fix the issues below and resubmit.' },
  suspended: { label: 'Suspended', tone: 'bad', help: 'Hidden from travellers by KashiNagri. Contact support to resolve this.' },
  archived: { label: 'Archived', tone: 'neutral', help: 'Hidden and inactive. Restore it to work on it again.' },
};

export const VERIFICATION_STATUS: Record<string, { label: string; tone: Tone; help: string }> = {
  unverified: { label: 'Not verified', tone: 'neutral', help: 'Upload a document, then request verification.' },
  pending: { label: 'Verification in review', tone: 'info', help: 'Our team is reviewing your documents.' },
  verified: { label: 'Verified', tone: 'good', help: 'Your business is verified. Approved listings can go public.' },
  changes_requested: { label: 'Corrections requested', tone: 'warn', help: 'Our team asked for corrections. Read the note, update your details or documents, then request verification again.' },
  rejected: { label: 'Verification declined', tone: 'bad', help: 'See the note below, upload corrected documents and request again.' },
  suspended: { label: 'Suspended', tone: 'bad', help: 'Your business is suspended. Contact support.' },
};

export { ENQUIRY_STATUS } from '../enquiries/rules';

export const ENGAGEMENT_LABELS: Record<string, string> = {
  view: 'Listing views',
  contact_click: 'Contact clicks',
  website_click: 'Website clicks',
  direction_click: 'Direction clicks',
  share: 'Shares',
  favourite: 'Saves',
};

export const IMAGE_LIMITS = { maxBytes: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], max: 10 };
export const DOCUMENT_LIMITS = { maxBytes: 10 * 1024 * 1024, types: ['application/pdf', 'image/jpeg', 'image/png'] };

export const LISTING_EDITABLE = ['draft', 'pending_review', 'changes_requested', 'published', 'rejected'];
