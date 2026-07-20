-- P4 points engine: levels reference, append-only ledger, complete_run().
-- Client never writes points (PLAN.md §2); the definer trigger bypasses P1's
-- column-grant lockdown on profiles by ownership.

alter type public.notification_kind add value if not exists 'run_completed';

-- ---------------------------------------------------------------------------
-- Levels (reference data — lives in the migration, not seed, so hosted has it)
-- ---------------------------------------------------------------------------
create table public.levels (
  level integer primary key,
  min_points integer not null unique check (min_points >= 0),
  title text not null default ''
);

alter table public.levels enable row level security;

create policy "levels are readable"
  on public.levels for select to authenticated
  using (true);

insert into public.levels (level, min_points) values
  (1, 0), (2, 300), (3, 750), (4, 1200), (5, 1800),
  (6, 2600), (7, 3600), (8, 4800), (9, 6200), (10, 8000)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Ledger — append-only; unique (user, run, reason) is the idempotency contract
-- ---------------------------------------------------------------------------
create type public.points_reason as enum ('finished', 'distance_goal', 'on_time', 'rate_crew');

create table public.points_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  run_id uuid not null references public.runs (id) on delete cascade,
  reason public.points_reason not null,
  points integer not null check (points > 0),
  created_at timestamptz not null default now(),
  unique (user_id, run_id, reason)
);

alter table public.points_ledger enable row level security;

create index points_ledger_user_created_idx on public.points_ledger (user_id, created_at desc);

create policy "own ledger rows are readable"
  on public.points_ledger for select to authenticated
  using (user_id = (select auth.uid ()));

-- Cache trigger: profiles.points_total/level always equal the ledger.
create function public.apply_points_ledger ()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p
  set points_total = p.points_total + new.points,
      level = (
        select coalesce(max(l.level), 1) from public.levels l
        where l.min_points <= p.points_total + new.points
      )
  where p.id = new.user_id;
  return null;
end; $$;

revoke execute on function public.apply_points_ledger () from public, anon, authenticated;

create trigger points_ledger_apply
  after insert on public.points_ledger
  for each row execute function public.apply_points_ledger ();

