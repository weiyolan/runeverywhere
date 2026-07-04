# P6 — Integrations (Weeks 17–19)

| | |
|---|---|
| **Depends on** | P1 (hosted project, Strava API app + Extended Access application filed, Garmin dev-program application filed, `docs/integrations/applications.md`, legal URLs) · P3 (Edge Function conventions: `supabase/functions/`, `config.toml` `[functions.*]` blocks, Vault `get_secret`, `supabase secrets set`, `supabase/functions/.env` local pattern) · P4 (`run_tracks` + `complete_run`, the finishing sequence in `live/[runId]`, `src/lib/tracks.ts`, `src/lib/recording/buffer.ts` sample buffer, `recap/[trackId]`, Your Runs PAST tab, `@mapbox/polyline`) · P5 (`settings/*` suite incl. `settings/_layout.tsx` + `settings/index.tsx`, `supabase/tests/` smoke convention) |
| **Provides to later phases** | `feature_flags` remote-config table + `useFeatureFlags` hook (P7 staged rollout reuses it); `connected_accounts` + Vault token pattern; `settings/connections` screen; `run_tracks.source/external_id/title` columns + imported-history rendering; P7 store-review inputs (HealthKit purpose strings + entitlement, privacy-manifest notes, Strava/Garmin data-sharing disclosures) |
| **Verify gate ([PLAN.md §5](../PLAN.md))** | "Recorded run appears in Apple Health; Strava import for test athlete" |

## Goal

Connect Run Everywhere to the fitness ecosystem behind server-controlled feature flags: HealthKit first (no external approval — the guaranteed integration per [PLAN.md §6](../PLAN.md)), writing every completed RE run as an Apple Health workout with its route; then Strava — OAuth connect via Edge Functions, tokens in Supabase Vault, webhook-driven import of the athlete's runs into RE history — working end-to-end at the Standard tier (10 athletes) so dev testing never blocks on the pending Extended Access review; then Garmin as a thin mirror of the Strava plumbing, executable only if the P1 application has unblocked. A `settings/connections` screen manages all three. Flags OFF must hide every trace.

## Definition of done

