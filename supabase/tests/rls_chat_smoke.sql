-- P3 chat/notifications smoke: RLS + fan-out behavior on a fresh reset.
-- Run: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -v ON_ERROR_STOP=1 -f supabase/tests/rls_chat_smoke.sql
-- Same technique as rls_smoke.sql / core_loop_smoke.sql. Fixture uuids:
-- maya …0001, marco …0002, nadia …0003; Old Town Loop run …0001 (maya +
-- marco are chat members via seed), Sunset 5K …0003 (maya hosts).
-- Section 11 covers migration 32's function-privilege denials (get_secret
-- would otherwise hand any client the send-push shared secret).

-- 1. Non-member reads nothing; member reads conversation + messages ----------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
declare v_conv uuid;
begin
  select id into v_conv from public.conversations where run_id = '10000000-0000-4000-8000-000000000001';
  if v_conv is not null then
    raise exception 'SMOKE FAIL 1: non-member sees the conversation';
  end if;
  if (select count(*) from public.messages) <> 0 then
    raise exception 'SMOKE FAIL 1: non-member sees messages';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.conversations where run_id = '10000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'SMOKE FAIL 1: member cannot see the conversation';
  end if;
  if (select count(*) from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where c.run_id = '10000000-0000-4000-8000-000000000001') < 4 then
    raise exception 'SMOKE FAIL 1: member cannot read the seeded stream';
  end if;
end $$;
rollback;

-- 2. Non-member message INSERT → RLS error -----------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
declare v_conv uuid;
begin
  -- Resolve the conversation as postgres would: bypass via a definer-free
  -- lookup is impossible under RLS, so hardcode via the runs row (readable).
  select c.id into v_conv
  from public.conversations c
  where c.run_id = '10000000-0000-4000-8000-000000000001';
  -- v_conv is null under RLS; use a subselect that the INSERT itself resolves.
  insert into public.messages (conversation_id, sender_id, body)
  select id, '00000000-0000-4000-8000-000000000003', 'let me in'
  from public.conversations where run_id = '10000000-0000-4000-8000-000000000001';
  -- RLS on conversations makes the subselect empty → 0 rows inserted.
  if found then
    raise exception 'SMOKE FAIL 2: non-member inserted a message';
  end if;
end $$;
rollback;

-- 2b. Non-member INSERT with a known id → RLS violation ----------------------
begin;
do $$
declare v_conv uuid;
begin
  select id into v_conv from public.conversations where run_id = '10000000-0000-4000-8000-000000000001';
  execute format(
    'set local role authenticated; select set_config(%L, %L, true)',
    'request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}');
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, '00000000-0000-4000-8000-000000000003', 'let me in');
    raise exception 'SMOKE FAIL 2b: non-member message INSERT succeeded';
  exception when others then
    if sqlerrm not like '%row-level security%' then raise; end if;
  end;
end $$;
rollback;

-- 3. Member cannot forge system messages; non-host cannot set meeting point --
begin;
do $$
declare v_conv uuid;
begin
  select id into v_conv from public.conversations where run_id = '10000000-0000-4000-8000-000000000001';
  execute format(
    'set local role authenticated; select set_config(%L, %L, true)',
    'request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}');
  begin
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (v_conv, '00000000-0000-4000-8000-000000000001', 'system', 'joined');
    raise exception 'SMOKE FAIL 3: member forged a system message';
  exception when others then
    if sqlerrm not like '%row-level security%' then raise; end if;
  end;
  begin
    -- maya is a member but NOT the host of Old Town Loop.
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (v_conv, '00000000-0000-4000-8000-000000000001', 'meeting_point', 'my place');
    raise exception 'SMOKE FAIL 3: non-host set a meeting point';
  exception when others then
    if sqlerrm not like '%row-level security%' then raise; end if;
  end;
end $$;
rollback;

-- 4. get_or_create_dm returns one id from either side -------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare a uuid; b uuid;
begin
  a := public.get_or_create_dm('00000000-0000-4000-8000-000000000002');
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  b := public.get_or_create_dm('00000000-0000-4000-8000-000000000001');
  if a is distinct from b then
    raise exception 'SMOKE FAIL 4: DM ids differ across directions (% vs %)', a, b;
  end if;
end $$;
rollback;

-- 5. notifications: client INSERT denied; UPDATE only via read_at -------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  insert into public.notifications (user_id, kind, title)
  values ('00000000-0000-4000-8000-000000000001', 'message', 'forged');
  raise exception 'SMOKE FAIL 5: client inserted a notification';
exception when insufficient_privilege then null;
when others then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
do $$
begin
  update public.notifications set title = 'renamed'
  where user_id = '00000000-0000-4000-8000-000000000001';
  raise exception 'SMOKE FAIL 5: client updated a protected column';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  update public.notifications set read_at = now()
  where user_id = '00000000-0000-4000-8000-000000000001' and read_at is null;
end $$;
rollback;

-- 6. Message fan-out dedupe: one unread row per conversation ------------------
begin;
do $$
declare
  v_conv uuid;
  v_count int;
