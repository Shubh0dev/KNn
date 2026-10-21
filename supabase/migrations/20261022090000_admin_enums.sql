-- Part 3 enum values (own migration: new enum values cannot be used in the
-- transaction that adds them).

-- Verifiers can ask a business to fix its submission without rejecting it.
alter type public.business_verification_status add value if not exists 'changes_requested';

-- Explicit permissions for sensitive admin actions.
alter type public.admin_permission add value if not exists 'reports.review';   -- content report queue
alter type public.admin_permission add value if not exists 'listings.suspend'; -- suspend / unpublish live listings
alter type public.admin_permission add value if not exists 'content.manage';   -- curated listings, featured placements
