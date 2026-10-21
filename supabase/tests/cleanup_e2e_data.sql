-- Removes everything the automated end-to-end tests created.
-- Run once in Supabase Dashboard -> SQL Editor. It only matches test data:
--   businesses with slug 'e2e-test-%' and users with email 'e2e-%@example.test'.
-- Real businesses and your own account are not matched.
--
-- Cascades: business -> listings, images, documents, members, private details,
-- enquiries, engagement events, verification history; user -> profile, roles,
-- permissions. audit_logs is append-only by design and keeps its entries.

delete from public.businesses where slug like 'e2e-test-%';
delete from auth.users where email like 'e2e-%@example.test';

-- Tiny leftover test images may remain in Storage (their listings no longer
-- exist, so no app user can remove them). Delete them in Dashboard -> Storage ->
-- listing-images if any folders remain there.
