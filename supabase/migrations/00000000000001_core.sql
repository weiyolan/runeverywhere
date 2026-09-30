-- Run Everywhere — migration 0001: core domain
-- Profiles, runs, membership state machine, favorites, geospatial discovery.
-- Later phases add: conversations/messages (P3), tracks/points/reviews (P4),
-- badges/leaderboard/safety (P5), connected accounts (P6).

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.run_type as enum ('discover', 'challenge', 'social');
create type public.run_status as enum ('published', 'cancelled', 'completed');
create type public.run_visibility as enum ('open', 'approval', 'invite');
create type public.member_status as enum ('pending', 'approved', 'declined', 'cancelled', 'removed');
create type public.pace_band as enum ('easy', 'steady', 'quick', 'fast');
create type public.distance_band as enum ('short', 'mid', 'long', 'ultra');
create type public.units_pref as enum ('km', 'mi');
create type public.profile_visibility as enum ('everyone', 'members', 'hidden');

-- ---------------------------------------------------------------------------
-- Profiles (one row per auth user, created by trigger)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_url text,
  home_city text check (char_length(home_city) <= 40),
  home_point extensions.geography (point, 4326),
  pace_band public.pace_band,
  distance_band public.distance_band,
  languages text[] not null default '{}',
  units public.units_pref not null default 'km',
  visibility public.profile_visibility not null default 'everyone',
  -- caches maintained by triggers in later migrations (points ledger, reviews)
  points_total integer not null default 0,
  level integer not null default 1,
  rating_avg numeric(3, 2),
  rating_count integer not null default 0,
  tos_accepted_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by signed-in users"
  on public.profiles for select to authenticated
  using (visibility <> 'hidden' or id = (select auth.uid ()));

create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid ()))
  with check (id = (select auth.uid ()));

create function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

-- ---------------------------------------------------------------------------
-- Runs
-- ---------------------------------------------------------------------------
create table public.runs (
  id uuid primary key default gen_random_uuid (),
  host_id uuid not null references public.profiles (id) on delete cascade,
  type public.run_type not null,
  status public.run_status not null default 'published',
  visibility public.run_visibility not null default 'approval',
  invite_code text unique default encode(extensions.gen_random_bytes(9), 'base64'),
  title text not null check (char_length(title) between 1 and 40),
  goal text not null default '' check (char_length(goal) <= 200),
  start_point extensions.geography (point, 4326) not null,
  area_name text not null default '',
  city text not null default '',
  country_code text not null default '',
  distance_km numeric(4, 1) not null check (distance_km between 1 and 42),
  max_group integer not null check (max_group between 2 and 30),
  target_pace_s_per_km integer check (target_pace_s_per_km between 120 and 720),
  starts_at timestamptz not null,
  closed_loop boolean not null default false,
  points_reward integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index runs_start_point_idx on public.runs using gist (start_point);
create index runs_starts_at_idx on public.runs (starts_at);
create index runs_host_idx on public.runs (host_id);
create index runs_title_trgm_idx on public.runs using gin (title extensions.gin_trgm_ops);

alter table public.runs enable row level security;

-- ---------------------------------------------------------------------------
-- Membership / join-request state machine
--   pending → approved | declined ; pending|approved → cancelled (runner)
--   approved → removed (host). Writes go through RPCs only.
-- (Created before the runs policies below, which depend on it.)
-- ---------------------------------------------------------------------------
create table public.run_members (
  run_id uuid not null references public.runs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.member_status not null default 'pending',
  intro_message text not null default '' check (char_length(intro_message) <= 240),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id),
  primary key (run_id, user_id)
);

create index run_members_user_idx on public.run_members (user_id);

alter table public.run_members enable row level security;

-- Membership lookup used by RLS below; security definer to avoid recursive RLS.
create function public.is_run_member (p_run_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.run_members m
    where m.run_id = p_run_id
      and m.user_id = p_user_id
      and m.status in ('pending', 'approved')
  );
$$;

create policy "discoverable or own or joined runs are readable"
  on public.runs for select to authenticated
  using (
    visibility in ('open', 'approval')
    or host_id = (select auth.uid ())
    or public.is_run_member (id, (select auth.uid ()))
  );

create policy "hosts create their own runs"
  on public.runs for insert to authenticated
  with check (host_id = (select auth.uid ()));

create policy "hosts update their own runs"
  on public.runs for update to authenticated
  using (host_id = (select auth.uid ()))
  with check (host_id = (select auth.uid ()));

-- Invite-only runs are resolved by code without exposing them in listings.
create function public.get_run_by_invite (p_code text)
returns setof public.runs
language sql
security definer
set search_path = ''
stable
as $$
  select * from public.runs
  where invite_code = p_code and status = 'published';
$$;

-- Server-authoritative points preview/award formula (design: base + km × 18
-- + type bonus). Single source of truth for the Create review step and the
-- completion award in Phase 4.
create function public.compute_points_reward (p_distance_km numeric, p_type public.run_type)
returns integer
language sql
immutable
as $$
  select round(p_distance_km * 18)::integer
    + case p_type when 'challenge' then 40 when 'discover' then 15 else 0 end;
$$;

create function public.set_run_points_reward ()
returns trigger
language plpgsql
as $$
begin
  new.points_reward := public.compute_points_reward (new.distance_km, new.type);
  return new;
