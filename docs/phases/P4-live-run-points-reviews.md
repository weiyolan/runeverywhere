# P4 — Live Run + Points + Reviews (Weeks 10–13)

| | |
|---|---|
| **Depends on** | P1 (hosted Supabase project linked + pushed, real auth, `database.types.ts`, `Input`/`IconButton`, `supabase/tests/` convention, column grants blocking client writes to `profiles.points_total/level/rating_*`) · P2 (map wrapper component, `run/[id]` detail, Your Runs tabs in `(tabs)/runs`, migrations `00000000000020`–`29`) · P3 (`notifications` + `notification_kind` + `send-push` pipeline, `Avatar`/`Badge`, migrations `00000000000030`–`32`) |
| **Provides to later phases** | `run_tracks`, `points_ledger`, `levels`, `reviews` tables + `complete_run()`/`submit_review()` RPCs; live `profiles.points_total`/`level`/`rating_avg`/`rating_count` caches (P5 leaderboard + badges hang off `points_ledger` inserts and these caches); private `tracks` Storage bucket with raw gzipped GPS (P6 HealthKit/Strava export reads `run_tracks`); the isolated recording module `src/lib/recording/` (P5 live-share reuses its location plumbing); `RatingStars`/`StatBlock` components; `recap/[trackId]`, `review/[runId]`, `live/[runId]` routes; `notification_kind` value `run_completed` |
| **Verify gate ([PLAN.md §5](../PLAN.md))** | "Real outdoor run with screen locked; points idempotent; rating aggregates update" |

## Goal

Ship the reward loop: a runner starts an explicit, bounded GPS recording session from a joined run, the app keeps tracking with the screen locked (iOS background-location mode, Android foreground service with persistent notification), and finishing calls the server-authoritative `complete_run()` which stores the track (encoded polyline + summary stats, raw samples gzipped to private Storage), awards idempotent `points_ledger` rows, and flips the run to `completed`. An animated recap celebrates the result and funnels into rate-the-crew reviews (`submit_review()`, +10 once per run) whose triggers maintain profile rating aggregates. Past runs become browsable history in the Your Runs "Past" tab.

## Definition of done

1. Migrations `00000000000040_run_tracks.sql`, `00000000000041_points.sql`, `00000000000042_reviews.sql` apply cleanly on fresh `supabase db reset` and on the hosted project via `supabase db push`.
2. New dev builds (both platforms) carry the P4 native config: iOS `UIBackgroundModes: ['location']` + Always usage string; Android foreground-service location permissions. Old builds refuse background recording — rebuild is a blocking task.
3. First-ever run start triggers the permission escalation flow (iOS "Always" prompt; Android notification-visible foreground service); denial degrades to a screen-on warning banner, never a crash.
4. On a **real outdoor run of ≥ 2 km on each platform**, with the screen locked for at least 10 consecutive minutes mid-run, the trace, distance, pace, and elapsed time are correct when the screen unlocks — no gap in the polyline.
5. Recorded distance is within **5 %** of a reference app (e.g. Strava) recording simultaneously on the same device; D+ is non-negative and plausible (no >50 m gain on a flat route).
6. Samples with horizontal accuracy > 30 m, out-of-order timestamps, or implied speed > 12.5 m/s are dropped; standing still for 2 minutes adds < 30 m of distance.
7. `live/[runId]` renders the live trace polyline on the map, LIVE · RECORDING pill, elapsed hero timer, KM / /KM / D+ StatBlocks, and PAUSE / RESUME / FINISH RUN controls per the Reward Loop design; pause freezes timer + accumulation and resume continues.
8. Kill the app mid-recording, relaunch: the session is either resumed live (task still running) or offered as a salvage (FINISH NOW / RESUME / DISCARD) built from the buffered samples — no silent data loss.
9. `complete_run()` inserts exactly one `run_tracks` row and the correct `points_ledger` rows; **calling it a second time (same user, same run) inserts zero new rows** and returns the original result — proven by `supabase/tests/rls_points_smoke.sql` and by re-invoking the RPC manually.
10. Ledger math: `finished` = `greatest(runs.points_reward − 40, 50)`; `distance_goal` +20 only when track distance ≥ 95 % of `runs.distance_km`; `on_time` +10 only when recording started ≤ 10 min after `starts_at`; `rate_crew` +10 on first review of the run. `profiles.points_total` always equals `sum(points_ledger.points)` for that user; `profiles.level` matches the `levels` table.
11. First successful `complete_run` flips `runs.status` to `'completed'` and fans out a `run_completed` notification (+ push, deep-linking to `/review/[runId]`) to every other participant.
12. Raw accepted samples are gzipped and uploaded to the private `tracks` bucket at `{user_id}/{run_id}.json.gz`; another authenticated user cannot read or write that object (RLS-proven).
13. `recap/[trackId]` shows the animated points ring counting up to the awarded total, the 4-stat strip, the points breakdown rows, a draw-on route card animated with reanimated, the rate-the-crew list, SHARE, and SAVE RUN → the completed run detail.
14. `review/[runId]` lets an approved participant rate each co-runner once (stars 1–5, quick tags, note ≤ 200); self-review and reviews on non-completed runs are impossible (RPC + RLS); a second review of the same person errors gracefully.
15. Submitting a review updates the reviewee's `profiles.rating_avg`/`rating_count` immediately — visible from the other device without app restart (Definition item for "rating aggregates update").
16. The reviewer's first review on a run awards `rate_crew` +10 exactly once, no matter how many crew members they rate.
17. `run/[id]` in completed state renders the completedDetail design: static track polyline header, COMPLETED pill, YOUR RESULT strip (when the viewer has a track), points-earned card, RAN WITH list with rate status.
18. Your Runs "Past" tab lists completed runs (hosted or joined) with `+N pts` earned, "You rated x.x" when applicable, tap → `run/[id]` completed state.
19. Client cannot INSERT/UPDATE `run_tracks`, `points_ledger`, `reviews`, `levels`, or the rating/points columns on `profiles` directly (RLS/grants proven in the smoke script).
20. `/dev/components` gallery renders `RatingStars` (value, partial fill, count, interactive) and `StatBlock` (sizes, accent, align) per their `.d.ts` contracts.
21. `supabase/seed.sql` seeds one completed past run with tracks, ledger rows, and one review so History/recap demo locally without running outdoors.
22. CI green: `npm run typecheck`, `npm run lint`, `supabase db lint` (no errors), `src/types/database.types.ts` diff-clean after `npm run db:types`.

## Preconditions

| Precondition | How to check |
|---|---|
| P2 verify gate passed; `run/[id]` and Your Runs tabs exist | Create → discover → join across two devices; open `src/app/(tabs)/runs.tsx` — segmented ALL/MANAGED/JOINED(/PAST) tabs from P2 |
| P2 map wrapper component exists (single MapView chokepoint, PLAN.md §1) | `ls src/components/map/` — reuse whatever P2 named it; do **not** create a second wrapper |
| P3 verify gate passed; notifications pipeline live | Push arrives with app killed; `notification_kind`, `notifications`, `send-push` deployed |
| Hosted project linked, migrations ≤ P3 pushed | `supabase migration list` — local == remote through `0000000000003x` |
| Two physical devices with GPS (1 iOS + 1 Android) | Simulators cannot produce a real outdoor verify run; iOS Simulator location is synthetic |
| `expo-location` + `expo-task-manager` present — do NOT reinstall | [package.json](../../package.json): `expo-location ~56.0.19`, `expo-task-manager ~56.0.20` ✓; `reanimated 4.3.1`, `react-native-svg 15.15.4`, `zustand`, `async-storage` ✓ |
| Reference recording app installed on both test devices | Strava (free) or similar, for the distance-tolerance check |
| Ability to cut new dev builds | `npx expo run:ios` / `run:android` locally or `eas build --profile development` |

