import type { Tone } from '../business/constants';

export const ADMIN_PERMISSIONS = [
  { key: 'businesses.verify', label: 'Verify businesses', help: 'Review documents and approve, reject or suspend business verification.' },
  { key: 'listings.moderate', label: 'Moderate listings', help: 'Approve, reject or request changes on submitted listings.' },
  { key: 'listings.suspend', label: 'Suspend or unpublish listings', help: 'Take live listings down. Requires a reason.' },
  { key: 'reports.review', label: 'Review content reports', help: 'Work the report queue and record outcomes.' },
  { key: 'enquiries.view', label: 'View enquiries', help: 'Read enquiries sent to businesses (for support cases).' },
  { key: 'users.view', label: 'View account profiles', help: 'See names and emails of registered people.' },
  { key: 'users.manage', label: 'Suspend accounts', help: 'Suspend or reactivate non-staff accounts.' },
  { key: 'categories.manage', label: 'Manage categories', help: 'Edit listing category definitions.' },
  { key: 'content.manage', label: 'Manage curated content', help: 'Curated places and featured placements.' },
  { key: 'payments.view', label: 'View billing records', help: 'Read subscription and payment records.' },
  { key: 'audit.view', label: 'View audit log', help: 'Read the platform audit history.' },
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]['key'];
export const ADMIN_PERMISSION_KEYS = ADMIN_PERMISSIONS.map(p => p.key) as AdminPermission[];
export const permissionLabel = (key: string) => ADMIN_PERMISSIONS.find(p => p.key === key)?.label ?? key;

export const REPORT_REASONS: Record<string, string> = {
  incorrect_information: 'Incorrect information',
  inappropriate_content: 'Inappropriate content',
  fraud_or_scam: 'Fraud or scam',
  closed_or_moved: 'Closed or moved',
  duplicate: 'Duplicate listing',
  other: 'Something else',
};

export const REPORT_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'info' },
  reviewing: { label: 'Under review', tone: 'warn' },
  resolved: { label: 'Resolved', tone: 'good' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
};

export const REPORT_RESOLUTIONS: Record<string, string> = {
  no_action: 'No action needed',
  listing_updated: 'Listing corrected',
  listing_suspended: 'Listing suspended',
  owner_contacted: 'Owner contacted',
};

export const ACCOUNT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'good' },
  suspended: { label: 'Suspended', tone: 'bad' },
  deactivated: { label: 'Deactivated', tone: 'neutral' },
};

/** Row returned by public.superadmin_list_users. */
export type UserRow = {
  id: string; email: string | null; full_name: string | null; account_status: string; roles: string[];
  business_count: number; created_at: string; last_sign_in_at: string | null; email_confirmed: boolean; total_count: number;
};

export const ROLE_LABELS: Record<string, string> = {
  visitor: 'Visitor',
  business_owner: 'Business owner',
  admin: 'Admin',
  super_admin: 'Super admin',
};
