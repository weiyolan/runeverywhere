# P3 — Chat + Notifications (Weeks 8–9)

| | |
|---|---|
| **Depends on** | P1 (hosted Supabase project linked + pushed, real auth/session, `database.types.ts`, `Input`/`IconButton`, `supabase/tests/` convention) · P2 (core loop live: `run/[id]` detail + `requests`/`roster` screens, `join_run`/`respond_to_join_request` in use, migrations `00000000000020`–`00000000000029`) · EAS project linked (`extra.eas.projectId` filled by `eas init`, a P0/P1 precondition) |
| **Provides to later phases** | `conversations`/`conversation_members`/`messages` + Broadcast-from-DB delivery (the private-channel + `realtime.messages` policy pattern — note no later v1 phase consumes it: P4 uses no Realtime at all and P5's live share polls `live_locations` via an Edge Function; the pattern simply stays available for post-v1 live features); `notifications` + `push_tokens` + `send-push` pipeline (P4 review prompts, P5 badge/leaderboard notifications extend `notification_kind`); pg_cron + pg_net enabled; `mark_conversation_read`, `get_or_create_dm` RPCs |
| **Verify gate (PLAN.md §5)** | "Realtime A→B; push with app killed; reminder fires" |

## Goal

Ship the communication layer of the core loop: per-run group chat and 1:1 DMs delivered via Supabase Realtime "Broadcast from database" over private channels, an unread-count messages tab, a notification center backed by a single `notifications` table, and a push pipeline (`notifications` INSERT → pg_net → `send-push` Edge Function → Expo Push API) with pg_cron T-60-minute run reminders. Everything is persisted-first: messages are rows under RLS, broadcast is a delivery optimization, and in-app badge counts and push can never disagree because they read the same table (PLAN.md §2).

## Definition of done

1. Migrations `00000000000030_chat.sql`, `00000000000031_notifications.sql`, `00000000000032_push_pipeline.sql` apply cleanly on a fresh `supabase db reset` and on the hosted project via `supabase db push`.
2. Creating a run auto-creates its `kind='run'` conversation with the host as first member; approving a runner (or an open-run direct join) adds them to `conversation_members` and posts a `kind='system'` "joined" message.
3. A runner cancelling an approved spot, or the host removing one, deletes their `conversation_members` row (they lose chat access) and posts the matching system message.
4. Two devices, two accounts, same run chat: a message sent on A renders on B in **< 1 s** without refetch, via a private `conversation:{id}` Broadcast channel.
5. A third signed-in account that is NOT a member cannot read that conversation or its messages — proven by `supabase/tests/rls_chat_smoke.sql` — and cannot subscribe to its Broadcast channel (subscribe errors / receives nothing), proven **on-device** in verification step 8. A psql script cannot exercise the subscribe path: `realtime.topic()` and the `extension` column are populated by the Realtime server during a websocket join, not by role-played SQL sessions.
6. Only the visible chat screen holds a Realtime subscription; leaving the screen tears it down (verify via Realtime inspector / `supabase.getChannels()` — PLAN.md §6 quota mitigation).
7. Optimistic send: the message appears instantly, is reconciled by id when the INSERT returns, and a failed INSERT shows a retry affordance — the persisted row is the source of truth, never the broadcast.
8. Host can set/update the meeting point; it persists as a `messages.kind='meeting_point'` row, renders in-stream and as the pinned banner, and notifies members. Non-hosts cannot insert `meeting_point` rows (RLS).
9. `get_or_create_dm` returns the same conversation id when called from either side, concurrently-safe; DM entry points on `run/[id]` (host card) and roster rows work.
10. `(tabs)/messages` lists run groups + DMs with last-message preview, relative time, and unread pill computed from `last_read_at`; opening a chat zeroes its unread everywhere (list, tab badge, notification center) via `mark_conversation_read`.
11. Messages tab dot on the TabBar reflects any unread conversation; bell badge on the Runs header reflects unread `notifications` count.
12. `/notifications` renders Today/Earlier sections, "MARK ALL READ" works, and tapping a row deep-navigates by kind (requests → `run/[id]/requests`, approvals/reminders → `run/[id]`, messages → `chat/[conversationId]`).
13. Notifications rows are created for: join request received (host), request approved/declined (runner), direct join on an open run (host), new chat message (deduped: max one unread row per conversation per recipient), run reminder T-60.
14. Push token registration: on grant, `getExpoPushTokenAsync({ projectId })` result is upserted into `push_tokens`; sign-out deletes the device's token row.
15. Push arrives on a **physical device with the app killed**, for both a chat message and a request approval; tapping it cold-starts the app and lands on the right screen.
16. Foreground suppression: a chat push for the conversation currently on screen shows no banner; any push for another conversation does.
17. Android uses channels `messages` / `requests` / `reminders`; iOS permission prompt happens contextually (first join request or first run publish), never at app launch.
18. pg_cron: a run starting in < 60 min produces exactly one `run_reminder` notification per participant (re-runs of the job insert nothing — idempotent), and the push is delivered.
19. Expo receipt checking runs (cron every 30 min → `send-push` `mode:'receipts'`) and a `DeviceNotRegistered` token is deleted from `push_tokens` (verify by inserting a fake token).
20. `seed.sql` gives the local stack a demoable state: maya approved into two of marco's runs, a seeded conversation with user + system + meeting-point messages, and one unread notification.
21. P2's `Avatar` (sizes, initials fallback, ring) and `Badge` (all tones, solid) ports verified against their `.d.ts` contracts and their `/dev/components` gallery sections render — verify-only (E1): both components and their gallery sections are P2 deliverables (P2 C2/C3/C9), not P3's.
22. CI green: `npm run typecheck`, `npm run lint`, `supabase db lint` (no errors), and `src/types/database.types.ts` diff-clean after `npm run db:types`.

## Preconditions

| Precondition | How to check |
|---|---|
| P2 verify gate passed (create → discover → request → approve across two devices) | Run the P2 verification script; `run/[id]`, `run/[id]/requests`, `run/[id]/roster` exist and work against the hosted project |
| Hosted project linked, migrations ≤ P2 pushed | `supabase migration list` shows local == remote through `0000000000002x` |
| `extra.eas.projectId` filled (`eas init` done) | Open [app.config.ts](../../app.config.ts) — `extra.eas.projectId` non-empty; `getExpoPushTokenAsync` hard-fails without it |
| Two physical devices (≥1 iOS, ≥1 Android ideal) with dev builds | Push does not work on simulators/emulators (`Device.isDevice` false) |
| Apple Developer membership (APNs key via EAS) | `eas credentials` → iOS → Push Notifications shows/creates an APNs key |
| Firebase project for FCM v1 (Android push) | console.firebase.google.com — create in Workstream E if missing |
| supabase CLI ≥ 2.x with local stack incl. edge runtime | `supabase start` boots; `curl http://127.0.0.1:54321/functions/v1/send-push -H "Authorization: Bearer $ANON_KEY"` reaches the stub (pre-C6 the local edge runtime still enforces JWT verification, so an *unauthenticated* curl returns 401 — that 401 also proves the function is reachable) |
| `expo-notifications` present (scaffold) | [package.json](../../package.json) — yes, `~56.0.19`; do NOT reinstall |

## Workstreams

### A — Migration `00000000000030_chat.sql`: conversations, members, messages, Broadcast

One file: `supabase/migrations/00000000000030_chat.sql`. All objects in `public` unless stated; every table `enable row level security` immediately after creation; all functions `set search_path = ''`.

**Function-privilege discipline (applies to all three migrations).** Every function in `public` is exposed as a PostgREST RPC (`[api] schemas` in [config.toml](../../supabase/config.toml) includes `public`) and Postgres grants EXECUTE to PUBLIC by default — so every function NOT meant to be client-called gets `revoke execute on function public.<fn>(<args>) from public, anon, authenticated;` immediately after creation: this migration's trigger functions (`handle_run_created`, `handle_run_member_conversation`, `broadcast_message_inserted`), migration 31's fan-out triggers (B3/B4), and migration 32's `get_secret` + job functions (C1/C3/C4). Keep EXECUTE for `authenticated` on the client RPCs (`get_or_create_dm`, `list_conversations`, `mark_conversation_read`) and on the RLS-policy helpers `is_conversation_member`/`uuid_or_null` — policy expressions evaluate as the calling role and break without it. F1 asserts the denials.

**A1. Enums + tables.**
- `create type public.conversation_kind as enum ('run', 'dm');`
- `create type public.message_kind as enum ('user', 'system', 'meeting_point');`
- `conversations`: `id uuid pk default gen_random_uuid()`, `kind conversation_kind not null`, `run_id uuid unique references public.runs(id) on delete cascade`, `dm_key text unique`, `created_at timestamptz not null default now()`. Check constraint `conversations_shape`: `(kind = 'run' and run_id is not null and dm_key is null) or (kind = 'dm' and run_id is null and dm_key is not null)`. `dm_key` = the two member uuids as text, sorted, joined with `:` — makes DM uniqueness a DB constraint, not app logic.
- `conversation_members`: `conversation_id uuid not null references conversations on delete cascade`, `user_id uuid not null references public.profiles(id) on delete cascade`, `joined_at timestamptz not null default now()`, `last_read_at timestamptz not null default now()`, `primary key (conversation_id, user_id)`; index `conversation_members_user_idx (user_id)`.
- `messages`: `id uuid pk default gen_random_uuid()` (client MAY supply its own uuid for optimistic reconciliation), `conversation_id uuid not null references conversations on delete cascade`, `sender_id uuid references public.profiles(id) on delete set null`, `kind message_kind not null default 'user'`, `body text not null check (char_length(body) between 1 and 2000)`, `created_at timestamptz not null default now()`; index `messages_conversation_created_idx (conversation_id, created_at desc)`.
- System-message bodies are machine codes, not prose: check `messages_system_body`: `kind <> 'system' or body in ('joined','left','removed')`. The client maps codes to copy (enables "You joined the run — say hi to the group." self-variant and future i18n).

**A2. Helpers (fiddly-part prerequisites).**
- `public.is_conversation_member(p_conversation_id uuid, p_user_id uuid) returns boolean` — `security definer stable`, returns false on null input, `exists(select 1 from public.conversation_members ...)`. Mirrors `is_run_member` from [00000000000001_core.sql](../../supabase/migrations/00000000000001_core.sql); definer avoids recursive RLS between `conversations` and `conversation_members`.
- `public.uuid_or_null(p text) returns uuid` — `immutable`, plpgsql with `begin return p::uuid; exception when others then return null; end;`. Needed because Postgres does NOT guarantee `AND` short-circuit order — a naked `::uuid` cast inside the Realtime policy can raise on non-conversation topics and kill every subscribe.

**A3. RLS policies (default deny — no insert/update/delete unless listed).**
- `conversations` SELECT to `authenticated`: `public.is_conversation_member(id, (select auth.uid()))`. No client writes ever (creation is triggers/RPCs).
- `conversation_members` SELECT to `authenticated`: `user_id = (select auth.uid()) or public.is_conversation_member(conversation_id, (select auth.uid()))` (co-members see each other for avatar stacks). No client writes; `last_read_at` moves only through `mark_conversation_read` (B4).
- `messages` SELECT to `authenticated`: `public.is_conversation_member(conversation_id, (select auth.uid()))`. INSERT to `authenticated` with check: `sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id, (select auth.uid())) and (kind = 'user' or (kind = 'meeting_point' and exists (select 1 from public.conversations c join public.runs r on r.id = c.run_id where c.id = conversation_id and r.host_id = (select auth.uid()))))`. No UPDATE/DELETE — no message editing in v1 (Decisions). `kind='system'` is unreachable from clients; the membership trigger (definer, table-owner) inserts those.

**A4. Run-conversation lifecycle trigger.** `public.handle_run_created()` — `security definer`, AFTER INSERT ON `public.runs`: insert `conversations (kind, run_id) values ('run', new.id)`; insert host into `conversation_members`. **Decision: conversation is created at run INSERT** (not at first approved member) — invariant "every run has exactly one conversation" is enforceable with `run_id unique`, the host can post the meeting point before anyone joins, chat entry points never race a lazily-created row, and empty conversations cost one row. Backfill at the end of this migration for pre-P3 rows (idempotent, covers hosted data created during P2): insert missing conversations for all runs, then host + `status='approved'` `run_members` into `conversation_members` via `on conflict do nothing`.

**A5. Membership sync trigger.** `public.handle_run_member_conversation()` — `security definer`, AFTER INSERT OR UPDATE OF status ON `public.run_members`, for each row:
- Became approved (`TG_OP='INSERT' and new.status='approved'` — open/invite direct join — or `TG_OP='UPDATE' and old.status='pending' and new.status='approved'`): upsert into `conversation_members` (`on conflict do nothing`, `last_read_at = now()`), then insert `messages (conversation_id, sender_id, kind, body)` = (`run conversation`, `new.user_id`, `'system'`, `'joined'`).
- Left approved state (`old.status='approved' and new.status in ('cancelled','removed')`): delete the `conversation_members` row; system message body `'left'` (cancelled) or `'removed'` (removed), `sender_id = new.user_id`.
- All other transitions: no-op. Resolve the conversation id via `select id from public.conversations where run_id = new.run_id` (guard: if not found — pre-backfill edge — return early rather than raise).

**A6. DM RPC.** `public.get_or_create_dm(p_other_user uuid) returns uuid` — `security definer`:
- Raise on `p_other_user is null`, `= auth.uid()`, or no such profile.
- `v_key := least(v_uid::text, p_other_user::text) || ':' || greatest(...)`.
- `insert into conversations (kind, dm_key) values ('dm', v_key) on conflict (dm_key) do nothing;` then `select id into v_id ... where dm_key = v_key;` then insert both `conversation_members` rows `on conflict do nothing`. Race-safe via the unique constraint; returns `v_id`. (Block checks arrive with P5 `blocks` — this function gets a guard clause then; noted in Out of scope.)

**A7. Conversation list RPC.** Per-row unread counts + last message don't compose in one PostgREST call, so: `public.list_conversations() returns table (conversation_id uuid, kind public.conversation_kind, run_id uuid, run_type public.run_type, starts_at timestamptz, title text, member_count integer, peer_ids uuid[], peer_names text[], peer_avatars text[], last_body text, last_kind public.message_kind, last_sender_id uuid, last_at timestamptz, unread_count bigint)` — `security invoker stable` (RLS does the filtering; scale is fine at v1). Semantics: rows = conversations where caller is a member; `title` = run title for `run` kind, other member's `display_name` for `dm`; `peer_*` = up to 3 non-self members ordered by `joined_at` (avatar stack); `last_*` = latest message (null-safe for empty conversations); `unread_count` = `count(messages where created_at > my last_read_at and sender_id is distinct from auth.uid())`. Order: `last_at desc nulls last`.

**A8. Broadcast from database** (cite: [Subscribing to database changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes), [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization) — both fetched-blocked from this sandbox on 2026-07-04; signatures below are per those docs as of the plan's knowledge date and MUST be re-verified against the docs by the executor before writing SQL):

```sql
create or replace function public.broadcast_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'conversation:' || new.conversation_id::text,  -- topic
    tg_op,                                         -- event  ('INSERT')
    tg_op,                                         -- operation
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
exception when others then
  return null;  -- delivery is best-effort; the row is already persisted
end;
$$;

create trigger messages_broadcast
  after insert on public.messages
  for each row execute function public.broadcast_message_inserted();
```

The exception guard means a Realtime hiccup (or seeding before Realtime is up) can never fail a message INSERT — persisted-first per PLAN.md §2.

**A9. The authorization policy on `realtime.messages` (the fiddly part).** Private-channel subscribes are authorized by RLS on `realtime.messages`, evaluated **at subscribe time** using `realtime.topic()` and the `extension` column:

```sql
create policy "conversation members can receive broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'conversation:%'
    and public.is_conversation_member(
          public.uuid_or_null(split_part(realtime.topic(), ':', 2)),
          (select auth.uid())
        )
  );
```

Gotchas the executor must respect: (a) use `uuid_or_null`, never a bare cast (A2); (b) no INSERT policy — clients never `channel.send()`, only the DB broadcasts, so client-write stays denied; (c) authorization is point-in-time at join — a member removed mid-session keeps the socket until unsubscribe/refresh; acceptable because the trigger removal also makes history unreadable (see Risks); (d) keep this policy topic-prefixed (`conversation:%`) so any future feature that adopts private channels can add a sibling policy for its own prefix without touching this one — note that no v1 phase actually does (P4 uses no Realtime; P5's live share polls via an Edge Function, no websockets); the pattern is for post-v1 live features.

**A10. Seed update** (`supabase/seed.sql`): after the existing fixtures, put maya (`…0001`) approved into both of marco's runs — minding what P2 already seeded: **UPDATE** her existing Old Town Loop `run_members` row from `pending` to `approved` (P2 B3 seeds her pending there; the `(run_id, user_id)` primary key makes a plain INSERT collide and break `supabase db reset` — DoD 1 — and the UPDATE also exercises A5's pending→approved trigger path), and **INSERT** a fresh `status='approved'` row for Monsanto Hills (no prior row; exercises A5's direct-join INSERT path). Both fire the triggers that auto-create membership + system messages. This supersedes P2 B3's host-inbox fixture — marco's Requests inbox no longer shows a seeded pending request (fine post-P3; if P2's `core_loop_smoke.sql` asserts on that seeded pending row, adjust the case to create its own pending request inside its `begin…rollback` block). Then add a meeting-point message from marco (`'Praça do Comércio · arch · 7:50'`), 3–4 user messages alternating senders, and leave one message unread for maya (set her `last_read_at` back an hour with a direct UPDATE at the end of seeding).

**A11. Commands + acceptance.** `supabase db reset` clean; `psql … -c "select count(*) from conversations"` = **4** — one per seeded run: the three original fixtures plus P2 B3's `Track Repeats` (hosted by maya); `select * from list_conversations()` as maya (via `set local role authenticated; set local request.jwt.claims …` per the P1 smoke-test pattern) returns **4 rows** — she hosts Sunset 5K + Track Repeats (A4 adds the host as first member) and is approved into Old Town Loop + Monsanto Hills (A10) — with `unread_count > 0` on exactly one.

### B — Migration `00000000000031_notifications.sql`: notifications + push_tokens + event fan-out

File: `supabase/migrations/00000000000031_notifications.sql`.

**B1. Enum + tables.**
- `create type public.notification_kind as enum ('join_request', 'request_approved', 'request_declined', 'member_joined', 'message', 'run_reminder');` (P4/P5 extend with `alter type … add value`.)
- `notifications`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references profiles on delete cascade` (recipient), `kind notification_kind not null`, `title text not null check (char_length(title) <= 80)`, `body text not null default '' check (char_length(body) <= 200)`, `run_id uuid references runs on delete cascade`, `conversation_id uuid references conversations on delete cascade`, `actor_id uuid references profiles on delete set null`, `created_at timestamptz not null default now()`, `read_at timestamptz`, `push_sent_at timestamptz`, `push_tickets jsonb`, `push_checked_at timestamptz`. Indexes: `(user_id, created_at desc)`; unique partial `notifications_reminder_once (user_id, run_id, kind) where kind = 'run_reminder'` (reminder idempotency); unique partial `notifications_message_dedupe (user_id, conversation_id) where kind = 'message' and read_at is null` (one unread chat row per conversation).
- `push_tokens`: `token text pk` (Expo push token, e.g. `ExponentPushToken[…]`), `user_id uuid not null references profiles on delete cascade`, `platform text not null check (platform in ('ios','android'))`, `updated_at timestamptz not null default now()`; index `(user_id)`.

**B2. RLS.**
- `notifications`: SELECT own (`user_id = (select auth.uid())`); UPDATE own with same check — then restrict the writable surface with column privileges: `revoke update on public.notifications from authenticated; grant update (read_at) on public.notifications to authenticated;` so a client can only ever set `read_at`. No INSERT/DELETE for clients (writes come from definer triggers/functions).
- `push_tokens`: one FOR ALL policy `using/with check (user_id = (select auth.uid()))` — a device registers, refreshes, and deletes its own tokens.

**B3. Chat → notification fan-out.** `public.handle_message_notification()` — `security definer`, AFTER INSERT ON `public.messages`, `when (new.kind in ('user','meeting_point'))` (system messages never notify). For each member of the conversation except the sender: **delete-then-insert** the unread `message` notification — `delete from notifications where user_id = m.user_id and conversation_id = new.conversation_id and kind = 'message' and read_at is null;` then INSERT **with `on conflict (user_id, conversation_id) where kind = 'message' and read_at is null do nothing`**. The conflict guard is mandatory: two messages sent concurrently in the same conversation both fire this trigger, and under READ COMMITTED the second transaction's DELETE cannot see the first's uncommitted row — without the guard the second INSERT raises `unique_violation` against B1's partial index and aborts that sender's entire `messages` INSERT (this trigger touches neither Realtime nor pg_net, so it is deliberately NOT exception-guarded). Cost: the message that loses the race window doesn't create a fresh row, so it doesn't re-push — acceptable. Delete+insert (not upsert) keeps the push trigger (C2) INSERT-only and the center deduped — the honest simple v1 (Decisions): every message re-notifies, no rate limiting, foreground suppression is the client's job (E4). Content: run conversations → `title = left(sender display_name || ' · ' || run title, 80)`, DMs → `title = sender display_name` (≤ 40, no truncation needed). The `left(…, 80)` is load-bearing: `profiles.display_name` and `runs.title` each allow 40 chars ([00000000000001_core.sql](../../supabase/migrations/00000000000001_core.sql)), so the untruncated concatenation reaches 83 and would trip B1's `char_length(title) <= 80` check — aborting the user's message INSERT for long-but-valid names/titles. `body = left(new.body, 140)` (meeting-point: `'Meeting point: ' || left(body, 120)`); `actor_id = new.sender_id`, `conversation_id`, `run_id` (null for DMs).

**B4. Run-member → notification fan-out.** `public.handle_run_member_notification()` — `security definer`, second AFTER INSERT OR UPDATE OF status trigger ON `run_members` (kept separate from A5 so migration 30 has no forward reference to `notifications`):
- INSERT with `status='pending'` → notify **host**: kind `join_request`, title `<runner> wants to join`, body `<run title> · tap to review`, `actor_id = runner`.
- UPDATE pending→approved → notify **runner**: `request_approved`, title `You're in!`, body `<host> accepted you into <run title>` (copy from the Main Flow prototype).
- UPDATE pending→declined → notify **runner**: `request_declined`, title `Request not accepted`, body `<run title> — keep exploring, more runs nearby`.
- INSERT with `status='approved'` (open/invite direct join) → notify **host**: `member_joined`, title `left(<runner> || ' joined ' || <run title>, 80)` — the only B4 title concatenating a name with a run title (40 + 8 + 40 = 88 untruncated; B1 caps at 80, and this trigger is not exception-guarded, so an overflow would abort the whole `join_run` direct-join transaction — same rule as B3), body `Your run now has <n> runners going`.
- Re-request after decline (`join_run`'s upsert path fires UPDATE …→pending): treat as `join_request` to host again.

**B5. Read-state RPC.** `public.mark_conversation_read(p_conversation_id uuid) returns void` — `security definer`: raise if caller not a member; `update conversation_members set last_read_at = now() where conversation_id = … and user_id = auth.uid();` and `update notifications set read_at = now() where user_id = auth.uid() and conversation_id = … and kind = 'message' and read_at is null;`. One call keeps unread pill, tab dot, and center consistent.

**B6. Acceptance.** SQL-level: as marco, `join_run` from maya's session on an approval run → marco has a `join_request` notification; approve → maya has `request_approved`; maya sends a message → marco has exactly one unread `message` row even after 3 more messages; `mark_conversation_read` clears it. Add these as `begin…rollback` blocks to `supabase/tests/rls_chat_smoke.sql` (F below).

### C — Migration `00000000000032_push_pipeline.sql`: pg_net, pg_cron, reminders, receipts

File: `supabase/migrations/00000000000032_push_pipeline.sql`.

**C1. Extensions + secrets plumbing.**
- `create extension if not exists pg_net with schema extensions;`
- `create extension if not exists pg_cron;` (installs into schema `pg_cron`/`cron`; on hosted Supabase this works from a migration because `db push` runs as `postgres`; the job list appears in Dashboard → Integrations → Cron. Locally the CLI's Postgres image ships both extensions — **no `config.toml` change needed** for either.)
- Config lives in **Supabase Vault** (works identically local/hosted, keeps URLs+secrets out of migrations): secrets `project_url` and `send_push_secret`. Helper `public.get_secret(p_name text) returns text` — `security definer stable`, `select decrypted_secret from vault.decrypted_secrets where name = p_name`, returns null if absent. Immediately after creating it: `revoke execute on function public.get_secret(text) from public, anon, authenticated;` (function-privilege discipline, A-preamble). This revoke is a security boundary, not hygiene: without it, `get_secret` is a PostgREST RPC with default EXECUTE-to-PUBLIC, so any signed-in (or `anon`) user could `POST /rest/v1/rpc/get_secret` with `{"p_name":"send_push_secret"}`, read the shared secret, and — since C6 sets `verify_jwt = false` and the secret is `send-push`'s only auth — push arbitrary notifications to arbitrary users' devices. Only `postgres`-owned definer callers (the C2 trigger, C3/C4 jobs) need it. F1 asserts the denial. Local values go in `supabase/seed.sql`: `select vault.create_secret('http://supabase_kong_runeverywhere:8000', 'project_url');` (Kong's docker-network hostname is `supabase_kong_<project_id>` and `project_id = "runeverywhere"` per [config.toml](../../supabase/config.toml) — this is the portable local URL; `host.docker.internal` is macOS/Windows-only) and `select vault.create_secret('local-dev-push-secret', 'send_push_secret');`. Hosted values are set ONCE in the SQL editor with the real `https://<ref>.supabase.co` and a generated secret (documented in the runbook task C6).

**C2. Push trigger.** `public.handle_notification_push()` — `security definer`, AFTER INSERT ON `public.notifications`: read both secrets via `get_secret`; if either is null, return (local stacks without setup keep working). Else `perform net.http_post(url := v_url || '/functions/v1/send-push', headers := jsonb_build_object('Content-Type','application/json','x-push-secret', v_secret), body := jsonb_build_object('mode','deliver','record', to_jsonb(new)), timeout_milliseconds := 5000);` wrapped in an exception guard. pg_net is async — the INSERT never blocks on Expo.

**C3. Reminder job.** `public.enqueue_run_reminders() returns void` — `security definer`: for every `runs` row with `status='published' and starts_at > now() and starts_at <= now() + interval '60 minutes'`, insert a `run_reminder` notification for the host and every `approved` member: title `<run title> starts soon`, body `to_char(starts_at, 'HH24:MI') || ' · ' || area_name` (UTC-rendered — acceptable best-effort for the push body; the app shows the correct local time once opened via `run_id`), `run_id` set. `on conflict (user_id, run_id, kind) where kind = 'run_reminder' do nothing` — the partial unique index makes 5-minute re-runs idempotent, which is why the job can run far more often than the T-60 semantic requires. Schedule: `select cron.schedule('run-reminders', '*/5 * * * *', $$select public.enqueue_run_reminders()$$);` (`cron.schedule` upserts by job name — re-running the migration is safe). Plus `revoke execute on function public.enqueue_run_reminders() from public, anon, authenticated;` — cron runs it as `postgres`; it must not be a client-callable RPC.

**C4. Receipts job.** `public.request_push_receipts() returns void` — `security definer`, same pg_net POST as C2 but body `{"mode":"receipts"}`; `select cron.schedule('push-receipts', '*/30 * * * *', $$select public.request_push_receipts()$$);` and `revoke execute on function public.request_push_receipts() from public, anon, authenticated;` (same reasoning as C3).

**C5. Edge Function `supabase/functions/send-push/index.ts`** — replace the stub (it already documents this pipeline):
- Auth: reject unless `req.headers.get('x-push-secret') === Deno.env.get('SEND_PUSH_SECRET')` → 401. Service client from auto-injected `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (`jsr` or `npm:@supabase/supabase-js@2` import).
- `mode:'deliver'`: select `push_tokens` for `record.user_id`; if none, 200 `{sent:0}`. Build one Expo message per token: `{ to, sound:'default', title: record.title, body: record.body, priority:'high', channelId: channelFor(record.kind), data: { url: deepLinkFor(record), notificationId: record.id, conversationId: record.conversation_id, runId: record.run_id } }` where `channelFor` maps `message→'messages'`, `run_reminder→'reminders'`, everything else →`'requests'`; `deepLinkFor` maps `message→'/chat/'+conversation_id`, `join_request→'/run/'+run_id+'/requests'`, else →`'/run/'+run_id`. Chunk ≤100, POST `https://exp.host/--/api/v2/push/send` ([Expo push docs](https://docs.expo.dev/push-notifications/sending-notifications/)). Immediately delete `push_tokens` rows whose *ticket* comes back `status:'error'` + `details.error:'DeviceNotRegistered'`. Persist `update notifications set push_sent_at = now(), push_tickets = <[{id, token}] array>` for the record. (Storing tickets on the notification row avoids a sixth table, which P3 is not allowed to create.)
- `mode:'receipts'`: select up to 300 notifications with `push_tickets is not null and push_checked_at is null and push_sent_at < now() - interval '30 minutes'`; POST ids to `https://exp.host/--/api/v2/push/getReceipts`; for each receipt `status:'error'` with `details.error:'DeviceNotRegistered'`, delete that token from `push_tokens`; set `push_checked_at = now()` on all processed rows.
- Always return JSON `{ ok, sent | checked }`; log errors, never throw for a single bad token.

**C6. Function config + secrets (exact keys).**
- [supabase/config.toml](../../supabase/config.toml): append
  ```toml
  [functions.send-push]
  verify_jwt = false
  ```
  (the caller is Postgres, not a user JWT; the shared secret is the auth).
- Local env: create `supabase/functions/.env` (gitignore it; commit `supabase/functions/.env.example`) containing `SEND_PUSH_SECRET=local-dev-push-secret` — matching the Vault seed. The CLI's local edge runtime / `supabase functions serve --env-file supabase/functions/.env` picks it up (verify which applies to the installed CLI version at execution time).
- Hosted: `supabase secrets set SEND_PUSH_SECRET=<openssl rand -hex 24>` (same value as the Vault `send_push_secret` set in C1's hosted step), then `supabase functions deploy send-push --no-verify-jwt`.
- Acceptance: `curl -X POST <local url>/functions/v1/send-push -H 'x-push-secret: local-dev-push-secret' -H 'Content-Type: application/json' -d '{"mode":"deliver","record":{"user_id":"00000000-0000-4000-8000-000000000001","kind":"message","title":"t","body":"b","id":"<uuid>"}}'` returns `{"ok":true,"sent":0}` (no tokens locally); wrong secret → 401.

### D — Client: chat data layer + screens

**D1. Install additions** (only these; check [package.json](../../package.json) first — `expo-notifications`, `expo-constants`, `expo-device`? no — device is absent): `npx expo install expo-device expo-crypto` (native modules → new dev builds required, batch with E5's rebuild). `expo-device` gates registration to physical hardware; `expo-crypto` provides `Crypto.randomUUID()` for client-generated message ids.

**D2. `src/lib/chat.ts`** — typed service module (P1 convention, screens stay presentational): `listConversations()` (RPC A7), `fetchMessagesPage(conversationId, cursor?)` (PostgREST: `from('messages').select('*, sender:profiles(id, display_name, avatar_url)').eq('conversation_id', id).order('created_at', { ascending: false }).limit(30)` + `.lt('created_at', cursor)` when paging), `sendMessage({ id, conversationId, body, kind })` (`insert(...).select().single()` — the INSERT persists first; broadcast is the DB trigger's job, the client never `channel.send()`s), `getOrCreateDm(otherUserId)`, `markConversationRead(id)`, `latestMeetingPoint(conversationId)` (`kind=eq.meeting_point`, order desc, limit 1). Also extend `src/lib/queryKeys.ts` here — P2 D1's file is binding ("later phases MUST extend this file, never invent ad-hoc keys") and already reserves the P3 shapes: `qk.conversations() = ['conversations']`, `qk.conversationMessages(id) = ['conversation', id, 'messages']`, `qk.notifications() = ['notifications']`; add `qk.notificationsUnread() = ['notifications', 'unread-count']` for D8.

**D3. `src/lib/realtime.ts`** — `subscribeToConversation(conversationId, onInsert)`: `supabase.channel('conversation:' + id, { config: { private: true } }).on('broadcast', { event: 'INSERT' }, (msg) => onInsert(msg.payload.record)).subscribe()`; returns an unsubscribe closure (`supabase.removeChannel`). Also export `syncRealtimeAuth()` calling `supabase.realtime.setAuth()`; wire it into the session store's auth-state-change handler (private channels require the access token on the socket; call it on sign-in and token refresh).

**D4. `src/stores/chat.ts`** — tiny zustand store: `activeConversationId: string | null` + setter. Written by the chat screen on focus/blur; read by the push foreground handler (E4) for suppression. That is the entire suppression mechanism — deliberately no server-side presence (Decisions).

**D5. Rewrite `src/app/(tabs)/messages.tsx`.** Data: `useQuery(['conversations'], listConversations)`. UI per the Main Flow "MESSAGES LIST" section: `screenTitle` "MESSAGES", search `Input` (client-side filter over title + peer names — no server search in v1), section label "RUN GROUPS" then "DIRECT" (`textStyles` caption-caps, `colors.ink*`), rows as cards: run rows have a 5px left border in the run-type color (`runType[type].main` from [theme.ts](../../src/theme/theme.ts) — the record's keys are `main`/`soft`/`ink`/`label`), stacked `Avatar size="sm"` (≤3), uppercase Saira Condensed title, truncated last-message preview (system codes render as e.g. "Maya joined"), `date-fns` relative time, unread pill (`Badge tone="danger" solid`, count from `unread_count`); DM rows use a single `Avatar` + regular-case name. States: loading skeleton (3 gray cards), error (retry button), empty ("No conversations yet — join a run to unlock its group chat." + EXPLORE RUNS button → tabs index). Row tap → `router.push('/chat/' + conversation_id)`. Pull-to-refresh invalidates the query.

**D6. `src/app/chat/[conversationId].tsx`** (new route; register in the root stack with `headerShown:false`).
- **Header**: back chevron; run chats — colored square icon block (run-type color), uppercase title, subtitle `You + <n-1> going · <EEE HH:mm>`, info `IconButton` → `router.push('/run/' + runId)`; DMs — `Avatar`, peer name, subtitle = peer `home_city ?? 'Runner'`, no info button in v1.
- **Pinned meeting-point banner** (run chats only): dark card per the design (ink background, volt pin icon, "MEETING POINT" volt caption, body text, volt MAP button → `/run/[id]`, which owns the map). Host sees "SET MEETING POINT" ghost card when none exists and an edit affordance when one does; both open a minimal modal (`Input` maxLength 200 + SAVE `Button`) that calls `sendMessage({ kind:'meeting_point' })`. Latest `meeting_point` message wins.
- **List**: `FlatList inverted` fed by `useInfiniteQuery(qk.conversationMessages(id))` pages (D2) — the key is `['conversation', id, 'messages']`, exactly the shape P2 D1 reserved for P3; `onEndReached` loads older. Bubbles: mine = ink bg/white text, right-aligned, radius 15/15/5/15; others = white bg + hairline border, left, avatar+name shown only when the previous (older) message has a different sender; system messages = centered gray pill mapping codes (`joined` → `<name> joined the run`, self → "You joined the run — say hi to the group.", `left`/`removed` accordingly); `meeting_point` renders in-stream as a mini version of the banner. Timestamps small under bubbles.
- **Realtime**: `useFocusEffect` — on focus: set `activeConversationId`, subscribe via D3, call `markConversationRead`; on new broadcast record: append to the query cache (dedupe by `id`), and if focused re-call `markConversationRead`; on blur: unsubscribe, clear `activeConversationId`. **Only this screen ever subscribes** (PLAN.md §6).
- **Composer**: pill `Input` placeholder "Message the group"/"Message <name>", maxLength 2000, volt circular send `IconButton`. Optimistic send: generate `id = Crypto.randomUUID()`, append `{ id, status:'sending' }` to cache, call `sendMessage`; on success mark sent (broadcast echo dedupes by id); on error mark failed with tap-to-retry, keep input restorable. Sending disabled while empty.
- States: full-screen loader on first page; error retry; a just-created run chat shows only the host's system-free empty stream with the meeting-point ghost card.
- Acceptance: all Definition-of-done items 4, 6, 7, 8 demonstrable on this screen.

**D7. DM entry points (modify P2 screens).** `run/[id]` host card gets a "MESSAGE" ghost `Button` (visible when viewer is an approved member or the host viewing a member profile context) and `run/[id]/roster` rows get a message `IconButton` (host ↔ approved members): both call `getOrCreateDm(userId)` then `router.push('/chat/' + id)` (loading state on the button while the RPC runs).

**D8. Tab badge.** `src/hooks/useUnreadBadges.ts`: exposes `{ messagesUnread, notificationsUnread }` from two queries — `['conversations']` (any `unread_count > 0`) and `['notifications','unread-count']` (`from('notifications').select('id', { count:'exact', head:true }).is('read_at', null)`). Both invalidated by: chat focus (`markConversationRead`), notification-center actions, and any push received in foreground (E4 listener). `(tabs)/_layout.tsx` passes `messagesBadge` into the existing `TabBar` prop ([TabBar.tsx](../../src/components/ui/TabBar.tsx) already supports it).

### E — Client: notification center + push registration

**E1. Verify P2's `Avatar` + `Badge` ports (verify-only — no porting in P3).** Both components belong to P2 (tasks C2/C3; gallery sections via C9) — do NOT re-port them or re-claim them as P3 deliverables. Confirm `src/components/ui/Avatar.tsx` and `src/components/ui/Badge.tsx` satisfy what this phase consumes, per their contracts: [Avatar.d.ts](../../run-everywhere-app-design/project/components/data/Avatar.d.ts) `src/name/size xs–xl/verified/ring` — initials fallback from `name`, `size="sm"` for D5's avatar stacks, row avatars in E2; [Badge.d.ts](../../run-everywhere-app-design/project/components/data/Badge.d.ts) `tone neutral|ink|volt|go|warn|danger|star`, `icon`, `solid` — `tone="danger" solid` unread pills (D5) and the bell-count badge (E2). Confirm both `/dev/components` gallery sections render. Any mismatch is a P2 defect: fix with the smallest diff against the `.d.ts`, not a re-port.

**E2. `src/app/notifications.tsx`** (root-level route per PLAN.md §4). Header: back + "NOTIFICATIONS" + "MARK ALL READ" text button (`update notifications set read_at`—PostgREST `update({ read_at: new Date().toISOString() }).is('read_at', null)`; column grant B2 makes this safe). Body: `useInfiniteQuery(['notifications'])`, pages of 30 ordered `created_at desc`; sections "TODAY" / "EARLIER" split on `startOfDay` (date-fns). Row: `Avatar` (actor avatar/initials; fallback ink circle for reminders) with a kind-colored 18px dot badge (`join_request`→challenge red, `request_approved`/`member_joined`→go-green, `message`→discover blue, `run_reminder`→volt — mirrors the prototype's mapping onto canonical tokens), bold title, gray body, relative time, volt unread dot. Unread rows get the white card treatment; read rows are flat. Tap: optimistically set `read_at`, then navigate by kind (C5's same mapping: `join_request`→`/run/[id]/requests`, `message`→`/chat/[conversationId]`, else `/run/[id]`). States: loading skeleton, error retry, empty ("Nothing yet — go find a run.").
- Entry point: bell `IconButton` with red count `Badge` in the `(tabs)/runs.tsx` header (the Main Flow places it on "YOUR RUNS"), count from D8's hook, `router.push('/notifications')`.

**E3. `src/lib/notifications.ts`** — registration + channels:
- `ensureAndroidChannels()`: `Notifications.setNotificationChannelAsync` for `messages` (importance DEFAULT), `requests` (HIGH), `reminders` (HIGH) — called once at root layout mount (channel creation needs no permission).
- `registerForPush(): Promise<boolean>`: bail unless `Device.isDevice`; `getPermissionsAsync` → if undetermined `requestPermissionsAsync` (this is the single iOS prompt + Android 13 `POST_NOTIFICATIONS` runtime prompt); on granted, `getExpoPushTokenAsync({ projectId: Constants.expoConfig?.extra?.eas?.projectId })` — throw a descriptive error if projectId is missing (the P0 `eas init` dependency) — then `upsert` into `push_tokens` `{ token, user_id, platform: Platform.OS, updated_at }`. Call sites (prompt **timing** decision): (a) after the first successful `join_run` ("get notified when the host responds"), (b) after publishing a run (host wants requests), (c) an inline "TURN ON NOTIFICATIONS" card atop `/notifications` when permission is undetermined. Never at launch. If previously denied, (c) deep-links to OS settings via `Linking.openSettings()`.
- `unregisterPush()`: delete this device's token row — wire into the sign-out path in `src/lib/auth.ts`.

**E4. Foreground/response handling** (root `_layout.tsx` effect + `src/lib/notifications.ts`):
- `Notifications.setNotificationHandler`: `shouldShowBanner/shouldPlaySound: !(data.conversationId && data.conversationId === useChatStore.getState().activeConversationId)` — the whole in-view suppression story (server always sends; the visible chat swallows its own banners; killed/background apps by definition aren't viewing).
- `addNotificationReceivedListener`: invalidate `['conversations']`, `['notifications']`, `['notifications','unread-count']`.
- `addNotificationResponseReceivedListener` + `getLastNotificationResponseAsync` (cold start): `router.push(data.url)` — covers the app-killed tap in the verify gate.

**E5. Native config + credentials.**
- [app.config.ts](../../app.config.ts): change the plain `'expo-notifications'` plugin entry to `['expo-notifications', { icon: './assets/images/notification-icon.png', color: '#CCFF00' }]`; create the 96×96 white-on-transparent glyph asset. Add `android.googleServicesFile: './google-services.json'`.
- Firebase: create project → add Android app `com.runeverywhere.app` → download `google-services.json` to repo root (it contains no secrets but add to the repo consciously; standard practice is committing it) → Firebase console: generate a service-account key → `eas credentials` → Android → Google Service Account → upload for **FCM v1** ([Expo FCM docs](https://docs.expo.dev/push-notifications/fcm-credentials/)).
- iOS: `eas credentials` → iOS → Push Notifications key (EAS creates/manages the APNs key).
- Rebuild dev clients (`eas build --profile development` both platforms, or local `npx expo run:ios|android`) — required by the new native modules (D1) + notification config.
- Acceptance: Expo push tool (`https://expo.dev/notifications`) delivers a test push to a device token from `push_tokens`.

### F — Verification pass (always last)

**F1. `supabase/tests/rls_chat_smoke.sql`** (extends the P1 pattern; `begin…rollback` blocks, role-played JWTs for maya/marco + a third user created in the script): non-member SELECT on `conversations`/`messages` returns 0 rows; non-member message INSERT → RLS error; member INSERT `kind='system'` → check/RLS error; non-host INSERT `kind='meeting_point'` → RLS error; `get_or_create_dm` called both directions returns one id; `notifications` INSERT as authenticated → denied; UPDATE of `title` → permission denied, UPDATE of `read_at` → OK; message fan-out dedupe (B6); internal functions unreachable as RPCs — `select public.get_secret('send_push_secret')` under the role-played `authenticated` (and `anon`) session → permission denied, same for `public.enqueue_run_reminders()` and `public.request_push_receipts()` (A-preamble revokes); max-length fan-out — set a 40-char `display_name` and a 40-char run title, then send a message and direct-join an open run: both INSERTs succeed and every generated `notifications.title` is ≤ 80 (B3/B4 truncation). Run via `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_chat_smoke.sql`. Scope note: this script proves **table RLS and function privileges only** — the Broadcast-subscribe denial cannot be exercised from psql (`realtime.topic()` and the `extension` column exist only during a Realtime websocket join); that negative test lives in the manual script, step 8.

**F2. Manual QA script** — see Verification script section.

## Data model & security

Three migrations, P3 slots:

| File | Creates |
|---|---|
| `supabase/migrations/00000000000030_chat.sql` | Enums `conversation_kind`, `message_kind`; tables `conversations`, `conversation_members`, `messages` (+ indexes, checks per A1); helpers `is_conversation_member`, `uuid_or_null`; RLS per A3; triggers `handle_run_created` (runs INSERT → conversation + host member), `handle_run_member_conversation` (membership sync + system messages), `broadcast_message_inserted` (Realtime broadcast, exception-guarded); RPCs `get_or_create_dm`, `list_conversations`; policy on `realtime.messages` (A9); idempotent backfill for pre-existing runs; EXECUTE revoked on the trigger functions (A-preamble) |
| `supabase/migrations/00000000000031_notifications.sql` | Enum `notification_kind`; tables `notifications` (recipient, kind, title ≤80, body ≤200, run/conversation/actor FKs, read_at, push_sent_at/push_tickets/push_checked_at; reminder-idempotency + message-dedupe partial unique indexes), `push_tokens` (token PK, user, platform); RLS per B2 incl. `grant update (read_at)`; triggers `handle_message_notification` (delete+insert dedupe, conflict-guarded, `left(…,80)` titles), `handle_run_member_notification` (`left(…,80)` on the `member_joined` title); RPC `mark_conversation_read`; EXECUTE revoked on the trigger functions |
| `supabase/migrations/00000000000032_push_pipeline.sql` | Extensions `pg_net`, `pg_cron`; `get_secret` (Vault); trigger `handle_notification_push` (notifications INSERT → `net.http_post` → send-push, skip-if-unconfigured, exception-guarded); `enqueue_run_reminders` + cron `run-reminders` `*/5 * * * *`; `request_push_receipts` + cron `push-receipts` `*/30 * * * *`; EXECUTE on `get_secret`/`enqueue_run_reminders`/`request_push_receipts` revoked from `public`/`anon`/`authenticated` (C1/C3/C4) |

RLS review notes: every new table default-deny with explicit policies; all writes to `conversations`/`conversation_members`/`messages(kind='system')`/`notifications` flow through `security definer` triggers/RPCs (tier 1, PLAN.md §2); the only client INSERTs are `messages` (user/meeting_point, membership-checked) and `push_tokens` (own rows); `notifications` UPDATE is column-restricted to `read_at`; `realtime.messages` gets a topic-scoped SELECT policy only — no client broadcast writes. "No client writes" also means no client *calls*: every function not meant for clients has EXECUTE revoked from `public`/`anon`/`authenticated` (A-preamble) so nothing internal is reachable at `POST /rest/v1/rpc/*` — without that, `get_secret` would hand any signed-in user the `send-push` shared secret; F1 asserts the denials. Trigger functions that touch Realtime or pg_net swallow exceptions so chat/notification writes can never fail on delivery infrastructure; the notification fan-out triggers (B3/B4) are intentionally unguarded and instead made safe by `left(…,80)` titles and the B3 conflict guard. `supabase db lint` + `npm run db:types` after each migration.

## Design references

- **Flows**: `Run Everywhere - Main Flow.dc.html` — MESSAGES LIST (sectioned run groups/direct, left type-color bar, unread pills), RUN GROUP CHAT (header + pinned meeting-point card + bubbles + composer), DIRECT MESSAGE, NOTIFICATIONS (Today/Earlier, mark-all-read, kind-dot avatars); `Run Everywhere - Flow Map.dc.html` nodes `msgList`/`groupChat`/`dm`/`notifications` confirm IA (messages reachable from tab hub; notifications → msgList edge; "joined → group chat unlocks").
- **Contracts**: `project/components/data/Avatar.d.ts`, `Badge.d.ts` (ported in P2 C2/C3, verified against in E1); existing `TabBar` `messagesBadge` prop; `Input`/`IconButton` from P1.
- **Tokens**: `colors` (ink/paper/volt scales), `runType` per-type colors for chat headers and list bars, `textStyles.screenTitle`/caption groups, `radius.pill` composer, `shadows.volt` send button — all from [src/theme/theme.ts](../../src/theme/theme.ts).
- **Reconciliation calls** (PLAN.md "Design reconciliation" wins): prototype hex values (`#C8FA00` volt, `#FF3B30` red, `#16C172` green, `#1466FF` blue) are replaced by canonical tokens (Volt `#CCFF00`, Challenge `#FF3D2E`, go `#00C271`, Discover `#1463FF`); prototype's Social green in seed data → purple `#7C5CFC`; composer's `'Hanken Grotesk'` → Saira; all buttons uppercase verb-first; no emoji anywhere.

## Verification script

Setup: two physical devices (A = maya, B = marco) with fresh dev builds (E5), hosted project with migrations pushed, `send-push` deployed, secrets set, a third account C for negative tests.

1. `supabase db reset` locally → zero errors; `npm run db:types` → `git diff --exit-code src/types/database.types.ts` clean; `npm run typecheck && npm run lint`; `supabase db lint` clean; `psql … -f supabase/tests/rls_chat_smoke.sql` all blocks pass.
2. B creates an approval-required run → B's Messages tab shows the new run group (only member: B). B sets the meeting point → pinned banner renders.
3. A requests to join → B gets a `join_request` notification (bell badge increments); with B's app **killed**, repeat from account C → push arrives on B's lock screen; tapping cold-starts into `run/[id]/requests`.
4. B approves A → A gets "You're in!" push + notification; run chat appears in A's Messages list; chat stream shows the system "joined" pill and the meeting-point banner.
5. Both open the chat. A sends a message → **appears on B in < 1 s** (watch it land without touching the screen). B replies → same on A. Kill A's app, B sends → push arrives on A (killed-state chat push).
6. With A viewing the chat, B sends → **no banner** on A (foreground suppression), message just appears. A backgrounds the app, B sends → banner shows on channel `messages` (Android: check channel in system settings).
7. On B, leave the chat open on A's messages list: sending from A updates B's list preview + unread pill without B subscribing to the chat (list refresh via push-received invalidation); `supabase.getChannels()` (debug log) shows 0 conversation channels when no chat screen is focused, exactly 1 when one is.
8. Account C (never joined): Explore → cannot open the run chat anywhere; SQL smoke (F1) already proved C reads 0 conversation/message rows. The subscribe denial is proven **here, on-device** (psql cannot reach the subscribe path — DoD 5): on C's device (throwaway dev button or console), `supabase.channel('conversation:<id>', { config: { private: true } }).subscribe()` → status `CHANNEL_ERROR` (or times out), no events arrive; repeat with the garbage topic `conversation:not-a-uuid` → same clean denial, and a subsequent valid member subscribe from A still succeeds (a raising policy would kill every subscribe — the `uuid_or_null` guard, A2/A9).
9. DMs: from `run/[id]` roster, A messages B → chat opens; B taps message on A → **same** conversation id. Both directions deliver realtime.
10. A cancels their spot → system "left" pill visible to B; A's Messages list no longer shows the run group; A can no longer read history (RLS).
11. Reminder: B creates a run starting in 45 minutes and approves A → within 5 minutes both have a `run_reminder` notification + push; `select * from cron.job_run_details order by start_time desc limit 5` shows the job succeeding; re-run `select public.enqueue_run_reminders()` manually → 0 new rows (idempotent).
12. Receipts: insert a fake token `ExponentPushToken[dead]` for A, trigger any push, run `select public.request_push_receipts()` after 30 min (or temporarily lower the interval check) → fake token row deleted.
13. Notification center: MARK ALL READ zeroes the bell badge; row taps navigate per kind; unread dedupe = one chat row per conversation regardless of message count.
14. `/dev/components` shows the Avatar + Badge sections (P2's gallery work — E1 only verified them against their contracts).

## Risks & gotchas

| Risk | Mitigation |
|---|---|
| `realtime.messages` policy raises on cast → **all** private-channel subscribes fail | `uuid_or_null` helper + `like 'conversation:%'` guard (A2/A9); never rely on AND ordering. Test subscribe with a garbage topic on-device in verification step 8 — F1's psql script cannot reach the subscribe path |
| Realtime auth is subscribe-time — removed member keeps an open socket until leave/refresh | Accepted v1: history is already unreadable via RLS; screen blur unsubscribes; token refresh re-evaluates. Documented, not engineered around |
| Realtime quotas (200 free concurrent, PLAN.md §6) | Only the focused chat subscribes (D6); no list-level subscriptions — list freshness comes from push-received invalidation + focus refetch |
| `supabase.com/docs` unreachable from the planning sandbox — `broadcast_changes` signature written from cutoff knowledge | Executor re-verifies A8/A9 SQL against the two cited docs pages before committing migration 30 (they are stable, but check arg order + `extension` column) |
| pg_net → local functions URL wrong (`host.docker.internal` is not Linux-portable) | Vault `project_url = http://supabase_kong_runeverywhere:8000` (docker-network hostname derived from `config.toml` `project_id`); verify with `select net.http_post(...)` + `select * from net._http_response` |
| Vault/secret missing on hosted → notifications insert but no push, silently | `handle_notification_push` skips when unconfigured by design; runbook step C1/C6 sets hosted values; verification step 3 catches it end-to-end |
| Chat push per message = spam potential (no throttling) | Accepted v1 (groups ≤30, Expo free): dedupe keeps the *center* clean; foreground suppression keeps active chats quiet. Revisit with digest/rate-limit if metrics demand (P7) |
| Android push silently broken without FCM v1 service account | E5 is a blocking task; acceptance = Expo push tool delivers to a real `push_tokens` token before app-level testing |
| `getExpoPushTokenAsync` throws without `projectId` | Explicit guard + error message pointing at `eas init` (E3); precondition table row |
| Broadcast/pg_net failures breaking message INSERTs (e.g. during seed) | Both trigger functions wrap delivery in `exception when others` — rows always persist |
| pg_cron drift local vs hosted (job runs in DB timezone; local container pauses when stopped) | Reminder window is `now()`-relative and idempotent, so late/backlogged runs self-heal; nothing schedules at wall-clock times |
| Two triggers on `run_members` (A5 conversation sync, B4 notifications) ordering | They are independent (no shared state); alphabetical firing is irrelevant. Keep them separate — migration 30 must not reference `notifications` |

## Decisions made by this plan

- **Run conversation created on `runs` INSERT** (not first approved member): unique-per-run invariant enforceable in schema, host can pre-seed the meeting point, no lazy-create races; empty conversations are one cheap row. Backfill covers pre-P3 runs.
- **System messages store machine codes** (`joined`/`left`/`removed`) with a check constraint; client renders copy (enables the design's "You joined the run — say hi to the group." self-variant and i18n).
- **Meeting point = latest `kind='meeting_point'` message**, text only; its MAP button routes to `run/[id]` (which owns the map). Coordinates on the meeting point deferred (P7 polish if wanted).
- **Chat-notification suppression = client-side v1**: server always fans out (deduped one-unread-row-per-conversation via delete+insert + partial unique index); the visible chat suppresses banners via `activeConversationId`; no server presence tracking. Honest tradeoff: a user actively chatting still receives (silent-suppressed) pushes.
- **Delete+insert (not upsert) for message-notification dedupe** so the pg_net push trigger stays INSERT-only — one pipeline, no UPDATE special-casing; the INSERT carries `on conflict … do nothing` (B3) so two concurrent messages in one conversation can never abort each other's `messages` INSERT.
- **Expo push tickets stored on `notifications` rows** (`push_tickets jsonb` + `push_sent_at`/`push_checked_at`) — a dedicated tickets table would exceed P3's allowed table set.
- **Shared-secret (`x-push-secret`) auth for `send-push`** with `verify_jwt=false`; secret lives in Vault (DB side) + function secrets (Deno side). Service-role key never stored in the database. `get_secret` (and the job functions) have EXECUTE revoked from client roles (C1/C3/C4) — with `verify_jwt=false`, a PostgREST-readable secret would hand any user direct push access to any device.
- **Vault for `project_url`/`send_push_secret`** rather than hardcoded URLs in migrations — identical migration text local vs hosted.
- **Reminder job = every 5 min, idempotent via partial unique index** `(user_id, run_id, kind='run_reminder')` — "fires once inside T-60" semantics without exact-time scheduling.
- **`member_joined` notification kind added** (host learns of open/invite direct joins — the design's "Sofia K. joined Sunset 5K" row); host approval itself does not self-notify.
- **Declined-request copy**: "Request not accepted · <run title> — keep exploring, more runs nearby" (design shows no decline screen; soft tone chosen).
- **Notification center entry point = bell on the Runs tab header** (Main Flow places it on "YOUR RUNS"); deep-link map: `join_request→/run/[id]/requests`, `message→/chat/[id]`, others→`/run/[id]`.
- **Push permission prompt timing**: contextual — after first join request sent, after first run published, or via an opt-in card on `/notifications`; never at launch.
- **Android channels**: `messages` (DEFAULT importance), `requests` (HIGH), `reminders` (HIGH).
- **No message edit/delete, no typing indicators, no attachments in v1**; message body capped at 2000 chars; conversation list search is client-side filtering.
- **DM eligibility v1**: host ↔ approved members surfaces (run detail + roster); the RPC itself only requires a valid target profile — block-gating lands with P5 `blocks`.
- **Removed/left members lose chat history access** (membership row deleted; RLS reads require membership) — simplest consistent rule.
- **Client-generated message uuids via `expo-crypto`** for optimistic reconciliation (broadcast echo dedupes by id).
- **`list_conversations` is `security invoker`** — RLS does the filtering; definer would only be needed at scales P3 doesn't have.

## Out of scope

- GPS recording, `complete_run` points, review prompts → **P4** (which uses no Realtime); live location sharing → **P5** (`live_locations` + a polling Edge Function — deliberately no websockets). No v1 phase adds live Realtime channels; the private-channel + `realtime.messages` policy pattern established here stays available for post-v1 live features.
- `blocks`/`reports` enforcement in DMs and chats, notification-preference settings screen, full `user/[id]` profile (DM header link) → **P5**.
- Message edit/delete/reactions, typing indicators, presence/online rings (Avatar `ring` renders but nothing feeds it), image attachments, server-side conversation search → **P7 or later** (design shows none as blocking).
- iOS app-icon badge counts, push digests/rate limiting, Expo "enhanced push security" access tokens → **P7 hardening**.
- Email notifications, quiet hours → not planned.
