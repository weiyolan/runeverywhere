-- P3 chat: conversations, members, messages, Broadcast-from-database.
-- Every write to conversations/conversation_members/messages(kind='system')
-- flows through security-definer triggers/RPCs (PLAN.md §2 tier 1); the only
-- client INSERT is messages (user/meeting_point, membership-checked).

-- ---------------------------------------------------------------------------
-- Enums + tables
-- ---------------------------------------------------------------------------
create type public.conversation_kind as enum ('run', 'dm');
create type public.message_kind as enum ('user', 'system', 'meeting_point');

create table public.conversations (
  id uuid primary key default gen_random_uuid (),
  kind public.conversation_kind not null,
  run_id uuid unique references public.runs (id) on delete cascade,
  -- Two member uuids as text, sorted, ':'-joined — DM uniqueness is a DB
  -- constraint, not app logic.
  dm_key text unique,
  created_at timestamptz not null default now(),
  constraint conversations_shape check (
    (kind = 'run' and run_id is not null and dm_key is null)
    or (kind = 'dm' and run_id is null and dm_key is not null)
  )
);

alter table public.conversations enable row level security;

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_members enable row level security;

create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  -- Client MAY supply its own uuid for optimistic reconciliation.
  id uuid primary key default gen_random_uuid (),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  kind public.message_kind not null default 'user',
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  -- System bodies are machine codes, not prose — the client maps to copy.
  constraint messages_system_body check (kind <> 'system' or body in ('joined', 'left', 'removed'))
);

alter table public.messages enable row level security;

create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Definer avoids recursive RLS between conversations and conversation_members.
create function public.is_conversation_member (p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql security definer stable set search_path = '' as $$
  select p_conversation_id is not null and p_user_id is not null and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = p_user_id
  );
$$;

-- Postgres does not guarantee AND short-circuit order — a naked ::uuid cast in
-- the realtime policy can raise on non-conversation topics and kill every
-- subscribe.
create function public.uuid_or_null (p text)
returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end; $$;

-- ---------------------------------------------------------------------------
-- RLS (default deny — no client writes unless listed)
-- ---------------------------------------------------------------------------
create policy "members read their conversations"
  on public.conversations for select to authenticated
  using (public.is_conversation_member (id, (select auth.uid ())));

create policy "members read co-members"
  on public.conversation_members for select to authenticated
  using (
    user_id = (select auth.uid ())
    or public.is_conversation_member (conversation_id, (select auth.uid ()))
  );

create policy "members read messages"
  on public.messages for select to authenticated
  using (public.is_conversation_member (conversation_id, (select auth.uid ())));

-- kind='system' is unreachable from clients; meeting_point is host-only.
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
  );

-- ---------------------------------------------------------------------------
-- Run-conversation lifecycle: created at run INSERT (decision: invariant
-- "every run has exactly one conversation" is schema-enforceable, host can
-- post the meeting point before anyone joins).
-- ---------------------------------------------------------------------------
create function public.handle_run_created ()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_conv uuid;
begin
  insert into public.conversations (kind, run_id)
  values ('run', new.id)
  returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id)
  values (v_conv, new.host_id)
  on conflict do nothing;
  return null;
end; $$;

revoke execute on function public.handle_run_created () from public, anon, authenticated;

create trigger runs_create_conversation
  after insert on public.runs
  for each row execute function public.handle_run_created ();

