-- P1 two-user RLS smoke: profiles + avatars-bucket policies on a fresh reset.
-- Run: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -v ON_ERROR_STOP=1 -f supabase/tests/rls_smoke.sql
-- Same role-play technique as core_loop_smoke.sql: `set local role` + JWT
-- claims per case, begin…rollback per block, DO-block assertions that raise
-- SMOKE FAIL on any deviation. Fixture uuids: maya …0001, marco …0002.

-- 1. Cross-user profile update touches 0 rows ----------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare v_count int;
begin
  update public.profiles set bio = 'x' where id = '00000000-0000-4000-8000-000000000001';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'SMOKE FAIL 1: cross-user profile update touched % rows', v_count;
  end if;
end $$;
rollback;

-- 2. Own points_total update = permission denied (column grant) ----------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  update public.profiles set points_total = 99999 where id = '00000000-0000-4000-8000-000000000002';
  raise exception 'SMOKE FAIL 2: self points_total update succeeded';
exception when insufficient_privilege then
  null;
end $$;
rollback;

-- 3. Cross-user avatar object insert = RLS violation ---------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('avatars', '00000000-0000-4000-8000-000000000001/avatar.jpg');
  raise exception 'SMOKE FAIL 3: cross-user avatar insert succeeded';
exception when others then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
rollback;

-- 3b. Own-prefix avatar insert is allowed --------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('avatars', '00000000-0000-4000-8000-000000000002/avatar.jpg');
end $$;
rollback;

-- 4. Hidden profile invisible cross-user, visible to self ----------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare v_count int;
begin
  update public.profiles set visibility = 'hidden' where id = '00000000-0000-4000-8000-000000000001';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'SMOKE FAIL 4: own visibility update touched % rows', v_count;
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000001') <> 0 then
    raise exception 'SMOKE FAIL 4: hidden profile visible to another user';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'SMOKE FAIL 4: hidden profile invisible to self';
  end if;
end $$;
rollback;

-- 5. set_home_location writes own row; rejects bad input -----------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare v public.profiles;
begin
  v := public.set_home_location(38.7223, -9.1393, ' Lisbon ');
  if v.home_city <> 'Lisbon' or v.home_point is null then
    raise exception 'SMOKE FAIL 5: set_home_location did not save city+point';
  end if;
end $$;
do $$
begin
  perform public.set_home_location(999, 0, 'Lisbon');
  raise exception 'SMOKE FAIL 5: out-of-range latitude accepted';
exception when others then
  if sqlerrm not like '%invalid coordinates%' then raise; end if;
end $$;
rollback;

-- 6. updated_at is trigger-owned -----------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare v_before timestamptz; v_after timestamptz;
begin
  select updated_at into v_before from public.profiles where id = '00000000-0000-4000-8000-000000000002';
  perform pg_sleep(0.01);
  update public.profiles set bio = 'touch check' where id = '00000000-0000-4000-8000-000000000002';
  select updated_at into v_after from public.profiles where id = '00000000-0000-4000-8000-000000000002';
  if v_after <= v_before then
    raise exception 'SMOKE FAIL 6: updated_at not touched by trigger';
  end if;
end $$;
rollback;

select 'rls_smoke: all cases passed' as result;
