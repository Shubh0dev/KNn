-- Part 3 access-control and workflow test (Admin / Super Admin).
-- Separate throwaway accounts for each role; everything rolls back via the
-- final RAISE. Expect "0 failed". Contains no DELETE statements.

do $$
declare
  r text := ''; fails int := 0; n int; ok boolean; msg text; v_status text; v jsonb;
  u_v uuid := gen_random_uuid();   -- visitor
  u_o uuid := gen_random_uuid();   -- business owner
  u_a1 uuid := gen_random_uuid();  -- admin: listings.moderate + businesses.verify only
  u_a2 uuid := gen_random_uuid();  -- admin with no permissions
  u_oa uuid := gen_random_uuid();  -- admin (all perms) who also owns a business
  u_s uuid := gen_random_uuid();   -- super admin
  u_s2 uuid := gen_random_uuid();  -- second super admin
  biz uuid; biz_oa uuid; lst uuid; lst_oa uuid; cur uuid; cat uuid; doc uuid; rep uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(), '{}'::jsonb, jsonb_build_object('full_name', name), now(), now()
  from (values (u_v, 'p3-v@example.test', 'Visitor'), (u_o, 'p3-o@example.test', 'Owner'), (u_a1, 'p3-a1@example.test', 'Admin One'),
               (u_a2, 'p3-a2@example.test', 'Admin Two'), (u_oa, 'p3-oa@example.test', 'Owner Admin'), (u_s, 'p3-s@example.test', 'Super'),
               (u_s2, 'p3-s2@example.test', 'Super Two')) t(id, email, name);
  insert into public.user_roles (user_id, role) values (u_a1, 'admin'), (u_a2, 'admin'), (u_oa, 'admin'), (u_s, 'super_admin'), (u_s2, 'super_admin');
  insert into public.admin_permissions (user_id, permission) values (u_a1, 'listings.moderate'), (u_a1, 'businesses.verify');
  insert into public.admin_permissions (user_id, permission)
  select u_oa, p from unnest(enum_range(null::public.admin_permission)) p;
  select id into cat from public.listing_categories where slug = 'stays';

  -- Owner sets up a business, document and listing
  perform set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  biz := public.create_business('P3 Stay', 'p3-stay', 'Test', 'Assi');
  update public.businesses set business_type = 'stay' where id = biz;
  insert into public.business_verification_documents (business_id, document_type, storage_path) values (biz, 'identity', biz::text || '/id.pdf') returning id into doc;
  perform public.request_business_verification(biz);
  insert into public.listings (business_id, category_id, title, slug, description, area)
  values (biz, cat, 'P3 room', 'p3-room', 'A calm riverside room close to the ghats with simple comforts.', 'Assi') returning id into lst;
  insert into public.listing_images (listing_id, storage_path, is_cover) values (lst, lst::text || '/0.jpg', true);
  perform public.submit_listing_for_review(lst);
  execute 'reset role';

  -- Owner-admin owns a business too
  perform set_config('request.jwt.claims', json_build_object('sub', u_oa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  biz_oa := public.create_business('P3 Own Shop', 'p3-own-shop', 'Test', 'Godowlia');
  update public.businesses set business_type = 'shop' where id = biz_oa;
  insert into public.listings (business_id, category_id, title, slug) values (biz_oa, cat, 'P3 own item', 'p3-own-item') returning id into lst_oa;
  execute 'reset role';

  -- ------------------------------------------------------------ visitor
  perform set_config('request.jwt.claims', json_build_object('sub', u_v, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin perform public.superadmin_list_users(null, null, null, 10, 0); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'visitor cannot list users\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.superadmin_platform_metrics(30); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'visitor cannot read platform metrics\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.superadmin_update_setting('listing_rules', '{"min_description_length":1,"require_image":false,"max_images":20}'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'visitor cannot change settings\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin update public.platform_settings set value = '{}' where key = 'listing_rules'; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'visitor cannot write settings table directly\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.platform_settings;
  ok := n = 3; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'visitor reads only the 3 public settings\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.admin_moderate_listing(lst, 'published', null); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'visitor cannot moderate listings\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ business owner
  perform set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin perform public.admin_set_business_verification(biz, 'verified', null); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner cannot verify own business\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.admin_review_verification_document(doc, 'accepted', null); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner cannot accept own document\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.superadmin_grant_admin(u_o, '{audit.view}'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner cannot make themselves admin\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.audit_logs;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner cannot read audit logs\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ admin without permissions
  perform set_config('request.jwt.claims', json_build_object('sub', u_a2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin perform public.admin_moderate_listing(lst, 'published', null); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin without permission cannot moderate\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.businesses where id = biz;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin without permission cannot see unverified businesses\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.profiles;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin without users.view sees only own profile\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ admin A1 (moderate + verify)
  perform set_config('request.jwt.claims', json_build_object('sub', u_a1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin perform public.admin_set_business_verification(biz, 'changes_requested', ''); exception when others then msg := sqlerrm; end;
  ok := msg like '%reason is required%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'requesting corrections needs a reason\n'; if not ok then fails := fails + 1; end if;
  perform public.admin_set_business_verification(biz, 'changes_requested', 'Please upload a clearer ID');
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.request_business_verification(biz);
  select verification_status::text into v_status from public.businesses where id = biz;
  ok := v_status = 'pending'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner resubmits after corrections were requested\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_a1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin perform public.admin_set_business_verification(biz, 'verified', null); exception when others then msg := sqlerrm; end;
  ok := msg like '%Review every pending document%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'cannot verify before documents are reviewed\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.admin_review_verification_document(doc, 'rejected', ''); exception when others then msg := sqlerrm; end;
  ok := msg like '%Explain why%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'rejecting a document needs a reason\n'; if not ok then fails := fails + 1; end if;
  perform public.admin_review_verification_document(doc, 'accepted', null);
  perform public.admin_set_business_verification(biz, 'verified', null);
  perform public.admin_moderate_listing(lst, 'published', null);
  select status::text into v_status from public.listings where id = lst;
  ok := v_status = 'published'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin reviews document, verifies business, publishes listing\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.admin_moderate_listing(lst, 'suspended', 'Test'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin without listings.suspend cannot suspend\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.admin_moderate_listing(lst, 'archived', 'Test'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin without listings.suspend cannot unpublish\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.superadmin_override_listing(lst, 'draft', 'Trying an override'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin cannot use super admin override\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.superadmin_set_admin_permission(u_a1, 'audit.view', true); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin cannot grant themselves permissions\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.superadmin_set_admin_permission(u_a2, 'audit.view', true); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin cannot change another admin''s permissions\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.superadmin_grant_admin(u_v, '{}'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin cannot create admins\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin insert into public.user_roles (user_id, role) values (u_a1, 'super_admin'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin cannot promote themselves to super admin\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.admin_set_account_status(u_v, 'suspended', 'x'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin without users.manage cannot suspend accounts\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.superadmin_update_setting('moderation', '{"report_daily_limit_per_user":50}'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin cannot change platform settings\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.platform_settings;
  ok := n = 3; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin cannot read private settings (affiliate, moderation)\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.audit_logs;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin without audit.view cannot read audit logs\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin insert into public.listings (business_id, category_id, title, slug) values (null, cat, 'Curated by A1', 'p3-curated-a1'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin without content.manage cannot create curated listings\n'; if not ok then fails := fails + 1; end if;
  update public.listing_categories set name = 'Hacked' where id = cat;
  get diagnostics n = row_count;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin without categories.manage cannot edit categories\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.admin_resolve_report(gen_random_uuid(), 'dismissed', null, 'x'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin without reports.review cannot work reports\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ admin who owns a business
  perform set_config('request.jwt.claims', json_build_object('sub', u_oa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin perform public.admin_set_business_verification(biz_oa, 'verified', null); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin cannot verify a business they belong to\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.admin_moderate_listing(lst_oa, 'published', null); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin cannot approve their own listing\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ reports
  perform set_config('request.jwt.claims', json_build_object('sub', u_v, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.content_reports (listing_id, reason, details) values (lst, 'incorrect_information', 'Wrong phone number') returning id into rep;
  msg := null; begin insert into public.content_reports (listing_id, reason) values (lst, 'other'); exception when unique_violation then msg := 'dup'; end;
  ok := msg = 'dup'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'one open report per person per listing\n'; if not ok then fails := fails + 1; end if;
  select status::text into v_status from public.listings where id = lst;
  ok := v_status = 'published'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'a report does not remove the listing\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_s, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin perform public.admin_resolve_report(rep, 'resolved', 'listing_suspended', 'Suspended it'); exception when others then msg := sqlerrm; end;
  ok := msg like '%Suspend the listing first%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'cannot record "listing suspended" unless it really was\n'; if not ok then fails := fails + 1; end if;
  perform public.admin_resolve_report(rep, 'reviewing', null, null);
  perform public.admin_moderate_listing(lst, 'suspended', 'Phone number reported wrong');
  perform public.admin_resolve_report(rep, 'resolved', 'listing_suspended', 'Suspended until the owner fixes the phone');
  select status::text into v_status from public.content_reports where id = rep;
  ok := v_status = 'resolved'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'reviewer suspends listing then resolves the report\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into n from public.listings where id = lst;
  ok := n = 0; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'suspended listing (of a still-verified business) is not public\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.businesses where id = biz;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'business stays verified and public while its listing is suspended\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ super admin
  perform set_config('request.jwt.claims', json_build_object('sub', u_s, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin perform public.superadmin_override_listing(lst, 'published', 'short'); exception when others then msg := sqlerrm; end;
  ok := msg like '%at least 10 characters%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'override requires a real reason\n'; if not ok then fails := fails + 1; end if;
  perform public.superadmin_override_listing(lst, 'published', 'Owner corrected the phone number by email');
  select count(*) into n from public.audit_logs where action = 'listing.override' and entity_id = lst::text and actor_id = u_s;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'override is audited with the super admin as actor\n'; if not ok then fails := fails + 1; end if;
  v := public.superadmin_platform_metrics(30);
  ok := (v -> 'accounts' ->> 'total')::int >= 7 and v ? 'pending'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'super admin reads platform metrics\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.superadmin_list_users('p3-', null, null, 50, 0);
  ok := n = 7; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'super admin searches accounts\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.superadmin_list_users('p3-', 'admin', null, 50, 0);
  ok := n = 3; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'super admin filters accounts by role\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.superadmin_grant_admin(u_s, '{}'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'super admin cannot change own roles\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.admin_set_account_status(u_s2, 'suspended', 'test'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'no one can suspend a super admin from the app\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.admin_set_account_status(u_s, 'suspended', 'test'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'super admin cannot suspend themselves\n'; if not ok then fails := fails + 1; end if;
  perform public.superadmin_grant_admin(u_v, '{reports.review}');
  select count(*) into n from public.user_roles where user_id = u_v and role = 'admin';
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'super admin provisions an admin with chosen permissions\n'; if not ok then fails := fails + 1; end if;
  perform public.superadmin_set_admin_permission(u_a2, 'audit.view', true);
  select count(*) into n from public.admin_permissions where user_id = u_a2;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'super admin grants a permission\n'; if not ok then fails := fails + 1; end if;
  perform public.admin_set_account_status(u_o, 'suspended', 'Testing suspension');
  perform public.admin_set_account_status(u_o, 'active', null);
  select account_status::text into v_status from public.profiles where id = u_o;
  ok := v_status = 'active'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'super admin suspends and reactivates an account\n'; if not ok then fails := fails + 1; end if;
  perform public.superadmin_add_business_member(biz, u_v, 'manager');
  select count(*) into n from public.business_members where business_id = biz and user_id = u_v;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'super admin assigns business access through the workflow\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.superadmin_add_business_member(biz, u_a2, 'owner'); exception when others then msg := sqlerrm; end;
  ok := msg like '%already has an owner%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'a business keeps a single owner\n'; if not ok then fails := fails + 1; end if;

  -- settings
  msg := null; begin perform public.superadmin_update_setting('affiliate', '{"programs":[{"name":"X","api_key":"abc"}]}'); exception when others then msg := sqlerrm; end;
  ok := msg like '%must not contain secrets%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'settings refuse secrets\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin perform public.superadmin_update_setting('moderation', '{"report_daily_limit_per_user":10,"auto_hide_on_reports":true}'); exception when others then msg := sqlerrm; end;
  ok := msg like '%not allowed%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'automatic removal on reports cannot be switched on\n'; if not ok then fails := fails + 1; end if;
  perform public.superadmin_update_setting('listing_rules', '{"min_description_length":80,"require_image":true,"max_images":10}');
  select count(*) into n from public.audit_logs where action = 'settings.updated' and entity_id = 'listing_rules';
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'settings change is audited\n'; if not ok then fails := fails + 1; end if;

  -- curated content and featured placements
  insert into public.listings (business_id, category_id, title, slug, description, area)
  values (null, (select id from public.listing_categories where slug = 'temples'), 'P3 Curated Temple', 'p3-curated-temple', 'A quiet old shrine in the lanes, best visited early in the morning.', 'Old city')
  returning id into cur;
  perform public.content_set_curated_status(cur, 'published');
  msg := null; begin insert into public.featured_placements (listing_id, placement, is_sponsored) values (cur, 'home', true); exception when others then msg := sqlerrm; end;
  ok := msg like '%switched off%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'sponsored placements blocked while disabled\n'; if not ok then fails := fails + 1; end if;
  insert into public.featured_placements (listing_id, placement) values (cur, 'home');
  msg := null; begin insert into public.featured_placements (listing_id, placement) values (lst_oa, 'home'); exception when others then msg := sqlerrm; end;
  ok := msg like '%Only published listings%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'only published listings can be featured\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin update public.audit_logs set action = 'tampered'; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'even a super admin cannot edit audit history\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ settings drive the business rules
  perform set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.listings (business_id, category_id, title, slug, description, area)
  values (biz, cat, 'P3 second room', 'p3-second-room', 'Forty-something characters of description here.', 'Assi') returning id into lst_oa;
  insert into public.listing_images (listing_id, storage_path, is_cover) values (lst_oa, lst_oa::text || '/0.jpg', true);
  msg := null; begin perform public.submit_listing_for_review(lst_oa); exception when others then msg := sqlerrm; end;
  ok := msg like '%at least 80 characters%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'the new listing rule from settings is enforced\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ public visibility of curated + featured content
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into n from public.listings where id = cur;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'published curated place is public\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.featured_placements where listing_id = cur;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'homepage feature is public\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.listings where id = lst;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'overridden listing is public again\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  raise exception E'ADMIN PANEL TEST (rolled back)\n%\n% failed', r, fails;
end;
$$;
