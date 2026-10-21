-- Adds the `suspended` listing status (moderator action: listing is hidden from
-- public discovery but kept, and the owner cannot edit or resubmit it).
-- Kept in its own migration: a new enum value cannot be used in the same
-- transaction that adds it.
alter type public.listing_status add value if not exists 'suspended';
