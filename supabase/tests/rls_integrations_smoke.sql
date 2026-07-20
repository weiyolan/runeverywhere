-- P6 integrations smoke: feature_flags read-only, connected_accounts RLS,
-- Vault token round trip, run_tracks import shape + idempotency.
-- Run: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -v ON_ERROR_STOP=1 -f supabase/tests/rls_integrations_smoke.sql
-- Self-contained: creates its own users inside each begin…rollback block
-- (variant-9 uuids can't collide with seed fixtures), so it also runs
-- against a hosted project with no seed data.

-- 1. Client surface: flags read-only, healthkit-only INSERT, fn denials ------
begin;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current
)
values
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smoke-ia@example.com', '',
   now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Smoke Ia"}',
   now(), now(), '', '', '', '', ''),
  ('00000000-0000-4000-9000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smoke-ib@example.com', '',
   now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Smoke Ib"}',
   now(), now(), '', '', '', '', '');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000001","role":"authenticated"}', true);
do $$
begin
  -- Flags are readable and complete…
  if (select count(*) from public.feature_flags
      where key in ('healthkit', 'strava', 'garmin', 'monetization')) <> 4 then
    raise exception 'SMOKE FAIL 1: expected 4 seeded feature flags';
  end if;
  -- …but fail loudly on write (the A2 revoke; RLS alone would report UPDATE 0).
  begin
    update public.feature_flags set enabled = true where key = 'strava';
    raise exception 'SMOKE FAIL 1: feature_flags writable by authenticated';
  exception when insufficient_privilege then null;
  end;

  -- HealthKit connect for self is the only client-writable case.
  insert into public.connected_accounts (user_id, provider)
  values ('00000000-0000-4000-9000-000000000001', 'healthkit');
  begin
    insert into public.connected_accounts (user_id, provider)
    values ('00000000-0000-4000-9000-000000000002', 'healthkit');
    raise exception 'SMOKE FAIL 1: healthkit INSERT for another user accepted';
  exception when others then
    if sqlerrm not like '%row-level security%' then raise; end if;
  end;
  begin
    insert into public.connected_accounts
      (user_id, provider, provider_user_id, access_token_secret_id, refresh_token_secret_id)
    values ('00000000-0000-4000-9000-000000000001', 'strava', '42',
            gen_random_uuid (), gen_random_uuid ());
    raise exception 'SMOKE FAIL 1: client strava INSERT accepted';
  exception when others then
    if sqlerrm not like '%row-level security%' then raise; end if;
  end;

  -- Token/import machinery is unreachable as client RPCs.
  begin
    perform public.store_connected_account (
      '00000000-0000-4000-9000-000000000001', 'strava', '42', '{}', 'a', 'r', now());
    raise exception 'SMOKE FAIL 1: store_connected_account callable by authenticated';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_connected_tokens ('00000000-0000-4000-9000-000000000001', 'strava');
    raise exception 'SMOKE FAIL 1: get_connected_tokens callable by authenticated';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.import_external_track (
      '00000000-0000-4000-9000-000000000001', 'strava', '1', 't', 'poly',
      1000, 600, 0, now() - interval '1 hour', now());
    raise exception 'SMOKE FAIL 1: import_external_track callable by authenticated';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_external_track ('00000000-0000-4000-9000-000000000001', 'strava', '1');
    raise exception 'SMOKE FAIL 1: delete_external_track callable by authenticated';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.disconnect_account_admin ('00000000-0000-4000-9000-000000000001', 'strava');
    raise exception 'SMOKE FAIL 1: disconnect_account_admin callable by authenticated';
  exception when insufficient_privilege then null;
  end;

  -- Clients still never write run_tracks (imported or otherwise).
  begin
    insert into public.run_tracks
      (user_id, source, external_id, polyline, distance_m, duration_s,
       avg_pace_s_per_km, started_at, ended_at)
    values ('00000000-0000-4000-9000-000000000001', 'strava', 'x', 'poly',
            1000, 600, 600, now() - interval '1 hour', now());
    raise exception 'SMOKE FAIL 1: client run_tracks INSERT accepted';
  exception when others then
    if sqlerrm not like '%row-level security%' then raise; end if;
  end;

end $$;
-- Other users see nothing (Ia's healthkit row still exists here).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000002","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.connected_accounts) <> 0 then
    raise exception 'SMOKE FAIL 1: foreign connected_accounts rows visible';
  end if;
end $$;
-- disconnect_account works for the token-less healthkit row.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000001","role":"authenticated"}', true);
do $$
begin
  perform public.disconnect_account ('healthkit');
  if exists (select 1 from public.connected_accounts
             where user_id = '00000000-0000-4000-9000-000000000001') then
    raise exception 'SMOKE FAIL 1: healthkit disconnect left the row';
  end if;
  begin
    perform public.disconnect_account ('garmin');
    raise exception 'SMOKE FAIL 1: disconnect of absent provider did not raise';
  exception when others then
    if sqlerrm not like '%not connected%' then raise; end if;
  end;
end $$;
rollback;

-- 2. Service paths: Vault round trip, import idempotency, shape checks -------
begin;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current
)
values
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smoke-ia@example.com', '',
   now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Smoke Ia"}',
   now(), now(), '', '', '', '', '');
