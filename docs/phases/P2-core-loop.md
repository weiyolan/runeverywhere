# P2 — Core Loop (Weeks 4–7)

| | |
|---|---|
| **Depends on** | P0 (dev builds both platforms, tokens, `Button`/`TypeChip`/`RunCard`/`TabBar`, local stack with `00000000000001_core.sql` + `00000000000002_points_reward_on_all_writes.sql`, typed client, committed `database.types.ts`, EAS project linked); P1 (real auth + AuthGate, onboarded `profiles` with `home_point`, hosted Supabase project with migrations `…10`/`…11` pushed, `Input` + `IconButton` components, EAS env-var pattern, Google Cloud project with OAuth SHA-1s already registered) |
| **Provides to later phases** | The app-wide TanStack Query **key schema + invalidation policy** (P3–P6 reuse it); membership transition RPCs `cancel_join`/`remove_member` + `run_approved_count` + `search_runs` (migrations `…20`/`…21`); the single `AppMap` wrapper + custom map style (P4 live trace, P5 live-share reuse it); ported `Tabs`/`Badge`/`Avatar`/`StatBlock`/`MapPin`/`RouteMarker`; installed `@gorhom/bottom-sheet` + `@react-native-community/datetimepicker`; Google Maps API keys (restricted, in EAS env); `invite/[code]` deep-link pattern (P7 QA matrix builds on it); `run/[id]` screens P3 chat and P4 live/recap link out of |
| **Verify gate (PLAN.md §5)** | "Create → discover → request → approve across two devices" |

## Goal

Ship the product's core loop end-to-end: a host creates a run through the 4-step wizard (pin drop, validated details, server-computed points preview), other runners discover it on the Explore map/list/search with filters, open its detail, request to join with an intro message, and the host approves from an inbox — all state transitions running through the `SECURITY DEFINER` RPCs from [0001_core.sql](../../supabase/migrations/00000000000001_core.sql) plus two small P2 migrations that close the runner-cancel / host-remove / capacity-count / search gaps. The phase is almost entirely client work; it ends with the two-device verify gate passing on real hardware.

## Definition of done

