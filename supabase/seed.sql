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
  )
on conflict (provider_id, provider) do nothing;

update public.profiles
set home_city = 'Lisbon',
    home_point = extensions.st_setsrid (extensions.st_makepoint (-9.1393, 38.7223), 4326)::extensions.geography,
    pace_band = 'steady',
    languages = '{EN,PT}',
    onboarded_at = now(),
    tos_accepted_at = now()
where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');

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
