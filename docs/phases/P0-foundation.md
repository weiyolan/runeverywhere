# P0 — Foundation (Weeks 1)

| | |
|---|---|
| **Depends on** | Nothing (first phase). Repo `weiyolan/runeverywhere` at commit `44c7d67` with the scaffold merged. |
| **Provides to later phases** | Bootable Expo SDK 56 dev builds (iOS + Android) with expo-router shell, locked tab IA, ported design tokens (`src/theme/theme.ts`) and 4 contract-complete components, local Supabase stack with migration `00000000000001_core.sql` + the P0 hardening migrations `…02`/`…03` + seed, committed `src/types/database.types.ts` + typed Supabase client, green CI (typecheck · lint · db lint · types drift · seed probe), EAS project linked (`extra.eas.projectId`). |
| **Verify gate** ([PLAN.md §5](../PLAN.md)) | "Boots on both platforms; tabs navigate; gallery renders" |

## Goal

P0 is the scaffold that already exists on `main`. This plan is therefore an **audit + gap-closure** plan: it enumerates everything the scaffold promises ([PLAN.md](../PLAN.md) §4–5, [README.md](../../README.md)) against what is on disk, closes the concrete gaps found (missing `database.types.ts`, component prop-contract gaps, CI weaknesses, unlinked EAS project, points-tampering holes in both the `runs` trigger and the `profiles` cache columns), and ends with a rigorous two-platform verification pass so every later phase starts from a known-good base.

## Definition of done

1. `npm ci` succeeds on a fresh clone with Node 22; `npx expo-doctor` reports no failures.
2. `npm run typecheck` exits 0.
3. `npm run lint` exits 0 with `--max-warnings 0` semantics (local script and CI identical).
4. `supabase start` then `supabase db reset` apply `00000000000001_core.sql`, the new `00000000000002_points_reward_on_all_writes.sql` and `00000000000003_profile_caches_server_only.sql`, and `seed.sql` without error.
5. Seed logins work: a password-grant token request for `maya@example.com` / `password123` (and `marco@example.com`) against the local Auth API returns an `access_token`.
6. `src/types/database.types.ts` exists, is committed, and `supabase gen types typescript --local --schema public | diff - src/types/database.types.ts` is clean (`--schema public` per decision 17).
7. `src/lib/supabase.ts` exports `SupabaseClient<Database> | null` (typed client).
8. Direct `UPDATE public.runs SET points_reward = 9999` is neutralized: the value re-computes to `compute_points_reward(distance_km, type)` on every insert/update.
9. Direct `UPDATE public.profiles SET points_total = 9999` (likewise `level`, `rating_avg`, `rating_count`) as an authenticated user is rejected with `42501 permission denied` — column-level UPDATE on the four cache columns is revoked from `authenticated` (B5 probe via PostgREST `PATCH`); a `bio` update by the same user still succeeds.
10. `npx expo run:ios` produces a dev build that boots to the Welcome screen on an iOS Simulator.
11. `npx expo run:android` produces a dev build that boots to the Welcome screen on an Android emulator.
12. "ENTER APP (DEV)" navigates to `(tabs)`; all four tabs (Explore, Runs, Messages, Profile) navigate via the custom TabBar; the center Volt (+) opens the `create/type` modal and CLOSE dismisses it.
13. `/dev/components` gallery renders all four ported components — Button (all 5 variants + disabled), TypeChip (solid/soft × 3 types + `custom` label), RunCard (`default`, `compact`, `feature` variants; attendees strip; closed-loop glyph; FULL state; verified host), TabBar specimen — plus a type-ramp/color-swatch section, with Saira / Saira Condensed visibly rendering (no system-font fallback) on both platforms.
14. The Explore → gallery link only renders in dev (`__DEV__`); the welcome screen shows a light status bar over its ink-900 background.
15. Deep link `runeverywhere:///dev/components` opens the gallery on at least one platform (`npx uri-scheme open`).
16. `.github/workflows/ci.yml` is green on a PR: app job (typecheck + lint) and db job (migrations apply, `supabase db lint --level warning`, types-drift check, seed-login probe).
17. `eas init` has been run; `extra.eas.projectId` is filled in `app.config.ts`; `eas build --profile development --platform android` completes and the artifact installs and boots.
18. RunCard/TypeChip/TabBar/Button props match their design `.d.ts` contracts per the reconciliation table in this doc (renames documented in "Decisions made by this plan").
19. All audit-matrix rows below read PASS (re-verified by the executor, not assumed).
20. `git log` shows the gap-closure work merged to `main`; the working tree is clean; no files under `run-everywhere-app-design/` were modified.

## Preconditions

| Precondition | How to check |
|---|---|
| Repo cloned at `/home/user/runeverywhere` (or equivalent), scaffold merged | `git log --oneline` shows `44c7d67` merge; `ls src/app supabase/migrations` |
| Node 22+, npm | `node --version` → v22.x |
| Docker running (Supabase local stack) | `docker info` exits 0 |
| Supabase CLI installed | `supabase --version` (any 2.x; record the exact version — CI pins it, see D2) |
| macOS with Xcode + iOS Simulator (for the iOS build) | `xcodebuild -version`; `npx expo-doctor` validates the toolchain against SDK 56 |
| Android Studio with an emulator (API 34+) and JDK 17 | `adb --version`; `emulator -list-avds` non-empty |
| Expo account (free tier suffices: 15+15 builds/mo) | `npx eas-cli whoami` after `eas login` |
| GitHub repo with Actions enabled, push access | `git push` to a branch; Actions tab shows the CI workflow |
| Design bundle present read-only | `ls run-everywhere-app-design/project/tokens` shows 5 css files |
| **Not** required in P0: Google Maps API keys, Apple Developer account, hosted Supabase project | — (deferred: keys → P2, Apple account → P1, hosted project → P1) |

