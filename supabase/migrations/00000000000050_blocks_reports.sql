-- P5 blocks + reports with every-surface enforcement. Blocking lives at the
-- four RLS choke points (profiles/runs/run_members/messages) plus the definer
-- patches below — never per-screen. Sever trigger rides P3's membership
-- triggers so the blocked side only ever sees ordinary declines.

-- ---------------------------------------------------------------------------
-- Tables + enum
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

create index blocks_blocked_idx on public.blocks (blocked_id);

create policy "own blocks are readable"
  on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid ()));

create policy "users block for themselves"
  on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid ()));

create policy "users unblock for themselves"
  on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid ()));

create type public.report_reason as enum (
  'inappropriate_behaviour', 'harassment', 'impersonation',
  'safety_concern', 'spam', 'other'
);

-- set null (not cascade) on the people FKs: the safety audit trail outlives
-- the accounts. Write-only from clients; triage happens in Studio.
create table public.reports (
  id uuid primary key default gen_random_uuid (),
  reporter_id uuid references public.profiles (id) on delete set null,
  subject_user_id uuid references public.profiles (id) on delete set null,
  run_id uuid references public.runs (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  reason public.report_reason not null,
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create index reports_subject_idx on public.reports (subject_user_id, created_at desc);

create policy "users report as themselves"
  on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid ())
    and subject_user_id is not null
    and subject_user_id <> (select auth.uid ())
  );

-- ---------------------------------------------------------------------------
-- Helpers. Definer is load-bearing: RLS policies cannot subquery blocks
-- directly (its SELECT policy only exposes the blocker's own rows).
-- ---------------------------------------------------------------------------
create function public.is_blocked_pair (p_a uuid, p_b uuid)
returns boolean
language sql security definer stable set search_path = '' as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

create function public.has_blocked (p_blocker uuid, p_blocked uuid)
returns boolean
language sql security definer stable set search_path = '' as $$
  select p_blocker is not null and p_blocked is not null and exists (
    select 1 from public.blocks
    where blocker_id = p_blocker and blocked_id = p_blocked
  );
$$;

create function public.shares_run_with (p_a uuid, p_b uuid)
returns boolean
language sql security definer stable set search_path = '' as $$
  select p_a is not null and p_b is not null and (
    exists (
      select 1
      from public.run_members ma
      join public.run_members mb on mb.run_id = ma.run_id
      where ma.user_id = p_a and ma.status = 'approved'
        and mb.user_id = p_b and mb.status = 'approved'
    )
    or exists (
      select 1 from public.runs r
      join public.run_members m on m.run_id = r.id
      where (r.host_id = p_a and m.user_id = p_b or r.host_id = p_b and m.user_id = p_a)
        and m.status = 'approved'
    )
  );
$$;

-- Full-profile gate: self → true; block pair → false; then by visibility.
-- 'members' includes hosts reviewing pending requesters.
create function public.can_view_profile (p_profile_id uuid)
returns boolean
language plpgsql security definer stable set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid ());
  v_visibility public.profile_visibility;
begin
  if v_uid is null or p_profile_id is null then
    return false;
  end if;
  if p_profile_id = v_uid then
    return true;
  end if;
  if public.is_blocked_pair (p_profile_id, v_uid) then
    return false;
  end if;
  select visibility into v_visibility from public.profiles where id = p_profile_id;
  if v_visibility is null then
    return false;
  end if;
  return case v_visibility
    when 'everyone' then true
    when 'members' then
      public.shares_run_with (v_uid, p_profile_id)
      or exists (
        select 1 from public.run_members rm
        join public.runs r on r.id = rm.run_id
        where rm.user_id = p_profile_id and rm.status = 'pending'
          and r.host_id = v_uid
      )
    else false
  end;
end; $$;

