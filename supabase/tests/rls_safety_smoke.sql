-- P5 blocks/reports/safety smoke. Run:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--     -v ON_ERROR_STOP=1 -f supabase/tests/rls_safety_smoke.sql
-- Fixture uuids: maya …0001, marco …0002, nadia …0003, rita …0004; marco
-- hosts Old Town Loop …0001 (published, maya approved via P3 seed).

-- 1. Block walk: marco disappears from every read surface for maya ------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  insert into public.blocks (blocker_id, blocked_id)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
end $$;
do $$
begin
  if exists (select 1 from public.runs where host_id = '00000000-0000-4000-8000-000000000002') then
    raise exception 'SMOKE FAIL 1: blocked host''s runs still readable';
  end if;
  if exists (
    select 1 from public.runs_within_radius(38.7139, -9.1300, 5000) rr
    where (rr.run).host_id = '00000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'SMOKE FAIL 1: blocked host''s runs in radius search';
  end if;
  if exists (select 1 from public.get_run_by_invite('DEVLINK01')) then
    null; -- DEVLINK01 is maya's own run — unaffected, fine
  end if;
  if exists (select 1 from public.run_members where user_id = '00000000-0000-4000-8000-000000000002') then
    raise exception 'SMOKE FAIL 1: blocked user''s membership rows visible';
  end if;
  if exists (select 1 from public.messages where sender_id = '00000000-0000-4000-8000-000000000002') then
    raise exception 'SMOKE FAIL 1: blocked user''s messages visible';
  end if;
  if exists (select 1 from public.notifications
             where actor_id = '00000000-0000-4000-8000-000000000002'
               and kind <> 'request_declined') then
    raise exception 'SMOKE FAIL 1: blocked actor''s notifications visible';
  end if;
  if exists (select 1 from public.get_leaderboard('Lisbon') gl
             where gl.user_id = '00000000-0000-4000-8000-000000000002') then
    raise exception 'SMOKE FAIL 1: blocked user on the leaderboard';
  end if;
  -- Reviews WRITTEN BY the blocked user disappear (own-authored reviews of
  -- him remain the viewer's content, per the A3 #11 policy shape).
  if exists (select 1 from public.reviews
             where reviewer_id = '00000000-0000-4000-8000-000000000002') then
    raise exception 'SMOKE FAIL 1: blocked user''s reviews visible';
  end if;
end $$;
-- DM creation refused both directions
do $$
begin
  perform public.get_or_create_dm('00000000-0000-4000-8000-000000000002');
  raise exception 'SMOKE FAIL 1: DM to blocked user created';
exception when others then
  if sqlerrm not like '%user unavailable%' then raise; end if;
end $$;
-- Sever: maya's approved membership in marco's runs is cancelled
do $$
begin
  if exists (select 1 from public.run_members rm
             join public.runs r on r.id = rm.run_id
             where r.host_id = '00000000-0000-4000-8000-000000000002'
               and rm.user_id = '00000000-0000-4000-8000-000000000001'
               and rm.status in ('pending', 'approved')) then
    raise exception 'SMOKE FAIL 1: live memberships with blocked host survive';
  end if;
end $$;
-- Symmetric side: maya's profile unreadable to marco; join_run raises generic
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000001') then
    raise exception 'SMOKE FAIL 1: blocker''s profile readable to blocked user';
  end if;
end $$;
do $$
begin
  perform public.join_run('10000000-0000-4000-8000-000000000003');
  raise exception 'SMOKE FAIL 1: blocked user joined the blocker''s run';
exception when others then
  if sqlerrm not like '%run not open for joining%' then raise; end if;
end $$;
rollback;

-- 2. Blocked-by-me stays row-readable (settings/blocked + banner) -------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  insert into public.blocks (blocker_id, blocked_id)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
  if not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000002') then
    raise exception 'SMOKE FAIL 2: user I blocked is row-unreadable';
  end if;
end $$;
rollback;

-- 3. Reports: insert-only, self-report rejected -------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  insert into public.reports (reporter_id, subject_user_id, reason, note)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
          'harassment', 'test');
  if (select count(*) from public.reports) <> 0 then
    raise exception 'SMOKE FAIL 3: reports readable by a client';
  end if;
end $$;
do $$
begin
  insert into public.reports (reporter_id, subject_user_id, reason)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'spam');
  raise exception 'SMOKE FAIL 3: self-report accepted';
