-- P0 hardening: profiles.points_total / level / rating_avg / rating_count
-- are server-maintained caches (P4 ledger/review triggers). The
-- unrestricted "users update own profile" policy plus Supabase's
-- table-wide UPDATE grant let any user set their own caches via
-- PostgREST. Column privileges are additive to the table grant, so
-- revoke table-level UPDATE and re-grant only the user-editable columns.
-- SECURITY DEFINER paths (P4 triggers, service_role) are unaffected.
revoke update on table public.profiles from authenticated, anon;
grant update (
  display_name, bio, avatar_url, home_city, home_point,
  pace_band, distance_band, languages, units, visibility,
  tos_accepted_at, onboarded_at, updated_at
) on table public.profiles to authenticated;