## Workstreams

### A — Native config, installs, permission escalation

**A1. `app.config.ts` — exact changes.** Modify [app.config.ts](../../app.config.ts):
- `ios` block — add (replacing the Phase-4 comment):
  ```ts
  infoPlist: {
    UIBackgroundModes: ['location'],
  },
  ```
- `expo-location` plugin entry — replace with:
  ```ts
  [
    'expo-location',
    {
      locationWhenInUsePermission:
        'Run Everywhere shows runs near you and lets you drop a start point on the map.',
      locationAlwaysAndWhenInUsePermission:
        'Run Everywhere records your route while you run, so distance and pace keep counting with the screen locked.',
      isIosBackgroundLocationEnabled: true,
      isAndroidForegroundServiceEnabled: true,
    },
  ],
  ```
  The plugin writes `NSLocationAlwaysAndWhenInUseUsageDescription` from `locationAlwaysAndWhenInUsePermission`; `UIBackgroundModes` is also spelled explicitly in `infoPlist` (redundant with `isIosBackgroundLocationEnabled` — intentional, values identical). `isAndroidForegroundServiceEnabled: true` adds `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION`. We deliberately do **not** set `isAndroidBackgroundLocationEnabled` / request `ACCESS_BACKGROUND_LOCATION` — the foreground service keeps the app "in use" on Android with only the when-in-use permission (Play-policy-friendly; see Decisions + Risks). docs.expo.dev was unreachable from the planning sandbox (403 via proxy) — prop names above are from SDK-56-era knowledge; executor must confirm against the expo-location config-plugin docs before prebuilding.
- Acceptance: `npx expo prebuild --clean` (or a dev build) succeeds; iOS `Info.plist` contains both keys; Android manifest contains `FOREGROUND_SERVICE_LOCATION`.