-- ---------------------------------------------------------------------------
-- Surface enforcement (A3): policy recreations keep the original names.
-- ---------------------------------------------------------------------------
-- #1 Explore/search/detail — runs SELECT is the choke point for the invoker
-- discovery RPCs.
drop policy "discoverable or own or joined runs are readable" on public.runs;
create policy "discoverable or own or joined runs are readable"
  on public.runs for select to authenticated
  using (
    host_id = (select auth.uid ())
    or (
      not public.is_blocked_pair (host_id, (select auth.uid ()))
      and (
        visibility in ('open', 'approval')
        or public.is_run_member (id, (select auth.uid ()))
      )
    )
  );

-- #2 Invite deep link (definer — RLS does not apply inside it).
create or replace function public.get_run_by_invite (p_code text)
returns setof public.runs
language sql security definer set search_path = '' stable as $$
  select * from public.runs
  where invite_code = p_code and status = 'published'
    and not public.is_blocked_pair (host_id, (select auth.uid ()));
$$;

-- #3 Rosters / avatar stacks — blocked users' membership rows vanish.
drop policy "own membership, host, and co-members can read" on public.run_members;
create policy "own membership, host, and co-members can read"
  on public.run_members for select to authenticated
  using (
    user_id = (select auth.uid ())
    or (
      not public.is_blocked_pair (user_id, (select auth.uid ()))
      and (
        exists (
          select 1 from public.runs r
          where r.id = run_id and r.host_id = (select auth.uid ())
        )
        or public.is_run_member (run_id, (select auth.uid ()))
      )
    )
  );

-- #4 Group-chat history.
drop policy "members read messages" on public.messages;
create policy "members read messages"
  on public.messages for select to authenticated
  using (
    public.is_conversation_member (conversation_id, (select auth.uid ()))
    and (sender_id is null or not public.is_blocked_pair (sender_id, (select auth.uid ())))
  );

-- #6 DM sending refused inside a blocked pair; group chats stay usable.
drop policy "members write user messages, hosts write meeting points" on public.messages;
create policy "members write user messages, hosts write meeting points"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid ())
    and public.is_conversation_member (conversation_id, (select auth.uid ()))
    and (
      kind = 'user'
      or (kind = 'meeting_point' and exists (
        select 1 from public.conversations c
        join public.runs r on r.id = c.run_id
        where c.id = conversation_id and r.host_id = (select auth.uid ())
      ))
    )
    and not (
      exists (
        select 1 from public.conversations c
        where c.id = conversation_id and c.kind = 'dm'
      )
      and exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = conversation_id
          and cm.user_id <> (select auth.uid ())
          and public.is_blocked_pair (cm.user_id, (select auth.uid ()))
      )
    )
  );

-- #7 DM creation (guard P3 explicitly deferred here).
create or replace function public.get_or_create_dm (p_other_user uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid ());
  v_key text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_other_user is null or p_other_user = v_uid then
    raise exception 'invalid dm target';
  end if;
  if not exists (select 1 from public.profiles where id = p_other_user) then
    raise exception 'no such user';
  end if;
  if public.is_blocked_pair (v_uid, p_other_user) then
    raise exception 'user unavailable';
  end if;

  v_key := least(v_uid::text, p_other_user::text) || ':' || greatest(v_uid::text, p_other_user::text);

  insert into public.conversations (kind, dm_key)
  values ('dm', v_key)
  on conflict (dm_key) do nothing;

  select id into v_id from public.conversations where dm_key = v_key;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_id, v_uid), (v_id, p_other_user)
  on conflict do nothing;

  return v_id;
end; $$;