end;
$$;

create trigger runs_points_reward
  before insert or update of distance_km, type on public.runs
  for each row execute function public.set_run_points_reward ();

-- ---------------------------------------------------------------------------
-- Membership policies + RPCs
-- ---------------------------------------------------------------------------
create policy "own membership, host, and co-members can read"
  on public.run_members for select to authenticated
  using (
    user_id = (select auth.uid ())
    or exists (
      select 1 from public.runs r
      where r.id = run_id and r.host_id = (select auth.uid ())
    )
    or public.is_run_member (run_id, (select auth.uid ()))
  );
-- No insert/update/delete policies: all writes via the definer RPCs below.

-- Request to join (or instantly join an open run). Capacity-safe via row lock.
create function public.join_run (p_run_id uuid, p_intro_message text default '')
returns public.run_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.runs;
  v_uid uuid := (select auth.uid ());
  v_approved_count integer;
  v_row public.run_members;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_run from public.runs where id = p_run_id for update;
  if not found or v_run.status <> 'published' then
    raise exception 'run not open for joining';
  end if;
  if v_run.host_id = v_uid then
    raise exception 'hosts are already in their own run';
  end if;
  if v_run.starts_at < now() then
    raise exception 'run already started';
  end if;

  select count(*) into v_approved_count
  from public.run_members
  where run_id = p_run_id and status = 'approved';

  if v_run.visibility = 'open' or v_run.visibility = 'invite' then
    if v_approved_count + 1 >= v_run.max_group then
      raise exception 'run is full';
    end if;
    insert into public.run_members (run_id, user_id, status, intro_message, decided_at)
    values (p_run_id, v_uid, 'approved', coalesce(p_intro_message, ''), now())
    on conflict (run_id, user_id) do update
      set status = 'approved', decided_at = now()
      where run_members.status in ('cancelled', 'declined')
    returning * into v_row;
  else
    insert into public.run_members (run_id, user_id, status, intro_message)
    values (p_run_id, v_uid, 'pending', coalesce(p_intro_message, ''))
    on conflict (run_id, user_id) do update
      set status = 'pending', intro_message = excluded.intro_message, requested_at = now()
      where run_members.status in ('cancelled', 'declined')
    returning * into v_row;
  end if;

  if v_row is null then
    raise exception 'already requested or joined';
  end if;
  return v_row;
end;
$$;

-- Host decision on a pending request. Approval is capacity-safe.
create function public.respond_to_join_request (
  p_run_id uuid,
  p_user_id uuid,
  p_approve boolean
)
returns public.run_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.runs;
  v_uid uuid := (select auth.uid ());
  v_approved_count integer;
  v_row public.run_members;
begin
  select * into v_run from public.runs where id = p_run_id for update;
  if not found or v_run.host_id <> v_uid then
    raise exception 'only the host can decide requests';
  end if;

  if p_approve then
    select count(*) into v_approved_count
    from public.run_members
    where run_id = p_run_id and status = 'approved';
    if v_approved_count + 1 >= v_run.max_group then
      raise exception 'run is full';
    end if;
  end if;

  update public.run_members
  set status = case when p_approve then 'approved' else 'declined' end::public.member_status,
      decided_at = now(),
      decided_by = v_uid
  where run_id = p_run_id and user_id = p_user_id and status = 'pending'
  returning * into v_row;

  if v_row is null then
    raise exception 'no pending request for that runner';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  run_id uuid not null references public.runs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, run_id)
);

alter table public.favorites enable row level security;

create policy "favorites are private to their owner"
  on public.favorites for all to authenticated
  using (user_id = (select auth.uid ()))
  with check (user_id = (select auth.uid ()));

-- ---------------------------------------------------------------------------
-- Discovery: runs near a location, with the Explore filter set.
-- ---------------------------------------------------------------------------
create function public.runs_within_radius (
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision default 15000,
  p_types public.run_type[] default null,
  p_from timestamptz default now(),
  p_to timestamptz default null,
  p_closed_loop boolean default null,
  p_only_open_spots boolean default false
)
returns table (
  run public.runs,
  distance_m double precision,
  approved_count bigint
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    r as run,
    extensions.st_distance (
      r.start_point,
      extensions.st_setsrid (extensions.st_makepoint (p_lng, p_lat), 4326)::extensions.geography
    ) as distance_m,
    (
      select count(*) from public.run_members m
      where m.run_id = r.id and m.status = 'approved'
    ) as approved_count
  from public.runs r
  where r.status = 'published'
    and r.visibility in ('open', 'approval')
    and r.starts_at >= p_from
    and (p_to is null or r.starts_at <= p_to)
    and (p_types is null or r.type = any (p_types))
    and (p_closed_loop is null or r.closed_loop = p_closed_loop)
    and extensions.st_dwithin (
      r.start_point,
      extensions.st_setsrid (extensions.st_makepoint (p_lng, p_lat), 4326)::extensions.geography,
      p_radius_m
    )
    and (
      not p_only_open_spots
      or (
        select count(*) from public.run_members m
        where m.run_id = r.id and m.status = 'approved'
      ) + 1 < r.max_group
    )
  order by distance_m asc;
$$;
