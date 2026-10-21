-- Part 4 analytics, privacy and abuse-control test. Rolls back via the final RAISE.
-- Expect "0 failed". Contains no DELETE statements.
do $$
declare
  r text := ''; fails int := 0; n int; ok boolean; msg text; v jsonb; b boolean; t text;
  u_v uuid := gen_random_uuid(); u_o uuid := gen_random_uuid(); u_a uuid := gen_random_uuid(); u_s uuid := gen_random_uuid();
  biz uuid; lst uuid; cat uuid; sess text := 'p4test-session-0001';
  i int;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  from (values (u_v, 'p4-v@example.test'), (u_o, 'p4-o@example.test'), (u_a, 'p4-a@example.test'), (u_s, 'p4-s@example.test')) t(id, email);
  insert into public.user_roles (user_id, role) values (u_a, 'admin'), (u_s, 'super_admin');
  insert into public.admin_permissions (user_id, permission) select u_a, p from unnest(enum_range(null::public.admin_permission)) p;
  select id into cat from public.listing_categories where slug = 'stays';
  -- a published listing (set up as the database owner)
  insert into public.businesses (name, slug, verification_status, business_type, area, created_by) values ('P4 Stay', 'p4-stay', 'verified', 'stay', 'Assi', u_o) returning id into biz;
  insert into public.business_members (business_id, user_id, member_role) values (biz, u_o, 'owner');
  insert into public.listings (business_id, category_id, title, slug, status, published_at, created_by) values (biz, cat, 'P4 room', 'p4-room', 'published', now(), u_o) returning id into lst;

  -- ------------------------------------------------------------ anonymous event validation
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  b := public.track_event('page_view', '/stays/?utm=x&token=secret', '{"referrer_host":"google.com","utm_source":"Instagram"}', sess);
  ok := b; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'valid page view accepted\n'; if not ok then fails := fails + 1; end if;
  b := public.track_event('page_view', '/stays/', '{}', sess);
  ok := not b; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'repeat page view in same session is de-duplicated\n'; if not ok then fails := fails + 1; end if;
  b := public.track_event('purchase', '/', '{"amount": 99999}', sess);
  ok := not b; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'unknown event names (e.g. revenue) are rejected\n'; if not ok then fails := fails + 1; end if;
  b := public.track_event('page_view', '/admin/', '{}', sess);
  ok := not b; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'private paths are never recorded\n'; if not ok then fails := fails + 1; end if;
  b := public.track_event('page_view', 'https://evil.example/', '{}', sess);
  ok := not b; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'non-site paths rejected\n'; if not ok then fails := fails + 1; end if;
  b := public.track_event('page_view', '/temples/', '{}', null);
  ok := not b; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'events without a session id are rejected\n'; if not ok then fails := fails + 1; end if;
  b := public.track_event('search', '/explore/', '{"term":"Room near Assi call +91 98765 43210 or me@mail.com"}', sess);
  ok := b; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'search accepted\n'; if not ok then fails := fails + 1; end if;
  b := public.track_event('search', '/explore/', '{"term":"9876543210"}', sess);
  ok := not b; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'a search that is only a phone number is dropped\n'; if not ok then fails := fails + 1; end if;
  b := public.track_event('outbound_click', '/listings/p4-room/', '{"host":"javascript:alert(1)"}', sess);
  ok := not b; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'outbound host is validated\n'; if not ok then fails := fails + 1; end if;
  b := public.track_event('category_click', '/', '{"category":"<script>"}', sess);
  ok := not b; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'category value is validated\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin select count(*) into n from public.site_events; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'anon cannot read raw events\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin insert into public.site_events (event_name, path, session_id) values ('page_view', '/', 'forged-session-1'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'anon cannot insert events directly\n'; if not ok then fails := fails + 1; end if;
  perform public.track_listing_event(lst, 'view', null);
  perform public.track_listing_event(lst, 'view', 'p4-listing-session-1');
  perform public.track_listing_event(lst, 'view', 'p4-listing-session-1');
  msg := null; begin select created_by::text into t from public.listings where id = lst; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'anon cannot read listings.created_by\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin select created_by::text into t from public.businesses where id = biz; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'anon cannot read businesses.created_by\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.listings where id = lst and title = 'P4 room';
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'anon still reads public listing columns\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  select search_term into t from public.site_events where session_id = sess and event_name = 'search';
  ok := t = 'room near assi call or'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'search stored without e-mail or phone number (' || coalesce(t, 'null') || E')\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.site_events where session_id = sess and event_name = 'page_view' and path = '/stays/' and referrer_host = 'google.com' and utm_source = 'instagram';
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'page view stored without query string, with source\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.listing_engagement_events where listing_id = lst;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'listing views need a session and are de-duplicated\n'; if not ok then fails := fails + 1; end if;

  -- rate cap: 300 events per session per hour
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  for i in 1..310 loop
    perform public.track_event('page_view', '/flood/' || i || '/', '{}', 'p4-flood-session');
  end loop;
  execute 'reset role';
  select count(*) into n from public.site_events where session_id = 'p4-flood-session';
  ok := n = 300; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'per-session hourly cap stops floods (' || n || E' stored)\n'; if not ok then fails := fails + 1; end if;

  -- popular searches need at least two occurrences
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  perform public.track_event('search', '/explore/', '{"term":"ghat stays"}', 'p4-search-a');
  perform public.track_event('search', '/explore/', '{"term":"ghat stays"}', 'p4-search-b');
  perform public.track_event('search', '/explore/', '{"term":"my unique private query"}', 'p4-search-c');
  execute 'reset role';

  -- ------------------------------------------------------------ analytics access
  perform set_config('request.jwt.claims', json_build_object('sub', u_v, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin v := public.superadmin_analytics(current_date - 7, current_date); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'visitor cannot read platform analytics\n'; if not ok then fails := fails + 1; end if;
  b := public.track_event('page_view', '/food/', '{}', 'p4-signed-in-session');
  execute 'reset role';
  select count(*) into n from public.site_events where session_id = 'p4-signed-in-session' and is_authenticated;
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'signed-in views flagged, but no user id is stored\n'; if not ok then fails := fails + 1; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin v := public.superadmin_analytics(current_date - 7, current_date); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin (all permissions) cannot read platform analytics\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin select count(*) into n from public.site_events; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'admin cannot read raw events\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_s, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  msg := null; begin v := public.superadmin_analytics(current_date - 400, current_date); exception when others then msg := sqlerrm; end;
  ok := msg like '%up to one year%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'date range limited to one year\n'; if not ok then fails := fails + 1; end if;
  v := public.superadmin_analytics(current_date - 6, current_date);
  ok := (v -> 'totals' ->> 'page_views')::int >= 302 and jsonb_array_length(v -> 'daily') = 7;
  r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'super admin gets totals and a 7-day series\n'; if not ok then fails := fails + 1; end if;
  ok := (v -> 'searches') @> '[{"term":"ghat stays","count":2}]'::jsonb and not (v::text like '%my unique private query%');
  r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'popular searches show repeated terms only, never one-off queries\n'; if not ok then fails := fails + 1; end if;
  ok := (v -> 'sources') @> '[{"source":"instagram"}]'::jsonb;
  r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'traffic source attributed per session\n'; if not ok then fails := fails + 1; end if;
  ok := (v -> 'top_listings') @> jsonb_build_array(jsonb_build_object('slug', 'p4-room', 'views', 1));
  r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'top listings report real listing views\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin select count(*) into n from public.site_events; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'even a super admin reads aggregates only, not raw events\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------------------ enquiry abuse limit
  perform set_config('request.jwt.claims', json_build_object('sub', u_v, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  for i in 1..3 loop
    insert into public.enquiries (listing_id, sender_name, sender_email, message) values (lst, 'Visitor', 'p4-v@example.test', 'Is a room free next week? ' || i);
  end loop;
  msg := null; begin insert into public.enquiries (listing_id, sender_name, sender_email, message) values (lst, 'Visitor', 'p4-v@example.test', 'Fourth enquiry today'); exception when others then msg := sqlerrm; end;
  ok := msg like '%several enquiries about this listing today%'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'enquiries per listing per day are limited\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- business owner sees own analytics only, never visitor identities
  perform set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select coalesce(sum(event_count), 0) into n from public.business_engagement_summary(biz, 30);
  ok := n = 1; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner sees their listing views\n'; if not ok then fails := fails + 1; end if;
  msg := null; begin select count(session_id) into n from public.listing_engagement_events; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner cannot see visitor session ids\n'; if not ok then fails := fails + 1; end if;
  select count(*) into n from public.enquiries where listing_id = lst;
  ok := n = 3; r := r || (case when ok then 'PASS  ' else 'FAIL  ' end) || E'owner sees enquiries for their listing\n'; if not ok then fails := fails + 1; end if;
  execute 'reset role';

  raise exception E'ANALYTICS TEST (rolled back)\n%\n% failed', r, fails;
end;
$$;
