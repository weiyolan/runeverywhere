-- P6 connected accounts: one row per (user, provider). OAuth tokens live in
-- Supabase Vault (encrypted at rest); this table stores only the secret
-- UUIDs, which are unusable without Vault access. All token I/O goes through
-- security-definer functions; the only client-writable surface is the
-- token-less HealthKit INSERT and the disconnect_account RPC.

create type public.integration_provider as enum ('healthkit', 'strava', 'garmin');
-- 'app' = recorded in RE; 'healthkit' reserved for a future import direction.
create type public.track_source as enum ('app', 'healthkit', 'strava', 'garmin');

create table public.connected_accounts (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider public.integration_provider not null,
  -- Strava athlete id / Garmin user id; null for healthkit.
  provider_user_id text,
  scopes text[] not null default '{}',
  -- Vault secret ids — never tokens.
  access_token_secret_id uuid,
  refresh_token_secret_id uuid,
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_error text,
  unique (user_id, provider),
  -- HealthKit is a token-less local grant; OAuth providers carry tokens.
  constraint connected_accounts_token_shape check (
    (provider = 'healthkit') = (
      access_token_secret_id is null
      and refresh_token_secret_id is null
      and provider_user_id is null
    )
  )
);

alter table public.connected_accounts enable row level security;

-- Webhook lookup key + prevents one Strava account linking to two RE users.
create unique index connected_accounts_provider_user_uniq
  on public.connected_accounts (provider, provider_user_id)
  where provider_user_id is not null;

create policy "own connected accounts are readable"
  on public.connected_accounts for select to authenticated
  using (user_id = (select auth.uid ()));

-- HealthKit "connect" is the only client-writable case. No UPDATE, no DELETE
-- (disconnect via RPC; token writes via service_role, which bypasses RLS).
create policy "healthkit connect inserts own row"
  on public.connected_accounts for insert to authenticated
  with check (
    user_id = (select auth.uid ())
    and provider = 'healthkit'
    and access_token_secret_id is null
    and refresh_token_secret_id is null
  );