## Audit matrix (promise vs disk)

Ground truth as audited on 2026-07-04. Executor: re-verify each row before starting; only FAIL/PARTIAL rows generate work.

| # | Scaffold promise (PLAN §4–5 / README) | On disk | Status → action |
|---|---|---|---|
| 1 | Routes `(auth)/welcome\|sign-in\|sign-up\|forgot-password` | All 4 + `_layout.tsx` (redirects signedIn → tabs) | PASS |
| 2 | Routes `(tabs)/index\|runs\|messages\|profile` + custom TabBar w/ Volt FAB | All present; `_layout.tsx` guards signedOut → welcome | PASS |
| 3 | Route `create/type` (wizard stub) + modal presentation | Present; root `_layout` registers `create` as modal | PASS |
| 4 | Route `dev/components` gallery | Present, but covers only a subset of ported props; Explore link not `__DEV__`-gated | PARTIAL → C3, C4 |
| 5 | `src/theme/theme.ts` 1:1 port of `project/tokens/*.css` | Verified value-by-value (colors, semantic aliases, type scale, tracking, spacing, radius, sizing, borders, shadows, motion). Not ported: CSS easing curves, `--screen-w`, `--maxline` (web-layout-only) | PASS (omissions recorded in Decisions) |
| 6 | Components `Button`, `TypeChip`, `RunCard`, `TabBar` port their `.d.ts` contracts | Ported, but contract diffs exist (see reconciliation table) | PARTIAL → C1, C2 |
| 7 | `src/lib/supabase.ts` (null-safe client), `src/lib/queryClient.ts` | Present; client is **untyped** `SupabaseClient` | PARTIAL → B2 |
| 8 | `src/stores/session.ts` zustand session (+ documented `devSignIn` escape hatch) | Present; removal explicitly deferred to P1 | PASS |
| 9 | All 9 Saira TTFs referenced by `app.config.ts` | All 9 present in `assets/fonts/` (Saira Regular/Medium/SemiBold/Bold + Condensed Medium/SemiBold/Bold/ExtraBold/Black) — matches `fonts.css` weight set exactly | PASS |
| 10 | `assets/images` referenced by `app.config.ts` (icon, splash-icon, android foreground/monochrome, favicon) | All 5 present | PASS |
| 11 | `.env.example` | Present (Supabase URL/anon key + Maps key slots, service-role warning) | PASS |
| 12 | `src/types/database.types.ts` (`npm run db:types` target; keeps client honest per PLAN §2) | **Missing**; `src/types/` dir doesn't exist, so the npm script's `>` redirect fails | FAIL → B1 |
| 13 | `supabase/config.toml` (Postgres 15, auth deep-link scheme, storage 10MiB) | Present, consistent with PLAN §1 | PASS |
| 14 | `supabase/migrations/00000000000001_core.sql` | Present; full schema as PLAN §3 describes | PASS (two hardening findings → B4, B5) |
| 15 | `supabase/seed.sql` (2 users / 3 Lisbon runs, `password123`) | Present; users are direct `auth.users` INSERTs (no `auth.identities` rows) | PASS on disk; the login path itself is unproven → verify via A3, contingency documented there |
| 16 | `eas.json` (development/preview/production profiles) | Present; `extra.eas.projectId` in `app.config.ts` is an empty comment | PARTIAL → E1 |
| 17 | CI: typecheck + lint + `supabase db lint` (PLAN §1 Build/deploy) | `.github/workflows/ci.yml` exists; suspect lint arg form (`npx expo lint -- --max-warnings 0`); no seed check, no types-drift check, CLI `version: latest` unpinned | PARTIAL → D1, D2 |
| 18 | Dev-build story (Expo Go can't run `react-native-maps`) | README documents `npx expo run:*` and EAS profiles; never exercised | VERIFY → A4, E2, E3 |
| 19 | `supabase/functions/send-push` stub (P3), excluded from tsc/eslint | Present, excluded in `tsconfig.json` + `eslint.config.js` | PASS |
| 20 | Design bundle read-only | Present, untouched | PASS |

### Component `.d.ts` contract reconciliation

Source contracts: `run-everywhere-app-design/project/components/{buttons/Button,data/TypeChip,run/RunCard,navigation/TabBar}.d.ts`.

| Component | Contract delta in port | Disposition |
|---|---|---|
| Button | `children` → `label: string` (uppercase enforced in style); web `ButtonHTMLAttributes` dropped; `lg` height fixed at 60 (tokens define only 52/40) | Accept — RN adaptation, recorded decision. No task. |
| TypeChip | `style` → `chipStyle` (RN `style` prop collision); **`custom?: string` label override missing** | Rename accepted. Add `custom` → task C2. |
| RunCard | `onClick` → `onPress`; **missing: `spotsTotal`, `closedLoop`, `attendees`, `variant: "feature"`, `host.src`; `host.verified` accepted but never rendered** | Renames accepted. Close all prop gaps → task C1. Note: the design's own `RunCard.jsx` never renders `spotsTotal`; we accept the prop and use it only in the accessibility label. |
| TabBar | `items: TabBarItem[]` replaced by hardcoded typed `TABS` (locked IA: Explore · Runs · [+] · Messages · Profile); `createLabel` dropped; `messagesBadge` added | Accept — the IA is locked by the design readme, a data-driven items prop only invites drift. Recorded decision. No task. |

Visual deltas between the RN RunCard and the design `RunCard.jsx` (stat glyphs, city placement in header vs stats row, footer hairline) are **not** P0 work — pixel reconciliation happens against real data in P2 and final polish in P7. That deferral covers *pre-existing* port deltas only; the values C1 newly prescribes (attendee circles, `+N` overflow, loop glyph, verified tick) are lifted verbatim from `RunCard.jsx`/`Avatar.jsx`, so C1 and the design source cannot disagree.

## Workstreams

### A — Baseline bring-up & audit re-verification

1. **Install & doctor.**
   Commands: `npm ci`, then `npx expo-doctor`.
   Files: none.
   Note: `babel-plugin-react-compiler` is already in `package-lock.json` (transitively, for `experiments.reactCompiler: true`); if Metro later errors on it, `npm i -D babel-plugin-react-compiler` and commit — do not disable the experiment.
   Acceptance: both commands exit 0.

2. **Static gates before any change.**
   Commands: `npm run typecheck`, `npm run lint`.
   Acceptance: both exit 0. If typed-routes types are referenced but missing on a fresh clone, run `npx expo start` once (generates `.expo/types` + `expo-env.d.ts`) and re-run; record which was needed in the PR description (feeds D1).

3. **Local Supabase stack + seed logins.**
   Commands:
   ```sh
   supabase start            # prints anon key; copy it
   supabase db reset         # applies migrations + seed.sql
   ANON=$(supabase status -o env | grep ANON_KEY | cut -d= -f2 | tr -d '"')
   curl -fsS -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
     -H "apikey: $ANON" -H "Content-Type: application/json" \
     -d '{"email":"maya@example.com","password":"password123"}' | grep -o access_token
   ```
   Repeat the curl for `marco@example.com`.
   Acceptance: both probes print `access_token`; Studio (`http://127.0.0.1:54323`) shows 2 `profiles` rows and 3 `runs` rows in Lisbon.
   Contingency (known GoTrue gotcha — do this only if a probe fails): `seed.sql` inserts `auth.users` rows directly, with no matching `auth.identities` rows and with GoTrue's varchar token columns (`confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`, `email_change_token_current`) left NULL — a well-known cause of local password-grant failures (500 "Database error querying schema" or invalid-credentials) on recent Supabase CLI/GoTrue versions. Fix by amending `supabase/seed.sql` to (a) insert a matching `auth.identities` row per user (`provider = 'email'`, `provider_id` = the user's id, `identity_data` = `{"sub": "<id>", "email": "<email>", "email_verified": true}`, timestamps `now()`) and (b) set the varchar token columns to `''` in the `auth.users` insert; then `supabase db reset` and re-run both probes. Commit the seed fix — DoD item 5 and the standing CI probe (D2) depend on it.