1. Migrations `00000000000020_membership_transitions.sql` and `00000000000021_search_runs.sql` apply cleanly (`supabase db reset` local, `supabase db push` hosted); `npm run db:types` regenerated and committed diff-clean.
2. Google Maps renders via `PROVIDER_GOOGLE` with the custom light JSON style on **both** platforms in dev builds using restricted per-platform API keys (no blank/beige tiles, no watermark errors).
3. Explore map shows nearby published runs as type-colored teardrop `MapPin`s with km labels (e.g. "7.5K"); overlapping pins cluster into dark count bubbles via supercluster; tapping a cluster zooms to expand it.
4. Foreground location permission is requested on first Explore open; granted → user dot + recenter button work; denied → map centers on `profiles.home_point` (fallback Lisbon) with a "location off" banner.
5. Tapping a pin opens the bottom run-preview sheet (`@gorhom/bottom-sheet`) with a compact `RunCard` + distance-away line; "VIEW RUN" navigates to `run/[id]`.
6. Map ↔ list pill toggle works; list shows full `RunCard`s with result count and NEAREST / SOONEST / DISTANCE sort.
7. `explore/search` returns title/area matches through the `search_runs` RPC (≥2 chars, debounced), shows areas-near-you suggestions and recent searches, and has an empty state. Invite-only runs never appear in map, list, or search.
8. `explore/filters` maps 1:1 to `runs_within_radius` params (types → `p_types`, date window → `p_from`/`p_to`, route → `p_closed_loop`, only-open-spots → `p_only_open_spots`); active-filter count badge + CLEAR ALL work.
9. Create wizard `create/type → location → details → review` completes: pin drop with on-device reverse geocode (area/city/country), zod validation mirroring DB constraints (title 1–40, goal ≤200, distance 1–42, max_group 2–30, pace 120–720 s/km, future `starts_at`), review step shows a points preview fetched from the `compute_points_reward` RPC that equals the published row's `points_reward`.
10. Publishing INSERTs `runs` under RLS as the signed-in host and lands on the published-success state → `run/[id]`; the run appears on a second account's Explore after refetch.
11. Run detail shows: quoted goal in body face, host card (avatar, name, rating), StatBlocks (km, pace, day, time), `+N PTS` badge, GOING count, and **spots left = `max_group − 1 − approved_count`** (host occupies one slot — matches `join_run`'s capacity check exactly).
12. Request-to-join modal (intro ≤240 chars + prompt chips) calls `join_run`; detail then renders the pending "Request sent" state with WITHDRAW.
13. Open-visibility runs join instantly (no modal); a full run renders FULL with the CTA disabled; `join_run`'s "run is full" error is surfaced cleanly if capacity races.
14. Invite-only run: hidden everywhere public; share sheet from detail/manage shares `runeverywhere://invite/<code>`; opening the link resolves via `get_run_by_invite` and lands on detail with an instant JOIN.
15. Host inbox `run/[id]/requests` lists pending requests with profile + intro; ACCEPT/DECLINE call `respond_to_join_request` with optimistic UI; approving into a full run surfaces the server error and refetches.
16. Requester sees APPROVED (or DECLINED) state on their device after app-focus refetch or pull-to-refresh — no manual restart needed.
17. `cancel_join` (runner withdraws pending or cancels approved spot) and `remove_member` (host removes approved) work end-to-end; a removed runner sees the removed state and **cannot** re-request (server behavior).
18. `run/[id]/manage`: edit title/goal/distance/max-group/pace/time/route/visibility with validation (max_group never below approved+1); CANCEL RUN sets `status='cancelled'`; cancelled run shows a banner on detail and disappears from Explore/search.
19. `(tabs)/runs` shows ALL / MANAGED BY YOU / JOINED underline tabs with counts; managed cards show a pending-requests badge; joined cards show pending/approved status.
20. `/dev/components` gallery renders the six newly ported components in all contract states.
21. `supabase/tests/core_loop_smoke.sql` passes locally and on hosted (RLS + RPC behavior, incl. removed-cannot-rejoin and capacity-full).
22. Two-device verification script (below) passes in full; automated gates green (`npm run typecheck`, `npm run lint`, `supabase db lint --level warning`, types drift clean).

## Preconditions

| Precondition | How to check |
|---|---|
| P1 verify gate passed: sign-up → onboarding → tabs; RLS smoke green | Sign in on device with a real account; `profiles.onboarded_at` set |
| Migrations `…01`, `…02`, `…10`, `…11` applied local + hosted | `select version from supabase_migrations.schema_migrations` lists all four |
| Typed client + committed types | `src/types/database.types.ts` exists; `npm run typecheck` green |
| `Input`, `IconButton` ported (P1 D1/D2) | `ls src/components/ui/` shows both; gallery renders them. If missing, execute P1 D1/D2 first — P2 does not re-specify them |
| Google Cloud project from P1 (OAuth clients, SHA-1s recorded) | console.cloud.google.com → project "Run Everywhere" exists |
| Google Cloud **billing enabled** (required to enable Maps SDKs; mobile SDK usage itself is $0 unlimited per PLAN.md §1) | Console → Billing shows a linked account |
| Two physical devices (or 1 device + 1 emulator w/ Play services) + two onboarded accounts | Both sign in against the hosted project |
| EAS env-var pattern from P1 B4 in place | `eas env:list --environment development` shows the P1 vars |
| Dev-build workflow working (Expo Go cannot run `react-native-maps`) | `npx expo run:ios` / `run:android` boot the current app |

## Workstreams

### A — Native prerequisites: Maps keys, installs, root wiring

**A1. Google Maps API keys (Google Cloud console, same project as P1).**
- Enable APIs: **Maps SDK for Android** and **Maps SDK for iOS** (APIs & Services → Library). Do **not** enable Places/Geocoding — PLAN.md §6: on-device geocoder + DB search only.
- Create two API keys (Credentials → Create credentials → API key):
  - `runeverywhere-ios`: Application restriction = iOS apps, bundle `com.runeverywhere.app`; API restriction = Maps SDK for iOS only.
  - `runeverywhere-android`: Application restriction = Android apps, package `com.runeverywhere.app` with **both** SHA-1s from P1 G3 (debug keystore + EAS keystore); API restriction = Maps SDK for Android only.
- Fill `.env` `GOOGLE_MAPS_API_KEY_IOS` / `GOOGLE_MAPS_API_KEY_ANDROID` (slots already exist in [.env.example](../../.env.example); [app.config.ts](../../app.config.ts) already reads them — no config change needed). Create the same two EAS env vars for `development` / `preview` / `production` environments (`eas env:create`).
- Acceptance: keys listed as restricted in console; `eas env:list` shows both names in all three environments.

**A2. Install dependencies.**
```sh
npm install @gorhom/bottom-sheet@^5        # JS-only; peers reanimated 4.3.1 + RNGH 2.31.1 already installed
npx expo install @react-native-community/datetimepicker   # native → dev clients must be rebuilt
```
`react-native-maps@1.27.2`, `supercluster@^8`, `@types/supercluster` are already in [package.json](../../package.json) — do not reinstall.
- Acceptance: `package.json` shows `@gorhom/bottom-sheet` ^5 and the SDK-56-pinned datetimepicker; `npm run typecheck` green.

**A3. Root wiring for gesture-handler.**
- `src/app/_layout.tsx`: wrap the existing tree in `<GestureHandlerRootView style={{ flex: 1 }}>` (import from `react-native-gesture-handler`, outermost inside `SafeAreaProvider` is fine). Required by bottom-sheet v5.
- Acceptance: app boots; no "GestureHandlerRootView" runtime warning.

**A4. Rebuild dev clients** (new native module + Maps keys are baked at build time): `npx expo run:ios` and `npx expo run:android` locally; `eas build --profile development` for the second physical device.
- Acceptance: both builds boot; a throwaway `<AppMap>` (after C7) renders Google tiles.

### B — Database: P2 migrations, seed fixtures, smoke tests

Full SQL in **Data model & security**. P2 owns slots `…20`–`…29`.

**B1. `supabase/migrations/00000000000020_membership_transitions.sql`** — three functions: `cancel_join(p_run_id)` (runner: pending|approved → cancelled), `remove_member(p_run_id, p_user_id)` (host: approved → removed), `run_approved_count(p_run_id)` (definer count so non-members can render spots-left; RLS blocks them from counting `run_members` rows directly).
- Acceptance: `supabase db reset` clean; `supabase db lint --level warning` clean.

**B2. `supabase/migrations/00000000000021_search_runs.sql`** — trigram GIN index on `runs.area_name` + `search_runs(p_query, p_lat, p_lng, p_limit)` RPC (SECURITY INVOKER — reuses the runs SELECT policy, so invite runs stay hidden).
- Acceptance: in psql as an authed role, `select (run).title from public.search_runs('old', 38.72, -9.14)` returns "Old Town Loop"; searching an invite run's title returns 0 rows.

**B3. Extend `supabase/seed.sql`** (local-only fixtures; never pushed to hosted):
- Add a 4th run: id `10000000-0000-4000-8000-000000000004`, host maya (`…0001`), `type='challenge'`, `visibility='invite'`, `invite_code='DEVLINK01'` (explicit, deterministic for link testing), title `Track Repeats`, goal `6×800m on the track — bring spikes if you have them.`, start_point `POINT(-9.1650 38.7420)`, area `Campolide`, city `Lisbon`, `distance_km 8.0`, `max_group 4`, pace `240`, `starts_at now() + interval '4 days'`, `closed_loop true`.
- Add membership fixtures: maya **pending** on `Old Town Loop` (intro `New in Lisbon this week and keen to explore with locals.`) → marco gets an inbox fixture; marco **approved** on `Sunset 5K` (`decided_at now()`) → roster fixture.
- Acceptance: after `supabase db reset`, marco's Requests inbox for Old Town Loop shows maya; Sunset 5K shows 1 approved.

**B4. Regenerate types**: `npm run db:types`; commit. The new RPCs appear under `Database['public']['Functions']`.

**B5. `supabase/tests/core_loop_smoke.sql`** (same role-play technique as P1's `rls_smoke.sql`: `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'`; one `begin…rollback` block per expected error). Cases (expected result in header comments):
1. As marco: `select count(*) from runs where id = '<track-repeats>'` → `0` (invite hidden); `select count(*) from get_run_by_invite('DEVLINK01')` → `1`.
2. As marco: `insert into run_members …` → RLS error (no INSERT policy; writes only via RPCs).
3. As marco: `join_run('<track-repeats>')` → row with `status='approved'` (invite joins instantly); repeat → error `already requested or joined`.
4. As maya (non-host): `respond_to_join_request('<old-town>', …)` → error `only the host can decide requests`.
5. As maya: `cancel_join('<old-town>')` → `status='cancelled'`; `join_run('<old-town>', 'again')` → `status='pending'` (re-request after cancel allowed).
6. As marco (host): `respond_to_join_request('<old-town>', '<maya>', true)` → approved; `remove_member('<old-town>', '<maya>')` → `removed`; as maya: `join_run('<old-town>')` → error `already requested or joined` (**removed cannot rejoin** — documented behavior).
7. Capacity: as postgres set `max_group=2` on a fixture, approve one member, then approve a second pending → error `run is full`; `run_approved_count` returns 1.
8. Regression (P0): `update runs set points_reward = 9999 where id = '<old-town>'` as postgres → value recomputes via trigger.
- Acceptance: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/core_loop_smoke.sql` output matches headers; same blocks pass in the hosted SQL editor (with hosted uuids where fixtures don't exist — cases 2/4 style checks still run against real rows).

### C — Design-system ports + map foundation

Port per `.d.ts` contract (web props → RN equivalents, same pattern as P0/P1 ports). Each task ends with a gallery section in `src/app/dev/components.tsx`.

**C1. `src/components/ui/Tabs.tsx`** — [Tabs.d.ts](../../run-everywhere-app-design/project/components/navigation/Tabs.d.ts): `items: {id,label,count?}[]`, `value`, `onChange`, `variant: 'underline'|'pill'` (default underline), `accent?` (default `colors.ink900`), `full?` (default true). Visuals per `Tabs.jsx`: underline = 46px row, `borderWidth.mid` `ink200` bottom hairline, active 3px underline in `accent`, labels `fonts.displayExtra` 13 uppercase `tracking.caps`, active `ink900`/inactive `ink400`; pill = `paper3` container `radius.pill` pad 4, 40px segments, active segment bg `accent` text `paper`; count pill 11px `fonts.bodyBold` (`ink200`/`ink500` inactive, accent/`paper` active).

**C2. `src/components/ui/Badge.tsx`** — [Badge.d.ts](../../run-everywhere-app-design/project/components/data/Badge.d.ts): `children`, `tone: 'neutral'|'ink'|'volt'|'go'|'warn'|'danger'|'star'`, `icon?`, `solid?`. Soft = `<tone>Soft` bg + tone text; solid = tone bg + contrast text (volt→`voltInk`, ink→`paper`). `radius.pill`, `fonts.display` 11 uppercase, padding 3×8. Used for `+120 PTS`, `FULL`, `PENDING`, `INVITE ONLY`, filter counts.

**C3. `src/components/ui/Avatar.tsx`** — [Avatar.d.ts](../../run-everywhere-app-design/project/components/data/Avatar.d.ts): `src?` (render with `expo-image`, `cachePolicy="memory-disk"`), `name?` (initials fallback, 2 chars, `fonts.display` on `ink100`), `size: 'xs'|'sm'|'md'|'lg'|'xl'` → 24/32/40/56/84, `verified?` (go-green tick puck bottom-right), `ring?` (2px ring in the given color token). Circular always.

**C4. `src/components/ui/StatBlock.tsx`** — [StatBlock.d.ts](../../run-everywhere-app-design/project/components/data/StatBlock.d.ts): `value`, `label`, `unit?`, `accent?`, `align?`, `size 'sm'|'md'|'lg'` → value 22/30/40 in `fonts.displayExtra` + `tabular-nums`; unit 12px `ink400` after value; label = `textStyles.eyebrow`. Used for KM · /KM · DAY · TIME rows.

**C5. `src/components/map/MapPin.tsx`** — [MapPin.d.ts](../../run-everywhere-app-design/project/components/run/MapPin.d.ts) via `react-native-svg` (no map dependency — the pin is a pure view usable inside `AppMarker` and the gallery): `type`, `label`, `selected?`, `cluster?`. Teardrop path from `MapPin.jsx` (`M20 1C9.5…`), fill `runType[type].main`, stroke `paper` 2.5 (selected: `ink900` 3, size 40→52), inner 18%-white circle, centered white label `fonts.displayBlack` 12/15; cluster = 38px `ink900` circle, 2.5px `paper` border, white count. `shadows.pin`.

**C6. `src/components/map/RouteMarker.tsx`** — [RouteMarker.d.ts](../../run-everywhere-app-design/project/components/run/RouteMarker.d.ts): `kind: 'start'|'finish'|'closed'`, `type?`, `size?` (default 22). start = filled dot in type color + white ring; finish = ink flag glyph; closed = type-color ring with gap (loop). P2 uses `start` (detail mini-map, create pin) and `closed` (closed-loop indicator); `finish` ships for P4.

**C7. `src/components/map/AppMap.tsx` — the ONE MapView wrapper (PLAN.md §1: MapLibre swap stays a one-module change).**
- Exports: `AppMap` (forwardRef), `AppMarker` (re-export of `Marker`), `AppMapHandle` (`animateToRegion(region, durationMs)`, `animateToCoordinate(latLng)`), types `Region`, `LatLng`.
- `AppMap` props: `initialRegion`, `onRegionChangeComplete?`, `onPress?`, `onMapReady?`, `showsUserLocation?`, `interactive?` (default true; false → all gestures/toolbars off for mini-map previews), `style?`, `children`.
- Hard-coded inside: `provider={PROVIDER_GOOGLE}` (both platforms), `customMapStyle={mapStyle}`, `showsMyLocationButton={false}`, `toolbarEnabled={false}`, `pitchEnabled={false}`, `rotateEnabled={false}`.
- Enforce single-module rule: add to `eslint.config.js` a `no-restricted-imports` entry for `react-native-maps` ("import from @/components/map/AppMap instead") with an override allowing `src/components/map/**`.
- Acceptance: `npm run lint` fails if any other file imports `react-native-maps` (test by temporarily adding one).

**C8. `src/components/map/mapStyle.ts`** — custom light JSON style (array of Google style rules), token-matched: geometry base `#F5F5F3` (paper2); water `#E7F0FF` (discoverSoft); parks/landscape.natural `#E4EFE4` (muted, NOT go-green — go is a signal color only); roads `#FFFFFF` with `#DEDEE2` strokes, highways `#ECECEE`; POI + transit `visibility: off` (all `poi.*`, `transit`); labels: only `locality`/`neighborhood`/`road.arterial+highway` visible, text fill `#6B6B73`, stroke `#FFFFFF`; `administrative` hairlines `#DEDEE2`. Keep ~20 rules, commented.
- Acceptance: map on device reads as the design's pale canvas; no default POI pins/labels compete with MapPins.

**C9. Gallery**: add sections "Tabs" (underline w/ counts, pill), "Badges" (all tones, solid/soft), "Avatars" (sizes, ring, verified, fallback), "StatBlocks", "Map pins" (3 types, selected, cluster), "Route markers".

### D — Data layer: query keys, services, filter store

**D1. `src/lib/queryKeys.ts` — the app-wide key schema.** Later phases MUST extend this file, never invent ad-hoc keys.

```ts
export const qk = {
  runsNearby: (p: { lat: number; lng: number; radiusM: number; filters: ExploreFilterParams }) =>
    ['runs', 'nearby', p] as const,          // invalidate all: ['runs','nearby']
  runsSearch: (q: string) => ['runs', 'search', q] as const,
  runsMine: () => ['runs', 'mine'] as const, // hosted + joined for (tabs)/runs
  run: (id: string) => ['run', id] as const, // detail bundle: run + host + approvedCount + myMembership
  runMembers: (id: string) => ['run', id, 'members'] as const, // roster + inbox (host/member only)
  pointsPreview: (km: number, type: RunType) => ['points', 'preview', { km, type }] as const,
  profile: (id: string) => ['profile', id] as const,           // reserved — P5 user/[id]
  // RESERVED (do not repurpose): ['conversations'], ['conversation', id, 'messages'],
  // ['notifications'] → P3; ['track', id], ['run', id, 'reviews'] → P4;
  // ['leaderboard', isoWeek, city], ['badges', userId] → P5.
};
```
- `lat`/`lng` in `runsNearby` are rounded to 3 decimals (~110 m) before keying to prevent cache churn; `filters` is a stable-serialized plain object (sort is NOT part of the key — sorting is client-side).

**D2. `src/lib/format.ts`** — pure helpers (unit-test-free, but deterministic): `formatPace(sPerKm)` → `"5:30 /km"`; `formatKm(km)` → `"7.5 km"`; `formatPinLabel(km)` → `"7.5K"` / `"12K"` (trim `.0`); `formatWhen(startsAt)` → `"Today · 18:30"` / `"Tomorrow · 07:00"` / `"Sat · 08:00"` / `"12 Jul · 08:00"` (date-fns, device-local); `formatAway(m)` → `"400 m away"` / `"2.1 km away"`; `spotsLeft(maxGroup, approvedCount)` → `maxGroup - 1 - approvedCount` (THE single definition — no screen computes it inline).

**D3. `src/lib/geo.ts`** — `parsePoint(value): { lat, lng } | null` handling both PostgREST geography encodings: hex-EWKB string (`0101000020E6100000` + 8-byte LE doubles lng, lat) and GeoJSON `{ type:'Point', coordinates:[lng,lat] }`. Used to read `runs.start_point` from every fetch path. Plus `regionForRadius(center, radiusM)` and `distanceMeters(a, b)` (haversine, for the "search this area" threshold).

**D4. `src/lib/runs.ts`** — all Supabase reads/writes for the loop; screens never call `supabase` directly.
- `fetchNearbyRuns(params)` → `supabase.rpc('runs_within_radius', { p_lat, p_lng, p_radius_m, p_types, p_from, p_to, p_closed_loop, p_only_open_spots })`; map rows to `NearbyRun = { run: RunRow & {point: LatLng}, distanceM, approvedCount, spotsLeft }`.
- `searchRuns(q, lat, lng)` → `rpc('search_runs', …)` (escape `%`/`_` in `q` first).
- `fetchMyRuns()` → parallel: `runs.select('*').eq('host_id', uid)`; `run_members.select('status, requested_at, run:runs(*)').eq('user_id', uid).in('status', ['pending','approved'])`; pending counts for hosted runs via `run_members.select('run_id').eq('status','pending').in('run_id', hostedIds)` grouped client-side. Returns `{ hosted: (RunRow & {pendingCount})[], joined: {run, myStatus}[] }`.
- `fetchRunDetail(id, inviteCode?)` → `runs.select('*, host:profiles!runs_host_id_fkey(id, display_name, avatar_url, rating_avg, rating_count, home_city)').eq('id', id).maybeSingle()`; if null and `inviteCode` present → `rpc('get_run_by_invite', { p_code })` (+ separate host profile fetch; hidden host → `host: null`, UI shows "Host"). Then parallel `rpc('run_approved_count')` + own `run_members` row (`maybeSingle`). Returns `{ run, host, approvedCount, myMembership }`; run null → throw `RunNotFoundError`.
- `fetchRunMembers(id)` → `run_members.select('*, profile:profiles(id, display_name, avatar_url, rating_avg, rating_count, languages)').eq('run_id', id).order('requested_at')` (RLS limits to host/members; screens gate with `enabled: isHost || isMember`).
- Mutations (thin): `joinRun(id, intro)`, `cancelJoin(id)`, `respondToRequest(id, userId, approve)`, `removeMember(id, userId)`, `createRun(draft)` (INSERT with `start_point: 'POINT(lng lat)'` WKT, `.select().single()`), `updateRun(id, patch)`, `cancelRun(id)` (`update({status:'cancelled'})`).
- **Invalidation policy** (implemented as custom hooks `useJoinRun(runId)` etc. in `src/lib/runMutations.ts`):

| Mutation | Optimistic (`onMutate` on cache) | `onError` | `onSettled` invalidates |
|---|---|---|---|
| `joinRun` | `qk.run(id)`.myMembership → `pending` (`approval`) / `approved` (`open`/`invite`) | rollback snapshot; surface "run is full" / "run already started" | `qk.run(id)`, `qk.runMembers(id)`, `qk.runsMine()`, `['runs','nearby']`, `['runs','search']` |
| `cancelJoin` | myMembership → `cancelled` | rollback | same as joinRun |
| `respondToRequest` | `qk.runMembers(id)` row → approved/declined | rollback; "run is full" → alert + refetch | `qk.run(id)`, `qk.runMembers(id)`, `qk.runsMine()` |
| `removeMember` | members row → `removed` | rollback | `qk.run(id)`, `qk.runMembers(id)` |
| `createRun` | none (pessimistic — needs server row) | inline error on review step | seed `qk.run(newId)` with response; invalidate `['runs','nearby']`, `qk.runsMine()` |
| `updateRun` / `cancelRun` | `qk.run(id)` patched | rollback | `qk.run(id)`, `['runs','nearby']`, `['runs','search']`, `qk.runsMine()` |

**D5. `src/lib/queryFocus.ts`** — wire TanStack Query to RN app state: `AppState.addEventListener('change', s => focusManager.setFocused(s === 'active'))`; import once from `src/app/_layout.tsx`. Screen-level freshness: run detail, requests inbox, and `(tabs)/runs` call a small `useRefetchOnFocus(...keys)` helper (`useFocusEffect` → `queryClient.invalidateQueries`). Lists get `RefreshControl` pull-to-refresh. (No realtime in P2 — push/broadcast arrive in P3; 30s `staleTime` from [queryClient.ts](../../src/lib/queryClient.ts) stands.)

**D6. `src/stores/exploreFilters.ts`** — zustand (filters must survive the `explore/filters` route round-trip):
```ts
{ types: RunType[]            // [] = all → p_types: null
  when: 'any'|'today'|'week'|'weekend'
  route: 'any'|'open'|'closed' // → p_closed_loop null/false/true
  onlyOpenSpots: boolean
  sort: 'nearest'|'soonest'|'distance'   // client-side only
  setters…, clearAll(), activeCount()    // count excludes sort
  toRpcParams(): ExploreFilterParams }   // when → p_from/p_to: today = [now, endOfDay];
                                         // week = [now, +7d]; weekend = [next Sat 00:00, Sun 24:00] (device-local, date-fns)
```
Recent searches: `recentQueries: string[]` (max 8, in-memory only) also lives here.
- Acceptance (D workstream): typecheck green; a throwaway probe screen lists nearby seed runs via `useQuery(qk.runsNearby(...), fetchNearbyRuns)`.

### E — Explore map + list (`(tabs)/index` rewrite)

**E1. `src/hooks/useUserLocation.ts`** — on mount: `Location.getForegroundPermissionsAsync()`; not granted → `requestForegroundPermissionsAsync()` (plugin string already in app.config.ts). Granted → `getCurrentPositionAsync({ accuracy: Accuracy.Balanced })`. Returns `{ status: 'loading'|'granted'|'denied', coords: LatLng | null }`. Fallback chain for the query/map center: device coords → `useSession().profile.home_point` (via `parsePoint`) → Lisbon `{ lat: 38.7223, lng: -9.1393 }`.

**E2. `src/hooks/useClusters.ts`** — `useClusters(runs: NearbyRun[], region: Region)`: memoized `new Supercluster({ radius: 48, maxZoom: 16 })` loaded with GeoJSON points (`properties: { runId, type, kmLabel }`); zoom = `Math.round(Math.log2(360 / region.longitudeDelta))`; bbox = region ± deltas × 0.6 (padding). Returns `{ clusters, expansionRegion(clusterId) }` (uses `getClusterExpansionZoom` → region).

**E3. Rewrite `src/app/(tabs)/index.tsx`** (replaces the P0 fixture list; design: Discover Flow "EXPLORE MAP" / "EXPLORE LIST").
- Local state: `view: 'map'|'list'`, `selectedRunId: string | null`, `queryCenter: LatLng` (initialized from E1 fallback chain), `mapRegion`.
- Data: `useQuery(qk.runsNearby({ ...round(queryCenter), radiusM: 25_000, filters: store.toRpcParams() }), …)`.
- Header overlay (absolute over map, safe-area padded): search pill (Pressable styled like `Input`, placeholder `Search runs in {city}` from profile.home_city fallback "your city") → `router.push('/explore/search')`; `IconButton` filter (surface) with a `Badge tone="ink" solid` count when `activeCount() > 0` → `/explore/filters`; row of 3 `TypeChip`s toggling `store.types`; pill `Tabs` MAP | LIST.
- **Map view**: `<AppMap ref showsUserLocation={locGranted} initialRegion={regionForRadius(queryCenter, 25_000)} onRegionChangeComplete={setMapRegion}>`; render `useClusters` output as `<AppMarker key coordinate anchor={{x:0.5,y:1}} tracksViewChanges={false} onPress>` wrapping `MapPin` (cluster → cluster bubble, press animates to `expansionRegion`; point → `type` + `kmLabel`, `selected={runId===selectedRunId}`). Recenter `IconButton` (surface, round, bottom-right) → animate to user coords. When `distanceMeters(mapRegion.center, queryCenter) > 5_000`: show a floating "SEARCH THIS AREA" chip (`Button size="sm" variant="secondary" shape="pill"`) → `setQueryCenter(mapRegion.center)`.
- **Preview sheet**: `BottomSheet` (index -1 when nothing selected; single snap point 248; `enablePanDownToClose`) containing `RunCard variant="compact"` for the selected run + `formatAway(distanceM)` caption + `Button label="VIEW RUN" full` → `router.push(\`/run/${id}\`)`. Marker press opens; map press / pan-down closes (`selectedRunId = null`).
- **List view**: `FlatList` of `RunCard` (default variant; `spotsLeft` from D2 helper; press → detail) sorted by `store.sort` (nearest = `distanceM`, soonest = `starts_at`, distance = `distance_km` asc); header row: `"{n} RUNS NEAR YOU"` eyebrow + sort toggle (Pressable cycling the 3 sorts, label `SORT: NEAREST`); `RefreshControl`.
- States: query loading → 3 skeleton cards (list) / pins absent (map); error → inline message + RETRY; empty → "No runs match — widen your filters." + `CLEAR FILTERS` (calls `clearAll()`); location denied → thin banner "Location is off — showing {home_city}. Enable in Settings." with `Linking.openSettings()` link.
- Keep the `__DEV__`-gated gallery link.
- Acceptance: seed runs appear as 3 typed pins with km labels; zooming out clusters them; pin → sheet → detail navigates; toggling a TypeChip refetches with `p_types`; list sorts flip order.

### F — Search + filters routes

**F1. Register routes** in `src/app/_layout.tsx`: `<Stack.Screen name="explore/search" />` (default push), `<Stack.Screen name="explore/filters" options={{ presentation: 'modal' }} />`, and (for H/I) `<Stack.Screen name="run/[id]" />`, `<Stack.Screen name="invite/[code]" />`.

**F2. `src/app/explore/search.tsx`** (design: Discover Flow "SEARCH"):
- Header: back `IconButton` + `Input` autofocus, placeholder "Search runs, areas, runners" (runners search is P5 — matching is runs/areas only in P2), trailing clear.
- Debounce 300 ms; `q.trim().length >= 2` → `useQuery(qk.runsSearch(q), () => searchRuns(q, center.lat, center.lng))` with `center` from E1 chain. On submit, push `q` into `recentQueries`.
- Idle state (no query): "RECENT" chip row (tap → set query) + "AREAS IN {CITY}" list derived client-side from the cached nearby query (group by `area_name`, count + min distance; tap → set query to area name).
- Results: compact `RunCard`s (+ `formatAway`); press → `run/[id]`. Empty: "No runs found for “{q}”." + hint "Try an area name or shorter word."
- Acceptance: "old" finds Old Town Loop; "Track Repeats" (invite) finds nothing; area suggestion taps populate results.

**F3. `src/app/explore/filters.tsx`** (design: Discover Flow "FILTERS" sheet):
- Modal screen bound to the D6 store (edits apply to a local copy; APPLY commits — CANCEL/back discards). Sections, each an eyebrow + chip/`Tabs` row:
  - RUN TYPE — 3 `TypeChip`s multi-toggle (`types`).
  - WHEN — chips ANY / TODAY / THIS WEEK / WEEKEND (`when`).
  - ROUTE — chips ANY / OPEN ROUTE / CLOSED LOOP (`route`).
  - SPOTS — toggle row "Only runs with open spots" (`onlyOpenSpots`, RN `Switch` with `trackColor` volt).
  - SORT BY — pill `Tabs` NEAREST / SOONEST / DISTANCE (`sort`).
  - Design's PACE and DISTANCE filter chips are **dropped in P2** — `runs_within_radius` has no such params (scope maps filters 1:1; see Decisions #6).
- Footer: `Button label="SHOW RUNS" full` (commit + `router.back()`); header right "CLEAR ALL" text button.
- Acceptance: each control changes the RPC call (verify in network/PostgREST logs); count badge on Explore reflects `activeCount()`; CLEAR ALL resets.

### G — Create wizard (`create/type → location → details → review`)

**G1. `src/stores/createRun.ts`** — zustand draft: `{ type, point: LatLng|null, area_name, city, country_code, title, goal, distance_km: 5, max_group: 8, target_pace_s_per_km: 360 | null, starts_at: Date|null, closed_loop: false, visibility: 'approval', set(patch), reset() }`. `reset()` on publish success and on wizard unmount-via-close.

**G2. `src/lib/validation/run.ts`** — zod schemas mirroring DB constraints 1:1 (source: [0001_core.sql](../../supabase/migrations/00000000000001_core.sql) `runs` checks): `title` trim 1–40; `goal` trim ≤200; `distance_km` 1–42, step 0.1 (numeric(4,1)); `max_group` int 2–30; `target_pace_s_per_km` int 120–720 nullable; `starts_at` ≥ now+15 min (client rule; server only rejects past at join time); `closed_loop` boolean; `visibility` enum; `point` required. Export per-step schemas (`locationStepSchema`, `detailsStepSchema`) + `publishSchema` (all).

**G3. Rewrite `src/app/create/type.tsx`** — step 1/4 "WHAT KIND OF RUN?": three full-width selectable cards (TypeChip + design blurbs: discover "Explore a city or route — sightsee on foot at an easy effort." / challenge "Race pace or hard effort — push together, regroup at the top." / social "Easy, chatty meet-up or recovery — all paces welcome."); select → store + auto-advance `router.push('/create/location')`. Header: `STEP 1 / 4` eyebrow + close `IconButton` (confirm-discard `Alert` if draft dirty).

**G4. `src/app/create/location.tsx`** — step 2/4 "DROP YOUR START POINT":
- `<AppMap>` (interactive) centered on E1 fallback chain; fixed center-pin UX: a `MapPin type={draft.type}` rendered as an overlay at screen center ("Tap map to move" is replaced by drag-map-under-pin — simpler and matches "pin drop"); `onRegionChangeComplete` → `draft.point = region center` + debounced (600 ms) `Location.reverseGeocodeAsync(point)` → `area_name = district ?? subregion ?? city ?? ''`, `city = city ?? region ?? ''`, `country_code = isoCountryCode ?? ''` (on-device, free — PLAN.md §2 Geo).
- Address card below map: `"{area_name}, {city}"` (or "Locating…" / "Unnamed area" on empty geocode — editable `Input label="AREA NAME"` fallback appears when geocoder returns nothing).
- Footer `Button label="CONTINUE" full` disabled until `locationStepSchema` passes.
- Acceptance: dragging the map updates the area label; airplane-mode geocode failure still allows manual area entry.

**G5. `src/app/create/details.tsx`** — step 3/4 "SET THE DETAILS" (design steps 2+3 merged; the visibility section lives here — see Decisions #9):
- `Input label="RUN NAME"` (maxLength 40, counter hint), `Input label="GOAL" multiline` (≤200, counter; placeholder "What's this run about? Pace, vibe, coffee after…").
- DISTANCE — stepper row (−/＋ `IconButton`s, 0.5 km steps, clamped 1–42) + big `StatBlock` readout.
- MAX GROUP — same stepper, 1 steps, 2–30, unit "PPL" (caption "including you").
- TARGET PACE — chips `6:30 6:00 5:30 5:00 4:30` + `NO TARGET` (null) + `CUSTOM` opening a ±15 s stepper (2:00–12:00 /km). Stored as s/km.
- WHEN — day chips TODAY / TOMORROW / +next two weekday shortnames + `PICK DATE` (opens `DateTimePicker mode="date"`, min today, max +30 d); time chips `06:30 08:00 12:00 18:00 19:30` + `PICK TIME` (`mode="time"`). Combined into `starts_at` (device-local → Date).
- ROUTE — pill `Tabs` OPEN ROUTE | CLOSED LOOP (`closed_loop`), with `RouteMarker kind="closed"` glyph on the loop option.
- WHO CAN JOIN — three stacked selectable cards (design copy): OPEN "Anyone can join instantly until the run is full." / APPROVAL REQUIRED "Runners request to join — you accept or decline each one." / INVITE ONLY "Hidden from the map. Only people you share the link with can join." Default approval.
- Footer CONTINUE gated by `detailsStepSchema`; per-field zod errors as `Input` hints.
- Acceptance: impossible to continue with out-of-range values; every constraint mirrors the DB check exactly.

**G6. `src/app/create/review.tsx`** — step 4/4 "REVIEW & PUBLISH" + published state:
- Preview: mini `<AppMap interactive={false}>` with `RouteMarker kind="start"` at the point; then a full `RunCard`-style summary (TypeChip, visibility Badge, title, area · city, quoted goal, stats row) + editable summary rows (label/value + EDIT → `router.back()` count).
- **Points preview — server-authoritative**: `useQuery(qk.pointsPreview(distance_km, type), () => supabase.rpc('compute_points_reward', { p_distance_km, p_type }))` → `Badge tone="volt" solid` `+{pts} PTS TO FINISHERS`. NEVER computed client-side (PLAN.md §2 — same function backs the publish trigger, so preview and stored `points_reward` cannot drift). While loading: "+… PTS".
- `Button label="PUBLISH RUN" full` → `createRun(draft)` (INSERT under RLS; `host_id: uid`, `start_point: 'POINT({lng} {lat})'`, statuses/`invite_code`/`points_reward` defaulted server-side). Working state "PUBLISHING…"; error inline.
- Success (design "STEP 5 · PUBLISHED", in-route state like P1's finish): ink900 full-screen, volt check, "YOUR RUN IS LIVE", "It's on the {city} map and in Managed by you. We'll ping you the moment someone asks to join." (ping = P3; copy stays aspirational per design), stats chips, `Button label="VIEW RUN"` → `reset()`, `router.dismissAll()`, `router.replace(\`/run/${id}\`)` + secondary "DONE" → dismiss to tabs.
- Acceptance: published row in Studio has trigger-computed `points_reward` equal to the preview; run visible on second account's Explore.

### H — Run detail + join flow (`run/[id]`)

**H1. `src/app/run/[id]/_layout.tsx`** — `<Stack screenOptions={{ headerShown: false }}>` with `<Stack.Screen name="request" options={{ presentation: 'modal' }} />`; siblings `index`, `requests`, `manage`, `roster`.

**H2. `src/app/run/[id]/index.tsx`** (design: Discover/Main Flow "RUN DETAIL"). Params: `id`, optional `code` (invite fallback). Data: `useQuery(qk.run(id), () => fetchRunDetail(id, code))` + `useQuery(qk.runMembers(id), …, { enabled: isHost || isApproved })`.
- Layout top→bottom: mini `<AppMap interactive={false}>` header (start `RouteMarker`, 180 h) with floating back + share `IconButton`s; `TypeChip` + visibility `Badge` (`INVITE ONLY` ink / `OPEN` go / approval none) + `closed_loop` loop glyph; title (`textStyles.screenTitle` d2 size); `"{area_name} · {city}"` caption; **goal quoted in body face** (`fonts.body`, `“…”`, omit when empty); StatBlock row: `{distance_km} KM · {formatPace} /KM · {day} · {time}`; `Badge volt solid` `+{points_reward} PTS`; host card (`Avatar md` + name + inline star `rating_avg` (`colors.star`, pattern from [RunCard.tsx](../../src/components/ui/RunCard.tsx)) + "HOSTS THIS RUN" eyebrow) — host profile null (hidden) → initials-less Avatar + "Host".
- Capacity line: `GOING · {approvedCount + 1}` (host included) + `Badge` `{spotsLeft} SPOTS LEFT` (warn) or `FULL` (neutral). Members-only: horizontal `Avatar sm` strip from `qk.runMembers` (approved only).
- **CTA state machine** (sticky footer; exactly one primary):

| Condition (priority order) | Footer |
|---|---|
| `run.status = 'cancelled'` | Danger-soft banner "This run was cancelled by the host." — no CTA |
| `starts_at < now` | Muted banner "This run has already started." — no CTA |
| viewer is host | `Button "MANAGE RUN" variant="secondary"` → `manage`; pending>0 → `Badge` "N REQUESTS" beside it → `requests` |
| `myMembership.status = 'approved'` | go-soft panel "YOU'RE IN — see you at the start." + `Button "CANCEL MY SPOT" variant="ghost"` → confirm `Alert` → `cancelJoin` |
| `myMembership.status = 'pending'` | warn-soft panel "REQUEST SENT — {host} will review your request." + WHAT HAPPENS NEXT caption + `Button "WITHDRAW REQUEST" variant="ghost"` → `cancelJoin` |
| `myMembership.status = 'removed'` | Muted banner "The host removed you from this run." — no CTA (server blocks re-join) |
| `myMembership.status = 'declined'` | Caption "Your request wasn't accepted this time." + CTA below still shown (server allows one re-request) |
| `spotsLeft ≤ 0` | `Button "FULL" disabled` |
| `visibility = 'approval'` | `Button "REQUEST TO JOIN"` → push `request` modal |
| `visibility = 'open'` or resolved via invite `code` | `Button "JOIN RUN"` → `joinRun(id, '')` directly (instant, optimistic) |

- States: loading skeleton; `RunNotFoundError` → "This run is no longer available." + BACK.
- Share `IconButton` → `Share.share({ message: 'Join my run “{title}” on Run Everywhere → runeverywhere://invite/{invite_code}' })` (host/approved members see it; custom scheme only in P2 — universal links are P7).

**H3. `src/app/run/[id]/request.tsx`** — modal (design: Discover Flow request sheet): title "REQUEST TO JOIN", caption "{host} hosts · {spotsLeft} spots left"; `Input multiline` maxLength 240 with live `{n}/240` counter, placeholder "Say hi and why you'd like to join — pace, experience, anything the host should know."; three prompt chips appending canned text (design copy: "I'm new in town" / "Easy pace" / "Coffee after?"); footer `Button "SEND REQUEST" full` → `useJoinRun` → on success `router.back()` (detail now renders pending panel — no toast system in P2); footnote caption "The host sees your profile, rating & this note."
- Acceptance: DoD #12; full-race error path shows the server message inline.

### I — Host tools + invite link

**I1. `src/app/run/[id]/requests.tsx`** — inbox (design: Main Flow "HOST INBOX / ACCEPT-DECLINE"). Host-only (non-host → redirect to detail). `FlatList` of `qk.runMembers` filtered `pending`: `Avatar` + name + star rating + languages chips + quoted `intro_message` + `requested_at` relative time; per-row `Button "ACCEPT" size="sm"` (primary) + `Button "DECLINE" size="sm" variant="ghost"` → `respondToRequest` (optimistic per D4; "run is full" → `Alert` + refetch). Header shows `"JOIN REQUESTS · {n}"`; below, "GOING · {approvedCount}" summary linking to roster. Empty state "No requests yet — share your run to fill spots." + SHARE button.

**I2. `src/app/run/[id]/manage.tsx`** (design: Main Flow "MANAGE RUN (HOST)"). Host-only. Header: "HOSTING · {VISIBILITY}" eyebrow + title + stats chips. Action rows (pressable cards): "Join requests — {n} waiting" → `requests`; "Roster — {approvedCount + 1} going" → `roster`; "Edit run — route, pace, time" → inline edit mode (below); "Share invite link" → share sheet (H2's message); "Cancel run" (danger) → `Alert.alert('Cancel this run?', 'Everyone approved will see it as cancelled.', …)` → `cancelRun` → back to detail (banner state). "Message group" is NOT rendered in P2 (chat is P3).
- **Edit mode**: reuses the G5 form components prefilled from `qk.run(id)`; editable: title, goal, distance, max_group, pace, starts_at, closed_loop, visibility. NOT editable: `type` (points identity; Decisions #13) and start point (re-pinning moves the meetup under joined runners' feet — v1 rule: cancel + recreate). `max_group` min = `max(2, approvedCount + 1)` enforced client-side. SAVE → `updateRun` (RLS host-update policy; `points_reward` recomputed by the P0 trigger when distance changes).
- Acceptance: DoD #18; edited distance changes `points_reward` in Studio without any client write to it.

**I3. `src/app/run/[id]/roster.tsx`** — host + approved members can view (RLS enforces anyway). Sections: HOST (self card), GOING (approved: Avatar + name + rating; host additionally sees `Button "REMOVE" size="sm" variant="danger"` → confirm `Alert` "Remove {name}? They won't be able to rejoin." → `removeMember`). Pending count footer (host only) linking to requests.

**I4. `src/app/invite/[code].tsx`** — deep-link target (`runeverywhere://invite/<code>`; scheme registered since P0). On mount: `rpc('get_run_by_invite', { p_code: code })`; found → `router.replace(\`/run/${run.id}?code=${code}\`)`; empty → error screen "This invite link is invalid or the run is no longer live." + `Button "EXPLORE RUNS"` → `/(tabs)`. Signed-out cold-start deep links bounce to welcome via P1's AuthGate and are NOT preserved (P7 deep-link QA; Decisions #16).
- Acceptance: DoD #14 including `npx uri-scheme open "runeverywhere://invite/DEVLINK01" --ios` against local seed.

### J — Your Runs tab (`(tabs)/runs`)

**J1. Rewrite `src/app/(tabs)/runs.tsx`** (design: Main Flow "YOUR RUNS"; contract: [Tabs.d.ts](../../run-everywhere-app-design/project/components/navigation/Tabs.d.ts)).
- `Tabs variant="underline"` items: `ALL` / `MANAGED BY YOU (count)` / `JOINED (count)`; data `useQuery(qk.runsMine(), fetchMyRuns)` + `useRefetchOnFocus`.
- MANAGED: hosted runs as `RunCard` + overlay `Badge tone="warn"` `"{pendingCount} REQUESTS"` when > 0 (this is the verify script's "inbox badge") + `Badge` `CANCELLED` for cancelled ones; press → detail.
- JOINED: membership runs with `Badge` PENDING (warn) / status-free when approved / run-cancelled banner tint; press → detail.
- ALL: union, sorted `starts_at` asc (upcoming first, past at bottom, 60% opacity). No PAST tab in P2 — completed runs need P4's `complete_run` (Decisions #17).
- Empty states per tab (e.g. JOINED: "You haven't joined a run yet." + `Button "EXPLORE RUNS"` → index). `RefreshControl`.
- Acceptance: DoD #19; counts match Studio.

### K — Verification pass

Run the **Verification script** below on two physical devices against the hosted project; run smoke SQL locally + hosted; fix and re-run until green; tick Definition of done. Phase ends demoable: full create → discover → request → approve loop live on two phones.

## Data model & security

Two migrations. No new tables (P3–P6 tables untouched per PLAN.md §3); only functions + one index. All functions `set search_path = ''`, schema-qualified references, style-matched to 0001.

### `supabase/migrations/00000000000020_membership_transitions.sql`

```sql
-- P2: membership transitions missing from 0001 (PLAN.md §2 state machine:
-- pending|approved → cancelled (runner); approved → removed (host)),
-- plus a definer capacity count so non-members can render "spots left"
-- (run_members SELECT policy hides rows from non-members by design).

-- Runner cancels own pending request or approved spot.
create function public.cancel_join (p_run_id uuid)
returns public.run_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.runs;
  v_uid uuid := (select auth.uid ());
  v_row public.run_members;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_run from public.runs where id = p_run_id for update;
  if not found or v_run.status <> 'published' then
    raise exception 'run is not open';
  end if;

  update public.run_members
  set status = 'cancelled', decided_at = now(), decided_by = v_uid
  where run_id = p_run_id and user_id = v_uid
    and status in ('pending', 'approved')
  returning * into v_row;

  if v_row is null then raise exception 'no active request or membership'; end if;
  return v_row;
end;
$$;

-- Host removes an approved member. Removed members cannot rejoin
-- (join_run's ON CONFLICT clause only revives cancelled/declined rows).
create function public.remove_member (p_run_id uuid, p_user_id uuid)
returns public.run_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.runs;
  v_uid uuid := (select auth.uid ());
  v_row public.run_members;
begin
  select * into v_run from public.runs where id = p_run_id for update;
  if not found or v_run.host_id <> v_uid then
    raise exception 'only the host can remove members';
  end if;

  update public.run_members
  set status = 'removed', decided_at = now(), decided_by = v_uid
  where run_id = p_run_id and user_id = p_user_id and status = 'approved'
  returning * into v_row;

  if v_row is null then raise exception 'no approved member to remove'; end if;
  return v_row;
end;
$$;

-- Definer count: exposes only an integer, never member rows. Backs the
-- run-detail "spots left" for viewers who cannot read run_members.
create function public.run_approved_count (p_run_id uuid)
returns integer
language sql security definer set search_path = '' stable
as $$
  select count(*)::integer from public.run_members
  where run_id = p_run_id and status = 'approved';
$$;
```

### `supabase/migrations/00000000000021_search_runs.sql`

```sql
-- P2: pg_trgm search over title + area_name. SECURITY INVOKER — the runs
-- SELECT policy applies, so invite-only runs never surface here.
create index runs_area_name_trgm_idx
  on public.runs using gin (area_name extensions.gin_trgm_ops);

create function public.search_runs (
  p_query text,
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 30
)
returns table (run public.runs, distance_m double precision, approved_count bigint)
language sql security invoker set search_path = '' stable
as $$
  select
    r as run,
    extensions.st_distance (
      r.start_point,
      extensions.st_setsrid (extensions.st_makepoint (p_lng, p_lat), 4326)::extensions.geography
    ) as distance_m,
    (
      select count(*) from public.run_members m
      where m.run_id = r.id and m.status = 'approved'
    ) as approved_count
  from public.runs r
  where char_length(btrim(coalesce(p_query, ''))) >= 2
    and r.status = 'published'
    and r.visibility in ('open', 'approval')
    and r.starts_at >= now()
    and (r.title ilike '%' || btrim(p_query) || '%'
         or r.area_name ilike '%' || btrim(p_query) || '%')
  order by greatest(extensions.similarity (r.title, p_query),
                    extensions.similarity (r.area_name, p_query)) desc,
           distance_m asc
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;
```

**RLS review notes**
- No policy changes. `run_members` still has **no** INSERT/UPDATE/DELETE policies — every write path in this phase is a definer RPC (`join_run`, `respond_to_join_request`, `cancel_join`, `remove_member`), preserving 0001's invariant.
- `cancel_join`/`remove_member` lock the run row (`for update`) — serialized with `join_run`/`respond_to_join_request`, so capacity counts never interleave.
- `run_approved_count` and `get_run_by_invite` are the only definer read paths for non-members; both leak deliberately-minimal data (a count; a run row addressable only by its unguessable 12-char code).
- `runs` UPDATE policy (host-only) covers edit/cancel; `title`/`distance_km`/`max_group`/`target_pace_s_per_km` stay constraint-checked by 0001, and the P0 trigger recomputes `points_reward` on every write. `max_group < approved+1` is NOT DB-enforced — client validation only; worst case a run reads "-1 spots"/FULL, capacity RPCs stay correct (they compare against `max_group` live). Recorded as a risk.
- Escape `%`/`_` client-side before `search_runs` (D4); a raw `%` merely broadens the ILIKE match — no injection surface (parameterized).

## Design references

- **Flow files:** [Discover Flow](../../run-everywhere-app-design/project/Run%20Everywhere%20-%20Discover%20Flow.dc.html) — EXPLORE MAP, EXPLORE LIST, SEARCH, FILTERS sheet, RUN DETAIL, request sheet, TOAST, NEW-CITY LANDING (dropped, Decisions #18); [Create Flow](../../run-everywhere-app-design/project/Run%20Everywhere%20-%20Create%20Flow.dc.html) — STEP 1 TYPE+START … STEP 5 PUBLISHED (points formula in the prototype `Math.round(km*18) + (challenge 40 | discover 15 | 0)` matches `compute_points_reward` exactly — the client still calls the RPC); [Main Flow](../../run-everywhere-app-design/project/Run%20Everywhere%20-%20Main%20Flow.dc.html) — RUN DETAIL, REQUEST SENT (pending), HOST INBOX / ACCEPT-DECLINE, MANAGE RUN (HOST), YOUR RUNS.
- **Component contracts:** [MapPin.d.ts](../../run-everywhere-app-design/project/components/run/MapPin.d.ts), [RouteMarker.d.ts](../../run-everywhere-app-design/project/components/run/RouteMarker.d.ts), [Tabs.d.ts](../../run-everywhere-app-design/project/components/navigation/Tabs.d.ts), [Badge.d.ts](../../run-everywhere-app-design/project/components/data/Badge.d.ts), [Avatar.d.ts](../../run-everywhere-app-design/project/components/data/Avatar.d.ts), [StatBlock.d.ts](../../run-everywhere-app-design/project/components/data/StatBlock.d.ts) (+ sibling `.jsx` reference visuals). Already ported: Button, TypeChip, RunCard, TabBar (P0), Input, IconButton (P1).
- **Token groups** (all in [theme.ts](../../src/theme/theme.ts)): `runType` triads for pins/chips/rails; `shadows.pin` for markers; signal colors — warn for SPOTS LEFT/PENDING, go strictly for "you're in"/OPEN-join affordances, danger for cancel/remove; `textStyles`; `sizing`/`spacing`/`radius`.
- **Reconciliation calls** (PLAN.md "Design reconciliation" + schema win): prototype body font "Hanken Grotesk" in flow HTML → **Saira**; Social purple; filter PACE/DISTANCE chips dropped (no RPC params); prototype's 5-screen create collapses into the 4 canonical routes (visibility inside details); "Message group" on manage deferred to P3; no emoji, uppercase verb-first buttons throughout.

## Verification script

Manual QA on hosted backend. Device/account A = host, device/account B = runner (both onboarded via P1 flow).

1. **Keys/map**: fresh dev builds on both devices → Explore renders styled Google tiles, user dot after permission grant, recenter works. Deny permission on B first → home-city fallback + banner, then re-enable via Settings.
2. **Create (A)**: FAB → wizard: pick CHALLENGE → drag pin in your city (area label updates) → details: title "QA Hills", goal set, 10 km, max 3, pace 5:30, tomorrow 08:00, closed loop, APPROVAL REQUIRED → review shows `+220 PTS` (10×18+40) from the RPC → PUBLISH → success → VIEW RUN. Studio: row has `points_reward = 220`, `invite_code` non-null.
3. **Discover (B)**: Explore map shows the new pin with "10K" label (pull-refresh if stale); zoom out → clusters; tap pin → preview sheet → VIEW RUN → detail shows quoted goal, host card, `2 SPOTS LEFT` (max 3 − host − 0). List view finds it; search "QA" finds it; filter CHALLENGE+CLOSED LOOP keeps it, SOCIAL-only hides it.
4. **Request (B)**: REQUEST TO JOIN → modal → prompt chip + edit intro → SEND REQUEST → detail shows REQUEST SENT panel with WITHDRAW.
5. **Inbox (A)**: Runs tab → MANAGED shows "1 REQUESTS" badge on the card → detail → REQUESTS → B's card with avatar, rating, intro quoted → ACCEPT → row moves to going; roster shows B.
6. **Approved (B)**: background → foreground the app (focus refetch) or pull-refresh detail → "YOU'RE IN" panel; Runs tab → JOINED lists it without PENDING badge.
7. **Withdraw/re-request (B)**: CANCEL MY SPOT → confirm → CTA returns to REQUEST TO JOIN; re-request → A sees a fresh pending (new intro visible).
8. **Decline path**: A declines this one → B sees "wasn't accepted" caption, CTA still available once.
9. **Remove**: A approves again, then ROSTER → REMOVE B → B sees "The host removed you" and no CTA; B attempting nothing further (server would reject).
10. **Capacity/open run**: A creates OPEN run with max_group 2 → B: JOIN RUN → instantly approved, detail shows FULL for a third account (or check `run_approved_count` = 1 and card shows FULL on B after joining from a signed-out-of… simplest: seed check via smoke #7 already covers the race).
11. **Invite run**: A creates INVITE ONLY run → confirm absent from B's map/list/search → A: detail → share → send link to B (any channel) → B opens `runeverywhere://invite/<code>` → detail with JOIN RUN → instant approved. Also `npx uri-scheme open "runeverywhere://invite/DEVLINK01"` locally.
12. **Edit/cancel**: A edits distance 10→12 → B's detail (refetch) shows 12 KM and `+256 PTS` (12×18+40, trigger-recomputed); A cancels run → B sees cancelled banner; run gone from Explore/search; A's MANAGED card shows CANCELLED badge.
13. **Runs tab counts**: both devices' ALL/MANAGED/JOINED counts match Studio queries.
14. **Gallery**: `/dev/components` renders Tabs/Badge/Avatar/StatBlock/MapPin/RouteMarker sections on both platforms.

Automated gates:

```sh
npm run typecheck
npm run lint                                  # also proves the react-native-maps import fence
supabase db lint --level warning
supabase db reset                             # 01,02,10,11,20,21 + seed apply cleanly
npm run db:types && git diff --exit-code src/types/database.types.ts
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_smoke.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/core_loop_smoke.sql
```

## Risks & gotchas

| Risk | Mitigation |
|---|---|
| Blank/gray map tiles (bad key restriction, missing SHA-1, billing off) | A1 checklist: both SHA-1s registered, API restrictions match SDK, billing linked; test on debug AND EAS builds (different keystores) |
| Expo Go can't run `react-native-maps`; stale dev clients crash on datetimepicker | All native changes batched in A2/A4 with immediate rebuilds; README already mandates dev builds |
| Map vendor/pricing change (PLAN.md §6) | Everything imports `AppMap` only; ESLint fence (C7) makes drift impossible to merge |
| Android marker jank / flicker with custom pin views | `tracksViewChanges={false}` on all markers (E3); supercluster caps visible markers; pins are lightweight SVG |
| `start_point` returned as WKB hex breaks naive parsing | Single `parsePoint` util (D3) handles hex-EWKB + GeoJSON; every read path funnels through `src/lib/runs.ts` |
| Approval races: two joiners / approve-into-full | Server RPCs row-lock and re-count (0001 + …20); client surfaces "run is full" and refetches (D4 table); smoke #7 proves it |
| Spots-left drift between screens | One `spotsLeft()` helper (D2) with the definition matching `join_run` (`approved + 1 >= max_group` ⇔ full); non-members get counts via `run_approved_count`, list/map via RPC's `approved_count` |
| Host shrinks `max_group` below approved+1 | Client clamps (I2); DB check only enforces 2–30 — accepted v1 gap; capacity RPCs remain correct regardless (documented in RLS notes) |
| No realtime in P2 → B "never sees" approval | Focus-refetch wiring (D5) + pull-to-refresh + verify step 6 make the loop demoable; P3 push closes the gap properly |
| Invite links opened signed-out / app-not-installed | Out of P2 (Decisions #16); share copy includes the run title so the link failing cold isn't meaningless; universal links + deep-link QA in P7 |
| Reverse geocode empty in parks/rural areas | G4 manual AREA NAME input fallback; `area_name`/`city` default `''` is schema-legal |
| Weekend/today filter boundaries across timezones | Windows computed device-local with date-fns (D6); server compares `timestamptz` — consistent |
| `@gorhom/bottom-sheet` + reanimated 4 integration | v5 supports reanimated v4 (v5.1.8+); GestureHandlerRootView wired in A3; if the sheet misbehaves, fallback is a plain absolute-positioned card (sheet is presentation-only here) |
| Query cache staleness after mutations | Mandatory invalidation table (D4) — every mutation's `onSettled` list is specified; code review checks against it |

## Decisions made by this plan

1. **Spots-left formula fixed as `max_group − 1 − approved_count`** (host occupies a slot) — matches `join_run`/`respond_to_join_request` (`approved + 1 >= max_group` ⇒ full) and `runs_within_radius`'s open-spots predicate; GOING count = `approved_count + 1`.
2. **Migration split**: `…20` membership transitions + `run_approved_count`, `…21` search — two single-concern files in P2's slots.
3. **`cancel_join` requires `status='published'`** — leaving a cancelled/completed run is meaningless; historical membership rows stay intact for P4.
4. **Removed members cannot rejoin** — inherited from `join_run`'s ON CONFLICT clause (revives only cancelled/declined); surfaced as explicit UI state, tested in smoke #6. Declined members may re-request once more (server allows; UI permits with a caption).
5. **Search mechanism = dedicated `search_runs` RPC** (SECURITY INVOKER, ILIKE + trgm `similarity` ordering over title + area_name, new area_name GIN index) rather than client `.ilike()` — one round trip returns distance + approved_count in the same shape as `runs_within_radius`.
6. **Filter set = exactly the `runs_within_radius` params** (types, when-window, closed_loop, only-open-spots) + client-side sort (NEAREST/SOONEST/DISTANCE, per the prototype's sort toggle); the prototype's PACE and DISTANCE filter chips are dropped in P2 (no RPC params; adding them is a future migration, earliest P7 polish).
7. **Nearby query = fixed 25 km radius around a query center** (user location → home_point → Lisbon), center keyed at 3-decimal rounding; map panning does NOT auto-refetch — an explicit "SEARCH THIS AREA" chip re-centers when the map moves > 5 km. Avoids refetch churn and key explosions.
8. **Query-key schema defined app-wide in `src/lib/queryKeys.ts`** with reserved keys for P3–P5; sort excluded from keys; invalidation policy is a normative table (D4).
9. **Wizard = the 4 canonical routes** (PLAN.md §4 wins over the prototype's 5 screens): visibility cards live in `details`; published-success is an in-route state of `review` (mirrors P1's finish pattern); prototype's step-1 run-name input moves to `details`.
10. **Pin-drop UX = fixed center pin over a draggable map** (not tap-to-place) — one gesture, no marker-drag edge cases; debounced on-device reverse geocode fills `area_name`/`city`/`country_code` with a manual fallback input.
11. **`starts_at` client rule ≥ now + 15 min**; date range today…+30 d; day/time quick chips from the prototype plus native datetimepicker for arbitrary values.
12. **Points preview always via `compute_points_reward` RPC** (cached under `['points','preview',…]`); the client never mirrors the formula even though it is trivially known.
13. **Post-publish immutability: `type` and `start_point`** — type changes the reward identity and pin color under joined runners; moving the meetup point invalidates joiners' consent. Host cancels + recreates instead. Everything else host-editable while published.
14. **`run_approved_count` definer RPC** added instead of widening `run_members` RLS — non-members get an integer, never rows; member avatar strip stays member-only.
15. **Invite resolution**: `invite/[code]` → `get_run_by_invite` → `run/[id]?code=…`; detail's queryFn falls back to the code when direct SELECT is RLS-blocked. `join_run` treats invite like open (instant approve) — acceptable because the run id is only discoverable via the code; share works for all visibilities (any published run resolves by its code).
16. **Share = OS share sheet with `runeverywhere://invite/<code>`** custom-scheme link only; signed-out/cold-start link preservation and universal links deferred to P7.
17. **`(tabs)/runs` has 3 tabs (ALL / MANAGED BY YOU / JOINED)** — the design's PAST tab needs `completed` runs, which only P4's `complete_run` produces.
18. **Dropped from P2**: NEW-CITY LANDING screen (marketing moment, no data dependency — earliest P7 polish); global toast system (state panels replace it); "Message group" row (P3); favorites/heart on detail (schema exists; UI unassigned in PLAN — earliest P5); runner-count ("· 27 runs") on host card (needs P4 history); RatingStars component (P4 reviews — detail reuses RunCard's inline star).
19. **Freshness model**: TanStack `focusManager` wired to AppState + `useRefetchOnFocus` on detail/inbox/runs-tab + pull-to-refresh; no realtime subscriptions in P2 (Realtime quota strategy per PLAN.md §6 — subscriptions arrive with P3 chat).
20. **Geography I/O**: write as WKT `POINT(lng lat)` string in INSERTs; read via one `parsePoint` util handling hex-EWKB and GeoJSON. No PostGIS casts added to RPC outputs to keep 0001's function shapes untouched.
21. **ESLint import fence on `react-native-maps`** (allowed only under `src/components/map/`) operationalizes PLAN.md's one-wrapper rule.
22. **Recent searches are in-memory only** (zustand, max 8) — persistence adds AsyncStorage churn for marginal value; revisit in P7.
23. **Seed gains deterministic fixtures** (`DEVLINK01` invite run, one pending + one approved membership) so host inbox, roster, invite link, and smoke tests work on a fresh `db reset` without manual setup.

## Out of scope

- Group chat, DMs, "Message group" action, unread counts, push notifications, `notifications`/`push_tokens` tables, pg_cron reminders, realtime subscriptions — **P3** (the request→approve loop relies on refetch until then).
- Live GPS recording, `run_tracks`, `complete_run` + points ledger, recap, reviews/RatingStars, run history / PAST tab — **P4**.
- Levels/badges/leaderboard UI, full profile & `user/[id]`, favorites UI, report/block, settings, safety features — **P5**.
- HealthKit/Strava/Garmin — **P6**.
- Universal links (https), signed-out deep-link preservation, offline states, accessibility pass, store assets — **P7**.
- Pace/distance discovery filters and `runs_within_radius` param extensions — deferred (Decisions #6).
- New-city landing screen, toast system, recent-search persistence — deferred polish (Decisions #18/#22, earliest **P7**).
