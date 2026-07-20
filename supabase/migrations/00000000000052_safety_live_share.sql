-- P5 safety: trusted contacts, tokenized live-share sessions + latest
-- location, live_share_auto profile toggle. The share page itself is the
-- live-share-page Edge Function (service-role reads; contacts never log in).

create table public.safety_contacts (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  phone text not null check (char_length(phone) between 5 and 24),
  label text not null default '' check (char_length(label) <= 30),
  is_emergency boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.safety_contacts enable row level security;

-- The "+1 emergency" rule.
create unique index safety_contacts_one_emergency_idx
  on public.safety_contacts (user_id) where is_emergency;

create policy "own safety contacts"
  on public.safety_contacts for all to authenticated
  using (user_id = (select auth.uid ()))
  with check (user_id = (select auth.uid ()));

-- ≤5 trusted (non-emergency) contacts.
create function public.enforce_trusted_limit ()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.is_emergency and (
    select count(*) from public.safety_contacts
    where user_id = new.user_id and not is_emergency and id <> new.id
  ) >= 5 then
    raise exception 'trusted contact limit reached';
  end if;
  return new;
end; $$;

revoke execute on function public.enforce_trusted_limit () from public, anon, authenticated;

create trigger safety_contacts_limit
  before insert or update on public.safety_contacts
  for each row execute function public.enforce_trusted_limit ();

-- ---------------------------------------------------------------------------
-- Live share sessions — one active per user, unguessable 32-hex token.
-- ---------------------------------------------------------------------------
create table public.live_share_sessions (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  run_id uuid references public.runs (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours',
  ended_at timestamptz
);

alter table public.live_share_sessions enable row level security;

create unique index live_share_sessions_active_idx
  on public.live_share_sessions (user_id) where ended_at is null;

create policy "own share sessions are readable"
  on public.live_share_sessions for select to authenticated
  using (user_id = (select auth.uid ()));

create function public.start_live_share (p_run_id uuid default null)
returns public.live_share_sessions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid ());
  v_row public.live_share_sessions;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  -- Race-safe via the partial unique index.
  insert into public.live_share_sessions (user_id, run_id)
  values (v_uid, p_run_id)
  on conflict (user_id) where ended_at is null do nothing;

  update public.live_share_sessions
  set expires_at = greatest(expires_at, now() + interval '12 hours'),
      run_id = coalesce(p_run_id, run_id)
  where user_id = v_uid and ended_at is null
  returning * into v_row;
  return v_row;
end; $$;

create function public.end_live_share ()
returns void
language sql security definer set search_path = '' as $$
  update public.live_share_sessions
  set ended_at = now()
  where user_id = (select auth.uid ()) and ended_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Latest point per session (single row; client upserts ≤ every 20 s).
-- ---------------------------------------------------------------------------
create table public.live_locations (
  session_id uuid primary key references public.live_share_sessions (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m double precision,
  distance_km numeric(5, 2),
  elapsed_s integer,
  recorded_at timestamptz not null default now()
);

alter table public.live_locations enable row level security;

create policy "runners write their own live location"
  on public.live_locations for all to authenticated
  using (exists (
    select 1 from public.live_share_sessions s
    where s.id = session_id and s.user_id = (select auth.uid ())
      and s.ended_at is null and s.expires_at > now()
  ))
  with check (exists (
    select 1 from public.live_share_sessions s
    where s.id = session_id and s.user_id = (select auth.uid ())
      and s.ended_at is null and s.expires_at > now()
  ));

-- ---------------------------------------------------------------------------
-- Auto-share toggle. Explicit column grant — P1 revoked table-wide UPDATE on
-- profiles and re-granted a fixed list, so new client-written columns must be
-- granted or the toggle fails with permission denied.
-- ---------------------------------------------------------------------------
alter table public.profiles add column live_share_auto boolean not null default false;
grant update (live_share_auto) on public.profiles to authenticated;