4. **First boot on both platforms.**
   Commands: `cp .env.example .env` (paste anon key into `EXPO_PUBLIC_SUPABASE_ANON_KEY`; leave Maps keys empty — no map renders in P0), then `npx expo run:ios` and `npx expo run:android`.
   Acceptance: Welcome screen renders on both; no red screen; Metro shows no font-load errors. Optional sanity check of the README claim: opening the project in Expo Go fails on `react-native-maps` native module — confirms dev builds are mandatory.

5. **Re-verify the audit matrix.** Walk rows 1–20 above; if any PASS row is actually broken, file it as a task in this phase before proceeding.

### B — Database artifacts & typed client

1. **Generate and commit `src/types/database.types.ts`.**
   Files: create dir `src/types/`; generated file `src/types/database.types.ts`.
   Commands (stack running from A3):
   ```sh
   mkdir -p src/types
   npm run db:types          # supabase gen types typescript --local > src/types/database.types.ts
   git add src/types/database.types.ts
   ```
   Acceptance: file contains `public.Tables` for `profiles`, `runs`, `run_members`, `favorites`; `Enums` for all 8 enums (`run_type`, `run_status`, `run_visibility`, `member_status`, `pace_band`, `distance_band`, `units_pref`, `profile_visibility`); `Functions` for `join_run`, `respond_to_join_request`, `get_run_by_invite`, `runs_within_radius`, `compute_points_reward`, `is_run_member`. `npm run typecheck` still exits 0.

2. **Type the Supabase client.**
   File: `src/lib/supabase.ts`.
   Change: `import type { Database } from '@/types/database.types';` and type the export as `SupabaseClient<Database> | null`, passing the generic to `createClient<Database>(…)`. No behavior change; keep the null-when-unconfigured contract and its doc comment.
   Acceptance: typecheck passes; `supabase!.from('runs')` in a scratch expression autocompletes typed columns (spot-check in editor, then delete).

3. **Add a drift-check script.**
   File: `package.json` → `"db:types:check": "supabase gen types typescript --local --schema public | diff - src/types/database.types.ts"` (`--schema public` on both `db:types` and `db:types:check`, per decision 17).
   Acceptance: `npm run db:types:check` exits 0 against the running local stack; exits non-zero after any schema edit (test by adding a throwaway column in Studio, then `supabase db reset` to restore).