-- #8 Messages list — DM rows with a blocked peer disappear. Invoker, so #4
-- already filters previews/unread from blocked senders in group rows.
create or replace function public.list_conversations ()
returns table (
  conversation_id uuid,
  kind public.conversation_kind,
  run_id uuid,
  run_type public.run_type,
  starts_at timestamptz,
  title text,
  member_count integer,
  peer_ids uuid[],
  peer_names text[],
  peer_avatars text[],
  last_body text,
  last_kind public.message_kind,
  last_sender_id uuid,
  last_at timestamptz,
  unread_count bigint
)
language sql security invoker stable set search_path = '' as $$
  with mine as (
    select cm.conversation_id as cid, cm.last_read_at as lra
    from public.conversation_members cm
    where cm.user_id = (select auth.uid ())
  ),
  visible as (
    select m.cid, m.lra
    from mine m
    join public.conversations c on c.id = m.cid
    where not (
      c.kind = 'dm'
      and exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = c.id
          and cm.user_id <> (select auth.uid ())
          and public.is_blocked_pair (cm.user_id, (select auth.uid ()))
      )
    )
  ),
  peers as (
    select cm.conversation_id as cid,
      (array_agg(cm.user_id order by cm.joined_at))[1:3] as ids,
      (array_agg(p.display_name order by cm.joined_at))[1:3] as names,
      (array_agg(p.avatar_url order by cm.joined_at))[1:3] as avatars
    from public.conversation_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.user_id <> (select auth.uid ())
      and cm.conversation_id in (select cid from visible)
    group by cm.conversation_id
  ),
  last_msg as (
    select distinct on (m.conversation_id)
      m.conversation_id as cid, m.body, m.kind as mkind, m.sender_id, m.created_at
    from public.messages m
    where m.conversation_id in (select cid from visible)
    order by m.conversation_id, m.created_at desc
  ),
  unread as (
    select m.conversation_id as cid, count(*) as n
    from public.messages m
    join visible on visible.cid = m.conversation_id
    where m.created_at > visible.lra
      and m.sender_id is distinct from (select auth.uid ())
    group by m.conversation_id
  )
  select
    c.id,
    c.kind,
    c.run_id,
    r.type,
    r.starts_at,
    case when c.kind = 'run' then r.title else coalesce(peers.names[1], 'Runner') end,
    (select count(*)::int from public.conversation_members cm2 where cm2.conversation_id = c.id),
    coalesce(peers.ids, '{}'),
    coalesce(peers.names, '{}'),
    coalesce(peers.avatars, '{}'),
    lm.body,
    lm.mkind,
    lm.sender_id,
    lm.created_at,
    coalesce(unread.n, 0)
  from public.conversations c
  join visible on visible.cid = c.id
  left join public.runs r on r.id = c.run_id
  left join peers on peers.cid = c.id
  left join last_msg lm on lm.cid = c.id
  left join unread on unread.cid = c.id
  order by lm.created_at desc nulls last;
$$;

-- #9 Notification center. request_declined stays visible to the blocked side
-- so A4's sever reads as an ordinary decline.
drop policy "own notifications are readable" on public.notifications;
create policy "own notifications are readable"
  on public.notifications for select to authenticated
  using (
    user_id = (select auth.uid ())
    and (
      actor_id is null
      or kind = 'request_declined'
      or not public.is_blocked_pair (actor_id, (select auth.uid ()))
    )
  );

-- #9b Chat fan-out skips recipients in a block pair with the sender — no new
-- rows, not just hidden ones.
create or replace function public.handle_message_notification ()
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
    if public.is_blocked_pair (m.user_id, new.sender_id) then
      continue;
    end if;
    delete from public.notifications
    where user_id = m.user_id and conversation_id = new.conversation_id
      and kind = 'message' and read_at is null;
    insert into public.notifications (user_id, kind, title, body, run_id, conversation_id, actor_id)
    values (m.user_id, 'message', v_title, v_body, v_conv.run_id, new.conversation_id, new.sender_id)
    on conflict (user_id, conversation_id) where kind = 'message' and read_at is null do nothing;
  end loop;
  return null;
end; $$;

-- #10 Profiles — deliberately one-directional: whoever blocked you is fully
-- unreadable; whoever YOU blocked stays row-readable (settings/blocked and
-- the "You blocked X." banner) while content surfaces filter pairwise.
drop policy "profiles are readable by signed-in users" on public.profiles;
create policy "profiles are readable by signed-in users"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid ())
    or (
      visibility <> 'hidden'
      and not public.has_blocked (profiles.id, (select auth.uid ()))
    )
  );