exception when others then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
rollback;

-- 4. Trusted-contact limits ----------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare i integer;
begin
  -- Seed has 1 trusted; add 4 more (total 5), then the 6th must fail.
  for i in 1..4 loop
    insert into public.safety_contacts (user_id, name, phone)
    values ('00000000-0000-4000-8000-000000000001', 'Contact ' || i, '+35191200001' || i);
  end loop;
  begin
    insert into public.safety_contacts (user_id, name, phone)
    values ('00000000-0000-4000-8000-000000000001', 'One Too Many', '+351912000099');
    raise exception 'SMOKE FAIL 4: 6th trusted contact accepted';
  exception when others then
    if sqlerrm not like '%trusted contact limit reached%' then raise; end if;
  end;
  begin
    insert into public.safety_contacts (user_id, name, phone, is_emergency)
    values ('00000000-0000-4000-8000-000000000001', 'Second Emergency', '+351912000098', true);
    raise exception 'SMOKE FAIL 4: second emergency contact accepted';
  exception when unique_violation then null;
  end;
end $$;
rollback;

-- 5. live_locations: cannot write against another user's session --------------
begin;
do $$
declare v_session uuid;
begin
  insert into public.live_share_sessions (user_id) values ('00000000-0000-4000-8000-000000000001')
  returning id into v_session;
  execute format(
    'set local role authenticated; select set_config(%L, %L, true)',
    'request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}');
  begin
    insert into public.live_locations (session_id, lat, lng)
    values (v_session, 38.7, -9.2);
    raise exception 'SMOKE FAIL 5: cross-user live_locations write accepted';
  exception when others then
    if sqlerrm not like '%row-level security%' then raise; end if;
  end;
end $$;
rollback;

-- 6. Leaderboard view revoked; RPC works ---------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  perform * from public.leaderboard_weekly;
  raise exception 'SMOKE FAIL 6: direct view select allowed';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  if (select count(*) from public.get_leaderboard('Lisbon')) = 0 then
    raise exception 'SMOKE FAIL 6: get_leaderboard empty for seeded Lisbon week';
  end if;
end $$;
rollback;

-- 7. can_view_profile truth table ---------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  -- rita vs maya: everyone → true
  if not public.can_view_profile('00000000-0000-4000-8000-000000000001') then
    raise exception 'SMOKE FAIL 7: everyone profile not viewable';
  end if;
end $$;
rollback;
begin;
update public.profiles set visibility = 'members' where id = '00000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  -- rita shares no run with marco → limited
  if public.can_view_profile('00000000-0000-4000-8000-000000000002') then
    raise exception 'SMOKE FAIL 7: members profile viewable without shared run';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  -- maya shares River Loop with marco → full
  if not public.can_view_profile('00000000-0000-4000-8000-000000000002') then
    raise exception 'SMOKE FAIL 7: members profile hidden from run-sharer';
  end if;
end $$;
rollback;
begin;
update public.profiles set visibility = 'hidden' where id = '00000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if public.can_view_profile('00000000-0000-4000-8000-000000000002') then
    raise exception 'SMOKE FAIL 7: hidden profile viewable';
  end if;
end $$;
rollback;

-- 8. Reviews broadening: unblocked third party reads an everyone profile ------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  -- rita (no block, no shared run) reads maya's review of marco (everyone).
  if not exists (select 1 from public.reviews
                 where reviewee_id = '00000000-0000-4000-8000-000000000002') then
    raise exception 'SMOKE FAIL 8: third party cannot read reviews on an everyone profile';
  end if;
end $$;
rollback;

-- 9. New profile column grants (P1 grant list didn't cover them) --------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  update public.profiles
  set live_share_auto = true,
      notification_prefs = '{"messages": false}',
      like_types = '{social,discover}'
  where id = '00000000-0000-4000-8000-000000000001';
end $$;
rollback;

select 'rls_safety_smoke: all cases passed' as result;
