-- P4 tracks: one row per (run, runner) — encoded polyline + summary stats.
-- Raw GPS samples live gzipped in the private `tracks` bucket for future
-- reprocessing (PLAN.md §2 geo mechanism). Writes happen exclusively inside
-- complete_run() (migration 41).

create table public.run_tracks (
  id uuid primary key default gen_random_uuid (),
  run_id uuid not null references public.runs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  polyline text not null check (char_length(polyline) between 1 and 200000),
  distance_m integer not null check (distance_m between 100 and 200000),
  duration_s integer not null check (duration_s between 60 and 43200),
  elevation_gain_m integer not null default 0 check (elevation_gain_m between 0 and 10000),
  avg_pace_s_per_km integer not null check (avg_pace_s_per_km > 0),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  raw_path text,
  sample_count integer,
  created_at timestamptz not null default now(),
  check (ended_at > started_at),
  -- Completion-idempotency anchor (complete_run upserts on this).
  unique (run_id, user_id)
);

alter table public.run_tracks enable row level security;

create index run_tracks_user_started_idx on public.run_tracks (user_id, started_at desc);

-- GPS tracks are sensitive: own rows only, no co-runner visibility in v1.
create policy "own tracks are readable"
  on public.run_tracks for select to authenticated
  using (user_id = (select auth.uid ()));

-- ---------------------------------------------------------------------------
-- Private raw-GPS bucket. Path convention: tracks/<auth.uid()>/<run_id>.json.gz
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tracks', 'tracks', false, 5242880, array['application/gzip'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "users read their own raw tracks"
  on storage.objects for select to authenticated
  using (bucket_id = 'tracks'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users upload their own raw tracks"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tracks'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users update their own raw tracks"
  on storage.objects for update to authenticated
  using (bucket_id = 'tracks'
    and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'tracks'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users delete their own raw tracks"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tracks'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