begin
  select id into v_conv from public.conversations where run_id = '10000000-0000-4000-8000-000000000001';
  -- marco sends three more messages (as postgres; triggers still fire)
  insert into public.messages (conversation_id, sender_id, body)
  values (v_conv, '00000000-0000-4000-8000-000000000002', 'one'),
         (v_conv, '00000000-0000-4000-8000-000000000002', 'two'),
         (v_conv, '00000000-0000-4000-8000-000000000002', 'three');
  select count(*) into v_count from public.notifications
  where user_id = '00000000-0000-4000-8000-000000000001'
    and conversation_id = v_conv and kind = 'message' and read_at is null;
  if v_count <> 1 then
    raise exception 'SMOKE FAIL 6: expected 1 unread message notification, got %', v_count;
  end if;
end $$;
rollback;

-- 7. mark_conversation_read clears pill + notification together ---------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare
  v_conv uuid;
  v_unread bigint;
begin
  select conversation_id into v_conv from public.list_conversations() where unread_count > 0 limit 1;
  if v_conv is null then
    raise exception 'SMOKE FAIL 7: no unread conversation in seed';
  end if;
  perform public.mark_conversation_read(v_conv);
  select unread_count into v_unread from public.list_conversations() lc where lc.conversation_id = v_conv;
  if v_unread <> 0 then
    raise exception 'SMOKE FAIL 7: unread pill not cleared';
  end if;
  if exists (select 1 from public.notifications
             where user_id = '00000000-0000-4000-8000-000000000001'
               and conversation_id = v_conv and kind = 'message' and read_at is null) then
    raise exception 'SMOKE FAIL 7: message notification not cleared';
  end if;
end $$;
rollback;

-- 8. Membership fan-out: request → host notified; approve → runner notified ---
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare v public.run_members;
begin
  -- marco requests to join maya's Sunset 5K (open run → instant approve;
  -- he's already approved there in seed, so use nadia's flow instead below).
  null;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
declare v public.run_members;
begin
  v := public.join_run('10000000-0000-4000-8000-000000000001', 'Can I come?');
  if v.status <> 'pending' then
    raise exception 'SMOKE FAIL 8: approval-run join was %', v.status;
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  -- Checked under the host's own JWT — notifications are self-readable only.
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-8000-000000000002'
                   and kind = 'join_request'
                   and actor_id = '00000000-0000-4000-8000-000000000003') then
    raise exception 'SMOKE FAIL 8: host missing join_request notification';
  end if;
end $$;
do $$
declare v public.run_members;
begin
  v := public.respond_to_join_request('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', true);
  if v.status <> 'approved' then
    raise exception 'SMOKE FAIL 8: approve failed';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
begin
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-8000-000000000003'
                   and kind = 'request_approved') then
    raise exception 'SMOKE FAIL 8: runner missing request_approved notification';
  end if;
  -- A5: nadia is now a chat member with a system 'joined' message.
  if not exists (select 1 from public.conversation_members cm
                 join public.conversations c on c.id = cm.conversation_id
                 where c.run_id = '10000000-0000-4000-8000-000000000001'
                   and cm.user_id = '00000000-0000-4000-8000-000000000003') then
    raise exception 'SMOKE FAIL 8: approved runner not added to chat';
  end if;
end $$;
rollback;

-- 9. Max-length fan-out: 40-char name + 40-char title still insert ------------
begin;
do $$
declare
  v_conv uuid;
  v_bad int;
begin
  update public.profiles set display_name = repeat('N', 40)
  where id = '00000000-0000-4000-8000-000000000002';
  update public.runs set title = repeat('T', 40)
  where id = '10000000-0000-4000-8000-000000000001';
  select id into v_conv from public.conversations where run_id = '10000000-0000-4000-8000-000000000001';
  insert into public.messages (conversation_id, sender_id, body)
  values (v_conv, '00000000-0000-4000-8000-000000000002', 'long-name check');
  select count(*) into v_bad from public.notifications where char_length(title) > 80;
  if v_bad <> 0 then
    raise exception 'SMOKE FAIL 9: notification title over 80 chars';
  end if;
end $$;
rollback;

-- 10. Re-request after cancel notifies the host again (B4 widened branch) --
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
declare v public.run_members;
begin
  v := public.join_run('10000000-0000-4000-8000-000000000001', 'first ask');
  v := public.cancel_join('10000000-0000-4000-8000-000000000001');
  v := public.join_run('10000000-0000-4000-8000-000000000001', 'second ask');
  if v.status <> 'pending' then
    raise exception 'SMOKE FAIL 10: re-request after cancel not pending';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.notifications
  where user_id = '00000000-0000-4000-8000-000000000002'
    and kind = 'join_request'
    and actor_id = '00000000-0000-4000-8000-000000000003';
  if v_count < 2 then
    raise exception 'SMOKE FAIL 10: cancel-then-re-request produced % join_request notifications (want 2)', v_count;
  end if;
end $$;
rollback;

-- 11. Migration 32 internals are unreachable as client RPCs ------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.get_secret ('send_push_secret');
    raise exception 'SMOKE FAIL 11: get_secret callable by authenticated';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.enqueue_run_reminders ();
    raise exception 'SMOKE FAIL 11: enqueue_run_reminders callable by authenticated';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.request_push_receipts ();
    raise exception 'SMOKE FAIL 11: request_push_receipts callable by authenticated';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role anon;
do $$
begin
  begin
    perform public.get_secret ('send_push_secret');
    raise exception 'SMOKE FAIL 11: get_secret callable by anon';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

select 'rls_chat_smoke: all cases passed' as result;
