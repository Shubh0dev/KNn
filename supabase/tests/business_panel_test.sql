-- Business Panel workflow and isolation test.
-- Creates throwaway users/businesses/listings inside one transaction,
-- impersonates each role, then RAISES at the end so everything rolls back.
-- Results are in the error message: expect "0 failed".
-- (Deliberately contains no DELETE statements; removal rules are covered by
-- the end-to-end UI test.)

do $$
declare
  r text := '';
  fails int := 0;
  n int;
  ok boolean;
  msg text;
  v_status text;
  u_a uuid := gen_random_uuid(); -- owner of business A
  u_b uuid := gen_random_uuid(); -- owner of business B
  u_c uuid := gen_random_uuid(); -- plain visitor who sends an enquiry
  u_m uuid := gen_random_uuid(); -- moderator
  biz_a uuid;
  biz_b uuid;
  l_a uuid;
  l_b uuid;
  cat uuid;
  i int;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
         '{}'::jsonb, jsonb_build_object('full_name', name), now(), now()
  from (values (u_a, 'bp-a@example.test', 'Owner A'), (u_b, 'bp-b@example.test', 'Owner B'),
               (u_c, 'bp-c@example.test', 'Visitor C'), (u_m, 'bp-m@example.test', 'Moderator M')) t(id, email, name);
  insert into public.user_roles (user_id, role) values (u_m, 'admin');
  insert into public.admin_permissions (user_id, permission)
  values (u_m, 'listings.moderate'), (u_m, 'businesses.verify'), (u_m, 'listings.suspend');
  select id into cat from public.listing_categories where slug = 'stays';

  -- ------------------------------------------------------------ onboarding
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  biz_a := public.create_business('BP Stay A', 'bp-stay-a', 'Test', 'Assi');
  update public.businesses set business_type = 'stay', public_phone = '+91 98765 43210', address = '1 Ghat Rd' where id = biz_a;
  get diagnostics n = row_count;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner updates own business profile fields\n'; if not ok then fails := fails + 1; end if;
  insert into public.listings (business_id, category_id, title, slug) values (biz_a, cat, 'Stay A room', 'bp-stay-a-room') returning id into l_a;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  biz_b := public.create_business('BP Shop B', 'bp-shop-b');
  insert into public.listings (business_id, category_id, title, slug) values (biz_b, cat, 'Shop B item', 'bp-shop-b-item') returning id into l_b;
  -- image limit (on B's own listing)
  for i in 0..9 loop
    insert into public.listing_images (listing_id, storage_path, sort_order) values (l_b, l_b::text || '/' || i || '.jpg', i);
  end loop;
  msg := null; begin insert into public.listing_images (listing_id, storage_path, sort_order) values (l_b, l_b::text || '/11.jpg', 11); exception when others then msg := sqlerrm; end;
  ok := msg like '%at most 10 images%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'an 11th image is rejected\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ submission gates (A)
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin perform public.submit_listing_for_review(l_a); exception when others then msg := sqlerrm; end;
  ok := msg like '%Request business verification%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'cannot submit before requesting business verification\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.request_business_verification(biz_a); exception when others then msg := sqlerrm; end;
  ok := msg like '%at least one verification document%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'cannot request verification without a document\n'; if not ok then fails := fails + 1; end if;
  insert into public.business_verification_documents (business_id, document_type, storage_path) values (biz_a, 'identity', biz_a::text || '/id.pdf');
  msg := null; begin insert into public.business_verification_documents (business_id, document_type, storage_path) values (biz_a, 'identity', biz_b::text || '/hijack.pdf'); exception when check_violation then msg := 'blocked'; end;
  ok := msg = 'blocked'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'document path must match the business folder\n'; if not ok then fails := fails + 1; end if;
  perform public.request_business_verification(biz_a);
  select verification_status::text into v_status from public.businesses where id = biz_a;
  ok := v_status = 'pending'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'verification request leaves the business pending, not verified\n'; if not ok then fails := fails + 1; end if;

  msg := null; begin perform public.submit_listing_for_review(l_a); exception when others then msg := sqlerrm; end;
  ok := msg like '%description%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'cannot submit without a 30+ character description\n'; if not ok then fails := fails + 1; end if;
  update public.listings set description = 'A calm riverside room close to the ghats with simple comforts.', area = 'Assi' where id = l_a;
  msg := null; begin perform public.submit_listing_for_review(l_a); exception when others then msg := sqlerrm; end;
  ok := msg like '%at least one image%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'cannot submit without an image\n'; if not ok then fails := fails + 1; end if;
  insert into public.listing_images (listing_id, storage_path, is_cover, sort_order) values (l_a, l_a::text || '/0.jpg', true, 0);
  perform public.submit_listing_for_review(l_a);
  select status::text into v_status from public.listings where id = l_a;
  ok := v_status = 'pending_review'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'complete listing submits to pending_review\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ moderator
  perform set_config('request.jwt.claims', json_build_object('sub', u_m, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin perform public.admin_moderate_listing(l_a, 'published', null); exception when others then msg := sqlerrm; end;
  ok := msg like '%must be verified%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'cannot publish while the business is unverified\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.admin_moderate_listing(l_a, 'rejected', ' '); exception when others then msg := sqlerrm; end;
  ok := msg like '%note is required%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'rejection requires a reason\n'; if not ok then fails := fails + 1; end if;
  -- Part 3: a document must be accepted before the business can be verified.
  perform public.admin_review_verification_document((select d.id from public.business_verification_documents d where d.business_id = biz_a limit 1), 'accepted', null);
  perform public.admin_set_business_verification(biz_a, 'verified', null);
  perform public.admin_moderate_listing(l_a, 'published', null);
  select status::text into v_status from public.listings where id = l_a;
  ok := v_status = 'published'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'moderator verifies the business, then publishes the listing\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ review policy on edits (A)
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.listings set business_hours = '{"mon":{"open":"09:00","close":"21:00"}}'::jsonb, price_from = 1200, price_to = 2500, price_note = 'per night' where id = l_a;
  select status::text into v_status from public.listings where id = l_a;
  ok := v_status = 'published'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'editing hours and pricing keeps the listing published\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin update public.listings set price_from = 5000, price_to = 100 where id = l_a; exception when check_violation then msg := 'blocked'; end;
  ok := msg = 'blocked'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'price range must be ordered\n'; if not ok then fails := fails + 1; end if;
  update public.listings set description = 'A calm riverside room close to the ghats, now with a balcony and a garden.' where id = l_a;
  select status::text into v_status from public.listings where id = l_a;
  ok := v_status = 'pending_review'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'editing public text sends a published listing back to review\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_m, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.admin_moderate_listing(l_a, 'published', null);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.listing_images (listing_id, storage_path, sort_order) values (l_a, l_a::text || '/1.jpg', 1);
  select status::text into v_status from public.listings where id = l_a;
  ok := v_status = 'pending_review'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'adding an image to a published listing forces re-review\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_m, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.admin_moderate_listing(l_a, 'published', null);
  execute 'reset role';

  -- ------------------------------------------------------------ enquiries and analytics
  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.enquiries (listing_id, sender_name, sender_email, message) values (l_a, 'Visitor C', 'bp-c@example.test', 'Is a room free next week?');
  update public.enquiries set status = 'closed' where listing_id = l_a;
  get diagnostics n = row_count;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'sender cannot change enquiry status\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  perform public.track_listing_event(l_a, 'view', 'bp-session');
  select count(*) into n from public.listings where id = l_a;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'anon sees the published listing\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.enquiries;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner A reads the enquiry about their listing\n'; if not ok then fails := fails + 1; end if;
  update public.enquiries set status = 'read' where listing_id = l_a;
  get diagnostics n = row_count;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner A marks the enquiry as read\n'; if not ok then fails := fails + 1; end if;
  select coalesce(sum(event_count), 0) into n from public.business_engagement_summary(biz_a, 30);
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner A sees real tracked engagement\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.listing_moderation_events where listing_id = l_a;
  ok := n >= 5; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner A sees the approval history\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ isolation (B must not touch A)
  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.enquiries;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner B cannot read A''s enquiries\n'; if not ok then fails := fails + 1; end if;
  select coalesce(sum(event_count), 0) into n from public.business_engagement_summary(biz_a, 30);
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner B gets no analytics for A''s business\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.business_private_details where business_id = biz_a;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner B cannot read A''s private details\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.business_verification_documents where business_id = biz_a;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner B cannot read A''s verification documents\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.listing_moderation_events where listing_id = l_a;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner B cannot read A''s approval history\n'; if not ok then fails := fails + 1; end if;
  update public.listings set title = 'Hijacked' where id = l_a;
  get diagnostics n = row_count;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner B cannot edit A''s listing\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.archive_listing(l_a); exception when others then msg := sqlerrm; end;
  ok := msg like '%Not allowed%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner B cannot archive A''s listing\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.request_business_verification(biz_a); exception when others then msg := sqlerrm; end;
  ok := msg like '%Only the business owner%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner B cannot act on A''s verification\n'; if not ok then fails := fails + 1; end if;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('listing-images', l_a::text || '/evil.jpg', u_b::text);
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner B cannot upload into A''s listing image folder\n'; if not ok then fails := fails + 1; end if;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('verification-documents', biz_a::text || '/evil.pdf', u_b::text);
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner B cannot upload into A''s private document folder\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ name lock
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin update public.businesses set name = 'Renamed Business' where id = biz_a; exception when others then msg := sqlerrm; end;
  ok := msg like '%verified business can only be changed%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'verified business cannot be renamed by its owner\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.businesses set name = 'BP Shop B (renamed)' where id = biz_b;
  get diagnostics n = row_count;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'unverified business can still be renamed\n'; if not ok then fails := fails + 1; end if;

  -- ------------------------------------------------------------ archive / restore (B, draft)
  perform public.archive_listing(l_b);
  select status::text into v_status from public.listings where id = l_b;
  ok := v_status = 'archived'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner archives a listing\n'; if not ok then fails := fails + 1; end if;
  update public.listings set title = 'Edit while archived' where id = l_b;
  get diagnostics n = row_count;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'archived listings cannot be edited\n'; if not ok then fails := fails + 1; end if;
  perform public.restore_listing(l_b);
  select status::text into v_status from public.listings where id = l_b;
  ok := v_status = 'draft'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'restore returns the listing to draft\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ suspension
  perform set_config('request.jwt.claims', json_build_object('sub', u_m, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin perform public.admin_moderate_listing(l_a, 'suspended', ''); exception when others then msg := sqlerrm; end;
  ok := msg like '%note is required%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'suspension requires a reason\n'; if not ok then fails := fails + 1; end if;
  perform public.admin_moderate_listing(l_a, 'suspended', 'Reported for misleading photos');
  execute 'reset role';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into n from public.listings where id = l_a;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'suspended listing disappears from public discovery\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.listing_images where listing_id = l_a;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'suspended listing images are hidden from public rows\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.listings set area = 'Elsewhere' where id = l_a;
  get diagnostics n = row_count;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner cannot edit a suspended listing\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.submit_listing_for_review(l_a); exception when others then msg := sqlerrm; end;
  ok := msg like '%cannot be submitted%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner cannot resubmit a suspended listing\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.archive_listing(l_a); exception when others then msg := sqlerrm; end;
  ok := msg like '%cannot be archived%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner cannot archive a suspended listing to escape it\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  raise exception E'BUSINESS PANEL TEST (rolled back)\n%\n% failed', r, fails;
end;
$$;
