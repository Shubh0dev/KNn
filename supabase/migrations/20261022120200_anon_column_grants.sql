-- Security audit fix: the anonymous role could read internal account ids
-- (created_by / updated_by) on public catalogue rows. Replace table-level
-- SELECT with column-level SELECT that omits them. Row Level Security is
-- unchanged; signed-in roles are unchanged.

revoke select on public.listings from anon;
grant select (id, business_id, category_id, title, slug, summary, description, area, address, latitude, longitude,
              price_band, price_from, price_to, price_note, amenities, business_hours, subtype,
              contact_phone, contact_email, website, status, submitted_at, published_at, created_at, updated_at)
  on public.listings to anon;

revoke select on public.businesses from anon;
grant select (id, name, slug, description, area, website, logo_path, verification_status, verified_at,
              business_type, public_phone, public_email, address, latitude, longitude, created_at, updated_at)
  on public.businesses to anon;

revoke select on public.platform_settings from anon;
grant select (key, value, description, is_public, updated_at) on public.platform_settings to anon;

revoke select on public.featured_placements from anon;
grant select (id, listing_id, placement, sort_order, is_sponsored, starts_at, ends_at, created_at) on public.featured_placements to anon;
