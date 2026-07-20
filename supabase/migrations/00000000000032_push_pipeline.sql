-- P3 push pipeline (deferred from P3.2, issue #24): notifications INSERT →
-- pg_net → send-push Edge Function → Expo Push API, plus pg_cron jobs for
-- T-60 run reminders and Expo receipt checks. Config (project URL + shared
-- secret) lives in Supabase Vault so nothing environment-specific is baked
-- into migrations; if the secrets are absent every delivery path is a no-op,
-- so stacks without setup keep working.
--
-- Migration 53 (shipped earlier, guarded on this file's absence) upgrades
-- handle_notification_push with the notification-prefs gate when it runs
-- after this one — fresh resets end up with the pref-gated version.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Vault config reader. The revoke is a security boundary, not hygiene:
-- send-push authenticates by this shared secret alone (verify_jwt = false),
-- so a PostgREST-callable get_secret would hand any signed-in user direct
-- push access to any device.
-- ---------------------------------------------------------------------------
create function public.get_secret (p_name text)
returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name;
$$;

revoke execute on function public.get_secret (text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Push trigger: async POST per notification row. pg_net never blocks the
-- INSERT; the exception guard means delivery infrastructure can never fail
-- a user's write.
-- ---------------------------------------------------------------------------
create function public.handle_notification_push ()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
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

revoke execute on function public.handle_notification_push () from public, anon, authenticated;

create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.handle_notification_push ();

-- ---------------------------------------------------------------------------
-- T-60 reminders. The partial unique index notifications_reminder_once makes
-- 5-minute re-runs idempotent, so the job can run far more often than the
-- T-60 semantic requires. Cron runs it as postgres — not a client RPC.
-- ---------------------------------------------------------------------------
create function public.enqueue_run_reminders ()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    select id, host_id, title, starts_at, area_name
    from public.runs
    where status = 'published'
      and starts_at > now()
      and starts_at <= now() + interval '60 minutes'
  loop
    insert into public.notifications (user_id, kind, title, body, run_id)
    select u.uid, 'run_reminder',
      left(r.title || ' starts soon', 80),
      -- UTC-rendered; the app shows correct local time once opened via run_id.
      left(to_char(r.starts_at, 'HH24:MI') || ' · ' || r.area_name, 200),
      r.id
    from (
      select r.host_id as uid
      union
      select rm.user_id from public.run_members rm
      where rm.run_id = r.id and rm.status = 'approved'
    ) u
    on conflict (user_id, run_id, kind) where kind = 'run_reminder' do nothing;
  end loop;
end; $$;

revoke execute on function public.enqueue_run_reminders () from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Expo receipt checks: DeviceNotRegistered tokens get pruned by send-push.
-- ---------------------------------------------------------------------------
create function public.request_push_receipts ()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  v_url := public.get_secret ('project_url');
  v_secret := public.get_secret ('send_push_secret');
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post (
    url := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := jsonb_build_object('mode', 'receipts'),
    timeout_milliseconds := 5000
  );
end; $$;

revoke execute on function public.request_push_receipts () from public, anon, authenticated;

-- cron.schedule upserts by job name — re-running this migration is safe.
select cron.schedule('run-reminders', '*/5 * * * *', $job$select public.enqueue_run_reminders()$job$);
select cron.schedule('push-receipts', '*/30 * * * *', $job$select public.request_push_receipts()$job$);