4. **Migration `00000000000002_points_reward_on_all_writes.sql` — close the points-tamper hole.**
   Finding: the `runs` UPDATE RLS policy lets a host update any column, and trigger `runs_points_reward` only fires `on update of distance_km, type` — so `UPDATE runs SET points_reward = 9999` sticks, violating the tier rule "client never writes points" (PLAN §2). P0 owns migration slots `…00`–`…09`, and this hardens a P0-owned trigger — no new tables.
   File: `supabase/migrations/00000000000002_points_reward_on_all_writes.sql`, exact content:
   ```sql
   -- P0 hardening: points_reward is always server-computed. The previous
   -- trigger fired only on distance_km/type updates, letting a direct
   -- UPDATE set points_reward. Recompute on every write instead.
   drop trigger if exists runs_points_reward on public.runs;
   create trigger runs_points_reward
     before insert or update on public.runs
     for each row execute function public.set_run_points_reward ();
   ```
   Commands: `supabase db reset`, then in Studio SQL editor (or `psql`):
   ```sql
   update public.runs set points_reward = 9999
     where id = '10000000-0000-4000-8000-000000000001';
   select points_reward, public.compute_points_reward(distance_km, type)
     from public.runs where id = '10000000-0000-4000-8000-000000000001';
   ```
   Acceptance: both columns equal (`round(7.5×18)+15 = 150` for the Old Town Loop discover run); `supabase db lint --level warning` clean; re-run B3's drift check (trigger changes don't alter generated types — expect clean).

5. **Migration `00000000000003_profile_caches_server_only.sql` — close the profile-cache tamper hole.**
   Finding: symmetric to B4. The `profiles` UPDATE policy ("users update own profile") has no column restrictions, and `profiles` carries the server-cache columns `points_total`, `level`, `rating_avg`, `rating_count` — commented "maintained by triggers in later migrations", but those triggers land only in P4, so nothing defends them in P0. Any authenticated user can `UPDATE public.profiles SET points_total = 999999, level = 99, rating_avg = 5.00, rating_count = 1000 WHERE id = auth.uid()` via PostgREST — the same PLAN §2 tier-3 violation B4 fixes for `runs.points_reward`, and P4/P5 leaderboard/rating features read these caches. RLS policies cannot restrict columns; Postgres column privileges can — but privileges are additive, so the table-wide UPDATE grant must be revoked and re-granted column-by-column.
   File: `supabase/migrations/00000000000003_profile_caches_server_only.sql`, exact content:
   ```sql
   -- P0 hardening: profiles.points_total / level / rating_avg / rating_count
   -- are server-maintained caches (P4 ledger/review triggers). The
   -- unrestricted "users update own profile" policy plus Supabase's
   -- table-wide UPDATE grant let any user set their own caches via
   -- PostgREST. Column privileges are additive to the table grant, so
   -- revoke table-level UPDATE and re-grant only the user-editable columns.
   -- SECURITY DEFINER paths (P4 triggers, service_role) are unaffected.
   revoke update on table public.profiles from authenticated, anon;
   grant update (
     display_name, bio, avatar_url, home_city, home_point,
     pace_band, distance_band, languages, units, visibility,
     tos_accepted_at, onboarded_at, updated_at
   ) on table public.profiles to authenticated;
   ```
   (`id` and `created_at` are deliberately absent from the grant list too.)
   Commands: `supabase db reset`, then probe through PostgREST as a real authenticated user (Studio's SQL editor runs as `postgres` and would bypass the grant):
   ```sh
   TOKEN=$(curl -fsS -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
     -H "apikey: $ANON" -H "Content-Type: application/json" \
     -d '{"email":"maya@example.com","password":"password123"}' | jq -r .access_token)
   curl -is -X PATCH "http://127.0.0.1:54321/rest/v1/profiles?id=eq.00000000-0000-4000-8000-000000000001" \
     -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"points_total": 9999}'          # expect 42501 permission denied
   curl -is -X PATCH "http://127.0.0.1:54321/rest/v1/profiles?id=eq.00000000-0000-4000-8000-000000000001" \
     -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"bio": "still editable"}'       # expect 204 (positive control)
   ```
   Acceptance: the cache-column `PATCH` is rejected with `42501` (permission denied), the `bio` `PATCH` succeeds; `supabase db lint --level warning` clean; B3's drift check still clean (grants don't alter generated types).

### C — Design-system contract parity & gallery completion