1. Migrations `00000000000060_feature_flags.sql` and `00000000000061_connected_accounts.sql` apply cleanly on fresh `supabase db reset` and on hosted via `supabase db push`; `npm run db:types` regenerated, committed, diff-clean.
2. `feature_flags` holds rows `healthkit` / `strava` / `garmin`, all `enabled = false` by default; hosted stays OFF until each integration passes its own verify steps.
3. **Flags-off sweep:** with all three flags false, the app shows zero integration UI — no "Connected apps" section in `settings/index`, `settings/connections` redirects away, no HealthKit write attempt after finishing a run, no IMPORTED cards in the PAST tab, no new permission prompts. Fresh-install QA on both platforms confirms.
4. New dev builds (both platforms) carry the P6 native changes (`@kingstinct/react-native-healthkit` + `react-native-nitro-modules` + `expo-web-browser`, HealthKit entitlement + purpose strings). The Android build compiles and boots — no HealthKit symbol is evaluated on Android (platform-split module).
5. With `healthkit` ON (iOS): `settings/connections` shows the Apple Health row; CONNECT presents the HealthKit permission sheet showing the exact purpose string from A-config; grant → `connected_accounts` row `(provider='healthkit')` exists; deny → row absent, sub reads "Not connected", no crash, no re-prompt loop.
6. **Verify-gate half 1:** finish a real recorded run (P4 flow) with Apple Health connected → a Running workout with correct start/end time, duration, and distance (±1 %) appears in the Apple Health app, **with the route visible** on the workout's map.
7. A run finished with HealthKit disconnected (or flag off, or permission denied) writes nothing to Health and the finishing sequence completes normally — the write is strictly best-effort and non-blocking.
8. HealthKit DISCONNECT deletes the `connected_accounts` row, stops future writes, and the manage sheet tells the user permissions themselves are revoked in iOS Settings → Health.
9. With `strava` ON: CONNECT on the Strava row opens the system browser at Strava's authorize page (scopes `read,activity:read`), approval deep-links back to `settings/connections`, and the row flips to "Connected · syncing runs" with the athlete id in the manage sheet.
10. `connected_accounts` never contains a token: the Strava row stores `access_token_secret_id` / `refresh_token_secret_id` (Vault UUIDs) only — proven by `select * from connected_accounts` in Studio and by the smoke script (clients can't read Vault).
11. **Verify-gate half 2:** within ~1 minute of connecting, the test athlete's recent Strava runs (GPS runs, ≤ 10 most recent) exist as `run_tracks` rows (`source='strava'`, `run_id is null`, correct distance/duration/polyline) and render as IMPORTED cards in Your Runs → PAST; tapping one opens the imported recap variant (stats + route, no points).
12. Webhook subscription is registered against the hosted `strava-webhook` URL; its validation GET echoes `hub.challenge` (wrong `verify_token` → 403). Creating a new activity in Strava (manual upload is fine) imports it within ~1 minute; deleting it in Strava deletes the imported row; a deauthorize event (`updates.authorized:"false"`) removes the connection server-side.
13. Imported activities award **zero** points: `points_ledger` count is unchanged by any import (SQL check), and no imported surface shows a points value.
14. Token refresh works: force-expire the stored token (SQL: set `token_expires_at = now()`), trigger an import → it succeeds and both Vault secrets + `token_expires_at` are updated (Strava rotates refresh tokens — the new one must be persisted).
15. DISCONNECT on Strava calls deauthorize, deletes the row + both Vault secrets, keeps already-imported history (decision), and a reconnect works cleanly.
16. Re-running any import (webhook redelivery, manual re-invoke) inserts zero duplicate rows — idempotent via `unique (user_id, source, external_id)`.
17. Garmin (only if evaluation keys arrived — else mark item "blocked, re-check date logged in `docs/integrations/applications.md`"): with `garmin` ON, connect reaches Garmin's consent page, callback stores tokens in Vault, and a synced Garmin run imports through `garmin-webhook` using the same `import_external_track` path.
18. `supabase/tests/rls_integrations_smoke.sql` passes locally and hosted: clients can't read others' `connected_accounts`, can't insert non-healthkit rows, can't execute `store_connected_account` / `get_connected_tokens` / `import_external_track` (permission denied), can't write `feature_flags` or `run_tracks`; `disconnect_account` removes row + Vault secrets.
19. `supabase/seed.sql` seeds flags ON locally plus one imported Strava fixture track for maya so the PAST tab demos without a live Strava account.
20. CI green: `npm run typecheck`, `npm run lint`, `supabase db lint` (no errors), `src/types/database.types.ts` diff-clean.

## Preconditions

| Precondition | How to check |
|---|---|
| P4 + P5 verify gates passed; migrations ≤ `0000000000005x` pushed | `supabase migration list` local == remote; P5 settings suite navigable on device |
| `run_tracks` shape as P4 shipped it (`unique(run_id,user_id)`, `polyline not null`, `run_id not null`) | `psql … -c '\d public.run_tracks'` — Workstream B alters exactly this table |
| Strava API app exists (P1 A2), Authorization Callback Domain = `<project-ref>.supabase.co` | strava.com/settings/api shows the app; fix the callback domain there if the ref changed |
| **Strava Standard-tier prerequisites (June 2026 program, in force since 2026-06-30):** dev holds an active Strava subscription; app self-upgraded to the 10-athlete Standard level in the API dashboard; Extended Access review status logged | strava.com/settings/api dashboard; [developer program update](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428), [API policy](https://www.strava.com/legal/api_policy); `docs/integrations/applications.md` |
| Test athlete = the dev's own Strava account with ≥ 1 GPS run activity | strava.com profile shows a run with a map |
| Garmin application status known (evaluation keys or still queued) | `docs/integrations/applications.md`; developer.garmin.com portal login |
| Vault + `get_secret` working (P3) | `select public.get_secret('project_url')` non-null locally |
| Hosted Edge Functions deployable | `supabase functions deploy send-push` succeeds |
| iOS device or simulator with the Health app (device for the verify gate; simulator OK for dev) | Health app opens; real recorded run needs a physical device (P4) |
| `@mapbox/polyline` installed (P4 A2) | [package.json](../../package.json) — present after P4; do not reinstall |
| `EXPO_PUBLIC_SUPABASE_URL` points at the right stack | `.env` per P1 B4 |

## Workstreams

### A — Feature-flag mechanism (migration `00000000000060_feature_flags.sql` + client hook)

**A1. Decision: remote-config table, not env.** Flags must be flippable without a rebuild/OTA (Strava could revoke access, Apple could reject the Health integration — [PLAN.md §6](../PLAN.md)); `EXPO_PUBLIC_*` vars are baked at bundle time. So: a `feature_flags` table, read-only to clients, toggled via SQL/Studio. (Not a table owned by any other phase; recorded in Decisions.)

**A2. Migration `supabase/migrations/00000000000060_feature_flags.sql`.**
- `create table public.feature_flags (key text primary key check (key ~ '^[a-z_]{1,40}$'), enabled boolean not null default false, note text not null default '', updated_at timestamptz not null default now());`
- RLS enabled immediately; single policy: SELECT to `authenticated` `using (true)`. No INSERT/UPDATE/DELETE policies — writes happen as `postgres` (Studio/SQL editor) only.
- Seed in the migration (idempotent, hosted-safe): `insert into public.feature_flags (key, enabled, note) values ('healthkit', false, 'P6 Apple Health write'), ('strava', false, 'P6 Strava import'), ('garmin', false, 'P6 Garmin import') on conflict (key) do update set note = excluded.note;` — deliberately never overwrites `enabled` on re-push.
- [supabase/seed.sql](../../supabase/seed.sql) (local only): append `update public.feature_flags set enabled = true where key in ('healthkit','strava');` so local dev always exercises the code paths.
- Acceptance: `supabase db reset` clean; `select * from feature_flags` = 3 rows, local `healthkit`/`strava` true.

**A3. Client hook `src/hooks/useFeatureFlags.ts`.**
- `useFeatureFlags(): { flags: Record<string, boolean>, isLoading }` — `useQuery(['flags'], () => supabase.from('feature_flags').select('key, enabled'))`, `staleTime: 5 * 60_000`, mapped to a record. **Default is OFF**: missing row, query error, or loading → `false` (flags-off must be the failure mode). Convenience `useFlag(key: 'healthkit'|'strava'|'garmin'): boolean`.
- Gating convention used by every later task: UI entry points render `null` when the flag is false; imperative paths (post-run HealthKit write) re-check the flag from the query cache before acting. Server-side, `strava-connect`/`garmin-connect` refuse new connections when the flag is off (D3); webhook imports for *already-connected* accounts keep flowing regardless of the flag (Decisions).
- Acceptance: `npm run typecheck`; with local flags flipped false, DoD #3 sweep behaviors hold.

### B — Migration `00000000000061_connected_accounts.sql`: accounts, Vault token pattern, `run_tracks` alter

All objects in `public`; RLS enabled immediately after each `create table`; functions `set search_path = ''`. Full column detail in **Data model & security**.

**B1. Enums.** `create type public.integration_provider as enum ('healthkit','strava','garmin');` and `create type public.track_source as enum ('app','healthkit','strava','garmin');` (`track_source` includes `'app'`; `'healthkit'` reserved for a future import direction — unused by v1 writes, see Decisions).

**B2. `connected_accounts`** — one row per (user, provider): `id uuid pk`, `user_id`, `provider integration_provider`, `provider_user_id text` (Strava athlete id / Garmin user id; null for healthkit), `scopes text[] not null default '{}'`, `access_token_secret_id uuid`, `refresh_token_secret_id uuid` (**Vault secret ids — never tokens**), `token_expires_at timestamptz`, `connected_at`, `last_synced_at`, `last_sync_error text`; `unique (user_id, provider)`; partial unique `(provider, provider_user_id) where provider_user_id is not null` (webhook lookup key + prevents one Strava account linking to two RE users); check `connected_accounts_token_shape`: `(provider = 'healthkit') = (access_token_secret_id is null and refresh_token_secret_id is null and provider_user_id is null)`.

**B3. The Vault pattern, spelled out ([PLAN.md §3](../PLAN.md): "OAuth tokens in Supabase Vault").** Tokens live in `vault.secrets` (encrypted at rest, readable only via `vault.decrypted_secrets` by privileged roles); the table stores only the secret UUIDs. Secret names: `'<provider>:access:<user_id>'` / `'<provider>:refresh:<user_id>'`. Three SECURITY DEFINER functions (owner `postgres`, which holds Vault access — same privilege basis as P3's `get_secret`; executor verifies `select vault.create_secret('x','test')` works from a definer function on hosted before shipping):
- `public.store_connected_account(p_user_id uuid, p_provider public.integration_provider, p_provider_user_id text, p_scopes text[], p_access_token text, p_refresh_token text, p_expires_at timestamptz) returns uuid` — upsert: no existing row → `vault.create_secret(token, name)` twice, insert row; existing row → `vault.update_secret(secret_id, new_token)` on both ids, update `scopes/provider_user_id/token_expires_at`, clear `last_sync_error`. Returns the account id. **`revoke execute … from public, anon, authenticated;`** — only `service_role` (Edge Functions) may call it.
- `public.get_connected_tokens(p_user_id uuid, p_provider public.integration_provider) returns table (access_token text, refresh_token text, expires_at timestamptz, provider_user_id text)` — joins the row to `vault.decrypted_secrets` twice. Same revoke: service_role only.
- `public.disconnect_account(p_provider public.integration_provider) returns void` — callable by `authenticated`: caller's own row; `delete from vault.secrets where id in (access_token_secret_id, refresh_token_secret_id)`; delete the row. Raises `'not connected'` when absent. (One definer path for all disconnects keeps Vault cleanup impossible to forget.)

**B4. RLS on `connected_accounts`.** SELECT own rows (`user_id = (select auth.uid())`) — secret UUIDs are opaque and Vault is unreachable from clients, so exposing them is harmless (noted in RLS review). INSERT to `authenticated` `with check (user_id = (select auth.uid()) and provider = 'healthkit' and access_token_secret_id is null and refresh_token_secret_id is null)` — HealthKit "connect" is a token-less local grant, the only client-writable case. No UPDATE, no DELETE (disconnect via RPC B3; token writes via service_role which bypasses RLS).

**B5. `run_tracks` alter (the "small alter" the import needs — P4 sign-off note).** P4 shipped `run_id NOT NULL` ("no solo runs"); imported activities genuinely have no run, so P6 owns this evolution:
```sql
alter table public.run_tracks
  add column source public.track_source not null default 'app',
  add column external_id text,
  add column title text check (char_length(title) <= 80),
  alter column run_id drop not null;
alter table public.run_tracks
  add constraint run_tracks_source_shape check ((source = 'app') = (run_id is not null)),
  add constraint run_tracks_external_shape check ((source = 'app') = (external_id is null));
create unique index run_tracks_external_uniq
  on public.run_tracks (user_id, source, external_id) where external_id is not null;
```
App-recorded tracks keep their run (`complete_run` untouched — its insert defaults `source='app'`); imported tracks always carry `external_id` and never a `run_id`. The P4 `unique(run_id, user_id)` constraint is unaffected (NULL `run_id` rows never collide). P4's `polyline not null` stays — v1 imports only GPS activities (Decisions). RLS untouched: SELECT own rows already covers imported tracks; still no client writes.

**B6. Import RPCs (service_role only, both `security definer`, both revoked like B3).**
- `public.import_external_track(p_user_id uuid, p_source public.track_source, p_external_id text, p_title text, p_polyline text, p_distance_m integer, p_duration_s integer, p_elevation_gain_m integer, p_started_at timestamptz, p_ended_at timestamptz) returns uuid` — validates like `complete_run` step 3 (distance 100–200000 m, duration 60–43200 s, elevation 0–10000, `ended_at > started_at`, polyline 1–200000 chars; plus `p_source <> 'app'`); computes `avg_pace_s_per_km = round(p_duration_s / (p_distance_m / 1000.0))`; `insert … on conflict (user_id, source, external_id) [the partial index] do nothing`; on insert, `update connected_accounts set last_synced_at = now(), last_sync_error = null where user_id = p_user_id and provider = p_source::text::public.integration_provider`. Returns the track id (or the existing one on conflict — idempotent replay).
- `public.delete_external_track(p_user_id uuid, p_source public.track_source, p_external_id text) returns void` — deletes the matching row (webhook `delete` events).

**B7. Commands + acceptance.** `supabase db reset`; `npm run db:types` + commit; smoke assertions per DoD #18 land in Workstream H's script. `psql … -c "\d public.run_tracks"` shows the three new columns + two constraints.

### C — Client: `settings/connections` screen + settings entry

**C1. Service module `src/lib/integrations/accounts.ts`.** `listConnectedAccounts()` (PostgREST select own rows → `Record<provider, Row>`), `connectHealthKit()` / `disconnectProvider(provider)` (insert per B4 / `rpc('disconnect_account')`), `importedTrackCount(source)` (`from('run_tracks').select('id', { count:'exact', head:true }).eq('source', source)`). Query keys: `['connected-accounts']`, `['imported-count', source]`; both invalidated on connect/disconnect and by the deep-link return (C3).

**C2. Route `src/app/settings/connections.tsx`** (add `connections` to the P5 `settings/_layout.tsx` screen list — within [PLAN.md §4](../PLAN.md)'s `settings/*`). Layout per the Profile Flow settings design ("Connected apps" card group): header back + "CONNECTED APPS"; one white card with divider rows, each: 44 px rounded icon block, uppercase Saira Condensed name, status sub-line, right-side button.
- Rows rendered only when that provider's flag is on; Apple Health row additionally `Platform.OS === 'ios'` only. All flags off → the screen shows the empty message "Nothing to connect yet." and, belt-and-braces, `settings/index` never links here (C4).
- Row states: **not connected** — sub "Not connected" (`ink400`), button CONNECT (ink solid, uppercase); **working** — button disabled with "CONNECTING…"; **connected** — sub "Connected · syncing runs" in `colors.go`, button MANAGE (gray `paper3`).
- Brand icon blocks (design reconciliation — the two flow files disagree; brand-accurate values win, recorded in Decisions): Strava `#FC4C02`, Apple Health `#FF2D55`, Garmin `#007CC3`; glyphs = the inline SVG paths from the flow HTML via `react-native-svg` (no emoji, no icon-font additions).
- MANAGE opens a `@gorhom/bottom-sheet`: provider name; details rows — HealthKit: "Saving completed runs to Apple Health" + caption "To change what Run Everywhere can write, open iOS Settings → Health → Data Access & Devices."; Strava/Garmin: athlete/user id, granted scopes, "Last synced <relative time>" (`last_synced_at`), "<n> runs imported" (`importedTrackCount`), `last_sync_error` in `colors.danger` when set; footer DISCONNECT (danger `Button`, confirm `Alert`) → `disconnectProvider` → invalidate + close. Strava disconnect first fires `strava-disconnect` (E5) and falls back to the bare RPC if that call fails (deauthorize is best-effort).
- States: loading skeleton rows; error retry; per-row inline error line under a failed connect ("Couldn't connect — try again.").

**C3. Deep-link return handling.** The OAuth callback lands on `runeverywhere://settings/connections?provider=strava&status=connected|error&reason=…`. In this screen, `useLocalSearchParams()`: `status=connected` → invalidate `['connected-accounts']` + toast "STRAVA CONNECTED"; `status=error` → inline error mapped from `reason` (`denied` → "You declined on Strava — nothing was connected.", `athlete_limit` → "This app is at Strava's 10-athlete test limit.", else generic).

**C4. `settings/index.tsx` (modify P5 F2).** Insert the "CONNECTED APPS" section between ACCOUNT and PREFERENCES (matching the design's order): one row "Connected apps" with sub-line summarizing state ("Strava connected" / "Not connected") → `router.push('/settings/connections')`. Rendered only when at least one of the three flags is on (`useFeatureFlags`). Acceptance: flags off → section absent (DoD #3); flags on → navigates.

### D — HealthKit write (iOS-only, no external approval — build first)

**D1. Library choice (web-verified 2026-07-04).** `@kingstinct/react-native-healthkit` **v14.0.2** (published 2026-06-05) — actively maintained, TypeScript, ships an Expo config plugin, Nitro-modules-based; peer deps `react >= 19`, `react-native >= 0.79`, `react-native-nitro-modules >= 0.35` — all satisfied by SDK 56 (RN 0.85.3 / React 19.2.3). Verified against the [npm registry](https://www.npmjs.com/package/@kingstinct/react-native-healthkit) and [GitHub README](https://github.com/kingstinct/react-native-healthkit); the workout API below was confirmed from the published `14.0.2` type declarations (`saveWorkoutSample`, `WorkoutProxy.saveWorkoutRoute`, `requestAuthorization({ toShare, toRead })`, `isHealthDataAvailable`). `expo-health` does not exist; `react-native-health` is effectively unmaintained — rejected.

Install (native modules → dev-client rebuild is a blocking sub-task):
```sh
npx expo install expo-web-browser
npm install @kingstinct/react-native-healthkit@14.0.2 react-native-nitro-modules
```
(`expo-web-browser` is for Workstream E's OAuth session but batched into this single rebuild. Pin healthkit exactly at 14.0.2; let npm resolve nitro-modules to the latest satisfying `>=0.35`, then pin whatever resolved in `package.json`.)

**D2. `app.config.ts` — exact changes.** Add to `plugins`:
```ts
[
  '@kingstinct/react-native-healthkit',
  {
    NSHealthUpdateUsageDescription:
      'Run Everywhere saves your completed runs — distance, time, and route — to Apple Health.',
    NSHealthShareUsageDescription:
      'Run Everywhere reads your workouts from Apple Health when you choose to import them.',
    background: false,
  },
],
```
The plugin adds the `com.apple.developer.healthkit` entitlement and both purpose strings; `background: false` because v1 never uses background delivery. v1 requests **write authorization only** (D4), so iOS shows only the update string — the share string is inert future-proofing (Decisions). Acceptance: `npx expo prebuild --clean --platform ios` → `Info.plist` contains both keys, entitlements file contains `com.apple.developer.healthkit`; then rebuild both dev clients (`npx expo run:ios` / `run:android`) — Android must still build (the plugin is iOS-only, no Android config emitted).

**D3. Platform-split module `src/lib/integrations/healthkit.ios.ts` + `healthkit.ts`.** The `.ts` file is the Android/default stub: `export const isAvailable = () => false; export async function requestHealthKitWrite() { return false; } export async function saveRunToHealthKit() { return false; }`. The `.ios.ts` file imports `@kingstinct/react-native-healthkit` at module top (safe — only bundled for iOS) and implements:
- `isAvailable(): boolean` → `isHealthDataAvailable()`.
- `requestHealthKitWrite(): Promise<boolean>` → `requestAuthorization({ toShare: ['HKWorkoutTypeIdentifier', 'HKQuantityTypeIdentifierDistanceWalkingRunning'], toRead: [] })` (identifier spellings re-checked against the lib's `SampleTypeIdentifierWriteable` union at execution). Returns the boolean. Note: HealthKit never reveals write-denial to apps; a "granted" return with denied toggles simply makes later saves no-ops — the UI copy never claims to know (Decisions).
- `saveRunToHealthKit(track: { startedAt: Date; endedAt: Date; distanceM: number }, samples: BufferSample[]): Promise<boolean>`:
  1. `const workout = await saveWorkoutSample(WorkoutActivityType.running, [], track.startedAt, track.endedAt, { distance: track.distanceM }, { 'HKMetadataKeyWorkoutBrandName': 'Run Everywhere' })` — quantities array empty; the `totals.distance` (meters) carries distance (verify unit expectation against the lib docs at execution; if totals expects meters — it maps to `HKWorkoutBuilder` totals — pass `distanceM` directly).
  2. Map the P4 buffer samples (`{ t, lat, lng, alt, acc, altAcc }`) to `LocationForSaving[]`: `{ date: new Date(t), latitude: lat, longitude: lng, altitude: alt ?? 0, horizontalAccuracy: acc ?? -1, verticalAccuracy: altAcc ?? -1, course: -1, speed: -1 }` (−1 = CLLocation "invalid", accepted by HealthKit).
  3. `await workout.saveWorkoutRoute(locations)`.
  4. Wrap everything in try/catch → return false; never throw into the finishing sequence.
- Elevation gain is not written (no first-class HKWorkout total; metadata quantity types are not worth the complexity in v1 — Decisions).

**D4. Connect flow (on `settings/connections`).** Apple Health CONNECT handler: `isAvailable()` guard → `requestHealthKitWrite()` → on `true`, `connectHealthKit()` (the B4 client INSERT) → row flips to connected. On `false`/throw → inline error "Apple Health isn't available on this device." The row's connected state = the `connected_accounts` row existing (permission state is unknowable, honest sub-copy "Connected · saving runs").

**D5. Write-after-complete (modify the P4 finishing sequence in `src/app/live/[runId].tsx` F3).** Insert one step between the raw-samples upload and `buffer.clear()`: if `Platform.OS === 'ios'` and flag `healthkit` is on (query cache) and `['connected-accounts']` has a healthkit row → `await saveRunToHealthKit({ startedAt, endedAt, distanceM }, samples)` with the same accepted-samples array already in memory for the gzip upload. Success → pass `healthkitSaved: true` via nav params so `recap/[trackId]` shows a one-line "Saved to Apple Health" caption (go-green, under the stat strip); failure → skip silently (no retry queue in v1 — Decisions; the route data needed for a faithful retro-write is gone once the buffer clears). The step must be awaited inside its own try/catch so it can never delay or fail the recap navigation by more than the write itself.

**D6. Import of external workouts — v1 decision: write-only.** RE→Health only. Reading Health workouts into RE history is deliberately out (would duplicate Strava imports for watch users, needs anchored-query bookkeeping and a dedupe story, and the verify gate doesn't require it). `track_source` already reserves `'healthkit'` so a later phase adds import without schema work. Recorded in Decisions + Out of scope.

**D7. Android Health Connect — explicitly deferred (decision, not stretch).** Different permission model, different store-listing declaration, and a separate library (`react-native-health-connect`) — none of it shared with this workstream, and the gate only names Apple Health. Deferred wholesale to backlog (earliest P7+); the Apple Health row simply never renders on Android.

**D8. Acceptance.** Simulator dev loop: finish the P4-seeded local flow (or a short simulated-location run) with Health connected → workout appears in the simulator Health app. Device: DoD #6 verbatim.

### E — Strava server side: Edge Functions, secrets, webhook subscription

Endpoints (stable Strava API v3, re-check against [developers.strava.com](https://developers.strava.com/) at execution): authorize `https://www.strava.com/oauth/mobile/authorize`, token `https://www.strava.com/oauth/token`, deauthorize `https://www.strava.com/oauth/deauthorize`, subscriptions `https://www.strava.com/api/v3/push_subscriptions`, activity detail `GET /api/v3/activities/{id}`, athlete activities `GET /api/v3/athlete/activities`.

**E1. Shared helpers `supabase/functions/_shared/`.**
- `_shared/oauth-state.ts` — the "PKCE-ish state" (stateless, no extra table): `signState({ uid, provider, exp: now+10min, nonce })` → `base64url(json) + '.' + base64url(HMAC-SHA256(json, OAUTH_STATE_SECRET))` (Web Crypto); `verifyState(state)` → payload or null (bad sig / expired). Also `deriveVerifier(nonce)` = hex `HMAC(OAUTH_STATE_SECRET, 'pkce:' + nonce)` — gives Garmin a real PKCE `code_verifier` that the callback can *recompute* from the state's nonce without storing or exposing it (F2).
- `_shared/tokens.ts` — `getFreshAccessToken(admin: SupabaseClient, userId: string, provider: 'strava'|'garmin'): Promise<string>`: `rpc('get_connected_tokens')`; if `expires_at > now()+5min` return access token; else POST the provider's token endpoint with `grant_type=refresh_token`, then `rpc('store_connected_account', …)` with the **new refresh token too** (Strava rotates refresh tokens — always persist the response's `refresh_token`), return the new access token. On refresh failure: `update connected_accounts set last_sync_error = …` (service client) and throw.
- `_shared/strava.ts` — typed fetch helpers: `exchangeCode(code)`, `getActivity(token, id)`, `listAthleteActivities(token, perPage)`, `deauthorize(token)`; plus `activityToTrack(a)` implementing the mapping table (Data model section): filter `a.sport_type in ('Run','TrailRun')` and non-empty `a.map.summary_polyline`, else return null.

**E2. `supabase/functions/strava-connect/index.ts`** — POST, `verify_jwt = true` (default; add an explicit `[functions.strava-connect]` block anyway). Body none. Steps: resolve caller from the JWT (anon-key client + `auth.getUser`); service client checks `feature_flags.strava` → 403 `{ error: 'flag_off' }` when disabled; build `https://www.strava.com/oauth/mobile/authorize?client_id=…&redirect_uri=<SUPABASE_URL>/functions/v1/strava-callback&response_type=code&approval_prompt=auto&scope=read,activity:read&state=<signState({uid, provider:'strava'})>`; return `{ url }`. **Deviation from the phase-card sketch, recorded in Decisions:** the function returns the URL for the app to open rather than 302-redirecting, because a browser GET cannot carry the Supabase JWT — `supabase.functions.invoke` (authenticated POST) + `WebBrowser.openAuthSessionAsync(url, redirect)` is the standard mobile shape; the signed state still binds the browser session to the user.

**E3. `supabase/functions/strava-callback/index.ts`** — GET, `verify_jwt = false` (browser arrives JWT-less; the HMAC state is the auth). Query: `code`, `state`, maybe `error`. Steps: `verifyState` → invalid/expired → 302 to `runeverywhere://settings/connections?provider=strava&status=error&reason=state`; `error=access_denied` → `…reason=denied`. Else POST token exchange (`client_id`, `client_secret`, `code`, `grant_type=authorization_code`); response carries `access_token`, `refresh_token`, `expires_at` (epoch s), granted `scope`, and the `athlete` object → `rpc('store_connected_account', { p_user_id: state.uid, p_provider: 'strava', p_provider_user_id: String(athlete.id), p_scopes: grantedScopes, … })`. Then `EdgeRuntime.waitUntil(backfill())` — backfill = `listAthleteActivities(token, 30)`, take the 10 most recent that pass `activityToTrack`, `rpc('import_external_track', …)` each (Decisions: connect-time backfill makes the verify gate demoable without waiting for a webhook). Finally 302 → `runeverywhere://settings/connections?provider=strava&status=connected`. Strava returning an athlete-cap error on exchange → `…status=error&reason=athlete_limit`.

**E4. `supabase/functions/strava-webhook/index.ts`** — `verify_jwt = false`.
- **GET (subscription validation):** if `hub.verify_token === Deno.env.get('STRAVA_VERIFY_TOKEN')` → 200 `{"hub.challenge": <hub.challenge>}` (must answer fast); else 403.
- **POST (events):** immediately build the 200 response; do the work in `EdgeRuntime.waitUntil` (Strava requires a 2-second ACK). Event handling: `object_type='activity'` — look up `connected_accounts where provider='strava' and provider_user_id = String(owner_id)` (service client; no row → ignore); `aspect_type='create'|'update'` → `getFreshAccessToken` → `getActivity(object_id)` → `activityToTrack` → `rpc('import_external_track')` (update re-imports are absorbed by the on-conflict no-op; title-only updates are ignored in v1 — Decisions); `aspect_type='delete'` → `rpc('delete_external_track')`. `object_type='athlete'` with `updates.authorized === 'false'` → the athlete revoked access on strava.com: delete Vault secrets + row (service client mirrors `disconnect_account`'s body, or a dedicated service-role RPC variant `disconnect_account_admin(p_user_id, p_provider)` added in B3 — add it, one line). Errors: log + write `last_sync_error`; always 200 to Strava (retries won't help a mapping bug).
- (No jobs table: `waitUntil` **is** the "import job". If the deployed edge runtime lacks `EdgeRuntime.waitUntil`, fall back to awaiting inline — imports are 2 HTTP calls, usually within budget; note in code.)

**E5. `supabase/functions/strava-disconnect/index.ts`** — POST, `verify_jwt = true`: resolve caller; `get_connected_tokens` → `deauthorize(access_token)` best-effort (ignore failures); `rpc('disconnect_account', { p_provider: 'strava' })` **as the caller** (forward the incoming JWT to a user-scoped client so the RPC's `auth.uid()` is the user); return `{ ok: true }`.

**E6. Config + secrets (exact keys).**
- [supabase/config.toml](../../supabase/config.toml) — append:
  ```toml
  [functions.strava-connect]
  verify_jwt = true
  [functions.strava-callback]
  verify_jwt = false
  [functions.strava-webhook]
  verify_jwt = false
  [functions.strava-disconnect]
  verify_jwt = true
  ```
- Local: extend `supabase/functions/.env` (+ `.env.example`, P3 convention): `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN=local-verify-token`, `OAUTH_STATE_SECRET=local-oauth-state-secret`.
- Hosted: `supabase secrets set STRAVA_CLIENT_ID=… STRAVA_CLIENT_SECRET=… STRAVA_VERIFY_TOKEN=$(openssl rand -hex 16) OAUTH_STATE_SECRET=$(openssl rand -hex 24)`; deploy: `supabase functions deploy strava-connect strava-callback strava-webhook strava-disconnect` (per-function `verify_jwt` comes from config.toml; use `--no-verify-jwt` only if the CLI version ignores the file — check `supabase functions deploy --help`).
- Strava dashboard: confirm Authorization Callback Domain = `<project-ref>.supabase.co` (P1 A2 set it).

**E7. Webhook subscription runbook** (hosted only; one subscription per app):
```sh
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=$STRAVA_CLIENT_ID -F client_secret=$STRAVA_CLIENT_SECRET \
  -F callback_url=https://<project-ref>.supabase.co/functions/v1/strava-webhook \
  -F verify_token=$STRAVA_VERIFY_TOKEN
# inspect / delete:
curl "https://www.strava.com/api/v3/push_subscriptions?client_id=…&client_secret=…"
curl -X DELETE "https://www.strava.com/api/v3/push_subscriptions/<id>?client_id=…&client_secret=…"
```
Record the subscription id in `docs/integrations/applications.md`. Local webhook testing = simulated POSTs (H2); real deliveries need the public hosted URL.

### F — Strava client + imported history surfacing

**F1. Connect flow (extend C2's Strava row).** CONNECT handler in `src/lib/integrations/strava.ts`: `const { data } = await supabase.functions.invoke('strava-connect')` → `WebBrowser.openAuthSessionAsync(data.url, 'runeverywhere://settings/connections')` → the callback's 302 lands back in the app (C3 handles params); `flag_off`/HTTP 403 → inline "Strava connections are currently disabled." Disconnect: `supabase.functions.invoke('strava-disconnect')` with RPC fallback (C2).

**F2. Imported cards in Your Runs → PAST (modify `src/app/(tabs)/runs.tsx`, P4 H5).** Add `listImportedTracks()` to `src/lib/tracks.ts`: `from('run_tracks').select('id, source, external_id, title, distance_m, duration_s, avg_pace_s_per_km, elevation_gain_m, started_at').neq('source', 'app').order('started_at', { ascending: false })` (own rows via existing RLS). Merge with `listPastRuns()` by date desc. Imported card: ink `IMPORTED · STRAVA` chip (uppercase, `paper3` bg) instead of the COMPLETED chip, title = `title ?? 'Imported run'`, meta `<date> · <km> km · <pace>/km`; **no points segment ever**. Tap → `router.push('/recap/' + id)`. Gated: when the source's flag is off, imported cards of that source are filtered out client-side (DoD #3). Empty/loading/error states unchanged from P4.

**F3. Imported recap variant (modify `src/app/recap/[trackId].tsx`, P4 G2).** When the fetched track has `source !== 'app'`: render header eyebrow `IMPORTED RUN` (ink, not go-green), hero = `title ?? 'NICE RUN.'`, caption `From <Strava|Garmin> · <date>`; the 4-stat strip and the draw-on route card as-is; **omit** points ring, breakdown card, rate-the-crew, SHARE stays, SAVE RUN becomes DONE → `router.back()`. No awards fetch is attempted (`run_id` is null).

**F4. Seed fixture** ([supabase/seed.sql](../../supabase/seed.sql)): one `run_tracks` row for maya — `source='strava'`, `external_id='seed-1'`, `title='Morning Run'`, short Belém polyline (reuse P4's fixture polyline), 4200 m / 1500 s, `started_at = now() - interval '5 days'`, inserted with explicit column list so `run_id` stays null; `on conflict do nothing`. Acceptance: local PAST tab shows the IMPORTED card; recap variant renders.

### G — Garmin (thin, flag-gated, reuses everything)

Garmin Connect Developer Program: OAuth 2.0 + PKCE ([Garmin OAuth2 PKCE spec](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf)); the [Activity API](https://developer.garmin.com/gc-developer-program/activity-api/) is **push-based** — Garmin POSTs activity summaries to registered callback URLs when a watch syncs; evaluation keys first, production keys after review ([program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/)). This workstream is deliberately thin: it may not unblock inside P6 (PLAN.md §6 lead-time risk), and every hard part is already built.

**G1. Gate check.** Read `docs/integrations/applications.md`. No evaluation keys yet → implement nothing, set DoD #17 to "blocked", add a re-check date, keep `garmin` flag false everywhere, and close the workstream. The remainder executes only with keys in hand.

**G2. Edge Functions `garmin-connect` / `garmin-callback` / `garmin-webhook` / `garmin-disconnect`** — copies of E2–E5 with provider swaps, sharing `_shared/oauth-state.ts` + `_shared/tokens.ts`:
- connect: authorize URL per the portal docs (`oauth2Confirm` host — confirm exact URL from the developer portal at execution) with `code_challenge = S256(deriveVerifier(nonce))`, `code_challenge_method=S256`, `state = signState({uid, provider:'garmin', nonce})`.
- callback: recompute `deriveVerifier(state.nonce)` as `code_verifier` for the token exchange (client id + secret + verifier); store via `store_connected_account` (`provider_user_id` = Garmin API user id from the User Id endpoint); no backfill — Garmin's model pushes on next device sync (Decisions).
- webhook: Garmin POSTs activity-summary payloads directly (register the callback URL for "Activities" in the portal). Map per the Data-model table; filter `activityType in ('RUNNING','TRAIL_RUNNING')`; summaries lack a polyline → fetch Activity Details for the GPS samples and encode with `@mapbox/polyline` server-side; activities without GPS are skipped like Strava's. Always 200 fast; `waitUntil` for the work.
- Secrets: `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET` (`supabase secrets set` + local `.env`); config.toml blocks mirroring E6 (`garmin-callback`/`garmin-webhook` `verify_jwt = false`, others true).

**G3. Client.** Zero new code paths: the C2 Garmin row calls the same connect/disconnect shape as F1 (`supabase.functions.invoke('garmin-connect')` → `openAuthSessionAsync`); imported rows surface through F2/F3 automatically (`source='garmin'`).

### H — Verification pass (always last)

**H1. `supabase/tests/rls_integrations_smoke.sql`** (P1 `begin…rollback` + role-played-JWT pattern): as maya — INSERT `connected_accounts (provider='healthkit')` for self OK; for marco's uid → RLS error; INSERT `provider='strava'` → check/RLS error; SELECT returns only own rows; `select public.store_connected_account(…)` and `get_connected_tokens(…)` and `import_external_track(…)` → `permission denied for function`; `update feature_flags set enabled = true` → RLS error; direct INSERT into `run_tracks` (any source) → RLS error; as postgres — `store_connected_account` twice updates (not duplicates) Vault secrets, `import_external_track` twice → one row, `disconnect_account` (role-played as maya) deletes the row **and** both `vault.secrets` rows (count check); `run_tracks` constraint checks: `source='app'` with null `run_id` → error, `source='strava'` with non-null `run_id` → error. Run: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_integrations_smoke.sql`.

**H2. Local webhook simulation.** With `supabase functions serve`: `curl "http://127.0.0.1:54321/functions/v1/strava-webhook?hub.mode=subscribe&hub.verify_token=local-verify-token&hub.challenge=abc"` → `{"hub.challenge":"abc"}`; wrong token → 403; POST a canned activity-create event JSON → (with a stubbed/recorded Strava API response or a real token) `run_tracks` gains the row; repeat the POST → count unchanged.

**H3. Manual QA** — see Verification script. Then update `docs/integrations/applications.md` (Strava tier status, subscription renewal date, Garmin status), tick the Definition of done, and leave hosted flags in the state the release plan wants (typically `healthkit` on, `strava` on for the test cohort, `garmin` off).

## Data model & security

Two migrations in P6's `0000000000006x` slots:

| File | Creates / changes |
|---|---|
| `supabase/migrations/00000000000060_feature_flags.sql` | `feature_flags` (`key text pk`, `enabled boolean default false`, `note`, `updated_at`); RLS SELECT-only to `authenticated`; seed rows `healthkit`/`strava`/`garmin` (never overwriting `enabled` on re-push) |
| `supabase/migrations/00000000000061_connected_accounts.sql` | Enums `integration_provider ('healthkit','strava','garmin')`, `track_source ('app','healthkit','strava','garmin')`; `connected_accounts` (B2 columns, `unique (user_id, provider)`, partial unique `(provider, provider_user_id)`, token-shape check); RLS SELECT own / INSERT own-healthkit-only / no UPDATE / no DELETE; definer fns `store_connected_account`, `get_connected_tokens`, `disconnect_account_admin` (all `revoke execute from public, anon, authenticated` — service_role only) + `disconnect_account` (authenticated); `run_tracks` alter (`source`, `external_id`, `title`, `run_id` nullable, `run_tracks_source_shape` + `run_tracks_external_shape` checks, partial unique `(user_id, source, external_id)`); import RPCs `import_external_track` / `delete_external_track` (service_role only) |

**Field mapping — RE ↔ HealthKit ↔ Strava ↔ Garmin** (the executor's single source for `activityToTrack` / `saveRunToHealthKit` / the Garmin mapper):

| `run_tracks` column | HealthKit write (D3) | Strava activity (read) | Garmin Activity API (read) |
|---|---|---|---|
| `polyline` | route: `WorkoutProxy.saveWorkoutRoute(locations)` from the P4 sample buffer | `map.polyline ?? map.summary_polyline` (skip activity if empty) | encode Activity **Details** samples (`latitudeInDegree`/`longitudeInDegree`) with `@mapbox/polyline`; skip if no GPS |
| `distance_m` | `totals.distance` on `saveWorkoutSample` (meters) | `distance` (float m, round) | `distanceInMeters` (round) |
| `duration_s` | implied by `startDate`/`endDate` | `moving_time` (s) | `durationInSeconds` |
| `elevation_gain_m` | not written (v1) | `total_elevation_gain` (round; null → 0) | `totalElevationGainInMeters` (round; null → 0) |
| `started_at` / `ended_at` | `startDate` / `endDate` args | `start_date` / `start_date + elapsed_time` | `startTimeInSeconds` (+`startTimeOffsetInSeconds` for local display only; store UTC) / `+ durationInSeconds` |
| `avg_pace_s_per_km` | derived by Health itself | computed in `import_external_track` | computed in `import_external_track` |
| `title` | metadata `HKMetadataKeyWorkoutBrandName = 'Run Everywhere'` | `name` (truncate 80) | `activityName ?? 'Garmin run'` (truncate 80) |
| `external_id` | n/a (write direction) | `String(activity.id)` | `summaryId` |
| `source` | n/a (`'app'` rows are the write source) | `'strava'` | `'garmin'` |
| activity filter | always `WorkoutActivityType.running` | `sport_type in ('Run','TrailRun')` | `activityType in ('RUNNING','TRAIL_RUNNING')` |

RLS review notes: `feature_flags` and `connected_accounts` are default-deny with the narrow policies above; the **only** client-writable integration surface is the token-less healthkit INSERT and the `disconnect_account` RPC. Tokens are readable exclusively through `get_connected_tokens` (service_role), stored only in Vault; the secret UUIDs a user can SELECT on their own row are unusable without Vault access. `import_external_track` keeps the P4 invariant that clients never write `run_tracks` (tier 1/2 split per [PLAN.md §2](../PLAN.md): Postgres owns validation + idempotency, Edge Functions own outbound HTTP + secrets). Webhook functions authenticate by shared verify-token (Strava GET) and by athlete-id row lookup (events) — an event for an unknown athlete is a silent no-op. `supabase db lint` + `npm run db:types` after each migration.

## Design references

- **Flows**: `Run Everywhere - Profile Flow.dc.html` — SETTINGS screen, "Connected apps" section: card group of three rows (icon block / name / sub "Connected · syncing runs" in green vs "Not connected" gray / right button "Connect" (ink solid) or "Manage" (gray)); section sits between Account and Preferences. `Run Everywhere - Auth & Onboarding.dc.html` — PERMISSIONS + CONNECT frame: provider sub-copy ("Import runs, pace & segments" · "Sync activity & heart rate" · "Connect your watch") and the brand glyph SVGs (lifted into C2); the onboarding placement itself stays dropped (P1 Decision 5 — settings-only in v1). `Run Everywhere - Flow Map.dc.html` node `permissions` confirms connect rows are "the tracking decision", satisfied by `settings/connections`.
- **Contracts**: `Button`, `IconButton`, `Input` (P0/P1 ports), `@gorhom/bottom-sheet` for the manage sheet — no new design-system components; the provider row is screen-local (like P1's onboarding primitives).
- **Tokens** ([src/theme/theme.ts](../../src/theme/theme.ts)): `colors.go` for connected status, `colors.danger` for DISCONNECT + sync errors, ink ramp cards, `textStyles.eyebrow` section labels, `radius.md` cards.
- **Reconciliation calls** ([PLAN.md](../PLAN.md) "Design reconciliation" wins): brand icon colors differ between the two flows (Apple Health `#0B0B0C` vs `#FF2D55`; Garmin `#1466FF` vs `#007CC3`) — brand-accurate `#FF2D55` / `#007CC3` chosen (Decisions); `#FC4C02` Strava orange is consistent. Health sub-copy "Sync activity & heart rate" over-promises → replaced with "Save your runs to Apple Health" (v1 is write-only, no heart rate). Buttons uppercase verb-first (CONNECT / MANAGE / DISCONNECT); no emoji.

## Verification script

Setup: hosted project with migrations pushed, all P6 functions deployed, secrets set, webhook subscription registered (E7); device A (iOS, maya) with a fresh dev build; the dev's Strava account holding ≥ 1 GPS run; flags initially **all false on hosted**.

1. Automated gates: `supabase db reset` → `npm run db:types && git diff --exit-code src/types/database.types.ts` → `npm run typecheck && npm run lint` → `supabase db lint` → `psql … -f supabase/tests/rls_integrations_smoke.sql` (all blocks pass) → H2 local webhook curls.
2. **Flags-off sweep (DoD #3)**: on hosted with all flags false — settings has no Connected apps section; deep-navigating `runeverywhere://settings/connections` shows the empty screen; finish a short recorded run → no Health prompt, no Health workout, recap unchanged; PAST tab shows no imported cards (seed fixture is local-only).
3. Enable `healthkit` on hosted (`update feature_flags set enabled = true where key = 'healthkit';`). Relaunch app → Connected apps section appears (iOS); Android device/emulator: section appears only if strava/garmin also on, and never an Apple Health row.
4. Apple Health CONNECT → permission sheet shows the D2 purpose string → allow all → row "Connected · saving runs". In Studio: `connected_accounts` has the healthkit row with null token columns.
5. **Verify gate, half 1**: record a real outdoor run ≥ 1 km via the P4 flow → finish → recap shows "Saved to Apple Health" → open the Health app → Workouts: a Running workout with matching date, duration, distance (±1 %), and the route drawn on its map.
6. Health negative paths: disconnect in the manage sheet → finish another (short) run → no new Health workout; reconnect works. Fresh-install deny path: decline the permission sheet → row stays "Not connected", no crash, CONNECT can retry.
7. Enable `strava` on hosted. CONNECT on the Strava row → system browser → Strava consent (scopes read + activity:read) → approve → app returns to `settings/connections`, toast "STRAVA CONNECTED", manage sheet shows the athlete id.
8. Studio checks (DoD #10): `select provider, provider_user_id, access_token_secret_id, refresh_token_secret_id from connected_accounts` — UUIDs only; `select count(*) from vault.secrets where name like 'strava:%'` = 2.
9. **Verify gate, half 2**: within ~1 min the backfill lands — PAST tab shows IMPORTED · STRAVA cards for the athlete's recent GPS runs; `select source, external_id, distance_m, duration_s from run_tracks where source='strava'` matches Strava's numbers; tap a card → imported recap variant (stats + route, no points ring); `select count(*) from points_ledger` unchanged from before the import (DoD #13).
10. Webhook live: upload/create a new run activity in Strava (a manual GPX upload works) → within ~1 min a new imported card appears; delete that activity on Strava → the card disappears after refetch. Re-deliver the same event via curl → row count unchanged (DoD #16).
11. Token refresh: `update connected_accounts set token_expires_at = now() where provider='strava';` → trigger another webhook import → succeeds; `token_expires_at` is future again and the Vault secret timestamps moved (DoD #14).
12. Disconnect Strava → strava.com → Settings → My Apps no longer lists Run Everywhere (deauthorize fired); Studio: row + both Vault secrets gone; imported cards remain; reconnect (counts against the 10-athlete cap once — same athlete re-uses the slot) works.
13. Garmin (if unblocked): enable `garmin`, connect → Garmin consent → connected row; sync a watch run → imported card. If blocked: record the status + re-check date in `docs/integrations/applications.md` and mark DoD #17 accordingly.
14. Turn `strava` off again on hosted → connect button gone, `strava-connect` returns 403, existing imported cards hidden (F2 filter) — clean hide with an active connection present.

## Risks & gotchas

| Risk | Mitigation |
|---|---|
| **Strava June-2026 program** ([PLAN.md §6](../PLAN.md)): Standard tier = 10 athletes, dev subscription required since 2026-06-30, Extended Access review still pending ([announcement](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428)) | Whole plan works at Standard tier with the dev as test athlete; flag stays off for real users until Extended Access lands; subscription renewal date tracked in `docs/integrations/applications.md`; HealthKit is the guaranteed integration and ships first |
| Strava rotates refresh tokens on every refresh — losing the new one bricks the connection | `_shared/tokens.ts` always persists the response's `refresh_token`; refresh is centralized in one helper; concurrent-refresh race accepted at v1 scale (single test athlete), noted in code |
| Webhook must ACK within ~2 s or Strava retries/disables | 200 built first, work in `EdgeRuntime.waitUntil` (E4); handler never throws to the response path |
| `@kingstinct/react-native-healthkit` v14 is Nitro-based — first Nitro dependency in the app (reanimated/worklets already present; `reactCompiler: true` experiment) | Pinned 14.0.2; D1 rebuild is a blocking early task so incompatibility surfaces on day 1; fallback = previous major (13.x, non-Nitro TurboModule) with the same plugin options — one version pin change |
| HealthKit write-authorization state is unknowable by design (Apple hides denials) | UI copy claims "saving runs", never "permission granted"; manage sheet points at iOS Settings → Health; failed saves are silent no-ops (D3/D5) |
| HealthKit write happens client-side after `complete_run` — a crash between RPC and write loses the workout (no retry queue) | Accepted v1 (Decisions): the write sits inside the finishing sequence before `buffer.clear()`; polyline/stats survive server-side for a future retro-write feature |
| Duplicate history: user records the same run in RE **and** on Strava/watch → one `app` track + one imported track | Accepted v1; IMPORTED chip visually separates them; dedupe heuristics (time-overlap) deferred to backlog |
| Definer functions touching `vault.*` may lack privileges on hosted (Vault ownership differs from local) | B3 acceptance explicitly tests `vault.create_secret` from a definer fn on hosted before the client work starts; fallback = Edge Functions write Vault via PostgREST as service_role with the same table shape |
| Deep-link return races the browser dismissal (`openAuthSessionAsync` resolves before params land) | C3 reads params from the route (the 302 target), not from the browser result; `['connected-accounts']` also refetches on screen focus |
| Garmin review never unblocks inside P6 | G1 gate closes the workstream cleanly; all plumbing (state signing, token vaulting, import RPCs, settings row) is provider-generic already — Garmin later is ~2 days |
| `sport_type` vs legacy `type` field drift on Strava activities | Mapper reads `sport_type` with fallback to `type`; unknown values are skipped, never mis-imported |
| Flag flipped off with live connections → silent continued imports | Intentional (A3/Decisions): flags gate UI + new connections; existing users' data keeps flowing; full kill = flag off **and** webhook subscription deleted (E7 runbook) |

## Decisions made by this plan

- **Flag mechanism = `feature_flags` table** (remote config), not env vars: integrations must be killable without rebuild/OTA; client defaults to OFF on missing/error/loading; local seed flips dev flags on. Flags gate UI and new connections; server-side imports for existing connections are not flag-checked.
- **HealthKit library**: `@kingstinct/react-native-healthkit` pinned **14.0.2** + `react-native-nitro-modules` peer (web-verified 2026-07-04; API confirmed from published types). `expo-health` does not exist; `react-native-health` unmaintained.
- **HealthKit v1 is write-only** (RE → Health: running workout + distance total + route). Health-import deferred: duplicates Strava for watch users, needs anchored queries + dedupe; `track_source` reserves `'healthkit'` for later.
- **Android Health Connect explicitly out of scope** (decision, not stretch): nothing shared with HealthKit work, separate library + Play declarations; earliest P7+.
- **HealthKit "connected" = a token-less `connected_accounts` row** (only client-insertable provider) — one table drives the whole settings screen; real permission state is unknowable (Apple hides write denials) and the copy never claims it.
- **HealthKit write is best-effort, no retry queue**: runs inside the finishing sequence with the in-memory sample buffer (route needs timestamps the polyline lacks); failure skips silently; elevation gain not written in v1.
- **Vault pattern**: tokens in `vault.secrets` named `<provider>:access|refresh:<uid>`; table stores secret UUIDs; all token I/O through three definer functions with `execute` revoked from `authenticated`/`anon` (service_role-only), plus user-callable `disconnect_account` that deletes secrets + row atomically.
- **Strava v1 direction = import-only** (`read,activity:read`). Pushing RE runs to Strava (`activity:write`, GPX/FIT upload) deferred: minimal scopes maximize Extended-Access approval odds, avoids double-posting for users who record in both apps, and the gate only requires import.
- **`strava-connect` returns the authorize URL from an authenticated POST** instead of 302-redirecting (browser GETs can't carry the JWT; JWT-in-query leaks). The phase card's "redirect" is preserved one hop later via `openAuthSessionAsync`.
- **"PKCE-ish state" = stateless HMAC**: `base64url(payload).sig` signed with `OAUTH_STATE_SECRET`, 10-min expiry — no pending-auth table (P6 may only create `connected_accounts` + the flags table this plan defines). Garmin's real PKCE verifier is derived as `HMAC(secret, 'pkce:'+nonce)` so the callback recomputes it from the state — nothing stored, nothing exposed.
- **Connect-time backfill**: last ≤ 10 GPS runs imported on Strava connect (makes the verify gate demoable immediately); ongoing sync via webhook.
- **Imports create `run_tracks` rows with `run_id = null`** — P6 relaxes P4's NOT NULL with shape checks (`app` ⇔ has run ⇔ no external_id); idempotency via partial unique `(user_id, source, external_id)`; only GPS activities with a polyline import (P4's `polyline not null` stands; treadmill runs skipped).
- **Imported activities never earn points** — the ledger is written only by `complete_run`/`submit_review` (PLAN.md §2 server-authoritative rule); importing a Strava run is not finishing an RE run, and paying it would be trivially gameable.
- **Imported history surfaces in the existing PAST tab** (merged client-side with `list_past_runs()`) and reuses `recap/[trackId]` with an imported variant — PLAN.md §4's route list is closed, no new routes beyond `settings/connections`.
- **Disconnect keeps imported history** (rows are the user's data; deleting on disconnect would surprise); Strava-side deletes and deauthorize events do remove/disconnect respectively.
- **Webhook "import job" = `EdgeRuntime.waitUntil`** after an immediate 200 — no job table (not in P6's table budget), no cron; inline-await fallback documented.
- **Strava activity `update` events**: re-import via the idempotent insert (no-op if present); title-only edits are not synced in v1.
- **Provider icon colors**: brand-accurate `#FC4C02` / `#FF2D55` / `#007CC3` where the two flow files disagree; Health sub-copy rewritten to "Save your runs to Apple Health" (no heart-rate claim — v1 writes none).
- **Onboarding "Connect your apps" stays dropped** (P1 Decision 5 stands): connections live in settings only for v1; revisit post-launch.
- **Migration filenames**: `00000000000060_feature_flags.sql`, `00000000000061_connected_accounts.sql` (P6 slots `…60`–`…69`).
- **Enum spellings**: `integration_provider ('healthkit','strava','garmin')`, `track_source ('app','healthkit','strava','garmin')` — `track_source` is a distinct enum because `'app'` is not a provider.

## Out of scope

- Pushing RE-recorded runs **to** Strava (`activity:write` upload) and to Garmin — backlog, revisit after Extended Access approval.
- HealthKit **import** (Health → RE history), heart-rate/energy read or write, background delivery, Apple Watch app — backlog.
- Android **Health Connect** — backlog (earliest P7+); requires `react-native-health-connect`, Play Console health declarations.
- Duplicate detection between app-recorded and imported tracks (time-overlap heuristics) — backlog.
- Strava segments/leaderboard data, athlete stats, social graph — never (prohibited uses under the [Strava API policy](https://www.strava.com/legal/api_policy) tiers we hold; imports are shown only to the owning athlete).
- Store-listing consequences (App Store privacy nutrition labels + privacy manifest entries for HealthKit, review notes, Play data-safety updates) — **P7**, seeded by this phase's purpose strings and scopes.
- Admin tooling for flags (Studio SQL suffices) and per-user/percentage rollout flags — **P7** if staged rollout needs them.
- Garmin production-key review follow-through if it slips past week 19 — tracked in `docs/integrations/applications.md`, executed whenever it lands (G is self-contained).
