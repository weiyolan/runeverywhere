-- Grants baseline. This repo's entire RLS/grant model was written against
-- Supabase's classic default privileges (postgres-created objects in `public`
-- get full DML for anon/authenticated/service_role and EXECUTE on functions,
-- with RLS as the row boundary and explicit revokes as the security
-- boundaries). The local CLI stack still behaves that way, but newer hosted
-- projects harden the postgres default ACL to Dxtm (no SELECT/INSERT/UPDATE/
-- DELETE, no EXECUTE) — which silently breaks every client read and RPC.
--
-- This migration converges any environment to the classic model:
--   1. classic default privileges for future postgres-created objects,
--   2. blanket grants on everything that exists,
--   3. every explicit grant/revoke from migrations 0003…0065 re-applied in
--      order, restoring the intended boundaries on top of the blanket grants.
-- On a local reset 1+2 are no-ops and 3 is idempotent.

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- Re-applied boundaries, in migration order.
-- --------------------------------------------------------------------------
-- 0003 + 0011: profiles caches are server-only; clients update a fixed list.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, bio, avatar_url, home_city, home_point,
              pace_band, distance_band, languages, units, visibility,
              tos_accepted_at, onboarded_at)
  on public.profiles to authenticated;

-- 0030: chat trigger internals.
revoke execute on function public.handle_run_created () from public, anon, authenticated;
revoke execute on function public.handle_run_member_conversation () from public, anon, authenticated;
revoke execute on function public.broadcast_message_inserted () from public, anon, authenticated;

-- 0031: notifications — clients only ever set read_at; fan-out internals.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke execute on function public.handle_message_notification () from public, anon, authenticated;
revoke execute on function public.handle_run_member_notification () from public, anon, authenticated;

-- 0032: push pipeline — get_secret guards the send-push shared secret.
revoke execute on function public.get_secret (text) from public, anon, authenticated;
revoke execute on function public.handle_notification_push () from public, anon, authenticated;
revoke execute on function public.enqueue_run_reminders () from public, anon, authenticated;
revoke execute on function public.request_push_receipts () from public, anon, authenticated;

-- 0041 + 0042: points/rating engines are trigger-only.
revoke execute on function public.apply_points_ledger () from public, anon, authenticated;
revoke execute on function public.apply_review_rating () from public, anon, authenticated;

-- 0050: block sever trigger.
revoke execute on function public.handle_block_created () from public, anon, authenticated;

-- 0051: gamification engine + leaderboard only via get_leaderboard.
revoke execute on function public.award_badges (uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_ledger_badges () from public, anon, authenticated;
revoke execute on function public.handle_review_badges () from public, anon, authenticated;
revoke all on public.leaderboard_weekly from anon, authenticated;
revoke execute on function public.get_leaderboard (text, date) from anon;

-- 0052 + 0053: safety/notification-pref columns + job internals.
revoke execute on function public.enforce_trusted_limit () from public, anon, authenticated;
grant update (live_share_auto) on public.profiles to authenticated;
grant update (notification_prefs, like_types) on public.profiles to authenticated;
revoke execute on function public.enqueue_weekly_leaderboard () from public, anon, authenticated;

-- 0060: feature flags are read-only to clients — and fail loudly on write.
revoke insert, update, delete on public.feature_flags from anon, authenticated;

-- 0061: Vault token I/O + imports are service_role-only.
revoke execute on function public.store_connected_account (uuid, public.integration_provider, text, text[], text, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.get_connected_tokens (uuid, public.integration_provider)
  from public, anon, authenticated;
revoke execute on function public.disconnect_account (public.integration_provider) from anon;
revoke execute on function public.disconnect_account_admin (uuid, public.integration_provider)
  from public, anon, authenticated;
revoke execute on function public.import_external_track (uuid, public.track_source, text, text, text, integer, integer, integer, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.delete_external_track (uuid, public.track_source, text)
  from public, anon, authenticated;

-- 0065: pro entitlement — flair granted (trigger-guarded), events sealed.
grant update (flair_accent, flair_ring) on public.profiles to authenticated;
revoke execute on function public.enforce_flair_requires_pro () from public, anon, authenticated;
revoke all on public.revenuecat_events from anon, authenticated;
