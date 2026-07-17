-- P2 core-loop smoke: RLS + membership RPC behavior on a fresh `db reset`.
-- Run: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -v ON_ERROR_STOP=1 -f supabase/tests/core_loop_smoke.sql
-- Role-play technique (as P1 rls_smoke.sql): `set local role` + JWT claims per
-- case; every case is a begin…rollback block against seed fixtures, and every
-- expectation is asserted in a DO block — any deviation raises SMOKE FAIL and
-- aborts the file. Fixture uuids: maya …0001, marco …0002, nadia …0003;
-- runs: old-town …0001, sunset-5k …0003, track-repeats …0004 (DEVLINK01).

-- 1. Invite run hidden from listings, resolvable by code -----------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.runs where id = '10000000-0000-4000-8000-000000000004') <> 0 then
    raise exception 'SMOKE FAIL 1: invite run visible in direct select';
  end if;
  if (select count(*) from public.get_run_by_invite('DEVLINK01')) <> 1 then
    raise exception 'SMOKE FAIL 1: get_run_by_invite did not resolve DEVLINK01';
  end if;
end $$;
rollback;

-- 2. Direct run_members writes blocked (RPCs are the only write path) ----------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  insert into public.run_members (run_id, user_id)
  values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
  raise exception 'SMOKE FAIL 2: direct insert into run_members succeeded';
exception when others then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
rollback;

-- 3. Invite joins instantly; double-join rejected ------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare v public.run_members;
begin
  v := public.join_run('10000000-0000-4000-8000-000000000004');
  if v.status <> 'approved' then
    raise exception 'SMOKE FAIL 3: invite join returned %, expected approved', v.status;
  end if;
end $$;
do $$
begin
  perform public.join_run('10000000-0000-4000-8000-000000000004');
  raise exception 'SMOKE FAIL 3: second join_run succeeded';
exception when others then
  if sqlerrm not like '%already requested or joined%' then raise; end if;
end $$;
rollback;

-- 4. Non-host cannot decide requests ------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  perform public.respond_to_join_request(
    '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', true);
  raise exception 'SMOKE FAIL 4: non-host decided a request';
exception when others then
  if sqlerrm not like '%only the host can decide requests%' then raise; end if;
end $$;
rollback;

-- 5. Runner cancels own pending request; may re-request after cancel -----------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare v public.run_members;
begin
  v := public.cancel_join('10000000-0000-4000-8000-000000000001');
  if v.status <> 'cancelled' then
    raise exception 'SMOKE FAIL 5: cancel_join returned %, expected cancelled', v.status;
  end if;
  v := public.join_run('10000000-0000-4000-8000-000000000001', 'again');
  if v.status <> 'pending' or v.intro_message <> 'again' then
    raise exception 'SMOKE FAIL 5: re-request after cancel returned % / %', v.status, v.intro_message;
  end if;
end $$;
rollback;

-- 6. Host approves, removes; removed cannot rejoin -----------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare v public.run_members;
begin
  v := public.respond_to_join_request(
    '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', true);
  if v.status <> 'approved' then
    raise exception 'SMOKE FAIL 6: approve returned %', v.status;
  end if;
  v := public.remove_member(
    '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
  if v.status <> 'removed' then
    raise exception 'SMOKE FAIL 6: remove_member returned %', v.status;
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  perform public.join_run('10000000-0000-4000-8000-000000000001');
  raise exception 'SMOKE FAIL 6: removed member re-joined';
exception when others then
  if sqlerrm not like '%already requested or joined%' then raise; end if;
end $$;
rollback;

-- 7. Approving into a full run fails; definer count visible --------------------
begin;
update public.runs set max_group = 2 where id = '10000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  perform public.respond_to_join_request(
    '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', true);
  raise exception 'SMOKE FAIL 7: approved into a full run';
exception when others then
  if sqlerrm not like '%run is full%' then raise; end if;
end $$;
do $$
begin
  if public.run_approved_count('10000000-0000-4000-8000-000000000003') <> 1 then
    raise exception 'SMOKE FAIL 7: run_approved_count expected 1';
  end if;
end $$;
rollback;

-- 8. Regression (P0): points_reward recomputed on every write ------------------
begin;
update public.runs set points_reward = 9999 where id = '10000000-0000-4000-8000-000000000001';
do $$
declare v public.runs;
begin
  select * into v from public.runs where id = '10000000-0000-4000-8000-000000000001';
  if v.points_reward <> public.compute_points_reward(v.distance_km, v.type) then
    raise exception 'SMOKE FAIL 8: points_reward tampered to %', v.points_reward;
  end if;
end $$;
rollback;

-- 9. Anon guard on every membership write RPC ----------------------------------
-- Supabase grants anon EXECUTE on public functions; the in-function guard is
-- all that stands between the app's embedded anon key and definer writes.
begin;
set local role anon;
do $$
declare fn text;
begin
  foreach fn in array array[
    $q$ select public.join_run('10000000-0000-4000-8000-000000000001') $q$,
    $q$ select public.cancel_join('10000000-0000-4000-8000-000000000001') $q$,
    $q$ select public.remove_member('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001') $q$,
    $q$ select public.respond_to_join_request('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', true) $q$
  ] loop
    begin
      execute fn;
      raise exception 'SMOKE FAIL 9: anon call succeeded: %', fn;
    exception when others then
      if sqlerrm not like '%not authenticated%' then raise; end if;
    end;
  end loop;
end $$;
rollback;

-- 10. Invite-code default uses the URL-safe alphabet ---------------------------
begin;
do $$
declare i integer;
begin
  for i in 1..20 loop
    insert into public.runs (host_id, type, title, start_point, distance_km, max_group, starts_at)
    values (
      '00000000-0000-4000-8000-000000000001', 'social', 'Alphabet probe ' || i,
      extensions.st_setsrid(extensions.st_makepoint(-9.14, 38.72), 4326)::extensions.geography,
      5, 4, now() + interval '1 day');
  end loop;
  if exists (
    select 1 from public.runs
    where title like 'Alphabet probe %' and invite_code !~ '^[A-Za-z0-9_-]{12}$'
  ) then
    raise exception 'SMOKE FAIL 10: invite_code default not URL-safe';
  end if;
end $$;
rollback;

-- 11. search_runs: title/area matches, invite runs never surface -------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if not exists (
    select 1 from public.search_runs('old', 38.72, -9.14) s where (s.run).title = 'Old Town Loop'
  ) then
    raise exception 'SMOKE FAIL 11: search "old" did not find Old Town Loop';
  end if;
  if (select count(*) from public.search_runs('Track Repeats', 38.72, -9.14)) <> 0 then
    raise exception 'SMOKE FAIL 11: invite run surfaced in search';
  end if;
  if (select count(*) from public.search_runs('o', 38.72, -9.14)) <> 0 then
    raise exception 'SMOKE FAIL 11: sub-2-char query returned rows';
  end if;
end $$;
rollback;

select 'core_loop_smoke: all cases passed' as result;
