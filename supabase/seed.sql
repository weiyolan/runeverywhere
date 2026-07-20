-- Run Everywhere — local development seed.
-- Levels + demo users + fixture runs in Lisbon. Applied by `supabase db reset`.
-- NOTE: level/badge *tables* land with the Phase 4/5 migrations; this seed
-- only creates auth users, profiles and runs that exist in migration 0001.

-- Two demo users (password: "password123" — local dev only).
-- GoTrue's varchar token columns are set to '' (not NULL) and each user gets
-- a matching auth.identities row — direct auth.users inserts without either
-- break the password grant on recent GoTrue versions.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current
)
values
  (
    '00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'maya@example.com',
    extensions.crypt ('password123', extensions.gen_salt ('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Maya Lawson"}', now(), now(),
    '', '', '', '', ''
  ),
  (
    '00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'marco@example.com',
    extensions.crypt ('password123', extensions.gen_salt ('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Marco R."}', now(), now(),
    '', '', '', '', ''
  ),
  (
    '00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'nadia@example.com',
    extensions.crypt ('password123', extensions.gen_salt ('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Nadia K."}', now(), now(),
    '', '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001', 'email',
    '{"sub":"00000000-0000-4000-8000-000000000001","email":"maya@example.com","email_verified":true}',
    now(), now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002', 'email',
    '{"sub":"00000000-0000-4000-8000-000000000002","email":"marco@example.com","email_verified":true}',
    now(), now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003', 'email',
    '{"sub":"00000000-0000-4000-8000-000000000003","email":"nadia@example.com","email_verified":true}',
    now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

update public.profiles
set home_city = 'Lisbon',
    home_point = extensions.st_setsrid (extensions.st_makepoint (-9.1393, 38.7223), 4326)::extensions.geography,
    pace_band = 'steady',
    languages = '{EN,PT}',
    onboarded_at = now(),
    tos_accepted_at = now()
where id in (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003'
);

-- Three fixture runs around Lisbon (Alfama, Monsanto, Belém)
insert into public.runs (
  id, host_id, type, visibility, title, goal, start_point, area_name, city,
  country_code, distance_km, max_group, target_pace_s_per_km, starts_at, closed_loop
)
values
  (
    '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
    'discover', 'approval', 'Old Town Loop',
    'Training for an ultra, easy effort to see the old town.',
    extensions.st_setsrid (extensions.st_makepoint (-9.1300, 38.7139), 4326)::extensions.geography,
    'Alfama', 'Lisbon', 'PT', 7.5, 8, 360, now() + interval '2 days', true
  ),
  (
    '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002',
    'challenge', 'approval', 'Monsanto Hills',
    'Hard tempo on the climbs — bring your legs.',
    extensions.st_setsrid (extensions.st_makepoint (-9.1870, 38.7280), 4326)::extensions.geography,
    'Monsanto', 'Lisbon', 'PT', 12.0, 6, 270, now() + interval '3 days', false
  ),
  (
    '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
    'social', 'open', 'Sunset 5K',
    'Easy effort, coffee after.',
    extensions.st_setsrid (extensions.st_makepoint (-9.2033, 38.6970), 4326)::extensions.geography,
    'Belém', 'Lisbon', 'PT', 5.2, 12, 390, now() + interval '1 day', true
  )
on conflict (id) do nothing;

-- Invite-only run with a deterministic code for deep-link testing
-- (runeverywhere://invite/DEVLINK01). Hidden from Explore/search by RLS.
insert into public.runs (
  id, host_id, type, visibility, invite_code, title, goal, start_point,
  area_name, city, country_code, distance_km, max_group,
  target_pace_s_per_km, starts_at, closed_loop
)
values
  (
    '10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001',
    'challenge', 'invite', 'DEVLINK01', 'Track Repeats',
    '6×800m on the track — bring spikes if you have them.',
    extensions.st_setsrid (extensions.st_makepoint (-9.1650, 38.7420), 4326)::extensions.geography,
    'Campolide', 'Lisbon', 'PT', 8.0, 4, 240, now() + interval '4 days', true
  )
on conflict (id) do nothing;

-- Membership fixtures: a pending inbox item for marco (Old Town Loop), an
-- approved roster row on Sunset 5K, and a second pending member there so the
-- capacity smoke case has an approved AND a pending non-host member at once.
insert into public.run_members (run_id, user_id, status, intro_message, decided_at, decided_by)
values
  (
    '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
    'pending', 'New in Lisbon this week and keen to explore with locals.', null, null
  ),
  (
    '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002',
    'approved', '', now(), '00000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003',
    'pending', 'Visiting for the weekend — easy pace suits me.', null, null
  )
on conflict (run_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- P3 chat fixtures (A10). Maya approved into both of marco's runs: UPDATE her
-- existing pending Old Town row (exercises the pending→approved trigger path)
-- and INSERT a fresh approved Monsanto row (direct-join trigger path). Both
-- fire the conversation-membership + system-message triggers.
-- ---------------------------------------------------------------------------
update public.run_members
set status = 'approved', decided_at = now(), decided_by = '00000000-0000-4000-8000-000000000002'
where run_id = '10000000-0000-4000-8000-000000000001'
  and user_id = '00000000-0000-4000-8000-000000000001'
  and status = 'pending';

insert into public.run_members (run_id, user_id, status, intro_message, decided_at, decided_by)
values (
  '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
  'approved', 'Hill repeats sound great.', now(), '00000000-0000-4000-8000-000000000002'
)
on conflict (run_id, user_id) do nothing;

-- Meeting point + a short exchange in the Old Town Loop chat.
insert into public.messages (conversation_id, sender_id, kind, body)
select c.id, '00000000-0000-4000-8000-000000000002', 'meeting_point',
       'Praça do Comércio · arch · 7:50'
from public.conversations c
where c.run_id = '10000000-0000-4000-8000-000000000001';

insert into public.messages (conversation_id, sender_id, kind, body)
select c.id, m.sender, 'user', m.body
from public.conversations c,
  (values
    ('00000000-0000-4000-8000-000000000002'::uuid, 'Welcome Maya — easy pace, lots of views.'),
    ('00000000-0000-4000-8000-000000000001'::uuid, 'Perfect, first time in Alfama!'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'Bring water, the climbs sneak up on you.')
  ) as m (sender, body)
where c.run_id = '10000000-0000-4000-8000-000000000001';

-- Leave the last message unread for maya (unread pill + notification demo).
update public.conversation_members
set last_read_at = now() - interval '1 hour'
where user_id = '00000000-0000-4000-8000-000000000001'
  and conversation_id = (
    select id from public.conversations
    where run_id = '10000000-0000-4000-8000-000000000001'
  );

-- Only Old Town Loop stays unread for maya (trigger-inserted system messages
-- would otherwise leave stray unread counts on her other conversations).
update public.conversation_members
set last_read_at = now()
where user_id = '00000000-0000-4000-8000-000000000001'
  and conversation_id <> (
    select id from public.conversations
    where run_id = '10000000-0000-4000-8000-000000000001'
  );

-- ---------------------------------------------------------------------------
-- P4 fixtures (D6): one completed past run with tracks, ledger rows and a
-- review so History/recap demo locally without running outdoors.
-- ---------------------------------------------------------------------------
insert into public.runs (
  id, host_id, type, visibility, status, title, goal, start_point, area_name,
  city, country_code, distance_km, max_group, target_pace_s_per_km, starts_at,
  closed_loop
)
values (
  '10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002',
  'social', 'open', 'completed', 'River Loop',
  'Flat riverside spin, coffee after.',
  extensions.st_setsrid (extensions.st_makepoint (-9.2033, 38.6970), 4326)::extensions.geography,
  'Belém', 'Lisbon', 'PT', 5.2, 10, 380, now() - interval '2 days', true
)
on conflict (id) do nothing;

insert into public.run_members (run_id, user_id, status, intro_message, decided_at, decided_by)
values (
  '10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001',
  'approved', '', now() - interval '3 days', '00000000-0000-4000-8000-000000000002'
)
on conflict (run_id, user_id) do nothing;

insert into public.run_tracks (
  run_id, user_id, polyline, distance_m, duration_s, elevation_gain_m,
  avg_pace_s_per_km, started_at, ended_at
)
values
  (
    '10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001',
    'g_ekFrodw@oFkMcGwLcGkM_DsNjCsNbGjMbG~MnF~Mf@~MSjM',
    5200, 1908, 21, 367,
    now() - interval '2 days', now() - interval '2 days' + interval '32 minutes'
  ),
  (
    '10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002',
    'g_ekFrodw@oFkMcGwLcGkM_DsNjCsNbGjMbG~MnF~Mf@~MSjM',
    5250, 1880, 22, 358,
    now() - interval '2 days', now() - interval '2 days' + interval '32 minutes'
  )
on conflict (run_id, user_id) do nothing;

-- Ledger rows (the trigger updates points_total/level caches).
insert into public.points_ledger (user_id, run_id, reason, points)
values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'finished', 54),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'distance_goal', 20),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'on_time', 10),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'rate_crew', 10),
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 'finished', 54),
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 'distance_goal', 20),
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 'on_time', 10)
on conflict (user_id, run_id, reason) do nothing;

-- One review maya → marco (the rating trigger fills marco's aggregates).
insert into public.reviews (run_id, reviewer_id, reviewee_id, stars, tags, note)
values (
  '10000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  5, '{"Great pace","Good vibes"}', 'Lovely easy pace and great route picks.'
)
on conflict (run_id, reviewer_id, reviewee_id) do nothing;

-- ---------------------------------------------------------------------------
-- P5 fixtures (H1): rita in Porto, week-boundary ledger rows, badges, one
-- trusted + one emergency contact for maya.
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current
)
values (
  '00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'rita@example.com',
  extensions.crypt ('password123', extensions.gen_salt ('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Rita M."}', now(), now(),
  '', '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
values (
  '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000004', 'email',
  '{"sub":"00000000-0000-4000-8000-000000000004","email":"rita@example.com","email_verified":true}',
  now(), now(), now()
)
on conflict (provider_id, provider) do nothing;

update public.profiles
set home_city = 'Porto',
    home_point = extensions.st_setsrid (extensions.st_makepoint (-8.6110, 41.1496), 4326)::extensions.geography,
    pace_band = 'quick',
    languages = '{PT,EN}',
    onboarded_at = now(),
    tos_accepted_at = now()
where id = '00000000-0000-4000-8000-000000000004';

-- A completed Porto run hosted by rita (week-boundary leaderboard fixture).
insert into public.runs (
  id, host_id, type, visibility, status, title, goal, start_point, area_name,
  city, country_code, distance_km, max_group, target_pace_s_per_km, starts_at,
  closed_loop
)
values (
  '10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000004',
  'discover', 'open', 'completed', 'Douro Sunrise',
  'Riverside out-and-back before work.',
  extensions.st_setsrid (extensions.st_makepoint (-8.6110, 41.1496), 4326)::extensions.geography,
  'Ribeira', 'Porto', 'PT', 6.0, 8, 330, now() - interval '3 days', false
)
on conflict (id) do nothing;

insert into public.run_tracks (
  run_id, user_id, polyline, distance_m, duration_s, elevation_gain_m,
  avg_pace_s_per_km, started_at, ended_at
)
values (
  '10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000004',
  'g_ekFrodw@oFkMcGwLcGkM_DsNjCsNbGjMbG~MnF~Mf@~MSjM',
  6000, 2000, 15, 333,
  now() - interval '3 days', now() - interval '3 days' + interval '34 minutes'
)
on conflict (run_id, user_id) do nothing;

-- Ledger rows straddling the ISO Monday: rita this week (Porto) + last week;
-- maya/marco already have this-week rows from the River Loop fixture, add a
-- last-week Lisbon row for marco so LAST WEEK isn't empty.
insert into public.points_ledger (user_id, run_id, reason, points, created_at)
values
  (
    '00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000006',
    'finished', 68, date_trunc('week', now() at time zone 'utc') + interval '1 day'
  ),
  (
    '00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000006',
    'on_time', 10, date_trunc('week', now() at time zone 'utc') - interval '3 days'
  ),
  (
    -- Keyed to Old Town Loop, NOT River Loop: the safety/points smokes award
    -- marco's River Loop rate_crew live and must find the slot empty.
    '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
    'rate_crew', 10, date_trunc('week', now() at time zone 'utc') - interval '2 days'
  )
on conflict (user_id, run_id, reason) do nothing;

-- Safety contacts for maya: one emergency + one trusted.
insert into public.safety_contacts (id, user_id, name, phone, label, is_emergency)
values
  (
    '30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
    'Ana Lawson', '+351 912 000 001', 'Sister', true
  ),
  (
    '30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
    'Tomás P.', '+351 912 000 002', 'Partner', false
  )
on conflict (id) do nothing;

-- Push-pipeline config (migration 32). Kong's docker-network hostname is
-- supabase_kong_<project_id>; host.docker.internal is macOS/Windows-only.
-- Hosted values are set once in the SQL editor with the real project URL and
-- a generated secret.
select vault.create_secret ('http://supabase_kong_runeverywhere:8000', 'project_url');
select vault.create_secret ('local-dev-push-secret', 'send_push_secret');

-- Local dev always exercises the integration code paths (P6 A2).
update public.feature_flags set enabled = true where key in ('healthkit', 'strava');
