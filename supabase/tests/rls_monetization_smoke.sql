-- P6.5 monetization smoke: pro_until grant, flair gate, revenuecat_events
-- denial, is_pro truth table, free-tier history limit.
-- Run: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -v ON_ERROR_STOP=1 -f supabase/tests/rls_monetization_smoke.sql
-- Self-contained: creates its own users inside each begin…rollback block
-- (variant-9 uuids can't collide with seed fixtures), so it also runs
-- against a hosted project with no seed data.

-- 1. Column grant, flair gate, events denial, is_pro truth table -------------
begin;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current
)
values
  ('00000000-0000-4000-9000-000000000011', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smoke-free@example.com', '',
   now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Smoke Free"}',
   now(), now(), '', '', '', '', ''),
  ('00000000-0000-4000-9000-000000000012', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smoke-pro@example.com', '',
   now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Smoke Pro"}',
   now(), now(), '', '', '', '', '');
update public.profiles set pro_until = now() + interval '1 year'
where id = '00000000-0000-4000-9000-000000000012';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000011","role":"authenticated"}', true);
do $$
begin
  -- pro_until is server-cache: never client-writable.
  begin
    update public.profiles set pro_until = now() + interval '1 year'
    where id = '00000000-0000-4000-9000-000000000011';
    raise exception 'SMOKE FAIL 1: free user granted themselves pro';
  exception when insufficient_privilege then null;
  end;
  -- Flair columns are granted but pro-gated by trigger.
  begin
    update public.profiles set flair_accent = 'volt'
    where id = '00000000-0000-4000-9000-000000000011';
    raise exception 'SMOKE FAIL 1: free user set flair';
  exception when others then
    if sqlerrm not like '%pro required%' then raise; end if;
  end;
  -- Events mirror is invisible to clients — loudly.
  begin
    perform count(*) from public.revenuecat_events;
    raise exception 'SMOKE FAIL 1: revenuecat_events readable by authenticated';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.revenuecat_events (id, type, environment, payload)
    values ('evt1', 'TEST', 'SANDBOX', '{}');
    raise exception 'SMOKE FAIL 1: revenuecat_events writable by authenticated';
  exception when insufficient_privilege then null;
  end;
  -- is_pro truth table.
  if public.is_pro ('00000000-0000-4000-9000-000000000011') then
    raise exception 'SMOKE FAIL 1: is_pro true for free user';
  end if;
  if not public.is_pro ('00000000-0000-4000-9000-000000000012') then
    raise exception 'SMOKE FAIL 1: is_pro false for pro user';
  end if;
  if public.is_pro (null) then
    raise exception 'SMOKE FAIL 1: is_pro true for null';
  end if;
  if public.is_pro (gen_random_uuid ()) then
    raise exception 'SMOKE FAIL 1: is_pro true for unknown user';
  end if;
end $$;
-- Pro user can write flair.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000012","role":"authenticated"}', true);
do $$
begin
  update public.profiles set flair_accent = 'volt', flair_ring = true
  where id = '00000000-0000-4000-9000-000000000012';
  if not exists (select 1 from public.profiles
                 where id = '00000000-0000-4000-9000-000000000012'
                   and flair_accent = 'volt' and flair_ring) then
    raise exception 'SMOKE FAIL 1: pro flair write did not persist';
  end if;
end $$;
-- Expiry re-locks flair writes.
reset role;
update public.profiles set pro_until = now() - interval '1 second'
where id = '00000000-0000-4000-9000-000000000012';
set local role authenticated;
do $$
begin
  begin
    update public.profiles set flair_ring = false
    where id = '00000000-0000-4000-9000-000000000012';
    raise exception 'SMOKE FAIL 1: expired pro user changed flair';
  exception when others then
    if sqlerrm not like '%pro required%' then raise; end if;
  end;
end $$;
rollback;

-- 2. Free-tier history limit: 10 rows free, unlimited pro --------------------
begin;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current
)
values
  ('00000000-0000-4000-9000-000000000011', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smoke-free@example.com', '',
   now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Smoke Free"}',
   now(), now(), '', '', '', '', '');
insert into public.runs (host_id, type, status, visibility, title, start_point,
                         distance_km, max_group, starts_at)
select
  '00000000-0000-4000-9000-000000000011', 'social', 'completed', 'open',
  'Past run ' || i,
  extensions.st_setsrid (extensions.st_makepoint (-9.14, 38.72), 4326)::extensions.geography,
  5.0, 5, now() - (i || ' days')::interval
from generate_series(1, 12) as i;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000011","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.list_past_runs ()) <> 10 then
    raise exception 'SMOKE FAIL 2: free history not capped at 10';
  end if;
end $$;
reset role;
update public.profiles set pro_until = now() + interval '1 year'
where id = '00000000-0000-4000-9000-000000000011';
set local role authenticated;
do $$
begin
  if (select count(*) from public.list_past_runs ()) <> 12 then
    raise exception 'SMOKE FAIL 2: pro history still limited';
  end if;
  -- Newest first survived the limit wrap.
  if (select title from public.list_past_runs () limit 1) <> 'Past run 1' then
    raise exception 'SMOKE FAIL 2: history ordering lost';
  end if;
end $$;
rollback;

select 'rls_monetization_smoke: all cases passed' as result;
