-- Convergence for the 53-before-32 ordering. Migration 53 guards its
-- pref-gated handle_notification_push and the leaderboard-weekly cron on
-- migration 32's infra existing — an environment that applied 53 while 32
-- was still unwritten (main was pushed before this branch merged) skipped
-- both, permanently, because migrations never re-run. Re-asserting them here
-- is a no-op everywhere the order was correct.
--
-- Also seals notification_pref_key: 53 never revoked it, which the P3
-- function-privilege discipline requires and migration 66's blanket grant
-- would otherwise expose as a client-callable RPC (harmless mapper, but the
-- rule is every internal fails loudly).

create or replace function public.handle_notification_push ()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
  v_prefs jsonb;
begin
  -- Pref gate (P5 D2): a disabled key suppresses push; the row stays.
  select notification_prefs into v_prefs
  from public.profiles where id = new.user_id;
  if not coalesce(
    (v_prefs ->> public.notification_pref_key (new.kind))::boolean, true
  ) then
    return null;
  end if;

  v_url := public.get_secret ('project_url');
  v_secret := public.get_secret ('send_push_secret');
  if v_url is null or v_secret is null then
    return null;
  end if;
  perform net.http_post (
    url := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := jsonb_build_object('mode', 'deliver', 'record', to_jsonb (new)),
    timeout_milliseconds := 5000
  );
  return null;
exception when others then
  return null;
end; $$;

-- pg_cron exists by now (migration 32 sorts first); schedule upserts by name.
select cron.schedule('leaderboard-weekly', '0 9 * * 1', $job$select public.enqueue_weekly_leaderboard()$job$);

revoke execute on function public.notification_pref_key (public.notification_kind) from public, anon, authenticated;