**A2. JS-only installs** (no new native modules → but A1's config change alone **requires new dev builds**):
```sh
npm install @mapbox/polyline@^1 pako@^2
npm install -D @types/mapbox__polyline @types/pako
```
`@mapbox/polyline` encodes tracks (PLAN.md §1 utilities row); `pako` gzips raw samples in JS (no native gzip in RN). Acceptance: `npm run typecheck` passes with both imported.

**A3. Rebuild dev clients.** `npx expo run:ios` and `npx expo run:android` (or `eas build --profile development` for both). Acceptance: on-device `Location.getBackgroundPermissionsAsync()` no longer throws, and the app can present the iOS Always upgrade prompt.

**A4. Permission escalation module — `src/lib/recording/permissions.ts`.** Export `ensureRecordingPermissions(): Promise<'granted' | 'foreground-only' | 'denied'>`:
- Verify foreground permission (granted since P2 map use; re-request if not).
- iOS: `Location.requestBackgroundPermissionsAsync()` → triggers the "Change to Always Allow" prompt. Granted → `'granted'`; provisional/denied → `'foreground-only'`.
- Android: no background permission needed (A1 decision) — return `'granted'` when foreground is granted (the foreground service does the rest). If `Location.startLocationUpdatesAsync` on the test device nevertheless rejects for missing background permission (expo-location internal check — verify at execution), fall back: add `isAndroidBackgroundLocationEnabled: true` to A1 and request background permission here; log the change for the P7 Play data-safety declaration.
- Called from the START RUN handler (B-side entry point, task F4), never at app launch (PLAN.md §6: "permission requested at first run start").
- `'foreground-only'` still allows recording with a persistent amber banner on `live/[runId]`: "KEEP THE SCREEN ON — background permission off. FIX" (FIX → `Linking.openSettings()`).
- Acceptance: fresh install → first START RUN shows explainer then OS prompt; deny → recording still starts with the banner.

**A5. Pre-permission explainer.** Inline bottom sheet (plain `Modal`, ink surface) shown by the START RUN handler before the OS prompt on first use (tracked via AsyncStorage flag `re.permExplainerShown`): title "TRACK YOUR RUN", body "To keep counting with your screen locked, Run Everywhere needs location access while you run. iOS will ask for 'Always'.", buttons "ALLOW TRACKING" (volt) / "NOT NOW" (ghost). Uppercase verb-first, no emoji.

### B — Migration `00000000000040_run_tracks.sql`: tracks table + private raw-GPS bucket

All objects in `public` unless stated; RLS enabled immediately after each `create table`; functions `set search_path = ''`. Full column detail in **Data model & security**.

**B1. `run_tracks` table** — one row per (run, runner): encoded polyline + summary stats. `run_id` **NOT NULL** (Decision: v1 requires an associated run; there is no solo-run entry point in the design — live run starts from a joined run per the Flow Map). `unique (run_id, user_id)` is the completion-idempotency anchor.

**B2. RLS**: SELECT own rows only (`user_id = (select auth.uid())`). No INSERT/UPDATE/DELETE policies — writes happen exclusively inside `complete_run()` (SECURITY DEFINER). GPS tracks are sensitive; co-runner visibility is deliberately not granted in v1 (Decisions).

**B3. `tracks` Storage bucket** — mirror the P1 `avatars` migration pattern: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('tracks', 'tracks', false, 5242880, array['application/gzip'])`. Four `storage.objects` policies, all keyed on `(storage.foldername(name))[1] = (select auth.uid())::text` and `bucket_id = 'tracks'`: owner SELECT, owner INSERT, owner UPDATE (re-upload retry), owner DELETE. **No public read** — private, owner-only (PLAN.md §2 geo mechanism: raw samples kept for future reprocessing).

**B4. Commands + acceptance.** `supabase db reset` clean; `select * from storage.buckets where id = 'tracks'` shows `public = false`; as user A upload to `A/<uuid>.json.gz` succeeds, to `B/x.json.gz` fails (exercised in F-tests).

### C — Migration `00000000000041_points.sql`: levels, ledger, `complete_run()`

**C1. `levels` reference table + seed rows in the migration** (reference data must exist on hosted too — `seed.sql` is local-only): `level integer pk`, `min_points integer not null unique check (min_points >= 0)`, `title text not null default ''`. Insert (idempotent `on conflict do nothing`):

| level | min_points | | level | min_points |
|---|---|---|---|---|
| 1 | 0 | | 6 | 2600 |
| 2 | 300 | | 7 | 3600 |
| 3 | 750 | | 8 | 4800 |
| 4 | 1200 | | 9 | 6200 |
| 5 | 1800 | | 10 | 8000 |

Rationale: a typical run yields ~90–130 pts (see C4); L2 lands after ~3 runs, L4 after ~12 — and the Profile Flow prototype shows "1,240 pts" as level 4, which this table reproduces. Titles left `''` (P5 may name levels). RLS: SELECT to `authenticated` `using (true)`; no writes.

**C2. `points_ledger`** — append-only award log. `create type public.points_reason as enum ('finished', 'distance_goal', 'on_time', 'rate_crew');` (P5 extends with `alter type … add value` for badges/leaderboard if needed). Columns: identity pk, `user_id`, `run_id`, `reason points_reason`, `points integer not null check (points > 0)`, `created_at`. **`unique (user_id, run_id, reason)`** — the idempotency contract (PLAN.md §2). Index `(user_id, created_at desc)`. RLS: SELECT own rows; no client writes.

**C3. Points cache trigger.** `public.apply_points_ledger()` — `security definer`, AFTER INSERT ON `points_ledger`:
```sql
update public.profiles p
set points_total = p.points_total + new.points,
    level = (select coalesce(max(l.level), 1) from public.levels l
             where l.min_points <= p.points_total + new.points)
where p.id = new.user_id;
```
Definer ownership bypasses the P1 column grants that block clients from these columns — note this in the migration comment. No DELETE/UPDATE handling: the ledger is append-only in v1.

**C4. `complete_run()` — the points engine.** Signature:
```sql
create function public.complete_run(
  p_run_id uuid,
  p_polyline text,
  p_distance_m integer,
  p_duration_s integer,
  p_elevation_gain_m integer,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_raw_path text default null
) returns jsonb
language plpgsql security definer set search_path = ''
```
Behavior, in order:
1. Auth guard (`auth.uid()` non-null). `select * from runs where id = p_run_id for update` — row-lock like `join_run`.
2. Validate: run exists; `status in ('published','completed')` (cancelled → error `'run was cancelled'`); caller is host **or** an `approved` `run_members` row (error `'not a participant'`); `now() >= starts_at - interval '30 minutes'` (error `'run has not started'`).
3. Validate payload (raise on failure): `p_distance_m between 100 and 200000`; `p_duration_s between 60 and 43200`; `p_elevation_gain_m between 0 and 10000`; `p_ended_at > p_started_at`; `p_started_at > now() - interval '2 days'`; `p_duration_s <= extract(epoch from p_ended_at - p_started_at) + 60` (duration is moving time; must fit inside the wall-clock window); `char_length(p_polyline) between 1 and 200000`.
4. Insert `run_tracks` (`avg_pace_s_per_km` = `round(p_duration_s / (p_distance_m / 1000.0))`) with `on conflict (run_id, user_id) do nothing`. If no row inserted → **idempotent replay**: fetch the existing track + this user's existing ledger rows for the run and return them with `"already_completed": true`. No new writes.
5. Award ledger rows for the **caller only**, each `on conflict do nothing`:
   - `finished` → `greatest(v_run.points_reward - 40, 50)` points, unconditional.
   - `distance_goal` → 20 points, iff `p_distance_m >= v_run.distance_km * 1000 * 0.95` (5 % tolerance for GPS/smoothing shrinkage).
   - `on_time` → 10 points, iff `p_started_at <= v_run.starts_at + interval '10 minutes'` (early start always counts).
6. If `v_run.status = 'published'`: `update runs set status = 'completed'`, then insert a `notifications` row (kind `'run_completed'`, title `run title || ' is done'`, body `'Rate the crew to earn +10 pts'`, `run_id`, `actor_id = caller`) for the host and every approved member **except the caller** — P3's pg_net trigger pushes them automatically.
7. Return `jsonb_build_object('track_id', …, 'distance_m', …, 'duration_s', …, 'elevation_gain_m', …, 'avg_pace_s_per_km', …, 'awards', <jsonb array of {reason, points}>, 'total_awarded', <sum>, 'already_completed', false)`.

**Points-reward reconciliation (the load-bearing decision).** `runs.points_reward = compute_points_reward(km, type) = round(km × 18) + type bonus` ([00000000000001_core.sql](../../supabase/migrations/00000000000001_core.sql) calls it "the completion award in Phase 4"; PLAN.md §2 fixes the ledger reasons at +50/+20/+10/+10). These reconcile as a **decomposition**: the card's `+N pts` is the maximum earnable from the run, and `complete_run`/`submit_review` decompose it — `finished = points_reward − 40` (the 40 reserved for the three fixed bonuses: 20 + 10 + 10), floored at 50 so PLAN.md's "finished +50" always holds. Cross-check against the design's canonical example (Reward Loop recap, 5 km social): `points_reward = 90`; breakdown "Finished the run +50 · Hit the 5K distance +20 · On time at the start +10 · Rate the crew +10" = 90 exactly. For runs with `points_reward < 90` (social < 5 km, discover < 4.2 km, challenge < 2.8 km) the earnable max is 90 > advertised — the card may *under*-promise but never over-promises. Documented in Decisions; the recap breakdown renders the actual `finished` value ("Finished the run +176" for a 12 km challenge).

**C5. `notification_kind` extension.** `alter type public.notification_kind add value if not exists 'run_completed';` at the top of this migration (PG ≥ 12 allows this in a transaction; the value is only referenced at runtime inside `complete_run`, never used as a literal in the same transaction — safe).

**C6. Acceptance.** `supabase db reset` clean; role-played (`set local role authenticated` + JWT claims, P1 smoke-test pattern) `select complete_run(...)` twice returns `already_completed = true` the second time and `select count(*) from points_ledger` is unchanged; `profiles.points_total` equals the ledger sum.

### D — Migration `00000000000042_reviews.sql`: reviews, `submit_review()`, rating triggers, history RPC

**D1. `reviews` table** per PLAN.md §3: uuid pk, `run_id`, `reviewer_id`, `reviewee_id`, `stars integer check (stars between 1 and 5)`, `tags text[] check` (each element in the design's six: `'Great pace','Welcoming','On time','Knows the city','Strong runner','Good vibes'`, max 6 — enforce with `tags <@ array[…]::text[] and array_length(tags,1) is null or array_length(tags,1) <= 6`), `note text not null default '' check (char_length(note) <= 200)`, `created_at`; **`unique (run_id, reviewer_id, reviewee_id)`**; `check (reviewer_id <> reviewee_id)`; index `(reviewee_id)`.

**D2. RLS**: SELECT to `authenticated` where `reviewer_id = (select auth.uid()) or reviewee_id = (select auth.uid())` (reviewer needs "rated" state in the UI; reviewee visibility feeds P5's "Other runners say" — P5 broadens this policy for public profiles). No client INSERT/UPDATE/DELETE — writes only via the RPC.

**D3. `submit_review(p_run_id uuid, p_reviewee_id uuid, p_stars integer, p_tags text[] default '{}', p_note text default '') returns jsonb`** — `security definer`:
1. Auth guard; `select * from runs where id = p_run_id` (no lock needed — no capacity math); require `status = 'completed'` (error `'run is not completed'`).
2. Require caller ≠ reviewee; require **both** caller and reviewee are participants (host or approved member) — reuse the pattern `host_id = x or exists(select 1 from run_members where … status='approved')`.
3. `insert into reviews (…) values (…)` — a duplicate hits the unique key; catch `unique_violation` and raise `'already reviewed this runner'` (one-shot, no edits in v1 — Decisions).
4. **Rate-crew idempotency, designed explicitly:** insert `points_ledger (user_id => caller, run_id, reason => 'rate_crew', points => 10) on conflict (user_id, run_id, reason) do nothing`. The ledger key is per `(user, run, reason)` — NOT per reviewee — so the +10 lands exactly once per reviewer per run regardless of how many crew members they rate; reviews 2..n of the same run insert a `reviews` row but zero ledger rows. This is the deliberate reconciliation between "rate crew +10 ONCE per run per reviewer" and the `UNIQUE(user_id, run_id, reason)` contract.
5. Return `jsonb_build_object('review_id', …, 'rate_crew_awarded', <bool: did step 4 insert>)` so the UI can show "+10 pts" feedback only the first time.

**D4. Rating aggregate trigger.** `public.apply_review_rating()` — `security definer`, AFTER INSERT ON `reviews`: full recompute (cheap at v1 scale, immune to drift):
```sql
update public.profiles p
set rating_avg = sub.avg, rating_count = sub.cnt
from (select round(avg(stars)::numeric, 2) as avg, count(*)::integer as cnt
      from public.reviews where reviewee_id = new.reviewee_id) sub
where p.id = new.reviewee_id;
```

**D5. History RPC.** `public.list_past_runs() returns table (run_id uuid, title text, type public.run_type, starts_at timestamptz, area_name text, city text, distance_km numeric, track_id uuid, track_distance_m integer, track_duration_s integer, track_avg_pace_s_per_km integer, track_elevation_gain_m integer, points_earned bigint, my_rating_given numeric, peer_names text[], peer_avatars text[])` — `security invoker stable`. Rows: runs with `status='completed'` where caller is host or was an approved member, newest `starts_at` first; `track_*` from the caller's `run_tracks` row (null if they never recorded); `points_earned` = caller's ledger sum for the run; `my_rating_given` = `round(avg(stars),1)` of the caller's reviews on that run (null if none); `peer_*` = up to 3 other participants for the avatar stack (P3 `list_conversations` pattern).

**D6. Seed update** ([supabase/seed.sql](../../supabase/seed.sql)): append a fourth fixture run `10000000-0000-4000-8000-000000000004` ("River Loop", social, hosted by marco, `starts_at = now() - interval '2 days'`, `status = 'completed'`), maya approved into it, one `run_tracks` row each for maya + marco (short hand-written encoded polyline near Belém, e.g. 5200 m / 1908 s / 21 m D+), matching `points_ledger` rows (insert directly — the trigger updates caches), and one review maya → marco (5 stars, tags `{'Great pace','Good vibes'}`). Insert ledger/tracks **after** the P3 seed content; keep all inserts idempotent (`on conflict do nothing`).

**D7. Commands + acceptance.** `supabase db reset`; `npm run db:types` + commit; `psql … -c "select display_name, points_total, level, rating_avg, rating_count from profiles"` shows marco with a 5.00 avg / count 1 and both users with non-zero points.

### E — Client: recording engine (task, filters, store, crash recovery)

All expo-location/task-manager calls are isolated in `src/lib/recording/` — this module boundary **is** the Transistorsoft escape hatch (swap one module, keep the store/UI contract; see Risks).

**E1. `src/tasks/locationTask.ts`** — `TaskManager.defineTask(LOCATION_TASK, handler)` at **module scope**; export `LOCATION_TASK = 're.live-run'`. Import this file for its side effect at the top of `src/app/_layout.tsx` (guarantees definition before any headless invocation). The handler: read `{ locations }` from `data`, run each through the filter pipeline (E2), append accepted samples to the buffer (E3), update the meta accumulators, and mirror into the zustand store via `useLiveRun.setState` (module-level import — works whether or not UI is mounted). Errors: log and return (never throw — a throw can unregister the task).

**E2. `src/lib/recording/geo.ts`** — pure functions, unit-testable:
- `acceptSample(prev, next)`: reject if `coords.accuracy > 30` m (accuracy threshold — Decision), missing/absurd coords, timestamp ≤ previous, or implied speed vs. the last accepted point > 12.5 m/s (GPS-jump gate). Additionally, movement < 3 m from the last accepted point does not advance the anchor (standstill jitter gate — distance unaffected).
- `haversineM(a, b)` — spherical distance.
- `accumulateElevation(state, sample)`: hysteresis D+ — ignore samples with `altitudeAccuracy > 10` m (fallback: `accuracy > 20` when altitudeAccuracy is unreported, common on Android); track a low-water anchor; only add gain once the climb since the anchor reaches **≥ 3 m**, then move the anchor; descending lowers the anchor so the next climb re-arms. (Noise gating — Decision.)
- `currentPaceSPerKm(window)`: pace over the trailing 45 s of accepted movement; return null (render `—:—`) when paused, < 50 m in window, or outside 2:00–30:00 /km.
- `encodeTrack(points)`: uniform-stride downsample to ≤ 2000 points, then `polyline.encode(latLngs)` (precision 5, the `@mapbox/polyline` default).
- GPS warm-up: recording's `started_at` = timestamp of the **first accepted** sample; earlier low-accuracy fixes are discarded (live screen shows "ACQUIRING GPS…" until then).

**E3. `src/lib/recording/buffer.ts`** — durable AsyncStorage buffer (Decision: AsyncStorage chunks, no SQLite — zero new native deps; writes stay O(batch)):
- Keys: `re.live.meta` (JSON: `{ runId, startedAt, state: 'recording'|'paused', pauses: [{from,to?}], stats: { distanceM, elevationM, movingMs, samples }, lastPoint, chunkCount }`) and `re.live.chunk.<n>` (JSON array of accepted samples `{ t, lat, lng, alt, acc, altAcc }`, flushed every 10 samples or 5 s).
- API: `initSession(runId)`, `appendSamples(batch)`, `updateMeta(patch)`, `readAll(): { meta, samples[] }`, `clear()`. Sizes: 2 h @ ~1 Hz ≈ 500 KB total — far below AsyncStorage's Android budget.

**E4. `src/stores/liveRun.ts`** — zustand store, UI mirror of the buffer: `{ status: 'idle'|'acquiring'|'recording'|'paused'|'finishing', runId, startedAt, distanceM, elevationM, movingMs, currentPace, coords: LatLng[] (decimated for the polyline, max ~1000), backgroundGranted }` + actions `start(runId)`, `pause()`, `resume()`, `finish()`, `discard()`. Elapsed time ticks in the UI from `startedAt` + `pauses` (1 s interval while focused); moving time and distance come from the task via `setState`.

**E5. `src/lib/recording/recorder.ts`** — the lifecycle owner:
- `startRecording(runId)`: `ensureRecordingPermissions()` (A4) → `initSession` → `Location.startLocationUpdatesAsync(LOCATION_TASK, { accuracy: Location.Accuracy.BestForNavigation, activityType: Location.LocationActivityType.Fitness, timeInterval: 1000, distanceInterval: 5, pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true, foregroundService: { notificationTitle: 'Run Everywhere — recording', notificationBody: 'Tracking your run. Tap to return.', notificationColor: '#CCFF00', killServiceOnDestroy: false } })`. (Option names to be re-verified against SDK 56 docs at execution, same caveat as A1.)
- `pauseRecording()` / `resumeRecording()`: location task **keeps running** (service + iOS indicator stay up — honest battery tradeoff, Decision); the meta `state` flag makes the task drop accumulation while paused and stamps the pause interval.
- `stopRecording()`: `Location.stopLocationUpdatesAsync(LOCATION_TASK)` + final buffer flush.
- `getRecoveryState()`: on cold start — if `re.live.meta` exists: `Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)` true → `'resume-live'` (task survived; rebuild store from buffer and continue); false → `'salvage'` (app was killed and the OS stopped the task; buffered data is intact). No meta → `'none'`.
- Auto-stop guard: task handler force-finishes into salvage state after 12 h.

**E6. Crash-recovery routing.** In `src/app/_layout.tsx` (after session init): `const rec = await getRecoveryState()`; `'resume-live'` → `router.replace('/live/' + runId)`; `'salvage'` → `router.replace('/live/' + runId + '?salvage=1')`. The live screen's salvage mode (F3) offers RESUME / FINISH NOW / DISCARD.

### F — Client: `live/[runId]` screen

**F1. Route + registration.** New `src/app/live/[runId].tsx`; register in the root Stack with `headerShown: false, gestureEnabled: false` (no swipe-away mid-recording). Also register `recap/[trackId]` and `review/[runId]` (G/H) in the same edit.

**F2. Layout per the Reward Loop "LIVE RUN (GPS)" section** (light map + dark console):
- Map: the P2 map wrapper, full-bleed; camera follows the latest point; `Polyline` of `coords` in `colors.go` `#00C271` (go-green = live signal — prototype's `#16C172` reconciled), width 6; runner dot = white-stroked circle with a volt pulse (reanimated loop). No co-runner dots (P5 — Out of scope).
- Top pills: ink `LIVE · RECORDING` pill with a blinking go-green dot (blink = reanimated opacity loop); while `status='acquiring'` it reads `ACQUIRING GPS…` with an amber dot. A4's `foreground-only` warning banner sits below when applicable.
- Bottom console (ink900 sheet, radius `lg` top corners): eyebrow `<TYPE> · <run title>` + "with <names>" caption; volt `+<points_reward> pts` pill (the run's advertised reward); ELAPSED eyebrow + hero timer (`SairaCondensed-Black`, tabular, ~76 pt); 3-cell stat strip using `StatBlock` (`size="md"`, dark styling): `<km>` KM · `<pace>` /KM · `<D+>` D+ M; controls row: PAUSE/RESUME (`Button variant ghost-on-dark`, flex 1) + FINISH RUN (volt, flex 1.3, square-stop lucide icon).
- States: `acquiring` (timer 0:00, stats `—`), `recording`, `paused` (timer frozen, pace `—:—`, console border pulses amber), plus salvage mode (F3).

**F3. Finish + salvage flows.**
- FINISH RUN → if `distanceM < 500`: confirm sheet "Not much recorded yet." with KEEP RUNNING / FINISH ANYWAY / DISCARD RUN. Otherwise straight to finishing.
- Finishing sequence (store `status='finishing'`, full-screen volt spinner overlay): `stopRecording()` → read buffer → `encodeTrack` → compute `duration_s = movingMs/1000`, `started_at`, `ended_at` → call `completeRun` service (G1) with `p_raw_path = '<uid>/<runId>.json.gz'` → gzip raw accepted samples (`pako.gzip(JSON.stringify(samples))`) and upload to the `tracks` bucket at that exact path (`contentType: 'application/gzip'`, `upsert: true`); upload failure retries once then proceeds (raw is best-effort; `raw_path` may dangle — tolerated, Decisions) → `buffer.clear()` → `router.replace('/recap/' + track_id)`.
- `?salvage=1`: dark takeover card "RECORDING INTERRUPTED — we saved <km> km / <mm:ss>." with RESUME RUN (restart location updates, keep buffer), FINISH NOW (runs the finishing sequence on buffered data), DISCARD (clear buffer, back to `run/[id]`).
- RPC failure (offline finish): keep the buffer, show retry screen "SAVING FAILED — your run is safe on this phone." with TRY AGAIN / LATER (LATER leaves meta in `salvage` state so E6 re-offers it).

**F4. Entry points (modify P2 screens).**
- `run/[id]`: for host + approved members, when `status = 'published'` and `now() >= starts_at - 30 min`, show primary volt **START RUN** button → A5 explainer (first time) → A4 permissions → `router.push('/live/' + id)`. Window matches `complete_run`'s earliest-accepted start.
- `(tabs)/runs`: joined/hosting cards inside the same window get footer "Tap to start · +<points_reward> pts" (design copy) wired to the same handler.
- Guard in `live/[runId]`: if the store is idle and no buffer exists, call `startRecording(runId)` on mount; if a *different* run is already recording, alert and redirect to the active one (one session at a time).

### G — Client: completion service, `recap/[trackId]`, share

**G1. `src/lib/tracks.ts`** — typed service module (P1 convention): `completeRun(args): Promise<CompleteRunResult>` (`supabase.rpc('complete_run', …)`, parse the jsonb), `uploadRawSamples(path, gz)`, `fetchTrack(trackId)` (PostgREST select own row), `fetchRunAwards(runId)` (`points_ledger` select own rows for the run), `listPastRuns()` (RPC D5).

**G2. `src/app/recap/[trackId].tsx`** — dark celebration screen per the Reward Loop "POST-RUN RECAP" section. Data: track (G1), its run + participants, awards (from the `complete_run` response passed via nav params when arriving from F3, else `fetchRunAwards`).
- Header: go-green eyebrow `RUN COMPLETE`, hero `NICE RUN.` (`screenTitle` scaled up), caption `<title> · <area> · with <n> runners`.
- Points ring: SVG circle pair; animate `strokeDashoffset` with reanimated (`useSharedValue` + `useAnimatedProps` on an `Animated.createAnimatedComponent(Circle)`), 1 s ease-out; center `+<total_awarded>` counts up (reanimated shared value driving a text via `useDerivedValue`/`runOnJS`), volt.
- Stat strip: four `StatBlock`s — KM, TIME, /KM, D+ M.
- Points breakdown card (ink800 rows): render awards with design copy — `finished` → "Finished the run +<n>", `distance_goal` → "Hit the <X> km distance +20", `on_time` → "On time at the start +10"; a final "Rate the crew +10" row rendered gray/pending until the reviewer's `rate_crew` ledger row exists, then go-green. Missed conditional bonuses simply don't render (no shaming).
- Route card: white-on-ink card with the track polyline projected into a local SVG viewBox; **draw-on animation** via animated `strokeDashoffset` over the path length (reanimated, 1.4 s, starts after the ring).
- RATE THE CREW section: heading + "+10 pts" volt tag; crew rows (`Avatar`, name, role "Host"/"Runner", RATE volt chip or `RatingStars value size 13` once rated) — data = host + approved members minus self, joined with my `reviews`; tap → `router.push('/review/' + runId)`.
- Footer: SHARE (`IconButton`/ghost, `Share.share({ message: 'Ran <km> km in <time> (<pace>/km, +<pts> pts) with Run Everywhere — <title>' })`) + SAVE RUN (volt) → `router.replace('/run/' + runId)` (completed detail, H4). No BADGES button until P5 (Decisions).
- States: loading skeleton; error retry; deep-linked visit with no awards yet (co-runner who finished earlier) renders stats without the breakdown card.

### H — Client: reviews UI + component ports + completed run detail

**H1. Port `RatingStars`** → `src/components/ui/RatingStars.tsx` per [RatingStars.d.ts](../../run-everywhere-app-design/project/components/data/RatingStars.d.ts): `value?, max=5, size?, count? ("(n)")`, `showValue?`, `onRate?` (interactive 1..max). Stars in `colors.star` `#FFC32B` (reconciles prototype `#FFB020`); partial fill via two overlaid rows + width mask; interactive mode = 44 pt touch targets. RN props replace `css`.

**H2. Port `StatBlock`** → `src/components/ui/StatBlock.tsx` per [StatBlock.d.ts](../../run-everywhere-app-design/project/components/data/StatBlock.d.ts): `value, label, unit?, accent?, align='center', size sm|md|lg` — condensed tabular value (`textStyles.metric` scaled per size) + uppercase eyebrow label. Add both components (all variants) to `/dev/components`.

**H3. `src/app/review/[runId].tsx`** + `src/lib/reviews.ts` (`submitReview`, `fetchCrew(runId)` = host + approved members minus self left-joined with my reviews).
- Crew-list state (default): header "RATE THE CREW" + run title/date caption; the recap's crew rows; footer DONE → back.
- Rate form (inner state, not a separate route — matches the design's recap ⇄ Rate runner loop): back chevron header "RATE RUNNER" + `<title> · <date>`; centered `Avatar xl` + name + role; `RatingStars size 40 onRate`; label under stars from stars value — 1 "Rough run" … 5 "Outstanding"; "WHAT STOOD OUT" chip row (the six D1 tags, multi-select pills); "ADD A NOTE · optional" `Input multiline maxLength 200` placeholder "Say something the next runner should know — pace, vibe, local knowledge."; SUBMIT REVIEW (volt, disabled until stars ≥ 1) → `submitReview` → on success return to crew list, show "+10 PTS EARNED" toast iff `rate_crew_awarded`; `already reviewed` error → friendly inline message and mark the row rated.
- Guards: non-participant or non-completed run → redirect to `run/[id]` (the RPC would reject anyway).

**H4. `run/[id]` completed state (modify P2 screen).** When `status = 'completed'`: render the Reward Loop "COMPLETED RUN DETAIL" layout — map header with the viewer's static track polyline (fallback: start-point pin) + ink COMPLETED pill; type chip + date; title/area/goal; YOUR RESULT `StatBlock` strip (only when the viewer has a track); points-earned ink card `+<sum> pts earned` with caption "Finishing · distance goal · on time · reviews"; "RAN WITH · <n>" rows with `RatingStars` or RATE chip → `/review/[runId]`; footer DONE → back. Join/manage affordances hidden for completed runs.

**H5. History — Your Runs "Past" tab (modify `src/app/(tabs)/runs.tsx`).** (Decision: history lives here, not on profile — the Main Flow prototype puts a PAST tab with count in Your Runs; profile stats are P5.) Data: `listPastRuns()`. Card = the P2 run card pattern with ink `COMPLETED` status chip, meta `<date> · <area> · <km> km · <pace>/km` (track stats when present, else planned values), footer `You rated <x.x> · +<pts> pts · view recap` (omit segments that are null); tap → `/run/[id]`. Empty state: "No completed runs yet — join one and hit START." Loading/error per the P2 list patterns.

**H6. `send-push` deep-link map (modify [supabase/functions/send-push/index.ts](../../supabase/functions/send-push/index.ts)).** Add `run_completed → '/review/' + run_id` to `deepLinkFor` and `run_completed → 'reminders'` to `channelFor`; redeploy `supabase functions deploy send-push --no-verify-jwt`. Acceptance: tapping the completion push cold-starts into `review/[runId]`.

### I — Verification pass (always last)

**I1. `supabase/tests/rls_points_smoke.sql`** (P1/P3 pattern: `begin…rollback` blocks, role-played JWTs for maya/marco + a third non-member): `complete_run` twice → second returns `already_completed`, ledger count unchanged; non-participant `complete_run` → error; `complete_run` on a cancelled run → error; direct INSERT into `run_tracks`/`points_ledger`/`reviews` as authenticated → RLS error; UPDATE `profiles.points_total`/`rating_avg` as authenticated → permission denied (P1 grants); `submit_review` self / non-completed / non-participant reviewee → errors; same reviewee twice → `'already reviewed'`; two different reviewees → two review rows, **one** `rate_crew` ledger row; `profiles.rating_avg/rating_count` reflect inserts; storage: cross-user object insert into `tracks` → RLS error. Run via `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_points_smoke.sql`.

**I2. Field-test protocol + Transistorsoft risk gate.** Before declaring the phase done, log ≥ 3 outdoor runs per platform in `docs/field-tests.md` (date, device, OS, km app vs. reference, D+, screen-locked minutes, anomalies). **Exit criteria to stay on expo-location**: distance error ≤ 10 % on every run, zero recordings that died with the screen locked, no polyline gaps > 60 s. Any failure → adopt the escape hatch (PLAN.md §1/§6): buy Transistorsoft `react-native-background-geolocation`, reimplement only `src/lib/recording/recorder.ts` + task against its API (store/UI contracts unchanged), rebuild, re-run the protocol. Budget: 1 week + license cost.

**I3. Manual QA script** — see Verification script below.

## Data model & security

Three migrations in P4's `0000000000004x` slots:

| File | Creates |
|---|---|
| `supabase/migrations/00000000000040_run_tracks.sql` | `run_tracks`: `id uuid pk default gen_random_uuid()`, `run_id uuid not null references runs on delete cascade`, `user_id uuid not null references profiles on delete cascade`, `polyline text not null check (char_length(polyline) between 1 and 200000)`, `distance_m integer not null check (distance_m between 100 and 200000)`, `duration_s integer not null check (duration_s between 60 and 43200)`, `elevation_gain_m integer not null default 0 check (between 0 and 10000)`, `avg_pace_s_per_km integer not null check (> 0)`, `started_at timestamptz not null`, `ended_at timestamptz not null check (ended_at > started_at)`, `raw_path text`, `sample_count integer`, `created_at timestamptz default now()`; `unique (run_id, user_id)`; index `(user_id, started_at desc)`; RLS: SELECT own only, no write policies. Storage: private `tracks` bucket (5 MB, `application/gzip`) + 4 owner-only `storage.objects` policies keyed on first path segment = `auth.uid()` |
| `supabase/migrations/00000000000041_points.sql` | `alter type notification_kind add value if not exists 'run_completed'`; `levels` (`level` pk, `min_points` unique, `title`) + 10 seed rows (C1) + SELECT-only RLS; enum `points_reason ('finished','distance_goal','on_time','rate_crew')`; `points_ledger` (identity pk, `user_id`, `run_id`, `reason`, `points > 0`, `created_at`, **`unique (user_id, run_id, reason)`**, index `(user_id, created_at desc)`), RLS SELECT own only; trigger `apply_points_ledger` (AFTER INSERT → `profiles.points_total`/`level`, definer); RPC `complete_run` (C4: participant + started + payload validation, `run_tracks` upsert-or-replay, conditional awards, status flip + `run_completed` fan-out, jsonb result) |
| `supabase/migrations/00000000000042_reviews.sql` | `reviews` (uuid pk, `run_id`/`reviewer_id`/`reviewee_id` FKs, `stars 1–5`, `tags text[]` constrained to the six design tags, `note ≤ 200`, **`unique (run_id, reviewer_id, reviewee_id)`**, `reviewer <> reviewee`, index `(reviewee_id)`), RLS SELECT reviewer-or-reviewee, no client writes; RPC `submit_review` (D3, incl. the once-per-run `rate_crew` ledger insert); trigger `apply_review_rating` (AFTER INSERT → full recompute of `profiles.rating_avg`/`rating_count`, definer); RPC `list_past_runs` (invoker, D5) |

RLS review notes: every new table default-deny; the **only** write path into `run_tracks`/`points_ledger`/`reviews` is the two SECURITY DEFINER RPCs (tier 1, PLAN.md §2 — "client never writes points, approvals, or rating aggregates"); cache columns on `profiles` are written solely by definer triggers, which bypass P1's column-grant lockdown by ownership; `levels` is read-only reference data; the `tracks` bucket has zero public access. `complete_run` locks the run row (`for update`) like `join_run` to serialize the status flip. Both RPCs raise typed errors for every guard so the client can map copy. `supabase db lint` + `npm run db:types` after each migration.

## Design references

- **Flows**: `Run Everywhere - Reward Loop.dc.html` — sections `LIVE RUN (GPS)` (map + LIVE pill + dark console: elapsed hero, KM · /KM · D+ M strip, pause/finish), `POST-RUN RECAP` (confetti, "RUN COMPLETE / NICE RUN.", animated points ring, stat strip, points breakdown `Finished the run +50 / Hit the 5K distance +20 / On time at the start +10 / Rate the crew +10`, crew rate rows, BADGES + SAVE RUN footer), `WRITE A REVIEW` (stars 40 px, rating labels Rough run→Outstanding, six "What stood out" tags, ≤ 200-char note, SUBMIT), `COMPLETED RUN DETAIL` (map header + COMPLETED pill, YOUR RESULT strip, "+N pts earned · Finishing · distance goal · on time · reviews", RAN WITH rows, VIEW BADGES + DONE). `Run Everywhere - Main Flow.dc.html` — YOUR RUNS past tab (ink `Completed` chip, footer "You rated 4.9 · +90 pts · view recap", joined-card "Tap to start · +90 pts"). `Run Everywhere - Flow Map.dc.html` — nodes `liveRun`/`recap`/`writeReview`/`completedDetail` and edges `joined→liveRun`, `myRuns→liveRun`, `liveRun→recap→writeReview`, `recap→completedDetail`, `notifications→recap`.
- **Contracts**: [RatingStars.d.ts](../../run-everywhere-app-design/project/components/data/RatingStars.d.ts), [StatBlock.d.ts](../../run-everywhere-app-design/project/components/data/StatBlock.d.ts) (ported H1/H2); `Avatar`/`Badge` (P3), `Button`/`TypeChip` (P0), `Input`/`IconButton` (P1).
- **Tokens** ([src/theme/theme.ts](../../src/theme/theme.ts)): ink ramp for dark console/recap, `colors.go` for live trace + blink dot + RUN COMPLETE eyebrow, `colors.volt` for CTAs/points, `colors.star` for stars, `textStyles.metric`/`screenTitle`/`eyebrow`, `radius.lg` console sheet, `shadows.volt` under FINISH RUN.
- **Reconciliation calls** (PLAN.md "Design reconciliation" wins): prototype `#C8FA00`→volt `#CCFF00`, `#16C172`→go `#00C271`, `#FF3B30`→challenge `#FF3D2E`/danger, `#1466FF`→discover `#1463FF`, `#FFB020`→star `#FFC32B`; 'Hanken Grotesk' body → Saira; prototype pause glyphs "❚❚ Pause / ▶ Resume" → lucide pause/play icons + uppercase PAUSE/RESUME (no glyph-as-emoji); all CTAs uppercase verb-first ("FINISH RUN", "SAVE RUN", "SUBMIT REVIEW"); recap BADGES button deferred to P5.

## Verification script

Setup: devices A (maya) and B (marco), fresh A3 dev builds, hosted project with migrations pushed and `send-push` redeployed (H6). B hosts a run starting "now + 10 min" with A approved (use P2/P3 flows).

1. Automated: `supabase db reset` zero errors → `npm run db:types` → `git diff --exit-code src/types/database.types.ts` → `npm run typecheck && npm run lint` → `supabase db lint` → `psql … -f supabase/tests/rls_points_smoke.sql` all blocks pass.
2. Local demo data: sign in as maya locally → Your Runs PAST shows the seeded River Loop with "+… pts"; tap → completed detail with result strip; `/dev/components` shows RatingStars + StatBlock.
3. Permission flow (fresh install on A): open the run → START RUN → explainer sheet → iOS Always prompt / Android foreground-service start. Deny on purpose once → amber keep-screen-on banner appears; re-grant via FIX → banner clears.
4. **Real outdoor run (repeat on both platforms)**: A and B both START RUN at the run's start point; also start the reference app. Run ≥ 2 km. Mid-run: lock the screen ≥ 10 min (iOS shows the blue/location indicator; Android shows the persistent notification). Pause 1 min at some point (timer freezes, pace `—:—`), resume. Unlock: polyline continuous, distance plausible.
5. During the same run on A: swipe-kill the app after ~1 km, relaunch → resumed live (or salvage card if the OS stopped the task) → continue; final distance still includes the pre-kill kilometre.
6. FINISH RUN on A → recap: ring animates to the awarded total; breakdown shows Finished +50 (5 km social; larger runs show the scaled value), distance/on-time rows matching reality; route draws on. B (app killed) receives the `run_completed` push after A's finish flipped the status; tapping lands on `review/[runId]`.
7. Distance audit: app vs. reference within 5 %; D+ sane (flat route < 50 m). Log both runs in `docs/field-tests.md` (I2).
8. Idempotency: from A, re-invoke `complete_run` with the same payload (SQL editor or a temporary dev button) → `already_completed: true`; `select count(*) from points_ledger where run_id = …` unchanged; `profiles.points_total` unchanged. This is the verify-gate "points idempotent" check.
9. Storage: dashboard → Storage → `tracks` → `A-uid/<runId>.json.gz` exists; as B (SQL smoke or client) reading A's object fails; download + `gunzip` yields the JSON samples.
10. Reviews: A rates B 5★ + tags + note → "+10 PTS EARNED" toast; B's device: open any surface showing B's rating (or query `profiles`) → `rating_avg 5.00 / rating_count 1` **without restart** — verify-gate "rating aggregates update". A rates a second crew member → review saved, no second +10 (ledger count for `rate_crew` = 1). A tries the same reviewee again → friendly "already reviewed".
11. B finishes their own recording (or `complete_run` via SQL) → B gets finished/distance/on-time rows; run stays `completed`; no duplicate notifications.
12. History: A's Your Runs PAST now lists the run with points + "You rated …"; tap → completed detail with A's polyline and RAN WITH rate states.
13. Consistency sweep: `select p.id, p.points_total, coalesce(sum(l.points),0) from profiles p left join points_ledger l on l.user_id = p.id group by p.id` — totals match; `level` matches the `levels` table for each total.

## Risks & gotchas

| Risk | Mitigation |
|---|---|
| Background GPS dies (OEM task killers, iOS suspension) — PLAN.md §6 top risk | Foreground service + persistent notification (A1/E5); bounded user-started session; buffer survives kills (E3/E6); **field-test protocol with explicit exit criteria and the paid Transistorsoft swap confined to `recorder.ts`** (I2) |
| iOS user picks "Keep Only While Using" on the Always prompt | Recording still works while app foregrounded/screen-on; explicit `foreground-only` banner + Settings deep link (A4); verify gate requires the granted path |
| expo-location plugin/option names drift (docs unreachable from planning sandbox — 403 on docs.expo.dev, 2026-07-04) | A1/E5 flag every name as re-verify-at-execution; `npx expo prebuild --clean` output + native manifests are the ground truth |
| Android rejects `startLocationUpdatesAsync` without `ACCESS_BACKGROUND_LOCATION` on some expo-location versions | Contingency spelled in A4: flip `isAndroidBackgroundLocationEnabled: true`, request background permission, note the Play data-safety implication for P7 |
| GPS altitude noise inflates D+ | 3 m hysteresis + altitude-accuracy gating (E2); accept residual error in v1, note barometer/track-reprocessing as future work (raw samples are preserved for exactly this) |
| Standstill drift inflates distance | 30 m accuracy cut + 3 m anchor gate + 12.5 m/s jump gate (E2); verified by DoD item 6 |
| `points_reward < 90` runs earn more than the card shows (decomposition floor) | Accepted, documented (C4): card never over-promises; affects only sub-5 km social / tiny runs by ≤ 72 pts |
| Double-completion race (same user, two devices) | `unique (run_id, user_id)` + `for update` run lock → second insert replays idempotently (C4 step 4) |
| Raw upload fails after RPC success → dangling `raw_path` | Best-effort by design (F3): one retry, tolerated dangle; polyline + stats already persisted server-side |
| `alter type … add value` misuse in-transaction | New enum value only referenced at runtime in function bodies, never as a literal in migration DML (C5) |
| AsyncStorage buffer growth on ultra-long sessions | Chunked O(batch) writes; ~500 KB per 2 h; 12 h auto-stop (E5) |
| Reanimated + SVG `animatedProps` regressions (reanimated 4 / worklets) | Ring + draw-on both use the documented `createAnimatedComponent` path; fallback = non-animated render behind a try (recap must never block the points display) |
| Review prompt push before recipient finished their own recording | Deep link goes to `review/[runId]` (works for any approved member of a completed run), not to a recap they don't have (H6 decision) |
| Status flip hides the run from Explore mid-window | Correct behavior: `runs_within_radius` only lists `published`, and the run has already started; `join_run` was already blocked by `starts_at < now()` |

## Decisions made by this plan

- **Points reconciliation (decomposition):** `runs.points_reward` = max earnable from the run; `complete_run` awards `finished = greatest(points_reward − 40, 50)` plus fixed `distance_goal +20` / `on_time +10`, and `submit_review` adds `rate_crew +10` — summing to exactly `points_reward` whenever it ≥ 90, matching both PLAN.md §2's fixed reasons and core.sql's "completion award" comment; sub-90 runs may over-deliver (never under).
- **Distance-goal tolerance:** track distance ≥ **95 %** of `runs.distance_km` (GPS smoothing shrinks distance; 5 % is within consumer-GPS error).
- **On-time definition:** recording `started_at ≤ runs.starts_at + 10 min`; early starts always qualify.
- **Run completion trigger:** the **first successful `complete_run` flips `runs.status` to `completed`** (no host action, no cron) — the finisher is ground truth the run happened; host inaction can't block reviews/points.
- **Non-recording participants earn nothing:** points require finishing with GPS via `complete_run`; they can still review (and earn `rate_crew`) once the run is completed.
- **`run_tracks.run_id` NOT NULL:** v1 has no solo-run entry point (design starts recording from a joined run); solo free-runs deferred rather than half-supported with a nullable FK.
- **Track privacy:** `run_tracks` SELECT own-only; co-runner traces are not shared in v1 (GPS is sensitive; the design's completed detail only shows *your* result).
- **Raw-sample storage:** private `tracks` bucket, path `{user_id}/{run_id}.json.gz`, deterministic so the path can be recorded by `complete_run` *before* the upload; upload is best-effort post-RPC.
- **Crash-recovery mechanism:** AsyncStorage chunked buffer + meta (no SQLite/native dep); resume when the OS kept the task alive, salvage (finish/resume/discard) otherwise.
- **Accuracy/smoothing thresholds:** drop accuracy > 30 m, speed > 12.5 m/s, out-of-order samples; 3 m movement anchor; D+ = 3 m hysteresis gated by altitude accuracy ≤ 10 m (fallback 20 m overall accuracy); current pace over trailing 45 s, clamped 2:00–30:00 /km.
- **Pause keeps the location task running** (samples flagged, timer frozen) — restart-latency and iOS re-arm risks outweigh the battery cost of a paused-but-open session.
- **Android permission posture:** foreground service + when-in-use only, no `ACCESS_BACKGROUND_LOCATION` (Play-policy-friendly, sufficient for screen-locked tracking); documented contingency if expo-location demands otherwise; iOS requests Always at first run start.
- **`rate_crew` idempotency:** awarded on the reviewer's *first* review of a run via `on conflict (user_id, run_id, reason) do nothing` — per-run-per-reviewer by construction, independent of reviewee count.
- **Reviews are one-shot** (no edit/delete in v1); duplicate submits surface a friendly error; `reviews` readable only by reviewer/reviewee until P5 profiles.
- **Rating aggregates = full recompute per insert** — drift-proof and cheap at v1 scale.
- **Completed-run detail is a state of `run/[id]`**, not a new route (PLAN.md §4 route list is closed); recap's SAVE RUN replaces to it.
- **History lives in Your Runs "Past" tab** (Main Flow prototype), backed by `list_past_runs()`; profile KM/RUNS/D+ totals are P5.
- **`run_completed` notification deep-links to `/review/[runId]`** (valid for every participant) rather than a recap they may not have.
- **Levels defaults:** 10 levels, 0→8000 pts (C1 table), calibrated so the prototype's "1,240 pts = level 4" holds; titles empty until P5.
- **Recap shows a draw-on route card** (directive) even though the prototype recap is map-less — implemented as SVG path animation, not a second MapView.
- **km-only display in P4 surfaces**; `profiles.units = 'mi'` rendering deferred to P7 hardening.
- **Start window:** START RUN appears (and `complete_run` accepts) from 30 min before `starts_at`.

## Out of scope

- Co-runner live dots, "3 running" presence, live-share pages, SOS, `live_share_sessions`/`live_locations` → **P5** (the Reward Loop live screen's runner dots are P5 polish).
- Badges (`badges`/`user_badges`, recap BADGES button, "VIEW BADGES"), weekly leaderboard, full profile stats (KM/RUNS/D+ totals, "Other runners say" review display), broadening `reviews` RLS for public profiles → **P5**.
- HealthKit/Strava/Garmin export of `run_tracks` → **P6**.
- Solo free-run recording without an associated run row; km splits/laps; auto-pause; audio cues; barometric altitude; track re-processing from raw samples; recap screenshot-image sharing; mi units display; review editing → **P7 or backlog**.
- Play Store background-location/foreground-service data-safety declarations, iOS background-location review notes + demo video → **P7** (seeded by this phase's A1 posture).