-- Membership sync: approved members join the chat; cancelled/removed leave it.
create function public.handle_run_member_conversation ()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_conv uuid;
begin
  select id into v_conv from public.conversations where run_id = new.run_id;
  if v_conv is null then
    return null; -- pre-backfill edge
  end if;

  if (tg_op = 'INSERT' and new.status = 'approved')
     or (tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved') then
    insert into public.conversation_members (conversation_id, user_id)
    values (v_conv, new.user_id)
    on conflict do nothing;
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (v_conv, new.user_id, 'system', 'joined');
  elsif tg_op = 'UPDATE' and old.status = 'approved' and new.status in ('cancelled', 'removed') then
    delete from public.conversation_members
    where conversation_id = v_conv and user_id = new.user_id;
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (
      v_conv, new.user_id, 'system',
      case when new.status = 'cancelled' then 'left' else 'removed' end
    );
  end if;
  return null;
end; $$;

revoke execute on function public.handle_run_member_conversation () from public, anon, authenticated;

create trigger run_members_sync_conversation
  after insert or update of status on public.run_members
  for each row execute function public.handle_run_member_conversation ();

-- ---------------------------------------------------------------------------
-- DM RPC — race-safe via the dm_key unique constraint.
-- ---------------------------------------------------------------------------
create function public.get_or_create_dm (p_other_user uuid)
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

-- ---------------------------------------------------------------------------
-- Conversation list RPC — per-row unread counts + last message don't compose
-- in one PostgREST call. Invoker: RLS does the filtering.
-- ---------------------------------------------------------------------------
create function public.list_conversations ()
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
  peers as (
    select cm.conversation_id as cid,
      (array_agg(cm.user_id order by cm.joined_at))[1:3] as ids,
      (array_agg(p.display_name order by cm.joined_at))[1:3] as names,
      (array_agg(p.avatar_url order by cm.joined_at))[1:3] as avatars
    from public.conversation_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.user_id <> (select auth.uid ())
      and cm.conversation_id in (select cid from mine)
    group by cm.conversation_id
  ),
  last_msg as (
    select distinct on (m.conversation_id)
      m.conversation_id as cid, m.body, m.kind as mkind, m.sender_id, m.created_at
    from public.messages m
    where m.conversation_id in (select cid from mine)
    order by m.conversation_id, m.created_at desc
  ),
  unread as (
    select m.conversation_id as cid, count(*) as n
    from public.messages m
    join mine on mine.cid = m.conversation_id
    where m.created_at > mine.lra
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
  join mine on mine.cid = c.id
  left join public.runs r on r.id = c.run_id
  left join peers on peers.cid = c.id
  left join last_msg lm on lm.cid = c.id
  left join unread on unread.cid = c.id
  order by lm.created_at desc nulls last;
$$;

-- ---------------------------------------------------------------------------
-- Broadcast from database — delivery is best-effort; the row is already
-- persisted, so a Realtime hiccup can never fail a message INSERT.
-- ---------------------------------------------------------------------------
create function public.broadcast_message_inserted ()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.broadcast_changes(
    'conversation:' || new.conversation_id::text, -- topic
    tg_op,                                        -- event ('INSERT')
    tg_op,                                        -- operation
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
exception when others then
  return null;
end; $$;

revoke execute on function public.broadcast_message_inserted () from public, anon, authenticated;

create trigger messages_broadcast
  after insert on public.messages
  for each row execute function public.broadcast_message_inserted ();

-- Private-channel subscribes are authorized by RLS on realtime.messages,
-- evaluated at subscribe time. Topic-prefixed so future features can add
-- sibling policies for their own prefixes.
create policy "conversation members can receive broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'conversation:%'
    and public.is_conversation_member (
      public.uuid_or_null (split_part(realtime.topic(), ':', 2)),
      (select auth.uid ())
    )
  );

-- ---------------------------------------------------------------------------
-- Backfill for pre-P3 rows (idempotent; covers hosted data created in P2).
-- ---------------------------------------------------------------------------
insert into public.conversations (kind, run_id)
select 'run', r.id
from public.runs r
where not exists (select 1 from public.conversations c where c.run_id = r.id);

insert into public.conversation_members (conversation_id, user_id)
select c.id, r.host_id
from public.conversations c
join public.runs r on r.id = c.run_id
on conflict do nothing;

insert into public.conversation_members (conversation_id, user_id)
select c.id, rm.user_id
from public.run_members rm
join public.conversations c on c.run_id = rm.run_id
where rm.status = 'approved'
on conflict do nothing;
