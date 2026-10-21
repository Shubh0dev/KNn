-- Removes everything the automated end-to-end tests created.
-- Run once in Supabase Dashboard -> SQL Editor. It only matches test data:
--   businesses with slug 'e2e-test-%', listings whose title starts with
--   'E2E TEST' (including curated places), and users with 'e2e-%@example.test'.
-- Real businesses and your own account are not matched.
--
-- Cascades: business -> listings, images, documents, members, private details,
-- enquiries, reports, engagement events, verification history, featured placements;
-- user -> profile, roles, permissions. audit_logs is append-only by design and
-- keeps its entries.

delete from public.listings where title like 'E2E TEST%';
delete from public.businesses where slug like 'e2e-test-%';
delete from auth.users where email like 'e2e-%@example.test';

-- Anonymous site analytics recorded by the Part 4 test runs (localhost, 21 Oct 2026 22:00–23:00 UTC,
-- before the analytics code was deployed). site_events rows carry no user id, so they are matched
-- by time window only. Run this BEFORE the Part 4 deploy goes live, or adjust the window.
delete from public.site_events where created_at >= '2026-10-21 22:00:00+00' and created_at < '2026-10-21 23:00:00+00';

-- Verify afterwards: these should all return 0.
-- select count(*) from public.businesses where slug like 'e2e-test-%';
-- select count(*) from public.listings where title like 'E2E TEST%';
-- select count(*) from auth.users where email like 'e2e-%@example.test';

-- Test photos in Storage whose listings no longer exist can only be removed in
-- Dashboard -> Storage -> listing-images (folders named by listing id).