-- ---------------------------------------------------------------------------
-- complete_run() — the points engine (C4). Decomposition decision:
-- runs.points_reward is the max earnable; finished = greatest(reward-40, 50),
-- the 40 reserved for distance_goal(20) + on_time(10) + rate_crew(10).
-- ---------------------------------------------------------------------------
create function public.complete_run (
  p_run_id uuid,
  p_polyline text,
  p_distance_m integer,
  p_duration_s integer,
  p_elevation_gain_m integer,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_raw_path text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid ());
  v_run public.runs;
  v_track public.run_tracks;
  v_awards jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_finished integer;
  v_member record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_run from public.runs where id = p_run_id for update;
  if v_run is null then
    raise exception 'run not found';
  end if;
  if v_run.status = 'cancelled' then
    raise exception 'run was cancelled';
  end if;
  if v_run.host_id <> v_uid and not exists (
    select 1 from public.run_members
    where run_id = p_run_id and user_id = v_uid and status = 'approved'
  ) then
    raise exception 'not a participant';
  end if;
  if now() < v_run.starts_at - interval '30 minutes' then
    raise exception 'run has not started';
  end if;

  -- Payload validation
  if p_distance_m is null or p_distance_m not between 100 and 200000 then
    raise exception 'invalid distance';
  end if;
  if p_duration_s is null or p_duration_s not between 60 and 43200 then
    raise exception 'invalid duration';
  end if;
  if p_elevation_gain_m is null or p_elevation_gain_m not between 0 and 10000 then
    raise exception 'invalid elevation gain';
  end if;
  if p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at then
    raise exception 'invalid time window';
  end if;
  if p_started_at <= now() - interval '2 days' then
    raise exception 'recording too old';
  end if;
  -- Duration is moving time; it must fit inside the wall-clock window.
  if p_duration_s > extract(epoch from p_ended_at - p_started_at) + 60 then
    raise exception 'duration exceeds time window';
  end if;
  if p_polyline is null or char_length(p_polyline) not between 1 and 200000 then
    raise exception 'invalid polyline';
  end if;
  -- The only object the caller's storage policies allow anyway — keeps
  -- raw_path a trustworthy pointer for P6 export reads, not free text.
  if p_raw_path is not null
     and p_raw_path <> v_uid::text || '/' || p_run_id || '.json.gz' then
    raise exception 'invalid raw path';
  end if;

  insert into public.run_tracks (
    run_id, user_id, polyline, distance_m, duration_s, elevation_gain_m,
    avg_pace_s_per_km, started_at, ended_at, raw_path
  ) values (
    p_run_id, v_uid, p_polyline, p_distance_m, p_duration_s, p_elevation_gain_m,
    round(p_duration_s / (p_distance_m / 1000.0)), p_started_at, p_ended_at, p_raw_path
  )
  on conflict (run_id, user_id) do nothing
  returning * into v_track;

  if v_track is null then
    -- Idempotent replay: return the original result, write nothing.
    select * into v_track from public.run_tracks
    where run_id = p_run_id and user_id = v_uid;
    select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'points', points)), '[]'::jsonb),
           coalesce(sum(points), 0)
    into v_awards, v_total
    from public.points_ledger
    where user_id = v_uid and run_id = p_run_id and reason <> 'rate_crew';
    return jsonb_build_object(
      'track_id', v_track.id,
      'distance_m', v_track.distance_m,
      'duration_s', v_track.duration_s,
      'elevation_gain_m', v_track.elevation_gain_m,
      'avg_pace_s_per_km', v_track.avg_pace_s_per_km,
      'awards', v_awards,
      'total_awarded', v_total,
      'already_completed', true
    );
  end if;

  v_finished := greatest(v_run.points_reward - 40, 50);
  insert into public.points_ledger (user_id, run_id, reason, points)
  values (v_uid, p_run_id, 'finished', v_finished)
  on conflict do nothing;
  v_awards := v_awards || jsonb_build_object('reason', 'finished', 'points', v_finished);
  v_total := v_total + v_finished;

  if p_distance_m >= v_run.distance_km * 1000 * 0.95 then
    insert into public.points_ledger (user_id, run_id, reason, points)
    values (v_uid, p_run_id, 'distance_goal', 20)
    on conflict do nothing;
    v_awards := v_awards || jsonb_build_object('reason', 'distance_goal', 'points', 20);
    v_total := v_total + 20;
  end if;

  if p_started_at <= v_run.starts_at + interval '10 minutes' then
    insert into public.points_ledger (user_id, run_id, reason, points)
    values (v_uid, p_run_id, 'on_time', 10)
    on conflict do nothing;
    v_awards := v_awards || jsonb_build_object('reason', 'on_time', 'points', 10);
    v_total := v_total + 10;
  end if;

  if v_run.status = 'published' then
    update public.runs set status = 'completed' where id = p_run_id;
    for v_member in
      select user_id from (
        select v_run.host_id as user_id
        union
        select rm.user_id from public.run_members rm
        where rm.run_id = p_run_id and rm.status = 'approved'
      ) participants
      where user_id <> v_uid
    loop
      insert into public.notifications (user_id, kind, title, body, run_id, actor_id)
      values (
        v_member.user_id, 'run_completed',
        left(v_run.title || ' is done', 80),
        'Rate the crew to earn +10 pts',
        p_run_id, v_uid
      );
    end loop;
  end if;

  return jsonb_build_object(
    'track_id', v_track.id,
    'distance_m', v_track.distance_m,
    'duration_s', v_track.duration_s,
    'elevation_gain_m', v_track.elevation_gain_m,
    'avg_pace_s_per_km', v_track.avg_pace_s_per_km,
    'awards', v_awards,
    'total_awarded', v_total,
    'already_completed', false
  );
end; $$;
