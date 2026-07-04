# Run Everywhere — Production Tech Stack & Implementation Plan

**Status:** approved · **Date:** 2026-07-02 · **Owner:** solo indie developer

Run Everywhere is a social running app: runners create runs (DISCOVER / CHALLENGE / SOCIAL), discover them on a city map, request to join with host approval, chat per run, record runs with GPS, and earn points, reviews, badges and a weekly city leaderboard. The design source of truth is the handoff bundle in [`run-everywhere-app-design/`](../run-everywhere-app-design/) — tokens in `project/tokens/*.css`, component contracts in `project/components/**/*.d.ts`, flows in `project/*.dc.html`.

Guiding constraint: **one person maintains this.** Every choice below favors proven, stable, low-operations technology over the newest option. All versions were verified current & stable on 2026-07-02.

---

## 1. Stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| App framework | Expo SDK (React Native, TypeScript) | **~56.0.13** (RN 0.85.3, React 19.2.3) | Current-minus-one: SDK 57 shipped days ago; SDK 56 has ~6 weeks of patch releases and ~1 year of support ([upgrade docs](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)). Upgrade once per ~6 months in a dedicated branch. |
| Routing | expo-router | ~56.2.12 | SDK-aligned, file-based, typed routes. Use the basics only. |
| Backend | Supabase — Postgres 15 + PostGIS, Auth, Realtime, Storage, Edge Functions (Deno 2.x) | supabase-js **^2.110.0** | One managed service covers geo queries, auth, realtime chat, image storage. SQL + RLS fits the relational domain (requests, reviews, ledger). [PostGIS guide](https://supabase.com/docs/guides/database/extensions/postgis). |
| Maps | **react-native-maps, Google provider on both platforms** | 1.27.2 (SDK 56's tested version; 1.29 is latest upstream) | Google's native mobile SDKs are free with unlimited usage ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)); one custom light JSON map style on iOS and Android; markers/polylines/user-location battle-tested. `expo-maps` is still alpha — rejected. Clustering via **supercluster ^8** driving plain `<Marker>`s. All map usage goes through one wrapper component so a MapLibre swap stays a one-module change. |
| Server state | @tanstack/react-query | ^5.101.2 | Cache + optimistic updates for all Supabase reads. |
| Client state | zustand | ^5.0.14 | Wizard drafts, live-run session. No boilerplate. |
| Styling | Plain `StyleSheet` + typed tokens in `src/theme/theme.ts` | — | ~13 components; no NativeWind means no Babel/Metro plugins to break on SDK upgrades. |
| GPS recording | expo-location + expo-task-manager | ~56.0.x | First-party; recording is an explicit user-started bounded session (Android foreground service, iOS background location mode). Escape hatch if field tests fail: Transistorsoft react-native-background-geolocation (paid). |
| Push | expo-notifications + Expo Push Service | ~56.0.19 | Free; one API for FCM v1 + APNs ([docs](https://docs.expo.dev/push-notifications/sending-notifications/)). Direct FCM/APNs possible later without client changes. |
| Auth providers | Supabase email/password + `expo-apple-authentication` + `@react-native-google-signin/google-signin` ^16 | — | Sign in with Apple is mandatory when offering Google login (App Store Guideline 4.8). |
| Utilities | @gorhom/bottom-sheet ^5 · @react-native-community/datetimepicker · zod ^3 · @mapbox/polyline ^1 · date-fns ^4 · lucide-react-native (design's icon spec) · expo-image · Sentry (free tier) | — | All proven. Native modules are added with `npx expo install` in the phase that needs them. |
| Fonts | Saira + Saira Condensed, static TTFs bundled in `assets/fonts/` | — | Design readme requires local bundling in production (no Google Fonts CDN at runtime). |
| Build/deploy | EAS Build/Submit/Update — free tier: 15+15 builds/mo, OTA ≤1k MAU ([plans](https://docs.expo.dev/billing/plans/)) | — | CI (GitHub Actions): typecheck + lint + `supabase db lint`. |

**Design reconciliation** (the two prototype sets disagree; `project/tokens/` + `project/readme.md` "Decisions locked" are canonical): Social = **purple `#7C5CFC`** (not green), body font = **Saira** (not Hanken Grotesk), Volt `#CCFF00`, Discover `#1463FF`, Challenge `#FF3D2E`; green `#00C271` is the "go" signal only.

## 2. Architecture

Single repo: Expo app at root (`src/app/` routes, `src/` code), `supabase/` (migrations = schema source of truth, Edge Functions, seed), design bundle kept read-only.

Business logic lives in three strict tiers:

1. **Postgres (RLS + `SECURITY DEFINER` functions via RPC)** — anything involving capacity, points, or trust: `join_run()`, `respond_to_join_request()` (row-lock the run, check capacity, one transaction), `complete_run()` (points engine, P4), `submit_review()` (P4), `runs_within_radius()`. RLS on every table, default deny. `supabase gen types typescript` keeps the client honest (`npm run db:types`).
2. **Edge Functions (Deno)** — outbound HTTP + secrets: `send-push`, `strava-*`/`garmin-*` OAuth + webhooks, `live-share-page` (public token page for trusted contacts), `delete-account`.
3. **Client** — presentation and optimistic UX only. It never writes points, approvals, or rating aggregates.

Key mechanisms:

- **Points engine (server-authoritative).** `points_ledger` rows are inserted by `complete_run()` (finished +50, distance goal +20, on time +10) and `submit_review()` (rate crew +10), idempotent via `UNIQUE(user_id, run_id, reason)`. Triggers maintain `profiles.points_total`/`level` and award badges. `runs.points_reward` is computed at publish by `compute_points_reward()` — the same function backs the Create-step preview, so client and server cannot drift.
- **Chat.** Messages are persisted first (INSERT under RLS), delivered via **Realtime Broadcast-from-database** — a trigger calls `realtime.broadcast_changes()` to private channel `conversation:{id}`, authorized against `conversation_members`. This is Supabase's recommended scalable pattern over `postgres_changes` ([docs](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)). History via PostgREST + TanStack Query; unread counts from `last_read_at`; meeting-point/system messages are `messages.kind`.
- **Join state machine.** `run_members` status: `pending → approved | declined`, `pending|approved → cancelled` (runner), `approved → removed` (host). Open-visibility runs insert straight to `approved` (resolves a prototype ambiguity). Spots are always derived by counting approved members inside the locked transaction — never a stored counter.
- **Geo.** `runs.start_point geography(Point,4326)` + GIST index; discovery through `runs_within_radius(lat, lng, radius, filters…)`. City/area names via on-device reverse geocoding (expo-location — free, no key). Recorded tracks are stored as **encoded polyline + summary stats** in `run_tracks`, raw GPS samples gzipped to Storage for future reprocessing; v1 never queries inside a track spatially, and polylines are ~10× smaller and render directly.
- **Push pipeline.** `notifications` INSERT (SQL functions + `pg_cron` T-60min reminders) → `pg_net` trigger → `send-push` Edge Function → Expo Push API, with receipt checks pruning dead tokens. The in-app notification center reads the same table, so badge counts and push never disagree.

## 3. Data model

Migration `0001_core.sql` (shipped in this scaffold): enums, `profiles` (auth-trigger-created; bands, languages, units, visibility, cached points/level/rating), `runs` (host, type, status, visibility, invite_code, `start_point`, area/city, distance 1–42 km, max_group 2–30, target pace, `starts_at`, closed_loop, points_reward), `run_members` (state machine + intro message), `favorites`, RPCs `join_run` / `respond_to_join_request` / `get_run_by_invite` / `runs_within_radius` / `compute_points_reward`.

Later migrations add: **P3** `conversations`, `conversation_members`, `messages`, `notifications`, `push_tokens` (+ broadcast trigger) · **P4** `run_tracks`, `reviews` (stars 1–5, tags[], note ≤200, `UNIQUE(run_id, reviewer_id, reviewee_id)`), `points_ledger`, `levels` · **P5** `badges`/`user_badges`, `leaderboard_weekly` view (ISO week × city), `safety_contacts` (≤5 trusted + 1 emergency), `live_share_sessions`/`live_locations`, `blocks`, `reports` · **P6** `connected_accounts` (OAuth tokens in Supabase Vault).

## 4. App structure

Routes (in `src/app/`, template-canonical): `(auth)/` welcome, sign-in/up, forgot-password, `onboarding/` (4 steps) · `(tabs)/` index=Explore, runs, messages, profile — custom TabBar with the center Volt Create FAB · `create/` modal stack (type → location → details → review) · `run/[id]/` (+ request modal, manage, requests, roster) · `live/[runId]` · `recap/[trackId]` · `review/[runId]` · `chat/[conversationId]` · `user/[id]` · `explore/search|filters` · `notifications` · `settings/*` · `invite/[code]` deep link.

Design-system port: tokens in `src/theme/theme.ts` (1:1 from `project/tokens/*.css`); components port their `.d.ts` contracts directly — shipped in scaffold: `Button` (5 variants), `TypeChip`, `RunCard`, `TabBar`; remaining: `IconButton`, `Input`, `Tabs`, `Badge`, `Avatar`, `RatingStars`, `StatBlock`, `MapPin` (custom Marker child), `RouteMarker`. Gallery at `/dev/components`.

## 5. Build order (each phase ends runnable)

Each phase has a detailed, executable implementation plan in [`docs/phases/`](phases/README.md).

| Phase | Weeks | Scope | Verify |
|---|---|---|---|
| [**P0 Foundation**](phases/P0-foundation.md) | 1 | This scaffold | Boots on both platforms; tabs navigate; gallery renders |
| [**P1 Auth + onboarding**](phases/P1-auth-onboarding.md) | 2–3 | Hosted Supabase project; email/Apple/Google sign-in; forgot password; 4-step onboarding (photo → Storage, home city via reverse geocode). **Apply for Strava Extended Access + Garmin dev program now.** | Full signup → onboarding → tabs; two-user RLS smoke test |
| [**P2 Core loop**](phases/P2-core-loop.md) | 4–7 | Explore map (custom light style, typed pins + km labels, clustering, user location), list/search/filters/sort, Create wizard (pin drop + reverse geocode + points preview), Run detail + request-to-join, host inbox, manage/edit/cancel, invite links | Create → discover → request → approve across two devices |
| [**P3 Chat + notifications**](phases/P3-chat-notifications.md) | 8–9 | Group chat + DMs (Broadcast), unread counts, notification center, push pipeline, pg_cron reminders | Realtime A→B; push with app killed; reminder fires |
| [**P4 Live run + points + reviews**](phases/P4-live-run-points-reviews.md) | 10–13 | Background GPS recording (iOS `UIBackgroundModes: location`, Android foreground service), smoothing + D+, live trace/stats, `complete_run` + ledger, animated recap, rate-the-crew, history | Real outdoor run with screen locked; points idempotent; rating aggregates update |
| [**P5 Gamification + profile + safety**](phases/P5-gamification-profile-safety.md) | 14–16 | Levels/badges/leaderboard, full profiles, report/block, settings, trusted contacts + live-share page + SOS (compose-SMS only) | Leaderboard across week boundary; blocked user disappears everywhere; share URL works in a plain browser |
| [**P6 Integrations**](phases/P6-integrations.md) | 17–19 | HealthKit first (no external approval), then Strava + Garmin behind feature flags | Recorded run appears in Apple Health; Strava import for test athlete |
| [**P7 Hardening + stores**](phases/P7-hardening-stores.md) | 20–22 | Empty/error/offline states, deep-link QA, accessibility, privacy manifests, review notes + demo video, EAS Submit, staged rollout | App Store + Play submissions accepted |

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Background GPS battery/permissions (OEM task killers, iOS "Always" prompts) | Foreground-service recording with persistent notification; permission requested at first run start; accuracy filtering; Transistorsoft as paid escape hatch |
| iOS review: background location, Guideline 4.8, safety claims | Apple sign-in from day one; reviewer notes + demo video; SOS = compose SMS, never claim emergency dispatch |
| **Strava API restrictions (June 2026):** Standard tier capped at 10 athletes, requires dev's Strava subscription, Extended Access review ([announcement](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428)) | Apply in P1; feature-flag; HealthKit is the guaranteed integration |
| Garmin production-key review lead time | Apply in P1; same feature-flag pattern |
| Map vendor/pricing change | Google mobile SDK currently $0 unlimited; single MapView wrapper isolates a MapLibre swap; avoid paid Places API (DB search + native geocoder) |
| Supabase Realtime quotas (200 free / 500 Pro concurrent) | Broadcast-from-DB pattern; subscribe only to the visible conversation + live run |
| Solo burnout | Demoable app every 2–3 weeks; integrations last; zero self-managed servers |

## 7. Costs (monthly)

- **0–1k MAU:** Supabase Free→Pro $0–25, EAS free, Google Maps $0, Expo Push $0, Sentry free, Apple Developer ~$8 amortized → **≈ $10–35/mo**
- **10k MAU:** Supabase Pro + usage ≈ $50–90, EAS Starter $19 → **≈ $80–150/mo** (EAS Production $199 only if full-fleet OTA matters)
