-- Storage buckets and object policies.
--
-- Path conventions (first folder decides ownership):
--   listing-images/<listing_id>/<file>          public bucket; writes by listing's business members
--   avatars/<user_id>/<file>                    public bucket; writes by that user
--   verification-documents/<business_id>/<file> PRIVATE; business members + verifiers only
--
-- Public buckets serve files to anyone who has the URL, so never put private
-- material in listing-images or avatars.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('verification-documents', 'verification-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- listing-images ------------------------------------------------------------
create policy "listing-images: read public or managed"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'listing-images'
    and (
      private.listing_is_public(private.uuid_or_null((storage.foldername(name))[1]))
      or private.can_manage_listing(private.uuid_or_null((storage.foldername(name))[1]))
      or private.has_permission('listings.moderate')
    )
  );

create policy "listing-images: members upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and private.can_manage_listing(private.uuid_or_null((storage.foldername(name))[1]))
  );

create policy "listing-images: members update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-images'
    and private.can_manage_listing(private.uuid_or_null((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'listing-images'
    and private.can_manage_listing(private.uuid_or_null((storage.foldername(name))[1]))
  );

create policy "listing-images: members delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-images'
    and private.can_manage_listing(private.uuid_or_null((storage.foldername(name))[1]))
  );

-- avatars -------------------------------------------------------------------
create policy "avatars: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy "avatars: users upload own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: users update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: users delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- verification-documents (private) ------------------------------------------
create policy "verification-documents: members and verifiers read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-documents'
    and (
      private.is_business_member(private.uuid_or_null((storage.foldername(name))[1]))
      or private.has_permission('businesses.verify')
    )
  );

create policy "verification-documents: owners upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-documents'
    and private.is_business_owner(private.uuid_or_null((storage.foldername(name))[1]))
  );

create policy "verification-documents: owners delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-documents'
    and private.is_business_owner(private.uuid_or_null((storage.foldername(name))[1]))
  );
