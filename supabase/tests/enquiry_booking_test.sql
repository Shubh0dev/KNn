-- Part 5 enquiry-based booking test: validation, workflow, privacy, staff masking.
-- Rolls back via the final RAISE. Expect "0 failed". Contains no DELETE statements.
do $$
declare
  r text := ''; fails int := 0; n int; ok boolean; msg text; st text; v jsonb; ref text;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  u_v uuid := gen_random_uuid(); u_v2 uuid := gen_random_uuid(); u_o uuid := gen_random_uuid(); u_o2 uuid := gen_random_uuid();
  u_a uuid := gen_random_uuid(); u_a0 uuid := gen_random_uuid();
  biz_a uuid; biz_b uuid; stay uuid; cafe uuid; phone_only uuid; curated uuid; e1 uuid; e2 uuid; tok uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  from (values (u_v, 'p5-v@example.test'), (u_v2, 'p5-v2@example.test'), (u_o, 'p5-o@example.test'), (u_o2, 'p5-o2@example.test'),
               (u_a, 'p5-a@example.test'), (u_a0, 'p5-a0@example.test')) t(id, email);
  insert into public.user_roles (user_id, role) values (u_a, 'admin'), (u_a0, 'admin');
  insert into public.admin_permissions (user_id, permission) values (u_a, 'enquiries.view'), (u_a0, 'listings.moderate');

  insert into public.businesses (name, slug, verification_status, business_type, area, created_by) values ('P5 Stay', 'p5-stay', 'verified', 'stay', 'Assi', u_o) returning id into biz_a;
  insert into public.businesses (name, slug, verification_status, business_type, area, created_by) values ('P5 Cafe', 'p5-cafe', 'verified', 'food', 'Godowlia', u_o2) returning id into biz_b;
  insert into public.business_members (business_id, user_id, member_role) values (biz_a, u_o, 'owner'), (biz_b, u_o2, 'owner');
  insert into public.listings (business_id, category_id, title, slug, status, published_at, created_by, contact_phone)
    values (biz_a, (select id from public.listing_categories where slug = 'stays'), 'P5 River Room', 'p5-river-room', 'published', now(), u_o, '+91 98765 11111') returning id into stay;
  insert into public.listings (business_id, category_id, title, slug, status, published_at, created_by)
    values (biz_b, (select id from public.listing_categories where slug = 'food'), 'P5 Cafe Table', 'p5-cafe-table', 'published', now(), u_o2) returning id into cafe;
  insert into public.listings (business_id, category_id, title, slug, status, published_at, created_by, enquiry_mode)
    values (biz_a, (select id from public.listing_categories where slug = 'shopping'), 'P5 Phone Only', 'p5-phone-only', 'published', now(), u_o, 'contact_only') returning id into phone_only;
  insert into public.listings (business_id, category_id, title, slug, status, published_at)
    values (null, (select id from public.listing_categories where slug = 'temples'), 'P5 Curated Temple', 'p5-curated-temple', 'published', now()) returning id into curated;

  -- ------------------------------------------------------------ visitor submits
  perform set_config('request.jwt.claims', json_build_object('sub', u_v, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.enquiries (listing_id, enquiry_type, sender_name, sender_email, sender_phone, message, check_in, check_out, guests, rooms, client_token)
    values (stay, 'stay', ' Priya Sharma ', 'Priya@Example.com', '+91 98765 43210', 'Late arrival, around 10pm', today + 10, today + 13, 3, 2, tok)
    returning id, reference, status::text into e1, ref, st;
  ok := ref ~ '^KN-[0-9A-F]{10}$' and st = 'new'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || 'valid stay request saved with a reference and status New (' || coalesce(ref, '-') || E')\n'; fails := fails + (not ok)::int;
  select count(*) into n from public.enquiries where id = e1 and sender_email = 'priya@example.com' and sender_name = 'Priya Sharma' and business_id = biz_a;
  ok := n = 1; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'contact details normalised and enquiry linked to the right business\n'; fails := fails + (not ok)::int;

  msg := null; begin insert into public.enquiries (listing_id, enquiry_type, sender_name, sender_email, sender_phone, message, check_in, check_out, guests, rooms)
    values (stay, 'stay', 'Priya Sharma', 'priya@example.com', '+91 98765 43210', '', today - 1, today + 2, 2, 1); exception when others then msg := sqlerrm; end;
  ok := msg like '%past%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'past check-in rejected\n'; fails := fails + (not ok)::int;
  msg := null; begin insert into public.enquiries (listing_id, enquiry_type, sender_name, sender_email, sender_phone, message, check_in, check_out, guests, rooms)
    values (stay, 'stay', 'Priya Sharma', 'priya@example.com', '+91 98765 43210', '', today + 5, today + 5, 2, 1); exception when others then msg := sqlerrm; end;
  ok := msg like '%after check-in%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'check-out not after check-in rejected\n'; fails := fails + (not ok)::int;
  msg := null; begin insert into public.enquiries (listing_id, enquiry_type, sender_name, sender_email, sender_phone, message, check_in, check_out, guests, rooms)
    values (stay, 'stay', 'Priya Sharma', 'priya@example.com', '+91 98765 43210', '', today + 5, today + 7, 1, 2); exception when others then msg := sqlerrm; end;
  ok := msg like '%rooms cannot be more%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'more rooms than guests rejected\n'; fails := fails + (not ok)::int;
  msg := null; begin insert into public.enquiries (listing_id, enquiry_type, sender_name, sender_email, sender_phone, message, check_in, check_out, guests, rooms)
    values (stay, 'stay', 'Priya Sharma', 'priya@example.com', '+91 98765 43210', '', today + 5, today + 7, 0, 1); exception when others then msg := sqlerrm; end;
  ok := msg is not null; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'zero guests rejected\n'; fails := fails + (not ok)::int;
  msg := null; begin insert into public.enquiries (listing_id, enquiry_type, sender_name, sender_email, sender_phone, message, check_in, check_out, guests, rooms)
    values (stay, 'stay', 'Priya Sharma', 'priya@example.com', 'call me', '', today + 5, today + 7, 2, 1); exception when others then msg := sqlerrm; end;
  ok := msg like '%valid contact number%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'malformed contact number rejected\n'; fails := fails + (not ok)::int;
  msg := null; begin insert into public.enquiries (listing_id, enquiry_type, sender_name, sender_email, message, check_in, check_out, guests, rooms)
    values (stay, 'stay', 'Priya Sharma', 'priya@example.com', '', today + 5, today + 7, 2, 1); exception when others then msg := sqlerrm; end;
  ok := msg like '%valid contact number%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'contact number is required\n'; fails := fails + (not ok)::int;
  msg := null; begin insert into public.enquiries (listing_id, enquiry_type, sender_name, sender_email, sender_phone, message, requested_date, requested_time, guests)
    values (stay, 'table', 'Priya Sharma', 'priya@example.com', '+91 98765 43210', '', today + 2, '19:00', 2); exception when others then msg := sqlerrm; end;
  ok := msg like '%does not take that kind%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'a table request to a stay listing is rejected\n'; fails := fails + (not ok)::int;
  msg := null; begin insert into public.enquiries (listing_id, enquiry_type, sender_name, sender_email, sender_phone, message, check_in, check_out, guests, rooms)
    values (stay, 'stay', 'Priya Sharma', 'priya@example.com', '+91 98765 43210', 'again', today + 10, today + 13, 3, 2); exception when others then msg := sqlerrm; end;
  ok := msg like '%already sent this request (reference ' || ref || ')%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'duplicate request rejected with the original reference\n'; fails := fails + (not ok)::int;
  msg := null; begin insert into public.enquiries (listing_id, enquiry_type, sender_name, sender_email, sender_phone, message, check_in, check_out, guests, rooms, client_token)
    values (stay, 'stay', 'Priya Sharma', 'priya@example.com', '+91 98765 43210', '', today + 20, today + 21, 2, 1, tok); exception when unique_violation then msg := 'dup'; end;
  ok := msg = 'dup'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'double submit of the same form (token) is rejected\n'; fails := fails + (not ok)::int;
  msg := null; begin insert into public.enquiries (listing_id, sender_name, sender_email, sender_phone, message)
    values (curated, 'Priya Sharma', 'priya@example.com', '+91 98765 43210', 'Can I book darshan through you?'); exception when others then msg := sqlerrm; end;
  ok := msg like '%curated%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'curated places (no business) take no enquiries\n'; fails := fails + (not ok)::int;
  msg := null; begin insert into public.enquiries (listing_id, sender_name, sender_email, sender_phone, message)
    values (phone_only, 'Priya Sharma', 'priya@example.com', '+91 98765 43210', 'Do you ship sarees abroad?'); exception when others then msg := sqlerrm; end;
  ok := msg like '%phone or email only%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'contact-only listings take no enquiries\n'; fails := fails + (not ok)::int;
  msg := null; begin update public.enquiries set status = 'confirmed' where id = e1; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'visitor cannot set a status directly\n'; fails := fails + (not ok)::int;
  insert into public.enquiries (listing_id, enquiry_type, sender_name, sender_email, sender_phone, message, requested_date, requested_time, guests)
    values (cafe, 'table', 'Priya Sharma', 'priya@example.com', '+91 98765 43210', '', today + 3, '20:00', 4) returning id into e2;
  ok := e2 is not null; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'valid table request saved\n'; fails := fails + (not ok)::int;
  execute 'reset role';

  -- ------------------------------------------------------------ other visitor and other business
  perform set_config('request.jwt.claims', json_build_object('sub', u_v2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.enquiries where id in (e1, e2);
  ok := n = 0; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'another visitor cannot read the enquiries\n'; fails := fails + (not ok)::int;
  msg := null; begin perform public.cancel_my_enquiry(e1, 'not mine'); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'another visitor cannot cancel it\n'; fails := fails + (not ok)::int;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_o2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.enquiries where id = e1;
  ok := n = 0; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'business B cannot read business A''s enquiry\n'; fails := fails + (not ok)::int;
  select count(*) into n from public.enquiry_events where enquiry_id = e1;
  ok := n = 0; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'business B cannot read its history\n'; fails := fails + (not ok)::int;
  msg := null; begin perform public.business_update_enquiry(e1, 'accepted', null); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'business B cannot change its status\n'; fails := fails + (not ok)::int;
  select count(*) into n from public.enquiries where id = e2 and sender_phone = '+91 98765 43210';
  ok := n = 1; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'business B sees its own table request with the contact number\n'; fails := fails + (not ok)::int;
  execute 'reset role';

  -- ------------------------------------------------------------ business A works the request
  perform set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.enquiries where id = e1 and sender_phone = '+91 98765 43210' and guests = 3 and rooms = 2 and check_in = today + 10;
  ok := n = 1; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'business A sees name, phone and requested dates\n'; fails := fails + (not ok)::int;
  select count(*) into n from public.notifications where enquiry_id = e1 and kind = 'enquiry_new' and body not like '%98765%' and body not like '%@%';
  ok := n = 1; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'business A got an in-app notification without contact details\n'; fails := fails + (not ok)::int;
  msg := null; begin perform public.business_update_enquiry(e1, 'confirmed', null); exception when others then msg := sqlerrm; end;
  ok := msg like '%cannot move%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'cannot confirm a request that was never accepted\n'; fails := fails + (not ok)::int;
  msg := null; begin perform public.business_update_enquiry(e1, 'declined', ''); exception when others then msg := sqlerrm; end;
  ok := msg like '%short message%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'declining requires a message\n'; fails := fails + (not ok)::int;
  perform public.business_update_enquiry(e1, 'read', null);
  perform public.business_update_enquiry(e1, 'accepted', 'Room 4 is free. Please call to confirm.');
  select status::text, business_response into st, msg from public.enquiries where id = e1;
  ok := st = 'accepted' and msg like 'Room 4%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'business accepts with a response\n'; fails := fails + (not ok)::int;
  perform public.business_update_enquiry(e1, 'confirmed', null);
  select count(*) into n from public.enquiry_events where enquiry_id = e1;
  ok := n = 4; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || 'history records every step (' || n || E')\n'; fails := fails + (not ok)::int;
  msg := null; begin update public.listings set enquiry_mode = 'message' where id = stay; exception when others then msg := sqlerrm; end;
  select status::text into st from public.listings where id = stay;
  ok := msg is null and st = 'published'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'changing the enquiry mode keeps the listing published\n'; fails := fails + (not ok)::int;
  update public.listings set whatsapp_enabled = true where id = stay;
  select status::text into st from public.listings where id = stay;
  ok := st = 'pending_review'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'turning on WhatsApp sends the listing back to review\n'; fails := fails + (not ok)::int;
  execute 'reset role';

  -- ------------------------------------------------------------ visitor follows up
  perform set_config('request.jwt.claims', json_build_object('sub', u_v, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select status::text, business_response into st, msg from public.enquiries where id = e1;
  ok := st = 'confirmed' and msg like 'Room 4%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'visitor sees the confirmed status and the response\n'; fails := fails + (not ok)::int;
  select count(*) into n from public.notifications where user_id = u_v and enquiry_id = e1;
  ok := n = 2; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || 'visitor notified of accepted and confirmed, not of "seen" (' || n || E')\n'; fails := fails + (not ok)::int;
  update public.notifications set read_at = now() where user_id = u_v;
  select count(*) into n from public.notifications where user_id = u_v and read_at is null;
  ok := n = 0; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'visitor can mark notifications read\n'; fails := fails + (not ok)::int;
  select count(*) into n from public.notifications where user_id <> u_v;
  ok := n = 0; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'visitor cannot read anyone else''s notifications\n'; fails := fails + (not ok)::int;
  msg := null; begin perform public.cancel_my_enquiry(e1, null); exception when others then msg := sqlerrm; end;
  ok := msg like '%contact the business%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'a confirmed reservation cannot be cancelled online\n'; fails := fails + (not ok)::int;
  perform public.cancel_my_enquiry(e2, 'Plans changed');
  select status::text into st from public.enquiries where id = e2;
  ok := st = 'cancelled'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'visitor cancels a pending request\n'; fails := fails + (not ok)::int;
  execute 'reset role';
  select count(*) into n from public.notifications where user_id = u_o2 and enquiry_id = e2 and kind = 'enquiry_cancelled';
  ok := n = 1; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'business B notified of the cancellation\n'; fails := fails + (not ok)::int;

  -- ------------------------------------------------------------ staff
  perform set_config('request.jwt.claims', json_build_object('sub', u_a0, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.enquiries where id = e1;
  ok := n = 0; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'admin without enquiries.view reads nothing\n'; fails := fails + (not ok)::int;
  msg := null; begin v := public.admin_list_enquiries(null, null, 10, 0); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'admin without enquiries.view cannot list enquiries\n'; fails := fails + (not ok)::int;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.enquiries where id = e1;
  ok := n = 0; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'staff no longer read raw enquiry rows\n'; fails := fails + (not ok)::int;
  v := public.admin_get_enquiry(e1);
  ok := v->>'sender' = 'Priya S.' and v->>'phone_masked' = '••••••210' and v->>'email_masked' = 'p•••@example.com' and v::text not like '%43210%';
  r := r || case when ok then 'PASS  ' else 'FAIL  ' end || 'staff see masked contact details (' || coalesce(v->>'phone_masked', '-') || E')\n'; fails := fails + (not ok)::int;
  v := public.admin_list_enquiries(null, ref, 10, 0);
  ok := (v->>'total')::int = 1 and v::text not like '%43210%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'staff can find an enquiry by reference, masked\n'; fails := fails + (not ok)::int;
  msg := null; begin v := public.admin_reveal_enquiry_contact(e1, 'short'); exception when others then msg := sqlerrm; end;
  ok := msg like '%reason%'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'revealing contact needs a reason\n'; fails := fails + (not ok)::int;
  v := public.admin_reveal_enquiry_contact(e1, 'Visitor reported a dispute (ticket 42)');
  ok := v->>'phone' = '+91 98765 43210'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'staff can reveal contact with a reason\n'; fails := fails + (not ok)::int;
  v := public.admin_enquiry_overview(today - 1, today);
  ok := (v->>'total')::int >= 2 and (v->'by_status'->>'cancelled')::int >= 1; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'aggregate overview counts statuses\n'; fails := fails + (not ok)::int;
  execute 'reset role';
  select count(*) into n from public.audit_logs where action = 'enquiry.contact_revealed' and entity_id = e1::text and actor_id = u_a;
  ok := n = 1; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'contact reveal is in the audit log\n'; fails := fails + (not ok)::int;

  -- ------------------------------------------------------------ anonymous
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  msg := null; begin select count(*) into n from public.enquiries; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied' or n = 0; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'anonymous visitors read no enquiries\n'; fails := fails + (not ok)::int;
  msg := null; begin select count(*) into n from public.notifications; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'anonymous visitors read no notifications\n'; fails := fails + (not ok)::int;
  msg := null; begin select count(*) into n from public.enquiry_events; exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'anonymous visitors read no enquiry history\n'; fails := fails + (not ok)::int;
  msg := null; begin v := public.admin_list_enquiries(null, null, 10, 0); exception when insufficient_privilege then msg := 'denied'; end;
  ok := msg = 'denied'; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'anonymous visitors cannot call staff functions\n'; fails := fails + (not ok)::int;
  select count(*) into n from public.listings where id = cafe and enquiry_mode = 'booking' and whatsapp_enabled = false;
  ok := n = 1; r := r || case when ok then 'PASS  ' else 'FAIL  ' end || E'anonymous visitors read the public enquiry options\n'; fails := fails + (not ok)::int;
  execute 'reset role';

  raise exception E'ENQUIRY BOOKING TEST (rolled back)\n%\n% failed', r, fails;
end;
$$;
