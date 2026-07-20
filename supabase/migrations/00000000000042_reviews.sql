-- P4 reviews: one-shot rate-the-crew with server-maintained rating caches.
-- Writes only via submit_review() (SECURITY DEFINER); reviews readable by
-- reviewer/reviewee until P5 broadens for public profiles.

alter type public.notification_kind add value if not exists 'review_received';

create table public.reviews (
  id uuid primary key default gen_random_uuid (),
  run_id uuid not null references public.runs (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  -- Parentheses around the length clause are load-bearing: without them AND
  -- binds tighter than OR and the whitelist collapses.
  tags text[] not null default '{}' check (
    tags <@ array['Great pace','Welcoming','On time','Knows the city','Strong runner','Good vibes']::text[]
    and (array_length(tags, 1) is null or array_length(tags, 1) <= 6)
  ),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (run_id, reviewer_id, reviewee_id),
  check (reviewer_id <> reviewee_id)
);

alter table public.reviews enable row level security;

create index reviews_reviewee_idx on public.reviews (reviewee_id);

create policy "reviewer and reviewee can read"
  on public.reviews for select to authenticated
  using (
    reviewer_id = (select auth.uid ())
    or reviewee_id = (select auth.uid ())
  );

-- Rating cache: full recompute per insert — drift-proof, cheap at v1 scale.
create function public.apply_review_rating ()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p
  set rating_avg = sub.avg, rating_count = sub.cnt
  from (
    select round(avg(stars)::numeric, 2) as avg, count(*)::integer as cnt
    from public.reviews where reviewee_id = new.reviewee_id
  ) sub
  where p.id = new.reviewee_id;
  return null;
end; $$;

revoke execute on function public.apply_review_rating () from public, anon, authenticated;

create trigger reviews_apply_rating
  after insert on public.reviews
  for each row execute function public.apply_review_rating ();

-- ---------------------------------------------------------------------------
-- submit_review() — one-shot review + once-per-run rate_crew award. The
-- ledger key is per (user, run, reason), NOT per reviewee, so the +10 lands
-- exactly once per reviewer per run regardless of reviewee count.
-- ---------------------------------------------------------------------------
create function public.submit_review (
  p_run_id uuid,
  p_reviewee_id uuid,
  p_stars integer,
  p_tags text[] default '{}',
  p_note text default ''
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid ());
  v_run public.runs;
  v_review_id uuid;
  v_awarded boolean := false;
  v_reviewer_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select * into v_run from public.runs where id = p_run_id;
  if v_run is null then
    raise exception 'run not found';
  end if;
  if v_run.status <> 'completed' then
    raise exception 'run is not completed';
  end if;
  if p_reviewee_id is null or p_reviewee_id = v_uid then
    raise exception 'invalid reviewee';
  end if;
  if not (v_run.host_id = v_uid or exists (
    select 1 from public.run_members
    where run_id = p_run_id and user_id = v_uid and status = 'approved'
  )) then
    raise exception 'not a participant';
  end if;
  if not (v_run.host_id = p_reviewee_id or exists (
    select 1 from public.run_members
    where run_id = p_run_id and user_id = p_reviewee_id and status = 'approved'
  )) then
    raise exception 'reviewee is not a participant';
  end if;

  begin
    insert into public.reviews (run_id, reviewer_id, reviewee_id, stars, tags, note)
    values (p_run_id, v_uid, p_reviewee_id, p_stars, coalesce(p_tags, '{}'), coalesce(btrim(p_note), ''))
    returning id into v_review_id;
  exception when unique_violation then
    raise exception 'already reviewed this runner';
  end;

  insert into public.points_ledger (user_id, run_id, reason, points)
  values (v_uid, p_run_id, 'rate_crew', 10)
  on conflict (user_id, run_id, reason) do nothing;
  v_awarded := found;

  select display_name into v_reviewer_name from public.profiles where id = v_uid;
  insert into public.notifications (user_id, kind, title, body, run_id, actor_id)
  values (
    p_reviewee_id, 'review_received',
    left(coalesce(v_reviewer_name, 'A runner') || ' rated you', 80),
    left('New review on ' || v_run.title, 200),
    p_run_id, v_uid
  );

  return jsonb_build_object('review_id', v_review_id, 'rate_crew_awarded', v_awarded);
end; $$;

-- ---------------------------------------------------------------------------
-- History RPC (invoker — RLS filters). Backs the Your Runs "Past" tab.
-- ---------------------------------------------------------------------------
create function public.list_past_runs ()
returns table (
  run_id uuid,
  title text,
  type public.run_type,
  starts_at timestamptz,
  area_name text,
  city text,
  distance_km numeric,
  track_id uuid,
  track_distance_m integer,
  track_duration_s integer,
  track_avg_pace_s_per_km integer,
  track_elevation_gain_m integer,
  points_earned bigint,
  my_rating_given numeric,
  peer_names text[],
  peer_avatars text[]
)
language sql security invoker stable set search_path = '' as $$
  with my_runs as (
    select r.* from public.runs r
    where r.status = 'completed'
      and (
        r.host_id = (select auth.uid ())
        or exists (
          select 1 from public.run_members rm
          where rm.run_id = r.id and rm.user_id = (select auth.uid ())
            and rm.status = 'approved'
        )
      )
  ),
  peers as (
    select p.rid,
      (array_agg(pr.display_name order by pr.display_name))[1:3] as names,
      (array_agg(pr.avatar_url order by pr.display_name))[1:3] as avatars
    from (
      select mr.id as rid, mr.host_id as uid from my_runs mr
      union
      select rm.run_id, rm.user_id from public.run_members rm
      where rm.run_id in (select id from my_runs) and rm.status = 'approved'
    ) p
    join public.profiles pr on pr.id = p.uid
    where p.uid <> (select auth.uid ())
    group by p.rid
  )
  select
    mr.id,
    mr.title,
    mr.type,
    mr.starts_at,
    mr.area_name,
    mr.city,
    mr.distance_km,
    t.id,
    t.distance_m,
    t.duration_s,
    t.avg_pace_s_per_km,
    t.elevation_gain_m,
    (select coalesce(sum(l.points), 0) from public.points_ledger l
     where l.user_id = (select auth.uid ()) and l.run_id = mr.id),
    (select round(avg(rv.stars)::numeric, 1) from public.reviews rv
     where rv.run_id = mr.id and rv.reviewer_id = (select auth.uid ())),
    coalesce(peers.names, '{}'),
    coalesce(peers.avatars, '{}')
  from my_runs mr
  left join public.run_tracks t
    on t.run_id = mr.id and t.user_id = (select auth.uid ())
  left join peers on peers.rid = mr.id
  order by mr.starts_at desc;
$$;