do $$
declare
  v_id1 uuid; v_id2 uuid;
  v_track1 uuid; v_track2 uuid;
  v_tokens record;
begin
  -- Upsert updates (not duplicates) the Vault secrets.
  v_id1 := public.store_connected_account (
    '00000000-0000-4000-9000-000000000001', 'strava', '4242', array['read'],
    'access-1', 'refresh-1', now() + interval '6 hours');
  v_id2 := public.store_connected_account (
    '00000000-0000-4000-9000-000000000001', 'strava', '4242', array['read'],
    'access-2', 'refresh-2', now() + interval '12 hours');
  if v_id1 <> v_id2 then
    raise exception 'SMOKE FAIL 2: re-store created a second account';
  end if;
  if (select count(*) from vault.secrets
      where name like 'strava:%:00000000-0000-4000-9000-000000000001') <> 2 then
    raise exception 'SMOKE FAIL 2: expected exactly 2 Vault secrets after re-store';
  end if;
  select * into v_tokens from public.get_connected_tokens (
    '00000000-0000-4000-9000-000000000001', 'strava');
  if v_tokens.access_token <> 'access-2' or v_tokens.refresh_token <> 'refresh-2' then
    raise exception 'SMOKE FAIL 2: get_connected_tokens returned stale tokens';
  end if;

  -- Import replay yields the same track id and one row.
  v_track1 := public.import_external_track (
    '00000000-0000-4000-9000-000000000001', 'strava', '9001', 'Morning Run',
    'g_ekFrodw@oFkM', 7300, 2555, 60, now() - interval '2 hours', now() - interval '1 hour');
  v_track2 := public.import_external_track (
    '00000000-0000-4000-9000-000000000001', 'strava', '9001', 'Morning Run',
    'g_ekFrodw@oFkM', 7300, 2555, 60, now() - interval '2 hours', now() - interval '1 hour');
  if v_track1 is null or v_track1 <> v_track2 then
    raise exception 'SMOKE FAIL 2: import replay not idempotent (% vs %)', v_track1, v_track2;
  end if;
  if (select count(*) from public.run_tracks
      where user_id = '00000000-0000-4000-9000-000000000001' and source = 'strava') <> 1 then
    raise exception 'SMOKE FAIL 2: import replay inserted a second row';
  end if;
  if (select last_synced_at from public.connected_accounts
      where user_id = '00000000-0000-4000-9000-000000000001' and provider = 'strava') is null then
    raise exception 'SMOKE FAIL 2: import did not stamp last_synced_at';
  end if;
  begin
    perform public.import_external_track (
      '00000000-0000-4000-9000-000000000001', 'app', '9002', 't', 'poly',
      1000, 600, 0, now() - interval '1 hour', now());
    raise exception 'SMOKE FAIL 2: import accepted source=app';
  exception when others then
    if sqlerrm not like '%source app%' then raise; end if;
  end;

  -- Shape checks: app ⇔ run_id, imported ⇔ external_id.
  begin
    insert into public.run_tracks
      (user_id, source, polyline, distance_m, duration_s,
       avg_pace_s_per_km, started_at, ended_at)
    values ('00000000-0000-4000-9000-000000000001', 'app', 'poly',
            1000, 600, 600, now() - interval '1 hour', now());
    raise exception 'SMOKE FAIL 2: app track without run_id accepted';
  exception when check_violation then null;
  end;
  begin
    update public.run_tracks
    set run_id = gen_random_uuid ()
    where user_id = '00000000-0000-4000-9000-000000000001' and source = 'strava';
    raise exception 'SMOKE FAIL 2: strava track with run_id accepted';
  exception when check_violation or foreign_key_violation then null;
  end;

  -- Webhook delete + disconnect clean up everything.
  perform public.delete_external_track (
    '00000000-0000-4000-9000-000000000001', 'strava', '9001');
  if exists (select 1 from public.run_tracks
             where user_id = '00000000-0000-4000-9000-000000000001' and source = 'strava') then
    raise exception 'SMOKE FAIL 2: delete_external_track left the row';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000001","role":"authenticated"}', true);
select public.disconnect_account ('strava');
reset role;
do $$
begin
  if exists (select 1 from public.connected_accounts
             where user_id = '00000000-0000-4000-9000-000000000001') then
    raise exception 'SMOKE FAIL 2: disconnect left the account row';
  end if;
  if (select count(*) from vault.secrets
      where name like 'strava:%:00000000-0000-4000-9000-000000000001') <> 0 then
    raise exception 'SMOKE FAIL 2: disconnect left Vault secrets behind';
  end if;
end $$;
rollback;

select 'rls_integrations_smoke: all cases passed' as result;
