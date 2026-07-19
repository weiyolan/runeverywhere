-- P5 gamification: badge catalog + award engine on the P4 ledger, level
-- titles, ISO-week × city leaderboard behind get_leaderboard.

alter type public.notification_kind add value if not exists 'badge_earned';

-- ---------------------------------------------------------------------------
-- Catalog + earned tables
-- ---------------------------------------------------------------------------
create table public.badges (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null,   -- lucide kebab name
  color text not null,  -- theme token key
  sort integer not null,
  active boolean not null default true
);

alter table public.badges enable row level security;

create policy "badge catalog is readable"
  on public.badges for select to authenticated
  using (true);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_code text not null references public.badges (code),
  run_id uuid references public.runs (id) on delete set null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

alter table public.user_badges enable row level security;

create index user_badges_user_idx on public.user_badges (user_id);

create policy "earned badges follow profile visibility"
  on public.user_badges for select to authenticated
  using (public.can_view_profile (user_id));

insert into public.badges (code, name, description, icon, color, sort) values
  ('first_run', 'FIRST STEPS', 'Finish your first run', 'footprints', 'go', 1),
  ('five_runs', 'REGULAR', 'Finish 5 runs', 'repeat', 'discover', 2),
  ('twenty_runs', 'RELENTLESS', 'Finish 20 runs', 'flame', 'challenge', 3),
  ('first_host', 'HOST', 'Host your first completed run', 'flag', 'volt', 4),
  ('five_hosts', 'COMMUNITY BUILDER', 'Host 5 completed runs', 'users', 'social', 5),
  ('marathon_total', '42K CLUB', 'Log 42.2 km total', 'medal', 'warn', 6),
  ('hundred_k', '100K CLUB', 'Log 100 km total', 'trophy', 'go', 7),
  ('early_bird', 'EARLY BIRD', 'Finish 5 runs starting before 07:00 local', 'sunrise', 'warn', 8),
  ('sunset_club', 'SUNSET CLUB', 'Finish 5 runs starting at/after 19:00 local', 'sunset', 'challenge', 9),
  ('explorer_3', 'EXPLORER', 'Finish runs in 3 different cities', 'map-pin', 'discover', 10),
  ('hill_crusher', 'HILL CRUSHER', 'Climb 1,000 m D+ total', 'mountain', 'social', 11),
  ('crew_rater', 'GOOD CREW', 'Rate 10 crew members', 'star', 'star', 12)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  sort = excluded.sort;

-- Level titles (P4 seeded '' — display-only copy for the level card/hero).
update public.levels l
set title = v.title
from (values
  (1, 'Rookie'), (2, 'Jogger'), (3, 'Pacer'), (4, 'Tempo'), (5, 'Strider'),
  (6, 'Racer'), (7, 'Pacesetter'), (8, 'Frontrunner'), (9, 'Elite'), (10, 'Legend')
) as v (level, title)
where l.level = v.level;

-- ---------------------------------------------------------------------------
-- Award engine
-- ---------------------------------------------------------------------------
-- Longitude/15 timezone approximation — honest v1 for dawn/dusk badges.
create function public.run_local_hour (p_starts_at timestamptz, p_point extensions.geography)
returns integer
language sql immutable set search_path = '' as $$
  select extract(hour from (p_starts_at at time zone 'utc')
    + make_interval(hours => round(extensions.st_x (p_point::extensions.geometry) / 15.0)::integer))::integer;
$$;

create function public.award_badges (p_user_id uuid, p_run_id uuid default null)
returns setof text
language plpgsql security definer set search_path = '' as $$
declare
  v_finished integer;
  v_cities integer;
  v_hosted integer;
  v_dawn integer;
  v_dusk integer;
  v_distance integer;
  v_dplus integer;
  v_reviews integer;
  v_code text;
  v_badge public.badges;
begin
  select count(*), count(distinct r.city),
         count(*) filter (where public.run_local_hour (r.starts_at, r.start_point) < 7),
         count(*) filter (where public.run_local_hour (r.starts_at, r.start_point) >= 19)
  into v_finished, v_cities, v_dawn, v_dusk
  from public.points_ledger pl
  join public.runs r on r.id = pl.run_id
  where pl.user_id = p_user_id and pl.reason = 'finished';

  select count(*) into v_hosted
  from public.points_ledger pl
  join public.runs r on r.id = pl.run_id
  where pl.user_id = p_user_id and pl.reason = 'finished' and r.host_id = p_user_id;

  select coalesce(sum(distance_m), 0), coalesce(sum(elevation_gain_m), 0)
  into v_distance, v_dplus
  from public.run_tracks
  where user_id = p_user_id;

  select count(*) into v_reviews from public.reviews where reviewer_id = p_user_id;

  for v_code in
    select code from public.badges b
    where b.active and (
      (b.code = 'first_run' and v_finished >= 1)
      or (b.code = 'five_runs' and v_finished >= 5)
      or (b.code = 'twenty_runs' and v_finished >= 20)
      or (b.code = 'first_host' and v_hosted >= 1)
      or (b.code = 'five_hosts' and v_hosted >= 5)
      or (b.code = 'marathon_total' and v_distance >= 42200)
      or (b.code = 'hundred_k' and v_distance >= 100000)
      or (b.code = 'early_bird' and v_dawn >= 5)
      or (b.code = 'sunset_club' and v_dusk >= 5)
      or (b.code = 'explorer_3' and v_cities >= 3)
      or (b.code = 'hill_crusher' and v_dplus >= 1000)
      or (b.code = 'crew_rater' and v_reviews >= 10)
    )
  loop
    insert into public.user_badges (user_id, badge_code, run_id)
    values (p_user_id, v_code, p_run_id)
    on conflict do nothing;
    if found then
      select * into v_badge from public.badges where code = v_code;
      insert into public.notifications (user_id, kind, title, body, run_id)
      values (
        p_user_id, 'badge_earned', 'Badge earned',
        left(v_badge.name || ' — ' || v_badge.description, 200), p_run_id
      );
      return next v_code;
    end if;
  end loop;
  return;
