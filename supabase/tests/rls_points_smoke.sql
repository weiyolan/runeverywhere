-- P4 points/reviews smoke: complete_run idempotency, review guards, RLS.
-- Run: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -v ON_ERROR_STOP=1 -f supabase/tests/rls_points_smoke.sql
-- Fixture uuids: maya …0001, marco …0002, nadia …0003; Old Town Loop …0001
-- (host marco, maya approved via P3 seed), completed River Loop …0005.

-- 1. complete_run awards once; replay returns already_completed, no new rows -
begin;
update public.runs set starts_at = now() - interval '5 minutes'
where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare
  r1 jsonb; r2 jsonb;
  n1 bigint; n2 bigint;
  total_before int; total_after int;
begin
  r1 := public.complete_run(
    '10000000-0000-4000-8000-000000000001',
    'g_ekFrodw@oFkM', 7300, 2555, 60,
    now() - interval '50 minutes', now(), null);
  if (r1->>'already_completed')::boolean then
    raise exception 'SMOKE FAIL 1: first completion flagged as replay';
  end if;
  if (r1->>'total_awarded')::int <= 0 then
    raise exception 'SMOKE FAIL 1: no points awarded';
  end if;
  select count(*) into n1 from public.points_ledger
  where user_id = '00000000-0000-4000-8000-000000000001'
    and run_id = '10000000-0000-4000-8000-000000000001';
  select points_total into total_before from public.profiles
  where id = '00000000-0000-4000-8000-000000000001';

  r2 := public.complete_run(
    '10000000-0000-4000-8000-000000000001',
    'g_ekFrodw@oFkM', 7300, 2555, 60,
    now() - interval '50 minutes', now(), null);
  if not (r2->>'already_completed')::boolean then
    raise exception 'SMOKE FAIL 1: replay not flagged';
  end if;
  select count(*) into n2 from public.points_ledger
  where user_id = '00000000-0000-4000-8000-000000000001'
    and run_id = '10000000-0000-4000-8000-000000000001';
  if n1 <> n2 then
    raise exception 'SMOKE FAIL 1: replay inserted ledger rows (% -> %)', n1, n2;
  end if;
  select points_total into total_after from public.profiles
  where id = '00000000-0000-4000-8000-000000000001';
  if total_before <> total_after then
    raise exception 'SMOKE FAIL 1: replay changed points_total';
  end if;
  -- Cache = ledger sum invariant
  if total_after <> (select sum(points) from public.points_ledger
                     where user_id = '00000000-0000-4000-8000-000000000001') then
    raise exception 'SMOKE FAIL 1: points_total drifted from ledger sum';
  end if;
end $$;
rollback;

-- 2. Non-participant / cancelled-run completion rejected -----------------------
begin;
update public.runs set starts_at = now() - interval '5 minutes'
where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
begin
  perform public.complete_run(
    '10000000-0000-4000-8000-000000000001', 'abc', 5000, 1800, 10,
    now() - interval '40 minutes', now(), null);
  raise exception 'SMOKE FAIL 2: non-participant completed the run';
exception when others then
  if sqlerrm not like '%not a participant%' then raise; end if;
end $$;
rollback;
begin;
update public.runs set status = 'cancelled'
where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  perform public.complete_run(
    '10000000-0000-4000-8000-000000000001', 'abc', 5000, 1800, 10,
    now() - interval '40 minutes', now(), null);
  raise exception 'SMOKE FAIL 2: completed a cancelled run';
exception when others then
  if sqlerrm not like '%run was cancelled%' then raise; end if;
end $$;
rollback;

-- 3. Direct writes blocked: run_tracks / points_ledger / reviews / caches -----
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  insert into public.run_tracks (run_id, user_id, polyline, distance_m, duration_s, avg_pace_s_per_km, started_at, ended_at)
  values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
          'abc', 5000, 1800, 360, now() - interval '1 hour', now());
  raise exception 'SMOKE FAIL 3: direct run_tracks insert succeeded';
