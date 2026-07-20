-- P6.5 RE Pro server mirror. Client entitlement reads come from the
-- RevenueCat SDK; server decisions only ever read profiles.pro_until, which
-- the revenuecat-webhook Edge Function maintains (service role). Client
-- gates are UX, server gates are enforcement (PLAN.md §2).

alter table public.profiles
  add column pro_until timestamptz,
  add column flair_accent text check (flair_accent in ('volt', 'discover', 'challenge', 'social')),
  add column flair_ring boolean not null default false;

-- P0/P1 column-grant pattern: flair is client-writable (guarded below);
-- pro_until deliberately is not — webhook/service-role only.
grant update (flair_accent, flair_ring) on public.profiles to authenticated;

create function public.enforce_flair_requires_pro ()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.flair_accent is distinct from old.flair_accent
      or new.flair_ring is distinct from old.flair_ring)
     and coalesce(new.pro_until, 'epoch'::timestamptz) <= now() then
    raise exception 'pro required';
  end if;
  return new;
end; $$;

revoke execute on function public.enforce_flair_requires_pro () from public, anon, authenticated;

create trigger profiles_flair_requires_pro
  before update on public.profiles
  for each row execute function public.enforce_flair_requires_pro ();

create function public.is_pro (p_user uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select pro_until from public.profiles where id = p_user),
    'epoch'::timestamptz
  ) > now();
$$;

-- ---------------------------------------------------------------------------
-- RevenueCat webhook mirror: raw audit trail + idempotency key (id PK).
-- Service-role only; the revoke makes client access fail loudly instead of
-- returning zero rows.
-- ---------------------------------------------------------------------------
create table public.revenuecat_events (
  id text primary key,
  type text not null,
  app_user_id uuid,
  environment text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table public.revenuecat_events enable row level security;

revoke all on public.revenuecat_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Free-tier history limit: same body as P4's list_past_runs, wrapped so free
-- users get 10 rows and Pro unlimited (SQL `limit null` = no limit).
-- ---------------------------------------------------------------------------
create or replace function public.list_past_runs ()
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
  select * from (
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
      t.id as track_id,
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
    order by mr.starts_at desc
  ) past
  limit case when public.is_pro ((select auth.uid ())) then null else 10 end;
$$;

-- Monetization kill switch (P6 feature_flags pattern): stays OFF on hosted
-- until store approval; flipping it ON is the launch of monetization.
insert into public.feature_flags (key, enabled, note)
values ('monetization', false, 'P6.5 RE Pro paywall + gates')
on conflict (key) do update set note = excluded.note;
