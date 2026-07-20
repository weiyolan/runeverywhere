-- P6 feature flags: remote config flippable without a rebuild/OTA (Strava
-- revocation or an Apple rejection must not brick the app). Read-only to
-- clients; writes happen as postgres (Studio/SQL editor) only.

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z_]{1,40}$'),
  enabled boolean not null default false,
  note text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

create policy "flags are readable by signed-in users"
  on public.feature_flags for select to authenticated
  using (true);

-- The revoke matters: under RLS with no UPDATE policy a client update
-- silently matches zero rows ("UPDATE 0"); revoking the default grants makes
-- it fail loudly with permission denied.
revoke insert, update, delete on public.feature_flags from anon, authenticated;

-- Idempotent, hosted-safe seed — deliberately never overwrites `enabled`.
insert into public.feature_flags (key, enabled, note)
values
  ('healthkit', false, 'P6 Apple Health write'),
  ('strava', false, 'P6 Strava import'),
  ('garmin', false, 'P6 Garmin import')
on conflict (key) do update set note = excluded.note;