-- #11 Reviews — a broadening, not just a block clause: P4 restricted SELECT
-- to reviewer-or-reviewee and deferred public-profile reads here.
drop policy "reviewer and reviewee can read" on public.reviews;
create policy "reviewer and reviewee can read"
  on public.reviews for select to authenticated
  using (
    (
      reviewer_id = (select auth.uid ())
      or reviewee_id = (select auth.uid ())
      or public.can_view_profile (reviewee_id)
    )
    and not public.is_blocked_pair (reviewer_id, (select auth.uid ()))
  );

-- #13 join_run (definer — #1's policy never applies inside it). Same message
-- as a dead run so the block is not disclosed.
create or replace function public.join_run (p_run_id uuid, p_intro_message text default '')
returns public.run_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.runs;
  v_uid uuid := (select auth.uid ());
  v_approved_count integer;
  v_row public.run_members;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_run from public.runs where id = p_run_id for update;
  if not found or v_run.status <> 'published' then
    raise exception 'run not open for joining';
  end if;
  if public.is_blocked_pair (v_run.host_id, v_uid) then
    raise exception 'run not open for joining';
  end if;
  if v_run.host_id = v_uid then
    raise exception 'hosts are already in their own run';
  end if;
  if v_run.starts_at < now() then
    raise exception 'run already started';
  end if;

  select count(*) into v_approved_count
  from public.run_members
  where run_id = p_run_id and status = 'approved';

  if v_run.visibility = 'open' or v_run.visibility = 'invite' then
    if v_approved_count + 1 >= v_run.max_group then
      raise exception 'run is full';
    end if;
    insert into public.run_members (run_id, user_id, status, intro_message, decided_at)
    values (p_run_id, v_uid, 'approved', coalesce(p_intro_message, ''), now())
    on conflict (run_id, user_id) do update
      set status = 'approved', decided_at = now()
      where run_members.status in ('cancelled', 'declined')
    returning * into v_row;
  else
    insert into public.run_members (run_id, user_id, status, intro_message)
    values (p_run_id, v_uid, 'pending', coalesce(p_intro_message, ''))
    on conflict (run_id, user_id) do update
      set status = 'pending', intro_message = excluded.intro_message, requested_at = now()
      where run_members.status in ('cancelled', 'declined')
    returning * into v_row;
  end if;

  if v_row is null then
    raise exception 'already requested or joined';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sever trigger (A4): rides P3's membership triggers, so chat membership +
-- system messages + decline notifications all follow automatically.
-- ---------------------------------------------------------------------------
create function public.handle_block_created ()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Blocker's hosted runs: pending → declined, approved → removed.
  update public.run_members rm
  set status = 'declined', decided_at = now(), decided_by = new.blocker_id
  from public.runs r
  where r.id = rm.run_id and r.host_id = new.blocker_id
    and rm.user_id = new.blocked_id and rm.status = 'pending';

  update public.run_members rm
  set status = 'removed', decided_at = now(), decided_by = new.blocker_id
  from public.runs r
  where r.id = rm.run_id and r.host_id = new.blocker_id
    and rm.user_id = new.blocked_id and rm.status = 'approved';

  -- Blocked user's hosted runs: the blocker walks away.
  update public.run_members rm
  set status = 'cancelled', decided_at = now(), decided_by = new.blocker_id
  from public.runs r
  where r.id = rm.run_id and r.host_id = new.blocked_id
    and rm.user_id = new.blocker_id and rm.status in ('pending', 'approved');

  return null;
end; $$;

revoke execute on function public.handle_block_created () from public, anon, authenticated;

create trigger blocks_sever
  after insert on public.blocks
  for each row execute function public.handle_block_created ();