1. **RunCard: close prop-contract gaps.**
   File: `src/components/ui/RunCard.tsx`. Reference implementation for visuals: `run-everywhere-app-design/project/components/run/RunCard.jsx`.
   Add to `RunCardProps` / `RunHost` and implement:
   - `host.src?: string` — when set, render the avatar with `expo-image` `<Image>` (24×24, `radius.pill`) instead of initials; keep initials fallback.
   - `host.verified?: boolean` — already in the interface; render it: a 16px `colors.go` circle with a white check (use lucide `Check` size 10, `strokeWidth 3`) and a 2px `semantic.bgSurface` border, overlapping the avatar's bottom-right — 16px is `Avatar.jsx`'s `minWidth`/`minHeight` floor for the verified tick.
   - `closedLoop?: boolean` — render lucide `Repeat` (size 18 — the design's `LoopGlyph` is 18×18, `RunCard.jsx` line 132 — color `runType[type].main`) at the right end of the host row, `accessibilityLabel="Closed loop"`.
   - `attendees?: { name: string; src?: string }[]` — overlapping 28px initial/photo circles, the design's `xs` Avatar size (marginLeft −8 after the first, 2px `semantic.bgSurface` ring via border), max 3 shown, then a `+N` circle (28px, `bgInverse` background, `textOnDark`, `fonts.displayExtra` 11px); right-aligned in the host row before the closed-loop glyph. All values per `RunCard.jsx` lines 107–120 + `Avatar.jsx` `dims.xs`.
   - `spotsTotal?: number | null` — no visual (the design's own JSX ignores it); include it in the spots pill's `accessibilityLabel` (e.g. "3 of 8 spots left") when both values present.
   - `variant: 'default' | 'compact' | 'feature'` — `feature`: title `fontSize` 26 (vs `typeScale.d3` 22), `shadows.lg` instead of `shadows.sm`; everything else as `default`.
   Keep existing renames (`onPress`) and the 5px accent rail untouched.
   Acceptance: typecheck + lint clean; gallery (C3) shows every new prop; no visual regression to the two existing gallery cards.

2. **TypeChip: add `custom` label override.**
   File: `src/components/ui/TypeChip.tsx`. Add `custom?: string`; render `custom ?? runType[type].label`. Colors still come from `type`.
   Acceptance: `<TypeChip type="discover" custom="ROUTE" />` renders "ROUTE" on discover blue.

3. **Gallery completion.**
   File: `src/app/dev/components.tsx`. Add sections (keep existing ones):
   - **Tab bar** — a non-interactive `<TabBar value="explore" onChange={() => {}} onCreate={() => {}} messagesBadge />` specimen inside a full-bleed container (it styles its own ink background).
   - **Run card variants** — a `feature` variant card, a card with `attendees` (4 entries → `+1` overflow), `closedLoop`, `host: { name, rating, verified: true }`, and `spotsTotal`.
   - **Type chips** — add one `custom` example.
   - **Type & color** — a type ramp rendering each `textStyles` role (`screenTitle`, `sectionHeader`, `cardTitle`, `eyebrow`, `body`, `caption`, `metric` with a tabular number like `5:30`) and a swatch row of `colors.volt`, the three run-type colors, and `go`/`warn`/`danger`/`star` (24px squares + hex captions in `caption` style). This doubles as the font-loading check (Saira Condensed vs system fallback is obvious at `d1` size).
   Acceptance: gallery scrolls through all sections on both platforms with no clipped content; every component prop listed in DoD item 13 is visible.

4. **Gate the gallery link to dev.**
   File: `src/app/(tabs)/index.tsx`. Wrap the `<Link href="/dev/components">` block in `{__DEV__ ? … : null}`. The route itself stays registered (harmless, unlinked in production — matches PLAN §4 "Gallery at /dev/components").
   Acceptance: link visible in dev build, absent in a release-mode build (`npx expo run:android --variant release` spot-check, or assert via code review — release build not otherwise required in P0).

5. **Welcome screen status bar.**
   File: `src/app/(auth)/welcome.tsx`. Add `<StatusBar style="light" />` (from `expo-status-bar`) inside the screen — the root layout sets `dark`, which is illegible on the ink-900 welcome background. Sign-in/up/forgot screens are light and keep the root default.
   Acceptance: status bar icons are white on Welcome, dark everywhere else, both platforms.

### D — CI hardening (GitHub Actions)

1. **Fix and align lint invocation.**
   Files: `.github/workflows/ci.yml`, `package.json`.
   - Verify locally: `npx expo lint -- --max-warnings 0` vs `npx expo lint --max-warnings 0` — keep whichever actually forwards `--max-warnings 0` to ESLint (expected: the form **without** `--`; confirm by introducing a temporary warning).
   - Set `package.json` `"lint": "expo lint --max-warnings 0"` and change the CI step to `npm run lint` so local and CI can never diverge. Keep `npm run typecheck` as-is but call it via `npm run typecheck` in CI for the same reason.
   Acceptance: CI app job green; a deliberate unused-variable commit on a scratch branch turns it red, then revert.

2. **Rework the db job.**
   File: `.github/workflows/ci.yml`, `db` job steps become:
   ```yaml
   - uses: actions/checkout@v4
   - uses: supabase/setup-cli@v1
     with:
       version: <pin to the exact `supabase --version` used locally in A3>
   - run: supabase start                 # full stack: migrations + seed apply here
   - run: supabase db lint --level warning
   - name: Generated types are committed and current
     run: npm run db:types:check   # --schema public, same command as local (decision 17)
   - name: Seed logins work
     run: |
       ANON=$(supabase status -o env | grep ANON_KEY | cut -d= -f2 | tr -d '"')
       curl -fsS -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
         -H "apikey: $ANON" -H "Content-Type: application/json" \
         -d '{"email":"maya@example.com","password":"password123"}' | grep -q access_token
   ```
   Rationale: the previous `supabase db start` never exercised `seed.sql`; `version: latest` makes the types-drift step flap when the CLI's codegen changes — pin it, and bump it deliberately alongside a regenerated `database.types.ts`.
   Acceptance: db job green on the PR; deliberately editing one line of `database.types.ts` turns the drift step red, then revert.

3. **Land via PR.** Branch `p0-gap-closure`, push, open PR, confirm both jobs green before merge.
   Acceptance: merged to `main` with green checks.

### E — EAS project init & dev-build bootstrap

1. **Link the EAS project.**
   Commands: `npm i -g eas-cli` (or `npx eas-cli`), `eas login`, `eas init`.
   File: `app.config.ts` — because config is dynamic (TS), `eas init` cannot write it; paste the printed project ID into `extra.eas.projectId: '<uuid>'` (replacing the placeholder comment).
   Acceptance: `eas project:info` shows the project; `npx expo config --json | grep projectId` prints the UUID; typecheck clean.

2. **Cloud Android development build.**
   Command: `eas build --profile development --platform android` (EAS generates the keystore on first run — accept).
   Then install the `.apk` on the emulator/device (`adb install <file>` or the QR from the build page) and start Metro with `npx expo start`.
   Acceptance: the EAS-built dev client boots, connects to Metro, and reaches the tabs. This proves the `development` profile works without any local Android toolchain — the bootstrap story for a maps-capable client that Expo Go can't provide.
3. **iOS dev-build path stays local in P0.**
   Command: `npx expo run:ios` (already done in A4). A cloud iOS `development` build needs Apple Developer credentials for ad-hoc provisioning; that lands in P1 where the Apple account is mandatory anyway (Sign in with Apple, PLAN §1).
   Acceptance: A4's iOS boot recorded; note in the PR that iOS EAS builds are deferred to P1.

### F — Verification pass (final)

Execute the full "Verification script" below on both platforms, tick every Definition-of-done item, and attach screenshots of (a) the gallery on iOS, (b) the gallery on Android, (c) green CI, (d) the EAS Android build page to the closing PR or phase notes.

## Data model & security

**Schema changes:** two migrations, both P0-owned hardening (slots `…00`–`…09`). `supabase/migrations/00000000000002_points_reward_on_all_writes.sql` (full content in task B4) drops and recreates trigger `runs_points_reward` as `before insert or update on public.runs` (previously `update of distance_km, type` only) so `points_reward` is recomputed by `set_run_points_reward()` on **every** write. `supabase/migrations/00000000000003_profile_caches_server_only.sql` (full content in task B5) revokes table-level UPDATE on `public.profiles` from client roles and re-grants it column-by-column, excluding the four server-cache columns (`points_total`, `level`, `rating_avg`, `rating_count`). No new tables, columns, policies, or functions — P3–P6 tables are explicitly out of scope here (PLAN §3).

**RLS review notes** (audit of `00000000000001_core.sql`; no changes required beyond B4 + B5):

- Default-deny holds for membership: every table has RLS enabled, and `run_members` has **no** client write policies — all membership writes go through `SECURITY DEFINER` RPCs (`join_run`, `respond_to_join_request`), which is the PLAN §2 tier-1 contract.
- The points path is closed only **after** B4 + B5. As shipped in `…01` it is open in two places: the unrestricted `runs` UPDATE policy plus the `update of distance_km, type` trigger let hosts write `points_reward` directly (→ B4), and the unrestricted `profiles` UPDATE policy lets any user write their own `points_total`/`level`/`rating_avg`/`rating_count` caches, which have no maintaining triggers until P4 (→ B5). Both violate PLAN §2 tier 3 ("client never writes points, approvals, or rating aggregates"); both are fixed by the migrations above and locked in by DoD items 8–9.
- **Capacity semantics: `max_group` includes the host.** Both `join_run` and `respond_to_join_request` reject when `approved_count + 1 >= max_group`, and `runs_within_radius` reports open spots as `approved_count + 1 < max_group`. P2 UI must compute `spotsLeft = max_group - 1 - approved_count`. Documented here so no later phase re-derives it differently.
- `join_run` on `open`/`invite` runs re-approves a previously `declined` member via the `ON CONFLICT` path. Acceptable for v1 (hosts remove, not decline, in open runs; `removed` members cannot rejoin), noted for the P2 host-tools design.
- Invite-only runs are hidden from listings by the SELECT policy and reachable only via `get_run_by_invite(code)`; `join_run` itself does not check the code, relying on run-UUID unguessability. Acceptable; P2's `invite/[code]` flow must always resolve through the RPC.
- `profiles` SELECT exposes `home_point` to all authenticated users unless `visibility = 'hidden'`. Flagged for the P5 privacy/settings pass (PLAN §5); no P0 action.
- `supabase db lint --level warning` runs in CI (D2) as the standing guard on plpgsql.

## Design references

- **Canonical decisions:** `run-everywhere-app-design/project/readme.md` "Decisions locked" — Volt `#CCFF00`, Discover `#1463FF`, Challenge `#FF3D2E`, Social purple `#7C5CFC`, `#00C271` as go/success signal only, Saira/Saira Condensed, uppercase verb-first buttons, no emoji, locked 5-slot tab IA. PLAN §1 "Design reconciliation" restates this and wins over any older prototype (notably: Social is purple, body face is Saira).
- **Token groups:** all five — `project/tokens/colors.css`, `typography.css`, `spacing.css`, `elevation.css` (+ `fonts.css`, replaced by locally bundled TTFs per the readme's production caveat). Verified 1:1 against `src/theme/theme.ts` in this audit.
- **Component contracts consumed in P0:** `components/buttons/Button.d.ts`, `components/data/TypeChip.d.ts`, `components/run/RunCard.d.ts` (+ `RunCard.jsx` as the visual reference for attendees/feature/closed-loop — C1's sizes are taken verbatim from it, and from `Avatar.jsx` for the `xs` avatar dimension and verified-tick minimum; `Avatar.jsx` is consulted for those values only, the component itself stays unported until P2), `components/navigation/TabBar.d.ts`. Remaining contracts (`IconButton`, `Input`, `Tabs`, `Badge`, `Avatar`, `RatingStars`, `StatBlock`, `MapPin`, `RouteMarker`) are read-only references until their phases (Input/IconButton → P1 auth forms; the rest → P2, per PLAN §4).
- **Flow files:** "Run Everywhere - Design System.dc.html" (sections: Colour · Type · Space/Radius/Elevation · Components · UI Kit) is the gallery's model — C3's type-ramp/swatch section mirrors its Colour/Type specimens. "Run Everywhere - Main Flow.dc.html" confirms tab labels EXPLORE / YOUR RUNS / MESSAGES (tab bar shows RUNS; "Your runs" is the screen title). "Run Everywhere - Auth & Onboarding.dc.html" confirms Welcome copy ("Social running", "Get started", "Log in") — the scaffold matches; full auth flows are P1 references.
- **Reconciliation calls made here:** RN prop renames and the TabBar items-prop removal (see contract table + Decisions); pixel-level RunCard deltas deferred to P2/P7.

## Verification script

Manual QA (single device account context — no multi-user flows exist yet in P0):

1. Fresh clone in a clean directory; `npm ci` → 0 errors; `npx expo-doctor` → all checks pass.
2. `supabase start` && `supabase db reset` → migrations `…01`, `…02` and `…03` + seed apply; note anon key.
3. Seed-login probes (A3 curl) for both `maya@example.com` and `marco@example.com` → `access_token` present (if not, apply the A3 contingency first).
4. Points-tamper checks: (B4 SQL) → `points_reward` re-computes; values: Old Town Loop 150, Monsanto Hills 256 (`round(12×18)+40`), Sunset 5K 94 (`round(5.2×18)+0`). (B5 curl) → authenticated `PATCH` of `profiles.points_total` returns `42501` permission denied; the `bio` positive-control `PATCH` succeeds.
5. `cp .env.example .env`, paste anon key; leave Maps keys blank.
6. `npx expo run:ios` → boots to Welcome on the iOS Simulator; status bar icons are light on the dark hero; Saira Condensed headline (not a fallback serif/system face).
7. "GET STARTED" → sign-up stub; back; "LOG IN" → sign-in stub; back (stub screens render, no crash).
8. "ENTER APP (DEV)" → lands on Explore ("YOU'RE IN LISBON / RUNS NEAR YOU" + 3 fixture RunCards).
9. Tap all four tabs in order Runs → Messages → Profile → Explore: each screen renders; active tab glyph/label turns Volt; no double-tap crashes.
10. Tap the center Volt (+) → `create/type` modal slides up; "CLOSE" dismisses back to the previous tab.
11. Explore → "Open component gallery" → gallery: verify every section from DoD item 13, including FULL state pill, `+N` attendee overflow, closed-loop glyph, verified tick, feature-variant shadow/title, custom TypeChip, TabBar specimen, type ramp, swatches.
12. Profile → "LOG OUT" → returns to Welcome (session store resets).
13. Repeat steps 6–12 on Android: `npx expo run:android` (emulator). Also confirm the Volt FAB renders above the bar and the tab bar respects the navigation-bar inset.
14. Deep link: with the dev build installed, `npx uri-scheme open "runeverywhere:///dev/components" --ios` (and `--android`) → gallery opens directly.
15. EAS: install the E2 Android artifact, `npx expo start`, open the dev client → tabs reachable.
16. Production-link check: build one release-variant boot (`npx expo run:android --variant release`) → Explore shows **no** gallery link.

Automated gates (all must pass, locally and in CI):

- `npm run typecheck` (tsc --noEmit)
- `npm run lint` (expo lint, zero warnings)
- `supabase db lint --level warning`
- `npm run db:types:check` (generated-types diff clean against the local DB)
- CI workflow green on the `p0-gap-closure` PR (app + db jobs, including the seed-login probe and drift step)

## Risks & gotchas

| Risk | Mitigation |
|---|---|
| Expo Go silently used instead of a dev build → `react-native-maps` native module error at Metro connect | README already mandates dev builds; A4 confirms; keep using `npx expo run:*` / EAS dev clients. Never demo from Expo Go. |
| `react-native-maps` 1.27.2 is SDK 56's tested version (PLAN §1); upgrading to 1.29 may break New Architecture builds | Do not bump in P0; version changes only via a dedicated upgrade branch (PLAN §1 policy). |
| `experiments.reactCompiler` needs `babel-plugin-react-compiler` at bundle time | Present in the lockfile (audited); A1 catches a miss — install as devDependency rather than disabling the experiment. |
| Typed-routes types (`.expo/types`, `expo-env.d.ts`) don't exist on a fresh clone, so `tsc` route checking is loose until first `expo start` | A2 records the behavior; run `npx expo start` once before trusting local typecheck for route strings. CI accepts loose route types in P0 (routes are exercised by the manual script). |
| `supabase gen types` output varies across CLI versions → CI drift step flaps | D2 pins `supabase/setup-cli` to the locally used version; bump CLI + regenerate types in one commit. |
| CI `supabase start` is slow (pulls the full stack, ~2–4 min) | Accept in P0 (one workflow); revisit with image caching only if it exceeds ~6 min. |
| iOS font names: `expo-font` config plugin registers fonts by PostScript name on iOS but by filename on Android — a mismatch renders silent fallback on one platform | The Saira TTFs' PostScript names match their filenames (`Saira-Regular`, `SairaCondensed-Bold`, …); step 6/13 + the gallery type ramp make fallback obvious at 40–64px. |
| Volt glow (`shadows.volt`) renders as plain gray elevation on Android (elevation ignores shadowColor) | Known platform limitation; accepted for P0 (visual-polish pass is P7). |
| Seed users are direct `auth.users` INSERTs with no `auth.identities` rows and NULL GoTrue varchar token columns — recent Supabase CLI/GoTrue versions can fail the password grant for such users (500 "Database error querying schema" or invalid-credentials), breaking DoD item 5 and the D2 CI probe | A3's contingency: amend `seed.sql` to insert matching `auth.identities` rows (provider `email`, `provider_id` = user id, `identity_data` with `sub`/`email`) and set the token columns to `''`, then `supabase db reset` and re-probe. Commit the fix so CI pins the working seed. |
| Seeded runs use `now() + interval` — a stale local DB from a previous week has past `starts_at`, making fixtures look wrong later (P2 filters) | `supabase db reset` re-seeds relative dates; make it a habit before demos. Harmless in P0 (static fixtures on screen). |
| Docker not running / low resources → cryptic `supabase start` failures | Precondition check `docker info`; allocate ≥4 GB to Docker. |
| Free-tier EAS build queue can stall the E2 acceptance | Only one cloud build is required in P0 (Android dev). Local `expo run:*` remains the fallback proof for the boot gate. |

## Decisions made by this plan

1. **P0 closes prop-contract gaps only for the four shipped components** (RunCard `closedLoop`/`attendees`/`feature`/`host.src`/verified-render/`spotsTotal`, TypeChip `custom`); the other nine design components stay unported until their consuming phases (PLAN §4 wording: "remaining"). Rationale: PLAN §4 claims the shipped four "port their `.d.ts` contracts directly" — make that claim true now, cheaply, before P2 builds on them.
2. **`spotsTotal` gets no visual rendering** (accessibility label only) because the design's own `RunCard.jsx` accepts but never renders it — the pill shows "N SPOTS LEFT"/"FULL" only.
3. **RN prop renames are locked:** TypeChip `style`→`chipStyle`, RunCard `onClick`→`onPress`, Button `children`→`label`, TabBar drops `items`/`createLabel` in favor of the hardcoded locked IA with typed `TabId`. Rationale: RN prop collisions and drift-proofing a design-locked IA.
4. **Pixel-level RunCard deltas (stat glyphs, city placement, footer hairline) are deferred** to P2 (built against real data) and P7 (polish); P0 is contract parity, not pixel parity.
5. **Migration slots `00000000000002`/`00000000000003` are used for points-tamper hardening** — the `runs` trigger rework (B4) and the `profiles` cache-column grant split (B5). P0 owns slots `…00`–`…09`, and "client never writes points" (PLAN §2) justifies closing both holes now rather than leaving them for P4's `complete_run`/ledger triggers. Column privileges (revoke + column-by-column re-grant) were chosen over a guard trigger for B5 because a BEFORE UPDATE trigger would also have to special-case the legitimate P4 definer-path writes; grants don't — `SECURITY DEFINER` functions and `service_role` keep full access.
6. **`database.types.ts` is committed to git** (not generated on demand), with a CI diff gate — keeps the client honest per PLAN §2 and makes schema drift a red PR.
7. **Google Maps API keys are not a P0 precondition** — no MapView renders in P0 and `app.config.ts` injects keys only when the env vars exist; keys become a P2 precondition.
8. **EAS scope in P0 = `eas init` + one Android cloud dev build; iOS cloud builds deferred to P1** where the Apple Developer account is mandatory anyway (Guideline 4.8 / Sign in with Apple). Local `expo run:ios` proves the iOS boot gate.
9. **CI db job uses full `supabase start`** (not `db start`) so `seed.sql` and the auth login path are exercised, plus pinned CLI version, types-drift and seed-login probe steps — an extension of PLAN §1's "typecheck + lint + supabase db lint" row, not a contradiction.
10. **Lint is standardized to `expo lint --max-warnings 0` via the npm script** in both local and CI (the existing CI arg form `-- --max-warnings 0` is suspect; D1 verifies empirically).
11. **`reactCompiler` and `typedRoutes` experiments stay enabled** (plugin present in lockfile; typed routes' fresh-clone looseness documented rather than worked around).
12. **Easing tokens (`--ease-out/in/spring`) and web layout tokens (`--screen-w`, `--maxline`) are intentionally not in `theme.ts`**; easing constants land with the first phase that animates beyond press states (P2). Motion durations + press scale are already ported.
13. **Status bar style is set per-screen** (`light` on the dark Welcome) rather than making the root dynamic — only one dark screen exists in P0.
14. **Gallery route ships in production builds but unlinked** (`__DEV__` gate on the Explore link only) — matches PLAN §4 "Gallery at /dev/components" and the component's "not linked in production UI" comment without route-level build gymnastics.
15. **Seed-login verification is done via the Auth REST password grant (curl)** since no sign-in UI exists until P1 — this also becomes the standing CI probe.
16. **`devSignIn` escape hatch and auth/create stub screens remain untouched** — their removal/implementation is P1/P2 scope by design (comments in the files say so).
17. **Type generation is pinned to `--schema public`** in `db:types`, `db:types:check`, and the D2 CI drift step. `config.toml` exposes `public, storage, graphql_public` to the API; without the flag, generated output embeds the storage-api schema bundled with the CLI, so the drift gate would flap on CLI upgrades that touch storage internals the app never queries. The app consumes only `public` tables/RPCs (storage goes through the supabase-js storage client, untyped by design).

## Out of scope (deferred)

- Real authentication (email/Apple/Google), removal of `devSignIn`, `onboarding/` routes, hosted Supabase project, Strava/Garmin program applications — **P1**.
- `Input`, `IconButton` component ports (needed by auth forms) — **P1**; `Tabs`, `Badge`, `Avatar`, `RatingStars`, `StatBlock`, `MapPin`, `RouteMarker` ports — **P2**.
- Explore map (react-native-maps wrapper, clustering, `runs_within_radius` consumption), full create wizard (`create/location|details|review`), `run/[id]/*`, `explore/*`, `invite/[code]` routes, Google Maps API keys — **P2**.
- `conversations`/`messages`/`notifications`/`push_tokens` tables, `send-push` implementation, pg_cron reminders — **P3**.
- `run_tracks`/`reviews`/`points_ledger`/`levels`, `complete_run`, background GPS — **P4**.
- Badges/leaderboard/safety tables, report/block, settings screens — **P5**; `connected_accounts` — **P6**.
- Pixel-perfect visual pass, empty/error/offline states, accessibility audit, store assets — **P7**.
- iOS EAS cloud builds and Apple credentials — **P1** (decision 8).
