-- Enquiry-based booking workflow (Part 5): new enquiry statuses.
-- Kept in its own migration because Postgres only allows a new enum value to be
-- used after the transaction that added it has committed.
--
-- Existing values (new, read, replied, closed, spam) stay valid, so no existing
-- row changes. Workflow:
--   new -> read (seen) -> contacted -> accepted | declined | alternative_proposed
--   accepted -> confirmed -> completed;  cancelled by visitor or business before completion.

alter type public.enquiry_status add value if not exists 'contacted';
alter type public.enquiry_status add value if not exists 'accepted';
alter type public.enquiry_status add value if not exists 'declined';
alter type public.enquiry_status add value if not exists 'alternative_proposed';
alter type public.enquiry_status add value if not exists 'confirmed';
alter type public.enquiry_status add value if not exists 'completed';
alter type public.enquiry_status add value if not exists 'cancelled';
