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

-- Anonymous site analytics recorded by the automated test runs (localhost). site_events rows carry no
-- user id, so they can only be matched by time window.
-- 1) 21 Oct 2026 22:00–22:45 UTC (03:30–04:15 IST): before Part 4 was pushed, so only test traffic.
delete from public.site_events where created_at >= '2026-10-21 22:00:00+00' and created_at < '2026-10-21 22:45:00+00';
-- 2) OPTIONAL. 21 Oct 22:45 UTC – 22 Oct 00:15 UTC (04:15–05:45 IST): the Part 4/5 test runs, but Part 4
--    was live by then, so a few real early-morning visits may be included. Remove the leading "-- " to
--    run it if you prefer clean analytics over keeping those few possible real page views.
-- delete from public.site_events where created_at >= '2026-10-21 22:45:00+00' and created_at < '2026-10-22 00:15:00+00';

-- Verify afterwards: these should all return 0.
-- select count(*) from public.businesses where slug like 'e2e-test-%';
-- select count(*) from public.listings where title like 'E2E TEST%';
-- select count(*) from auth.users where email like 'e2e-%@example.test';

-- Test photos in Storage whose listings no longer exist can only be removed in
-- Dashboard -> Storage -> listing-images (folders named by listing id).
