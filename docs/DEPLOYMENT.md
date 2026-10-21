# KashiNagri — deployment and operations

Hosting: **Vercel** (project `k-nn`, domain `www.kashinagri.com`), deploying from GitHub `main`.
Database/Auth/Storage: **Supabase** project `ryexnaymomoezslcpkbk`.

## 1. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Scope | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | yes | `https://ryexnaymomoezslcpkbk.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | yes | publishable key only (RLS protects data) |
| `NEXT_PUBLIC_SITE_URL` | public | yes | `https://www.kashinagri.com` (auth emails, sitemap, canonical URLs) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | public | no | `G-…`; GA loads only after cookie consent |
| `PAYMENT_PROVIDER` | server | no | set only after a real payment integration with verified webhooks |

Never add a Supabase secret/service-role key with a `NEXT_PUBLIC_` prefix. The app does not use one today.

## 2. Supabase configuration (dashboard, manual)

- **Auth → URL configuration**: Site URL `https://www.kashinagri.com`; redirect URLs
  `https://www.kashinagri.com/auth/callback/**`, `https://kashinagri.com/auth/callback/**`, `http://localhost:3000/auth/callback/**`.
- **Auth → Email templates** (recommended, works across devices): confirmation link
  `{{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&type=email`; recovery link
  `{{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&type=recovery`.
- **Auth → SMTP**: configure a real sender (the built-in one is heavily rate limited).
- **Auth → Password security**: enable leaked-password protection.
- **Auth → Providers → Google** (optional): client id/secret from Google Cloud; redirect URI
  `https://ryexnaymomoezslcpkbk.supabase.co/auth/v1/callback`. The button appears automatically when enabled.

## 3. Database migrations

Migrations live in `supabase/migrations/` and are applied in filename order. All of them are already
applied to the production project. Notes on history:

- The project's recorded migration versions are timestamps assigned at apply time, not the file
  names. Before ever using `supabase db push`, run `supabase migration list` and reconcile with
  `supabase migration repair` so files are not re-applied.
- `20261021090410_superadmin_role_functions.sql` is present in the database (verified) but has no
  history row; it is idempotent (`create or replace`).
- Every migration is additive. None drops tables or rewrites data.

Rollback: there are no automatic down-migrations. To undo a change, write a new forward migration
(e.g. `revoke`/`drop policy`/`create or replace function` back to the previous body, which is in
the earlier migration file). Never disable RLS to fix an error.

## 4. Deploy checklist

1. `npm ci && npm run typecheck && npm test && npm run build` locally (CI runs the same).
2. Apply any new migration in Supabase (SQL editor or MCP) **before** pushing code that needs it.
3. Run the database tests in the SQL editor; each must end with `0 failed` and rolls itself back:
   `supabase/tests/rls_smoke_test.sql`, `business_panel_test.sql`, `admin_panel_test.sql`, `analytics_test.sql`.
4. Commit and push to `main`; Vercel builds and deploys.
5. Smoke-check: `/`, a category page, `/login/`, `/business/`, `/admin/`, `/superadmin/` (signed out → login),
   `/sitemap.xml`, `/robots.txt`.
6. Run Supabase advisors (security + performance) and review any new warnings.

**Caching:** public pages are cached for 5 minutes (sitemap: 1 hour). Moderation and edits made in
the panels refresh them immediately; changes made directly in the Supabase SQL editor or API do not,
and appear once the cache expires (or after the next deploy).

**Rollback (app):** Vercel → Deployments → previous production deployment → *Promote to Production*
(instant). Because migrations are additive, the previous app version keeps working against the
newer schema.

## 5. Analytics data model

| Source | What | Stored where | Who can read |
|---|---|---|---|
| First-party site events | `page_view`, `search`, `category_click`, `trip_created`, `trip_saved`, `trip_shared`, `outbound_click` | `site_events` (written only via `track_event`) | super admins, aggregates only (`superadmin_analytics`) |
| Listing engagement | `view`, `contact_click`, `website_click`, `direction_click`, `share` | `listing_engagement_events` (via `track_listing_event`) | the listing's business (no visitor identity), moderators |
| Records | enquiries, accounts, businesses, submissions | their own tables | per RLS |
| Google Analytics 4 | traffic, devices, geography | Google | GA property owners; never merged with first-party numbers |

Privacy rules: no cookies for first-party analytics; per-tab random session id; no IP, user agent,
query strings or user ids in `site_events`; e-mails/phone numbers stripped from search terms;
private paths never recorded; Do Not Track / Global Privacy Control respected; popular searches
shown only when used at least twice.

Abuse controls: event names and fields validated in the database; de-duplication windows; 300
site events and 200 listing events per session per hour; enquiries limited to 10/day per user and
3/day per listing. Limitation: a determined script can rotate session ids, so anonymous counts are
indicative, not audited figures. Consider a scheduled job to aggregate and purge raw `site_events`
older than ~13 months.

## 6. Test accounts and cleanup

Automated end-to-end tests use labelled accounts (`e2e-*@example.test`) and records (`E2E TEST …`,
slug `e2e-test-*`). After a test run they are deactivated and banned. Remove them completely with
`supabase/tests/cleanup_e2e_data.sql` in the SQL editor.
