-- RLS / authorization smoke test.
--
-- Safe to run against any environment: it creates throwaway users and data,
-- impersonates each role, and then deliberately RAISES at the end so the whole
-- transaction rolls back. The results are in the error message.
-- Run in the SQL editor (as postgres). Expect: "RLS TEST RESULTS ... 0 failed".

do $$
declare
  r text := '';
  fails int := 0;
  n int;
  v_err text;
  u_a uuid := gen_random_uuid(); -- visitor
  u_b uuid := gen_random_uuid(); -- business owner B
  u_c uuid := gen_random_uuid(); -- business owner C
  u_m uuid := gen_random_uuid(); -- admin (listings.moderate, businesses.verify)
  u_s uuid := gen_random_uuid(); -- super admin
  biz_b uuid;
  biz_c uuid;
  lst_b uuid;
  cat uuid;
  v_status text;
begin
  -- ---------------------------------------------------------------- setup
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
         '{}'::jsonb, jsonb_build_object('full_name', name), now(), now()
  from (values (u_a, 'rls-a@example.test', 'Visitor A'), (u_b, 'rls-b@example.test', 'Owner B'),
               (u_c, 'rls-c@example.test', 'Owner C'), (u_m, 'rls-m@example.test', 'Admin M'),
               (u_s, 'rls-s@example.test', 'Super S')) t(id, email, name);

  select count(*) into n from public.profiles where id in (u_a, u_b, u_c, u_m, u_s);
  if n = 5 then r := r || E'PASS  signup trigger created 5 profiles\n'; else fails := fails + 1; r := r || E'FAIL  signup trigger profiles=' || n || E'\n'; end if;
  select count(*) into n from public.user_roles where user_id in (u_a, u_b, u_c, u_m, u_s) and role = 'visitor';
  if n = 5 then r := r || E'PASS  new users get only the visitor role\n'; else fails := fails + 1; r := r || E'FAIL  visitor roles=' || n || E'\n'; end if;

  insert into public.user_roles (user_id, role) values (u_m, 'admin'), (u_s, 'super_admin');
  insert into public.admin_permissions (user_id, permission) values (u_m, 'listings.moderate'), (u_m, 'businesses.verify');
  select id into cat from public.listing_categories where slug = 'stays';

  -- B and C onboard businesses through the RPC
  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  biz_b := public.create_business('Ganga View Stay', 'rls-ganga-view-stay', 'Test', 'Assi');
  insert into public.listings (business_id, category_id, title, slug) values (biz_b, cat, 'Riverside room', 'rls-riverside-room') returning id into lst_b;
  execute 'reset role';
  -- Meet the Part 2 submission rules (description, area, image, verification requested, accepted document).
  update public.businesses set business_type = 'stay', verification_status = 'pending' where id = biz_b;
  update public.listings set description = 'A quiet riverside room near Assi Ghat with a small balcony.', area = 'Assi' where id = lst_b;
  insert into public.listing_images (listing_id, storage_path, is_cover) values (lst_b, lst_b::text || '/cover.png', true);
  insert into public.business_verification_documents (business_id, document_type, storage_path, review_status) values (biz_b, 'identity', biz_b::text || '/id.pdf', 'accepted');

  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  biz_c := public.create_business('Other Shop', 'rls-other-shop');
  execute 'reset role';

  select count(*) into n from public.user_roles where user_id = u_b and role = 'business_owner';
  if n = 1 then r := r || E'PASS  create_business grants business_owner\n'; else fails := fails + 1; r := r || E'FAIL  business_owner not granted\n'; end if;

  -- ---------------------------------------------------------------- anon
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    select count(*) into n from public.profiles;
    fails := fails + 1; r := r || E'FAIL  anon can read profiles\n';
  exception when insufficient_privilege then r := r || E'PASS  anon cannot read profiles\n';
  end;
  select count(*) into n from public.listings where id = lst_b;
  if n = 0 then r := r || E'PASS  anon cannot see draft listing\n'; else fails := fails + 1; r := r || E'FAIL  anon sees draft\n'; end if;
  select count(*) into n from public.businesses where id in (biz_b, biz_c);
  if n = 0 then r := r || E'PASS  anon cannot see unverified businesses\n'; else fails := fails + 1; r := r || E'FAIL  anon sees unverified business\n'; end if;
  begin
    perform public.create_business('Anon Biz', 'rls-anon-biz');
    fails := fails + 1; r := r || E'FAIL  anon can call create_business\n';
  exception when insufficient_privilege then r := r || E'PASS  anon cannot call create_business\n';
  end;
  execute 'reset role';

  -- ---------------------------------------------------------------- visitor A
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.profiles;
  if n = 1 then r := r || E'PASS  visitor reads only own profile\n'; else fails := fails + 1; r := r || E'FAIL  visitor reads ' || n || E' profiles\n'; end if;
  update public.profiles set full_name = 'Visitor A2' where id = u_a;
  get diagnostics n = row_count;
  if n = 1 then r := r || E'PASS  visitor updates own name\n'; else fails := fails + 1; r := r || E'FAIL  visitor cannot update own name\n'; end if;
  update public.profiles set full_name = 'hacked' where id = u_b;
  get diagnostics n = row_count;
  if n = 0 then r := r || E'PASS  visitor cannot update another profile\n'; else fails := fails + 1; r := r || E'FAIL  visitor updated another profile\n'; end if;
  begin
    update public.profiles set account_status = 'active' where id = u_a;
    fails := fails + 1; r := r || E'FAIL  visitor can write account_status\n';
  exception when insufficient_privilege then r := r || E'PASS  visitor cannot write account_status\n';
  end;
  begin
    insert into public.user_roles (user_id, role) values (u_a, 'admin');
    fails := fails + 1; r := r || E'FAIL  visitor self-granted admin\n';
  exception when insufficient_privilege then r := r || E'PASS  visitor cannot self-grant admin\n';
  end;
  begin
    insert into public.user_roles (user_id, role) values (u_a, 'super_admin');
    fails := fails + 1; r := r || E'FAIL  visitor self-granted super_admin\n';
  exception when insufficient_privilege then r := r || E'PASS  visitor cannot self-grant super_admin\n';
  end;
  begin
    insert into public.admin_permissions (user_id, permission) values (u_a, 'audit.view');
    fails := fails + 1; r := r || E'FAIL  visitor self-granted permission\n';
  exception when insufficient_privilege then r := r || E'PASS  visitor cannot self-grant permissions\n';
  end;
  begin
    perform public.admin_moderate_listing(lst_b, 'published', null);
    fails := fails + 1; r := r || E'FAIL  visitor moderated a listing\n';
  exception when insufficient_privilege then r := r || E'PASS  visitor cannot moderate listings\n';
  end;
  begin
    perform public.admin_set_account_status(u_b, 'suspended', 'x');
    fails := fails + 1; r := r || E'FAIL  visitor changed account status\n';
  exception when insufficient_privilege then r := r || E'PASS  visitor cannot suspend users\n';
  end;
  select count(*) into n from public.audit_logs;
  if n = 0 then r := r || E'PASS  visitor cannot read audit logs\n'; else fails := fails + 1; r := r || E'FAIL  visitor reads audit logs\n'; end if;
  execute 'reset role';

  -- ---------------------------------------------------------------- owner B / other owner C
  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.listings where id = lst_b;
  if n = 1 then r := r || E'PASS  owner sees own draft\n'; else fails := fails + 1; r := r || E'FAIL  owner cannot see own draft\n'; end if;
  begin
    update public.listings set status = 'published' where id = lst_b;
    fails := fails + 1; r := r || E'FAIL  owner set own listing status\n';
  exception when insufficient_privilege then r := r || E'PASS  owner cannot write listing status\n';
  end;
  begin
    update public.businesses set verification_status = 'verified' where id = biz_b;
    fails := fails + 1; r := r || E'FAIL  owner verified own business\n';
  exception when insufficient_privilege then r := r || E'PASS  owner cannot self-verify business\n';
  end;
  begin
    insert into public.listings (business_id, category_id, title, slug) values (biz_c, cat, 'Injected', 'rls-injected');
    fails := fails + 1; r := r || E'FAIL  owner created listing for another business\n';
  exception when insufficient_privilege then r := r || E'PASS  owner cannot create listing for another business\n';
  end;
  perform public.submit_listing_for_review(lst_b);
  select status::text into v_status from public.listings where id = lst_b;
  if v_status = 'pending_review' then r := r || E'PASS  owner submits listing for review\n'; else fails := fails + 1; r := r || E'FAIL  submit gave ' || v_status || E'\n'; end if;
  begin
    perform public.admin_moderate_listing(lst_b, 'published', null);
    fails := fails + 1; r := r || E'FAIL  owner approved own listing\n';
  exception when insufficient_privilege then r := r || E'PASS  owner cannot approve own listing\n';
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('verification-documents', biz_b::text || '/id.pdf', u_b::text);
    r := r || E'PASS  owner uploads own verification document\n';
  exception when others then fails := fails + 1; r := r || E'FAIL  owner cannot upload own document: ' || sqlerrm || E'\n';
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('verification-documents', biz_c::text || '/x.pdf', u_b::text);
    fails := fails + 1; r := r || E'FAIL  owner uploaded into another business folder\n';
  exception when insufficient_privilege then r := r || E'PASS  owner cannot upload to another business folder\n';
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.listings where id = lst_b;
  if n = 0 then r := r || E'PASS  other owner cannot see unpublished listing\n'; else fails := fails + 1; r := r || E'FAIL  other owner sees listing\n'; end if;
  update public.listings set title = 'Hijacked' where id = lst_b;
  get diagnostics n = row_count;
  if n = 0 then r := r || E'PASS  other owner cannot edit listing\n'; else fails := fails + 1; r := r || E'FAIL  other owner edited listing\n'; end if;
  select count(*) into n from public.business_private_details where business_id = biz_b;
  if n = 0 then r := r || E'PASS  other owner cannot read private details\n'; else fails := fails + 1; r := r || E'FAIL  other owner reads private details\n'; end if;
  select count(*) into n from storage.objects where bucket_id = 'verification-documents' and name like biz_b::text || '/%';
  if n = 0 then r := r || E'PASS  other owner cannot read verification documents\n'; else fails := fails + 1; r := r || E'FAIL  other owner reads documents\n'; end if;
  execute 'reset role';

  -- ---------------------------------------------------------------- admin M
  perform set_config('request.jwt.claims', json_build_object('sub', u_m, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.admin_moderate_listing(lst_b, 'published', null);
    fails := fails + 1; r := r || E'FAIL  published listing of unverified business\n';
  exception when raise_exception then r := r || E'PASS  cannot publish before business is verified\n';
  end;
  perform public.admin_set_business_verification(biz_b, 'verified', null);
  perform public.admin_moderate_listing(lst_b, 'published', null);
  select status::text into v_status from public.listings where id = lst_b;
  if v_status = 'published' then r := r || E'PASS  admin verifies business and publishes listing\n'; else fails := fails + 1; r := r || E'FAIL  publish gave ' || v_status || E'\n'; end if;
  select count(*) into n from public.audit_logs;
  if n = 0 then r := r || E'PASS  admin without audit.view cannot read audit logs\n'; else fails := fails + 1; r := r || E'FAIL  admin reads audit logs\n'; end if;
  begin
    perform public.admin_set_account_status(u_a, 'suspended', 'test');
    fails := fails + 1; r := r || E'FAIL  admin without users.manage suspended a user\n';
  exception when insufficient_privilege then r := r || E'PASS  admin limited to granted permissions\n';
  end;
  begin
    insert into public.user_roles (user_id, role) values (u_m, 'super_admin');
    fails := fails + 1; r := r || E'FAIL  admin self-granted super_admin\n';
  exception when insufficient_privilege then r := r || E'PASS  admin cannot self-grant super_admin\n';
  end;
  execute 'reset role';

  -- ---------------------------------------------------------------- public after publish
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into n from public.listings where id = lst_b;
  if n = 1 then r := r || E'PASS  anon sees published listing\n'; else fails := fails + 1; r := r || E'FAIL  anon cannot see published listing\n'; end if;
  select count(*) into n from public.businesses where id in (biz_b, biz_c);
  if n = 1 then r := r || E'PASS  anon sees only verified business\n'; else fails := fails + 1; r := r || E'FAIL  anon sees ' || n || E' businesses\n'; end if;
  begin
    select count(*) into n from public.business_private_details;
    fails := fails + 1; r := r || E'FAIL  anon reads private details\n';
  exception when insufficient_privilege then r := r || E'PASS  anon cannot read private business details\n';
  end;
  begin
    insert into public.enquiries (listing_id, sender_name, sender_email, message) values (lst_b, 'Anon', 'a@example.test', 'Hello there, anon');
    fails := fails + 1; r := r || E'FAIL  anon inserted enquiry\n';
  exception when insufficient_privilege then r := r || E'PASS  anon cannot send enquiries directly\n';
  end;
  perform public.track_listing_event(lst_b, 'view', 'rls-session');
  execute 'reset role';
  select count(*) into n from public.listing_engagement_events where listing_id = lst_b;
  if n = 1 then r := r || E'PASS  anon engagement tracked via RPC\n'; else fails := fails + 1; r := r || E'FAIL  engagement rows=' || n || E'\n'; end if;

  -- ---------------------------------------------------------------- enquiries privacy
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.enquiries (listing_id, sender_name, sender_email, sender_phone, message) values (lst_b, 'Visitor A', 'rls-a@example.test', '+91 90000 00001', 'Is a room free next week?');
  n := 1; begin update public.enquiries set status = 'closed' where listing_id = lst_b; get diagnostics n = row_count; exception when insufficient_privilege then n := 0; end;
  if n = 0 then r := r || E'PASS  sender cannot change enquiry status\n'; else fails := fails + 1; r := r || E'FAIL  sender changed enquiry status\n'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.enquiries;
  if n = 0 then r := r || E'PASS  other business cannot read enquiries\n'; else fails := fails + 1; r := r || E'FAIL  other business reads enquiries\n'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.enquiries;
  if n = 1 then r := r || E'PASS  business reads its enquiries\n'; else fails := fails + 1; r := r || E'FAIL  business reads ' || n || E' enquiries\n'; end if;
  select count(*) into n from public.listing_engagement_events where listing_id = lst_b;
  if n = 1 then r := r || E'PASS  business reads engagement for own listing\n'; else fails := fails + 1; r := r || E'FAIL  business engagement rows=' || n || E'\n'; end if;
  begin
    select count(user_id) into n from public.listing_engagement_events;
    fails := fails + 1; r := r || E'FAIL  business can read viewer user_id\n';
  exception when insufficient_privilege then r := r || E'PASS  business cannot see viewer identities\n';
  end;
  -- Editing a live listing sends it back to review
  update public.listings set title = 'Riverside room with balcony' where id = lst_b;
  select status::text into v_status from public.listings where id = lst_b;
  if v_status = 'pending_review' then r := r || E'PASS  editing published listing forces re-review\n'; else fails := fails + 1; r := r || E'FAIL  edit left status ' || v_status || E'\n'; end if;
  execute 'reset role';

  -- ---------------------------------------------------------------- super admin S
  perform set_config('request.jwt.claims', json_build_object('sub', u_s, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.audit_logs;
  if n > 0 then r := r || E'PASS  super admin reads audit logs\n'; else fails := fails + 1; r := r || E'FAIL  super admin sees no audit logs\n'; end if;
  perform public.admin_set_account_status(u_a, 'suspended', 'test');
  begin
    perform public.admin_set_account_status(u_s, 'suspended', 'self');
    fails := fails + 1; r := r || E'FAIL  super admin suspended self\n';
  exception when insufficient_privilege then r := r || E'PASS  super admin cannot change own status\n';
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.profiles set full_name = 'Suspended' where id = u_a;
  get diagnostics n = row_count;
  if n = 0 then r := r || E'PASS  suspended user cannot edit profile\n'; else fails := fails + 1; r := r || E'FAIL  suspended user edited profile\n'; end if;
  begin
    perform public.create_business('Suspended Biz', 'rls-suspended-biz');
    fails := fails + 1; r := r || E'FAIL  suspended user created business\n';
  exception when insufficient_privilege then r := r || E'PASS  suspended user cannot create business\n';
  end;
  execute 'reset role';

  -- ---------------------------------------------------------------- audit log immutability
  begin
    update public.audit_logs set action = 'tampered';
    fails := fails + 1; r := r || E'FAIL  audit log updated\n';
  exception when insufficient_privilege then r := r || E'PASS  audit log is append-only (even for postgres)\n';
  end;

  raise exception E'RLS TEST RESULTS (rolled back)\n%\n% failed', r, fails;
end;
$$;
