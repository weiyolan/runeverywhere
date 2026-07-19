-- P3 notifications: one table backs both the in-app center and the push
-- pipeline (PLAN.md §2 — badge counts and push can never disagree). Writes
-- come from security-definer triggers; clients may only set read_at.

create type public.notification_kind as enum (
  'join_request', 'request_approved', 'request_declined',
  'member_joined', 'message', 'run_reminder'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) <= 80),
  body text not null default '' check (char_length(body) <= 200),
  run_id uuid references public.runs (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_sent_at timestamptz,
  push_tickets jsonb,
  push_checked_at timestamptz
);

alter table public.notifications enable row level security;

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
-- Reminder idempotency: at most one run_reminder per user per run.
create unique index notifications_reminder_once
  on public.notifications (user_id, run_id, kind)
  where kind = 'run_reminder';
-- Chat dedupe: at most one UNREAD message row per conversation per recipient.
create unique index notifications_message_dedupe
  on public.notifications (user_id, conversation_id)
  where kind = 'message' and read_at is null;

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
create policy "own notifications are readable"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid ()));

create policy "own notifications are updatable"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid ()))
  with check (user_id = (select auth.uid ()));

-- Clients can only ever set read_at.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "devices manage their own tokens"
  on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid ()))
  with check (user_id = (select auth.uid ()));

-- ---------------------------------------------------------------------------
-- Chat → notification fan-out. Delete-then-insert keeps the (future) push
-- trigger INSERT-only and the center deduped; the ON CONFLICT guard is
-- mandatory — two concurrent messages in one conversation would otherwise
-- abort each other's INSERT under READ COMMITTED. Deliberately NOT
-- exception-guarded (touches neither Realtime nor pg_net).
-- ---------------------------------------------------------------------------
create function public.handle_message_notification ()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_conv public.conversations;
  v_run public.runs;
  v_sender text;
  v_title text;
  v_body text;
  m record;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  select display_name into v_sender from public.profiles where id = new.sender_id;

  if v_conv.kind = 'run' then
    select * into v_run from public.runs where id = v_conv.run_id;
    -- left(…,80) is load-bearing: 40-char name + ' · ' + 40-char title = 83
    -- would trip the title check and abort the user's message INSERT.
    v_title := left(coalesce(v_sender, 'Someone') || ' · ' || v_run.title, 80);
  else
    v_title := coalesce(v_sender, 'Someone');
  end if;

  if new.kind = 'meeting_point' then
    v_body := 'Meeting point: ' || left(new.body, 120);
  else
    v_body := left(new.body, 140);
  end if;

  for m in
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = new.conversation_id and cm.user_id <> new.sender_id
  loop
    delete from public.notifications
    where user_id = m.user_id and conversation_id = new.conversation_id
      and kind = 'message' and read_at is null;
    insert into public.notifications (user_id, kind, title, body, run_id, conversation_id, actor_id)
    values (m.user_id, 'message', v_title, v_body, v_conv.run_id, new.conversation_id, new.sender_id)
    on conflict (user_id, conversation_id) where kind = 'message' and read_at is null do nothing;
  end loop;
  return null;
end; $$;

revoke execute on function public.handle_message_notification () from public, anon, authenticated;

create trigger messages_notify
  after insert on public.messages
  for each row
  when (new.kind in ('user', 'meeting_point'))
  execute function public.handle_message_notification ();

-- ---------------------------------------------------------------------------
-- Run-member → notification fan-out. Kept separate from migration 30's
-- conversation-sync trigger so that file has no forward reference here.
-- ---------------------------------------------------------------------------
create function public.handle_run_member_notification ()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_run public.runs;
  v_runner text;
  v_host text;
  v_count integer;
begin
  select * into v_run from public.runs where id = new.run_id;
  if v_run is null then
    return null;
  end if;
  select display_name into v_runner from public.profiles where id = new.user_id;

  if (tg_op = 'INSERT' and new.status = 'pending')
     or (tg_op = 'UPDATE' and old.status in ('declined', 'cancelled') and new.status = 'pending') then
    -- New request, or re-request after decline/cancel (join_run revives both).
    insert into public.notifications (user_id, kind, title, body, run_id, actor_id)
    values (
      v_run.host_id, 'join_request',
      left(coalesce(v_runner, 'Someone') || ' wants to join', 80),
      left(v_run.title || ' · tap to review', 200),
      new.run_id, new.user_id
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' then
    select display_name into v_host from public.profiles where id = v_run.host_id;
    insert into public.notifications (user_id, kind, title, body, run_id, actor_id)
    values (
      new.user_id, 'request_approved', 'You''re in!',
      left(coalesce(v_host, 'The host') || ' accepted you into ' || v_run.title, 200),
      new.run_id, v_run.host_id
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'declined' then
    insert into public.notifications (user_id, kind, title, body, run_id, actor_id)
    values (
      new.user_id, 'request_declined', 'Request not accepted',
      left(v_run.title || ' — keep exploring, more runs nearby', 200),
      new.run_id, v_run.host_id
    );
  elsif tg_op = 'INSERT' and new.status = 'approved' and new.user_id <> v_run.host_id then
    -- Open/invite direct join. Approved count includes this row (AFTER
    -- trigger); +1 for the host.
    select count(*)::int into v_count
    from public.run_members
    where run_id = new.run_id and status = 'approved';
    insert into public.notifications (user_id, kind, title, body, run_id, actor_id)
    values (
      v_run.host_id, 'member_joined',
      left(coalesce(v_runner, 'Someone') || ' joined ' || v_run.title, 80),
      'Your run now has ' || (v_count + 1) || ' runners going',
      new.run_id, new.user_id
    );
  end if;
  return null;
end; $$;

revoke execute on function public.handle_run_member_notification () from public, anon, authenticated;

create trigger run_members_notify
  after insert or update of status on public.run_members
  for each row execute function public.handle_run_member_notification ();

-- ---------------------------------------------------------------------------
-- Read-state RPC — one call keeps unread pill, tab dot, and center agreeing.
-- ---------------------------------------------------------------------------
create function public.mark_conversation_read (p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid ());
begin
  if not public.is_conversation_member (p_conversation_id, v_uid) then
    raise exception 'not a conversation member';
  end if;
  update public.conversation_members
  set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = v_uid;
  update public.notifications
  set read_at = now()
  where user_id = v_uid and conversation_id = p_conversation_id
    and kind = 'message' and read_at is null;
end; $$;