-- ---------------------------------------------------------------------------
-- Vault token I/O (service_role only). Secret names:
-- '<provider>:access:<user_id>' / '<provider>:refresh:<user_id>'.
-- ---------------------------------------------------------------------------
create function public.store_connected_account (
  p_user_id uuid,
  p_provider public.integration_provider,
  p_provider_user_id text,
  p_scopes text[],
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.connected_accounts;
begin
  select * into v_row from public.connected_accounts
  where user_id = p_user_id and provider = p_provider;

  if v_row.id is null then
    insert into public.connected_accounts (
      user_id, provider, provider_user_id, scopes,
      access_token_secret_id, refresh_token_secret_id, token_expires_at
    )
    values (
      p_user_id, p_provider, p_provider_user_id, coalesce(p_scopes, '{}'),
      vault.create_secret (p_access_token, p_provider || ':access:' || p_user_id),
      vault.create_secret (p_refresh_token, p_provider || ':refresh:' || p_user_id),
      p_expires_at
    )
    returning * into v_row;
  else
    -- Strava rotates refresh tokens — both secrets must be persisted.
    perform vault.update_secret (v_row.access_token_secret_id, p_access_token);
    perform vault.update_secret (v_row.refresh_token_secret_id, p_refresh_token);
    update public.connected_accounts
    set provider_user_id = p_provider_user_id,
        scopes = coalesce(p_scopes, '{}'),
        token_expires_at = p_expires_at,
        last_sync_error = null
    where id = v_row.id;
  end if;

  return v_row.id;
end; $$;

revoke execute on function public.store_connected_account (uuid, public.integration_provider, text, text[], text, text, timestamptz)
  from public, anon, authenticated;

create function public.get_connected_tokens (p_user_id uuid, p_provider public.integration_provider)
returns table (access_token text, refresh_token text, expires_at timestamptz, provider_user_id text)
language sql stable security definer set search_path = '' as $$
  select sa.decrypted_secret, sr.decrypted_secret, ca.token_expires_at, ca.provider_user_id
  from public.connected_accounts ca
  left join vault.decrypted_secrets sa on sa.id = ca.access_token_secret_id
  left join vault.decrypted_secrets sr on sr.id = ca.refresh_token_secret_id
  where ca.user_id = p_user_id and ca.provider = p_provider;
$$;

revoke execute on function public.get_connected_tokens (uuid, public.integration_provider)
  from public, anon, authenticated;

-- One definer path for all disconnects keeps Vault cleanup impossible to
-- forget. User-callable variant:
create function public.disconnect_account (p_provider public.integration_provider)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.connected_accounts;
begin
  select * into v_row from public.connected_accounts
  where user_id = (select auth.uid ()) and provider = p_provider;
  if v_row.id is null then
    raise exception 'not connected';
  end if;
  delete from vault.secrets
  where id in (v_row.access_token_secret_id, v_row.refresh_token_secret_id);
  delete from public.connected_accounts where id = v_row.id;
end; $$;

revoke execute on function public.disconnect_account (public.integration_provider) from anon;

-- Service-role variant for webhook deauthorizations (athlete revoked on the
-- provider's site) and delete-account. Silent no-op when not connected.
create function public.disconnect_account_admin (p_user_id uuid, p_provider public.integration_provider)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.connected_accounts;
begin
  select * into v_row from public.connected_accounts
  where user_id = p_user_id and provider = p_provider;
  if v_row.id is null then
    return;
  end if;
  delete from vault.secrets
  where id in (v_row.access_token_secret_id, v_row.refresh_token_secret_id);
  delete from public.connected_accounts where id = v_row.id;
end; $$;

revoke execute on function public.disconnect_account_admin (uuid, public.integration_provider)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- run_tracks: imported activities. P4 shipped run_id NOT NULL for app
-- recordings (no solo-run entry point) — that still holds via the shape
-- check below, but an imported activity genuinely has no RE run to
-- reference. The P4 unique(run_id, user_id) is unaffected (NULL run_id rows
-- never collide); polyline stays NOT NULL (v1 imports GPS activities only).
-- ---------------------------------------------------------------------------
alter table public.run_tracks
  add column source public.track_source not null default 'app',
  add column external_id text,
  add column title text check (char_length(title) <= 80),
  alter column run_id drop not null;

alter table public.run_tracks
  add constraint run_tracks_source_shape check ((source = 'app') = (run_id is not null)),
  add constraint run_tracks_external_shape check ((source = 'app') = (external_id is null));

create unique index run_tracks_external_uniq
  on public.run_tracks (user_id, source, external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------
-- Import RPCs (service_role only). Postgres owns validation + idempotency;
-- Edge Functions own outbound HTTP + secrets (PLAN.md §2). Clients still
-- never write run_tracks.
-- ---------------------------------------------------------------------------
create function public.import_external_track (
  p_user_id uuid,
  p_source public.track_source,
  p_external_id text,
  p_title text,
  p_polyline text,
  p_distance_m integer,
  p_duration_s integer,
  p_elevation_gain_m integer,
  p_started_at timestamptz,
  p_ended_at timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  -- Validation mirrors complete_run's ranges (and the table checks).
  if p_source = 'app' then
    raise exception 'imports must not use source app';
  end if;
  if p_external_id is null or btrim(p_external_id) = '' then
    raise exception 'external id required';
  end if;
  if p_polyline is null or char_length(p_polyline) not between 1 and 200000 then
    raise exception 'invalid polyline';
  end if;
  if p_distance_m is null or p_distance_m not between 100 and 200000 then
    raise exception 'invalid distance';
  end if;
  if p_duration_s is null or p_duration_s not between 60 and 43200 then
    raise exception 'invalid duration';
  end if;
  if coalesce(p_elevation_gain_m, 0) not between 0 and 10000 then
    raise exception 'invalid elevation gain';
  end if;
  if p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at then
    raise exception 'invalid time range';
  end if;

  -- The `where external_id is not null` predicate is mandatory for Postgres
  -- to infer the partial unique index as the conflict arbiter.
  insert into public.run_tracks (
    user_id, source, external_id, title, polyline, distance_m, duration_s,
    elevation_gain_m, avg_pace_s_per_km, started_at, ended_at
  )
  values (
    p_user_id, p_source, p_external_id, left(p_title, 80), p_polyline,
    p_distance_m, p_duration_s, coalesce(p_elevation_gain_m, 0),
    greatest(1, round(p_duration_s / (p_distance_m / 1000.0)))::integer,
    p_started_at, p_ended_at
  )
  on conflict (user_id, source, external_id) where external_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    -- Idempotent replay: the conflict path still yields the track id.
    select id into v_id from public.run_tracks
    where user_id = p_user_id and source = p_source and external_id = p_external_id;
    return v_id;
  end if;

  update public.connected_accounts
  set last_synced_at = now(), last_sync_error = null
  where user_id = p_user_id
    and provider = p_source::text::public.integration_provider;

  return v_id;
end; $$;

revoke execute on function public.import_external_track (uuid, public.track_source, text, text, text, integer, integer, integer, timestamptz, timestamptz)
  from public, anon, authenticated;

create function public.delete_external_track (p_user_id uuid, p_source public.track_source, p_external_id text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.run_tracks
  where user_id = p_user_id and source = p_source and external_id = p_external_id;
end; $$;

revoke execute on function public.delete_external_track (uuid, public.track_source, text)
  from public, anon, authenticated;