end; $$;

revoke execute on function public.award_badges (uuid, uuid) from public, anon, authenticated;

create function public.handle_ledger_badges ()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.award_badges (new.user_id, new.run_id);
  return null;
end; $$;

create function public.handle_review_badges ()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.award_badges (new.reviewer_id, new.run_id);
  return null;
end; $$;

revoke execute on function public.handle_ledger_badges () from public, anon, authenticated;
revoke execute on function public.handle_review_badges () from public, anon, authenticated;

create trigger points_ledger_badges
  after insert on public.points_ledger
  for each row execute function public.handle_ledger_badges ();

create trigger reviews_badges
  after insert on public.reviews
  for each row execute function public.handle_review_badges ();

-- Indexes the award counts lean on.
create index if not exists points_ledger_user_idx on public.points_ledger (user_id);
create index if not exists run_tracks_user_idx on public.run_tracks (user_id);
create index if not exists reviews_reviewer_idx on public.reviews (reviewer_id);

-- ---------------------------------------------------------------------------
-- Leaderboard: plain view (per-viewer block filtering can't be materialized),
-- direct SELECT revoked — get_leaderboard is the only door.
-- ---------------------------------------------------------------------------
create view public.leaderboard_weekly as
select
  (date_trunc('week', pl.created_at at time zone 'utc'))::date as week_start,
  to_char(pl.created_at at time zone 'utc', 'IYYY-"W"IW') as iso_week,
  btrim(p.home_city) as city,
  pl.user_id,
  p.display_name,
  p.avatar_url,
  p.level,
  sum(pl.points)::integer as points,
  count(distinct pl.run_id) filter (where pl.reason = 'finished') as runs_count
from public.points_ledger pl
join public.profiles p on p.id = pl.user_id
where p.visibility <> 'hidden'
  and nullif(btrim(p.home_city), '') is not null
group by 1, 2, 3, 4, 5, 6, 7;

revoke all on public.leaderboard_weekly from anon, authenticated;

create function public.get_leaderboard (
  p_city text default null,
  p_week_start date default null
) returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  avatar_url text,
  level integer,
  points integer,
  runs_count bigint,
  is_me boolean
)
language plpgsql security definer stable set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid ());
  v_city text;
  v_week date;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  v_city := coalesce(
    nullif(btrim(p_city), ''),
    (select btrim(home_city) from public.profiles where id = v_uid)
  );
  v_week := coalesce(p_week_start, (date_trunc('week', now() at time zone 'utc'))::date);

  return query
  with ranked as (
    select
      rank() over (order by lw.points desc, lw.runs_count desc, lw.display_name) as r,
      lw.user_id as uid, lw.display_name as dn, lw.avatar_url as av,
      lw.level as lv, lw.points as pts, lw.runs_count as rc
    from public.leaderboard_weekly lw
    where lw.week_start = v_week
      and lw.city = v_city
      and not public.is_blocked_pair (lw.user_id, v_uid)
  )
  select ranked.r, ranked.uid, ranked.dn, ranked.av, ranked.lv, ranked.pts,
         ranked.rc, ranked.uid = v_uid
  from ranked
  where ranked.r <= 100 or ranked.uid = v_uid
  order by ranked.r;
end; $$;

revoke execute on function public.get_leaderboard (text, date) from anon;

-- ---------------------------------------------------------------------------
-- Profile stats (single meters→km conversion point).
-- ---------------------------------------------------------------------------
create function public.get_profile_stats (p_user_id uuid)
returns table (runs_count bigint, total_km numeric, total_dplus numeric)
language sql security definer stable set search_path = '' as $$
  select count(*)::bigint,
         round(coalesce(sum(distance_m), 0) / 1000.0, 1),
         coalesce(sum(elevation_gain_m), 0)::numeric
  from public.run_tracks
  where user_id = p_user_id
  -- No row at all for unviewable profiles — a real zero must stay
  -- distinguishable from hidden/blocked (P5 B4).
  having public.can_view_profile (p_user_id);
$$;