exception when others then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
do $$
begin
  insert into public.points_ledger (user_id, run_id, reason, points)
  values ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'finished', 999);
  raise exception 'SMOKE FAIL 3: direct points_ledger insert succeeded';
exception when insufficient_privilege then null;
when others then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
do $$
begin
  insert into public.reviews (run_id, reviewer_id, reviewee_id, stars)
  values ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000003', 4);
  raise exception 'SMOKE FAIL 3: direct reviews insert succeeded';
exception when insufficient_privilege then null;
when others then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
do $$
begin
  update public.profiles set rating_avg = 5.0 where id = '00000000-0000-4000-8000-000000000001';
  raise exception 'SMOKE FAIL 3: client updated rating_avg';
exception when insufficient_privilege then null;
end $$;
rollback;

-- 4. submit_review guards: self, non-completed, non-participant, bad tags -----
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  perform public.submit_review('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', 5);
  raise exception 'SMOKE FAIL 4: self-review accepted';
exception when others then
  if sqlerrm not like '%invalid reviewee%' then raise; end if;
end $$;
do $$
begin
  perform public.submit_review('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 5);
  raise exception 'SMOKE FAIL 4: review on a non-completed run accepted';
exception when others then
  if sqlerrm not like '%not completed%' then raise; end if;
end $$;
do $$
begin
  perform public.submit_review('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', 5);
  raise exception 'SMOKE FAIL 4: non-participant reviewee accepted';
exception when others then
  if sqlerrm not like '%reviewee is not a participant%' then raise; end if;
end $$;
do $$
begin
  perform public.submit_review('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 5, '{"Speedy"}');
  raise exception 'SMOKE FAIL 4: off-whitelist tag accepted';
exception when check_violation then null;
end $$;
rollback;

-- 5. rate_crew once per run; second reviewee = review row, no second +10 ------
begin;
-- nadia becomes an approved participant of the completed River Loop
insert into public.run_members (run_id, user_id, status, decided_at, decided_by)
values ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003',
        'approved', now(), '00000000-0000-4000-8000-000000000002')
on conflict (run_id, user_id) do update set status = 'approved';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare
  r1 jsonb; r2 jsonb;
  v_ledger int;
begin
  r1 := public.submit_review('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 4, '{"On time"}');
  if not (r1->>'rate_crew_awarded')::boolean then
    raise exception 'SMOKE FAIL 5: first review missing the +10';
  end if;
  r2 := public.submit_review('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', 5);
  if (r2->>'rate_crew_awarded')::boolean then
    raise exception 'SMOKE FAIL 5: second reviewee re-awarded rate_crew';
  end if;
  select count(*) into v_ledger from public.points_ledger
  where user_id = '00000000-0000-4000-8000-000000000002'
    and run_id = '10000000-0000-4000-8000-000000000005'
    and reason = 'rate_crew';
  if v_ledger <> 1 then
    raise exception 'SMOKE FAIL 5: rate_crew ledger rows = %', v_ledger;
  end if;
end $$;
-- duplicate reviewee → friendly error
do $$
begin
  perform public.submit_review('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 3);
  raise exception 'SMOKE FAIL 5: duplicate review accepted';
exception when others then
  if sqlerrm not like '%already reviewed%' then raise; end if;
end $$;
-- rating aggregates follow the inserts (checked under maya's own JWT)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare v_avg numeric; v_cnt int;
begin
  select rating_avg, rating_count into v_avg, v_cnt
  from public.profiles where id = '00000000-0000-4000-8000-000000000001';
  if v_cnt <> 1 or v_avg <> 4.00 then
    raise exception 'SMOKE FAIL 5: maya aggregates % / % (want 4.00 / 1)', v_avg, v_cnt;
  end if;
end $$;
rollback;

-- 6. Cross-user raw-track object insert blocked --------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('tracks', '00000000-0000-4000-8000-000000000001/run.json.gz');
  raise exception 'SMOKE FAIL 6: cross-user tracks object insert succeeded';
exception when others then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('tracks', '00000000-0000-4000-8000-000000000002/run.json.gz');
end $$;
rollback;

select 'rls_points_smoke: all cases passed' as result;
