-- P5 notification prefs + weekly leaderboard notification. Prefs gate PUSH
-- only — the in-app notification row is always written, so the center and
-- badge counts stay truthful.
--
-- NOTE: the push-pipeline pieces (handle_notification_push pref gate and the
-- pg_cron schedule) are guarded on migration 32's infra actually existing —
-- that migration (pg_net/pg_cron/Vault/send-push) is tracked separately
-- (issue #24) and this file works both before and after it lands.

alter table public.profiles add column notification_prefs jsonb not null default '{}'::jsonb;
alter table public.profiles add column like_types public.run_type[] not null default '{}';
grant update (notification_prefs, like_types) on public.profiles to authenticated;

alter type public.notification_kind add value if not exists 'leaderboard_weekly';

-- Maps every kind to its settings toggle; null = deliberately ungated.
-- Compares on text, not the enum: 'leaderboard_weekly' is added above in this
-- same transaction, and SQL function bodies are parsed at creation — an enum
-- CASE would fail with "unsafe use of new value" on db push.
create function public.notification_pref_key (p_kind public.notification_kind)
returns text
language sql immutable set search_path = '' as $$
  select case p_kind::text
    when 'join_request' then 'requests'
    when 'member_joined' then 'requests'
    when 'request_approved' then 'accepts'
    when 'request_declined' then 'accepts'
    when 'run_reminder' then 'accepts'
    when 'message' then 'messages'
    when 'run_completed' then 'reviews'
    when 'review_received' then 'reviews'
    when 'badge_earned' then 'rewards'
    when 'leaderboard_weekly' then 'rewards'
    else null
  end;
$$;

-- Pref-gate the push trigger when migration 32 has installed it.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_notification_push'
  ) then
    create or replace function public.handle_notification_push ()
    returns trigger
    language plpgsql security definer set search_path = '' as $fn$
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
    end; $fn$;
  end if;
end $$;

-- Weekly leaderboard notification (previous ISO week, one per ranked runner).
create function public.enqueue_weekly_leaderboard ()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_week date := (date_trunc('week', now() at time zone 'utc'))::date - 7;
  m record;
begin
  for m in
    select lw.user_id as uid, lw.city, lw.points,
           rank() over (partition by lw.city order by lw.points desc, lw.runs_count desc, lw.display_name) as r
    from public.leaderboard_weekly lw
    where lw.week_start = v_week
  loop
    if not exists (
      select 1 from public.notifications
      where user_id = m.uid and kind = 'leaderboard_weekly'
        and created_at >= date_trunc('week', now() at time zone 'utc')
    ) then
      insert into public.notifications (user_id, kind, title, body)
      values (
        m.uid, 'leaderboard_weekly', 'Weekly leaderboard',
        left('You finished #' || m.r || ' in ' || m.city || ' · ' || m.points || ' pts', 200)
      );
    end if;
  end loop;
end; $$;

revoke execute on function public.enqueue_weekly_leaderboard () from public, anon, authenticated;

-- Schedule when pg_cron is present (installed by migration 32's session).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('leaderboard-weekly', '0 9 * * 1',
      $job$select public.enqueue_weekly_leaderboard()$job$);
  end if;
end $$;
