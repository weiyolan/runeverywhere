# P7 — Hardening + Stores (Weeks 20–22)

| | |
|---|---|
| **Depends on** | P1 (auth + deep-link reset flow, legal pages on Netlify, `docs/integrations/applications.md`) · P2 (all core-loop routes, `AppMap` wrapper, `qk` query-key schema, invite links) · P3 (notifications pipeline + Android channels + `deepLinkFor` map in `send-push`) · P4 (recording, recap animations, `field-tests.md` protocol, mi-units deferral) · P5 (settings suite incl. `delete-account`, blocks/reports, live-share page, SOS copy) · P6 (HealthKit + Strava/Garmin flags, `connected_accounts` — adjusts privacy declarations; see Preconditions) |
| **Provides to later phases** | Shipped v1.0.0 in both stores; `EmptyState`/`ErrorState`/`OfflineBanner` components; offline-aware `queryClient`; Sentry crash reporting + source maps; EAS Update channels + OTA policy; release/rollback runbook (`docs/release-runbook.md`); store metadata + reviewer-notes source files under `docs/store/` |
| **Verify gate ([PLAN.md §5](../PLAN.md))** | "App Store + Play submissions accepted" |

## Goal

Turn the feature-complete app into a shippable product: a systematic empty/error/offline pass over every route, a deep-link and accessibility QA matrix, performance guardrails, Sentry crash reporting with source maps, and full store compliance (iOS privacy manifest + nutrition labels, Play Data Safety + foreground-service declaration, background-location reviewer notes + demo video, Guideline 4.8/5.1.1(v)). Week 20 is audit + fixes, week 21 is store prep + external betas, week 22 is submission with the whole week reserved for the rejection/resubmission loop. No new product features; the only new components are the shared Empty/Error state pair and the offline banner.

## Definition of done

1. The Workstream A route table is fully executed: every route renders a designed empty state, a retryable error state, and defined offline behavior; a screenshot per route/state is archived in `docs/store/qa-screens/` (used later for store screenshots too).
2. `src/lib/queryClient.ts` wires `onlineManager` (NetInfo) + `focusManager` (AppState), retry policy that never retries 4xx/RLS/auth errors, and `networkMode: 'offlineFirst'` for queries; airplane-mode toggles the `OfflineBanner` in < 2 s and cached screens stay browsable.
3. `src/app/+not-found.tsx` exists; any unknown URL (e.g. `runeverywhere://nope`) lands there and EXPLORE RUNS recovers to `(tabs)`.
4. Invite deep links opened signed-out are preserved: after sign-in (+ onboarding for new users) the app lands on the invited run (reverses P2 Decision #16).
5. Every row of the Workstream B deep-link matrix passes on one iOS and one Android physical device, cold start and warm start.
6. `profiles.units = 'mi'` renders correctly on every distance/pace surface (Explore, cards, detail, live, recap, history) — closes P4's explicit deferral.
7. Every `IconButton`, map pin, tab, toggle, and star control has an `accessibilityLabel`/role; `npm run typecheck` fails on an unlabeled `IconButton` (required prop, C1 — no lint rule needed).
8. VoiceOver (iOS) and TalkBack (Android) walks of the 5 core flows (C4) complete without dead ends; issues found are fixed or logged with rationale.
9. Contrast audit table (C2) verified: text-on-Volt ≥ 4.5:1 (measured ≈ 16.7:1 — AAA), and the two known large-text-only pairs are confined to large/bold uses.
10. Reduced motion honored: with OS reduce-motion on, recap ring/count-up/draw-on render final state instantly, pulse loops stop, and the live-share web page disables its CSS pulse via `prefers-reduced-motion`.
11. Dynamic type at the largest non-accessibility iOS setting (and Android font scale 1.3): no clipped or overlapping text on the 10 audit screens in C3.
12. With a 500-run seeded map region, Explore pan/zoom stays fluid (no frame-drop bursts in perf monitor); rendered markers are capped and `tracksViewChanges` is false after first render.
13. Sentry receives a symbolicated crash from a **production** build of each platform (test event fired via D4's hidden trigger — 7 taps on the `settings/index` version row), and from an EAS Update bundle (source maps uploaded both paths).
14. Built IPA contains the aggregated `PrivacyInfo.xcprivacy` with the four required-reason API categories; App Store Connect App Privacy labels and the Play Data Safety form are submitted per the E2/E3 tables.
15. Reviewer notes (E4) + demo video are attached in both consoles; the seeded reviewer account signs in on a clean install against production.
16. Guideline 4.8 + 5.1.1(v) checklist passes: Apple sign-in present and listed first on iOS auth screens, account deletion reachable in-app (Profile → Settings → Account & security → DELETE ACCOUNT), and a web deletion-instructions page is linked in Play Data Safety.
17. `eas.json` production profiles build both platforms; `expo-updates` configured with `runtimeVersion: { policy: 'fingerprint' }` and channels `preview`/`production`; the OTA policy section in `docs/release-runbook.md` is written.
18. Rollback drill executed on the `preview` channel: publish an update, `eas update:republish` the previous group, device reverts on next launch.
19. Play closed test satisfied the 12-testers/14-consecutive-days production-access requirement (if the account is a post-Nov-2023 personal account) and the pre-launch report shows no crashes/ANRs; TestFlight external beta ran with ≥ 10 testers and Beta App Review passed.
20. iOS submitted with phased release ON; Android production rollout started at 10 % staged.
21. **Both submissions reach "Approved"/"Released" state** — the verify gate. Rejections are handled via the H2 playbook within the week-22 reserve.
22. CI green: `npm run typecheck`, `npm run lint`, `supabase db lint`, `npm run db:types && git diff --exit-code src/types/database.types.ts`.

## Preconditions

| Precondition | How to check |
|---|---|
| P5 verify gate passed (blocks everywhere, share URL in plain browser, deletion works) | Run P5's verification script steps 6, 10, 12 |
| P6 verify gate passed, or P6 features flagged OFF for launch | Recorded run appears in Apple Health; Strava import works for a test athlete — or both flags off. Either way read `docs/phases/P6-*.md` + `supabase/migrations/0000000000006*.sql` and audit: the connected-apps settings route name, HealthKit purpose strings, `connected_accounts` columns. **Privacy declarations E2/E3 have conditional Health rows — pick per what actually ships** |
| Migrations ≤ `0000000000006x` local == hosted | `supabase migration list` |
| Apple Developer Program active; App Store Connect access | developer.apple.com → Membership (P1 precondition) |
| **Google Play Console account exists and identity-verified — created as early as possible** | play.google.com/console. If it is a *personal* account created after 2023-11-13, production access requires a closed test with **≥ 12 opted-in testers for 14 consecutive days** ([Play policy](https://support.google.com/googleplay/android-developer/answer/14151465)) — the closed test must START on week-20 day 1 (Workstream G1) or the week-22 submission slips |
| 12+ Android testers recruited (friends/run club) with opt-in emails collected | List in `docs/store/beta-testers.md` (emails only, gitignored if preferred) |
| Sentry account (free tier) with org + project `runeverywhere` created | sentry.io → copy DSN, org slug, project slug |
| EAS project linked, paid-tier not required | `app.config.ts` `extra.eas.projectId` non-empty; `eas build:list` works |
| Legal pages live on Netlify (P1) + access to redeploy them | Open the URLs in `docs/integrations/applications.md`; Netlify login works (E3/B4 add pages) |
| Two physical devices (1 iOS ≥ iOS 17, 1 Android ≥ 13) + one desktop browser | For the QA matrix, screen-reader walks, and live-share check |
| CI workflow from PLAN.md §1 exists (typecheck + lint + db lint) | `.github/workflows/` — if absent, create it in Workstream I (it is a one-file catch-up, not a blocker) |

## Workstreams

Week 20 = A–D (audit + fixes). Week 21 = E–G (store prep + betas). Week 22 = H–I (submit + reserve).

### A — Empty / error / offline systematization

**A1. Install + rebuild.** `npx expo install @react-native-community/netinfo @sentry/react-native expo-updates` (all three native modules batched into ONE dev-client rebuild here; Sentry/Updates are configured in D4/F2 but installed now). JS-only: none. Rebuild dev clients (`npx expo run:ios` / `run:android`). Acceptance: `NetInfo.fetch()` resolves on device.

**A2. Shared state components (the only new components this phase).**
- `src/components/ui/EmptyState.tsx` — port of the design's one canonical empty pattern (Discover Flow "No runs match" block: 60 px `paper3` circle with a 28 px `ink300` lucide icon, title `SairaCondensed-ExtraBold` 22 uppercase, body `textStyles.caption` centered, optional volt `Button`). Props: `{ icon: LucideIcon; title: string; body?: string; actionLabel?: string; onAction?: () => void; compact?: boolean }` (`compact` = smaller paddings for in-tab use).
- `src/components/ui/ErrorState.tsx` — same layout, fixed icon `alert-triangle` in `colors.warn`, defaults `title="SOMETHING WENT WRONG"`, `body="Check your connection and try again."`, `retryLabel="TRY AGAIN"`; props `{ title?, body?, retryLabel?, onRetry: () => void, compact? }`. When `onlineManager.isOnline()` is false it swaps body to "You're offline — we'll retry when you're back." automatically.
- `src/components/OfflineBanner.tsx` — NetInfo-subscribed ink900 bar pinned under the top safe-area inset, text "OFFLINE — SHOWING SAVED DATA" (`eyebrow` style, `paper` color), 200 ms slide (skipped under reduced motion). Mounted once in `src/app/_layout.tsx` above the `Stack`. Debounce 1 s to avoid flicker on network blips.
- Add all three to `/dev/components`. Acceptance: gallery renders; airplane mode toggles the banner.

**A3. `src/lib/queryClient.ts` — offline/retry defaults (exact content).**
```ts
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { QueryClient, onlineManager, focusManager } from '@tanstack/react-query';

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((s) => setOnline(!!s.isConnected)));
AppState.addEventListener('change', (st) => focusManager.setFocused(st === 'active'));

const isClientError = (err: unknown) => {
  const code = (err as { code?: string; status?: number }) ?? {};
  return (typeof code.status === 'number' && code.status >= 400 && code.status < 500)
    || (typeof code.code === 'string' && /^(PGRST|42501|22|23)/.test(code.code));
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,          // cached screens stay browsable offline for the session
      retry: (count, err) => !isClientError(err) && count < 2,
      networkMode: 'offlineFirst',           // render cache immediately; fetch when online
      refetchOnReconnect: true,
    },
    mutations: { retry: 0, networkMode: 'online' }, // RPCs must not auto-repeat (join_run errors on replay)
  },
});
```
No cache persistence to disk in v1 (Decisions). Acceptance: with airplane mode on, Explore/Your Runs/Messages render last data + banner; a mutation fails fast with the ErrorState/inline error, no hang.

**A4. `src/app/+not-found.tsx`** — expo-router unmatched-route screen: `EmptyState icon={compass} title="NOTHING HERE" body="That link doesn't go anywhere anymore." actionLabel="EXPLORE RUNS" onAction={() => router.replace('/(tabs)')}`. Register nothing (file convention handles it). Acceptance: `npx uri-scheme open "runeverywhere://bogus/path" --ios` lands here; button recovers.

**A5. Gate the dev gallery.** `src/app/dev/components.tsx`: first line `if (!__DEV__) return <Redirect href="/" />;`. Acceptance: production build cannot open it via deep link. (This deliberately does NOT gate the Sentry test-crash trigger — production builds need one for DoD 13, so it lives behind D4's hidden version-row gesture, not here.)

**A6. Units pass (closes P4 deferral).** Extend P2's existing `src/lib/format.ts` (P2 D2 created it unit-less, and P2 mandates every screen already routes through it) — this is a **migration of that module, not a new one**: add a `units` parameter to the distance/pace helpers, renaming `formatKm` → `formatDistance(km, units)` (`'5.2 km'` / `'3.2 mi'`, factor 0.621371) and changing `formatPace` → `formatPace(sPerKm, units)` (`'5:30 /km'` / `'8:51 /mi'`, s-per-mi = s-per-km / 0.621371); add `formatElevation(m, units)` (m / ft ×3.28084). The signature change deliberately breaks every P2–P5 call site — `npm run typecheck` is the sweep checklist; update them all in one sitting. `formatPinLabel`, `spotsLeft`, `formatWhen`, and `formatAway` stay untouched (Explore pins keep **km labels on the map** regardless — pin labels are part of the map's visual system and `runs.distance_km` is the stored truth; Decisions). Route any distance/pace/D+ rendering that P3–P5 left inline through these helpers too, passing `useSession().profile.units`. Acceptance: flip `settings/preferences` to MI → cards, detail, live console, recap, history all switch; DB values unchanged.

**A7. Route-by-route audit + fixes — THE TABLE.** Every route from [PLAN.md §4](../PLAN.md) (+ the P5/P6 additions). For each row: verify the listed states exist (most shipped with their phase — this is enforcement, not re-design), replace any ad-hoc inline error/empty views with `EmptyState`/`ErrorState`, and implement the **Offline** column exactly. Copy shown is final (uppercase titles; sentence-case bodies; no emoji).

| Route | Empty state | Error state | Offline behavior |
|---|---|---|---|
| `(auth)/welcome` | n/a (static) | n/a | Fully usable (static) |
| `(auth)/sign-in`, `sign-up` | n/a (forms) | Inline field errors (P1) | Submit fails fast → inline "You're offline — try again when connected." |
| `(auth)/forgot-password` | n/a | Expired/cross-device link copy (P1) | Same inline offline error |
| `onboarding/*` (4 steps) | n/a (forms) | Photo upload / geocode failure inline (P1) | Save blocked with inline error; draft state survives (store) |
| `(tabs)/index` Explore map | "NO RUNS MATCH" + "Try widening your filters to see more runs near you." + CLEAR FILTERS (design copy, Discover Flow) ; separate location-denied state: "TURN ON LOCATION" + body + OPEN SETTINGS | `ErrorState` overlay on the sheet area, map stays | Cached pins render; SEARCH THIS AREA disabled; banner |
| Explore list mode | Same empty as map | `ErrorState compact` | Cached list |
| `explore/search` | "NO RUNS FOUND FOR "{q}"" + "Try an area name or shorter word." (P2) ; pre-query: recents/suggestions | `ErrorState compact` under the field | Recents render; querying shows offline error |
| `explore/filters` | n/a (local state) | n/a | Fully usable; APPLY returns to cached results |
| `(tabs)/runs` (ALL/MANAGED/JOINED/PAST) | Per-tab: "NO RUNS YET" + "Join a run or host your own." + EXPLORE RUNS ; PAST: "No completed runs yet — join one and hit START." (P4) | `ErrorState compact` per tab | Cached tabs |
| `(tabs)/messages` | "NO CONVERSATIONS YET" + "Join a run to unlock its group chat." + EXPLORE RUNS (P3) | `ErrorState compact` | Cached list; unread pills frozen |
| `(tabs)/profile` | n/a (own profile always exists) | `ErrorState` full | Cached profile |
| `create/*` (4 steps) | n/a (wizard) | Publish failure inline on review step; draft preserved (P2 zustand) | PUBLISH RUN disabled-with-toast when offline ("You're offline — your draft is saved.") |
| `run/[id]` | Not-found → `EmptyState` "RUN NOT FOUND" + "It may have been cancelled or the link is stale." + EXPLORE RUNS ; cancelled → banner (P2) | `ErrorState` full | Cached detail; JOIN/REQUEST buttons disabled + toast |
| `run/[id]/request` (modal) | n/a | RPC errors surfaced ("run is full", P2) | Send disabled offline |
| `run/[id]/requests` | "NO REQUESTS YET" + "Share the run to fill the remaining spots." + SHARE RUN | `ErrorState compact` | Cached; ACCEPT/DECLINE disabled |
| `run/[id]/manage` | n/a (form) | Validation + save errors inline | Save disabled offline |
| `run/[id]/roster` | Host-only run: "NOBODY'S IN YET." | `ErrorState compact` | Cached |
| `live/[runId]` | n/a | RPC-finish failure → P4's "SAVING FAILED — your run is safe on this phone." retry screen | **Recording continues fully offline** (GPS is local); live-share upserts silently skipped (P5); finish waits via the salvage path |
| `recap/[trackId]` | n/a | `ErrorState` full (params-passed data still renders after F3 arrival) | Renders from nav params; refetch when back online |
| `review/[runId]` | Crew of 1 (host solo): "NOBODY TO RATE" + DONE | Duplicate-review + RPC errors inline (P4) | SUBMIT disabled offline |
| `chat/[conversationId]` | New run chat: host sees the meeting-point ghost card (P3) | First-page `ErrorState`; per-message send-failure tap-to-retry (P3) | Cached history; sends fail → retry affordance persists |
| `user/[id]` | Unavailable / limited / blocked-by-me states (P5) | `ErrorState` full | Cached |
| `notifications` | "NOTHING YET" + "Go find a run." + EXPLORE RUNS (P3) | `ErrorState` full | Cached; MARK ALL READ disabled |
| `rewards` | Leaderboard: "NO POINTS IN {CITY} YET THIS WEEK" + "Finish a run." ; no home city → SET YOUR CITY → edit-profile (P5) | `ErrorState compact` per section | Cached |
| `settings/index`, `legal`, `preferences`, `notifications` | n/a (static/forms) | Optimistic-toggle rollback + toast (P5) | Toggles roll back with toast when offline |
| `settings/edit-profile`, `account`, `safety` | n/a (forms) | Inline save/upload errors | Saves disabled offline; DELETE ACCOUNT requires connectivity (Edge Function) — button disabled + note |
| `settings/blocked` | "NOBODY BLOCKED. Hopefully it stays that way." (P5) | `ErrorState compact` | Cached |
| Connected-apps settings (P6 route — audit exact name) | Per P6 plan (disconnected state) | Per P6 plan | Connect/disconnect disabled offline |
| `invite/[code]` | Invalid → "THIS INVITE LINK IS INVALID or the run is no longer live." + EXPLORE RUNS (P2) | `ErrorState` (resolution failed ≠ invalid: offline shows retry, not "invalid") | **Fix**: only show "invalid" on a definitive empty RPC result; network failure → `ErrorState` |
| `dev/components` | dev-only (A5) | — | — |
| `+not-found` | Itself (A4) | — | Static |

Acceptance: for each row, capture light-mode screenshots of empty/error/offline into `docs/store/qa-screens/<route>-<state>.png` (device screenshots; also feeds F7 store listings). Grep check: `rg "Something went wrong|try again" src/app src/components` shows only the shared components.

### B — Deep-link QA matrix + link fixes

**B1. Pending-link preservation (fix).** `src/lib/pendingLink.ts`: zustand-persisted (`AsyncStorage`) single slot `{ url: string; setAt: number }` with `capture(url)` / `consume(): string | null` (expires after 30 min). Wire: (a) `invite/[code]` and the P3 notification cold-start handler call `capture` when `useSession().status !== 'signedIn'` or onboarding incomplete, then let AuthGate route normally; (b) P1's AuthGate, at the moment it routes a signed-in + onboarded user to `(tabs)`, calls `consume()` and `router.push(url)` instead when non-null. Reverses P2 Decision #16 by design. Acceptance: cold-open an invite link signed-out → welcome → sign in → land on the run detail with JOIN.

**B2. Notification cold-start race (fix-if-broken).** Audit P3 E4: `getLastNotificationResponseAsync` must not `router.push` before the root layout + session resolve. Route the URL through `pendingLink.capture` unconditionally and let AuthGate consume it — one mechanism for both cases. Acceptance: kill app → tap a chat push → cold start lands in the right chat, not a dropped navigation.

**B3. Web bounce page for invites (fix).** Custom-scheme URLs (`runeverywhere://invite/…`) are not tappable in iOS Messages/most mail clients. Add `invite.html` to the Netlify legal site: reads `?code=`, immediately tries `location.href = 'runeverywhere://invite/' + code`, and shows a fallback card with "GET THE APP" store links + the code. Raw interpolation into both the query string and the scheme URL's path segment is safe because P2's `…22` migration made invite codes URL-safe base64 (`[A-Za-z0-9_-]` only — no `+`/`/`); the page still `encodeURIComponent`s the code as belt-and-braces. Change the share message (P2 H2, `run/[id]` + manage) to `https://<netlify-site>/invite.html?code={invite_code}`. Full universal links / Android App Links stay deferred (Decisions). Acceptance: link tapped from a real SMS on both platforms opens the app when installed; opens the fallback page when not.

**B4. Hosted auth email settings.** Dashboard → Auth: turn **email confirmations ON** for production (P1 deferred this decision here) and configure **custom SMTP** (Resend free tier — Supabase's built-in sender is rate-limited to a few emails/hour and not for production; verify current limits at execution). Confirmation + email-change links redirect to `runeverywhere://` (already in Redirect URLs); the app shows a "Email confirmed — log in." toast on that deep link (small handler in AuthGate). Sign-up already handles the `needsEmailConfirm` flag (P1 F1). Acceptance: fresh sign-up receives mail via Resend; tapping the link opens the app with the toast; unconfirmed sign-in shows the Supabase error inline.

**B5. The matrix.** Execute every row on both platforms; record pass/fail + build number in `docs/store/deeplink-matrix.md` (a checked-off copy of this table). Fixtures: rows 1–4 use the deterministic seeded code `DEVLINK01` — present locally via `seed.sql` (P2) and on hosted via the E4 SQL-editor seeding; row 5 uses a **freshly created** invite run (maya account) so a real *generated* code (P2 `…22` URL-safe default, `[A-Za-z0-9_-]`) is exercised, not just the fixture.

| # | Link / trigger | Entry state | Expected |
|---|---|---|---|
| 1 | `runeverywhere://invite/DEVLINK01` | Signed in, warm | `run/[id]` via `get_run_by_invite`, instant JOIN visible |
| 2 | Same | Signed in, cold (app killed) | Same, after splash |
| 3 | Same | Signed out, cold | Welcome → sign in → **replayed** to run detail (B1) |
| 4 | Same, invalid code | Any | Invalid-invite EmptyState (not error) |
| 5 | `https://<site>/invite.html?code=<fresh code>` from SMS (invite run created ad hoc as maya — generated code, not `DEVLINK01`) | App installed | Bounce page → app opens on run detail |
| 6 | Password-reset email link | Signed out, same device | `forgot-password` reset mode → new password works (P1) |
| 7 | Password-reset link, expired / other device | Signed out | "That link expired — request a new one." |
| 8 | Sign-up confirmation email link (B4) | Signed out | App opens, "Email confirmed" toast, sign-in works |
| 9 | Email-change confirmation links (both inboxes) | Signed in | Change completes; `settings/account` shows new email |
| 10 | Push `join_request` tap | Killed / background / foreground | `/run/[id]/requests` (foreground for the visible run: no banner, P3) |
| 11 | Push `request_approved` / `request_declined` / `member_joined` tap | Killed | `/run/[id]` |
| 12 | Push `message` tap | Killed / background | `/chat/[conversationId]`; suppressed while that chat is on screen |
| 13 | Push `run_reminder` tap | Killed | `/run/[id]` |
| 14 | Push `run_completed` tap | Killed | `/review/[runId]` (P4 H6) |
| 15 | Push `review_received` tap | Killed | `/run/[id]` completed detail (P4 H6) |
| 16 | Push `badge_earned` / `leaderboard_weekly` tap | Background | `/rewards` (P5 D4) |
| 17 | Google OAuth round-trip | Sign-in screen, iOS (reversed-client-id scheme) + Android | Returns signed in; user-cancel returns silently |
| 18 | Apple sign-in sheet | iOS | Signs in; cancel returns silently |
| 19 | Live-share URL | Desktop Chrome + iOS Safari + Android Chrome (no app) | P5 page renders, polls, then "ended" after finish |
| 20 | `runeverywhere://bogus/path` | Cold | `+not-found` → EXPLORE RUNS recovers |
| 21 | Push tap for a since-deleted run | Killed | `run/[id]` not-found EmptyState (no crash) |

Commands: `npx uri-scheme open "<url>" --ios|--android`; push rows via real pushes from a second device (P3 script) or Expo push tool with the `data.url` payload.

### C — Accessibility pass

**C1. Labels + roles.**
- `src/components/ui/IconButton.tsx`: make `accessibilityLabel: string` a **required** prop (TS breaks every unlabeled call site — fix them all; ~25 sites: back, share, filter, bell, settings, edit, send, info, zoom/recenter, overflow, SOS). Set `accessibilityRole="button"`, `accessibilityState={{ disabled, selected: active }}`.
- Map pins: `AppMarker` children aren't focusable per-platform reliably — set on the `Marker` itself: `accessibilityLabel={"{TYPE} run, {distance}, {title}"}` for pins, `"{n} runs, tap to zoom"` for clusters; the Explore **list mode is the accessible equivalent** of the map (state this in code comments; VoiceOver users use LIST).
- `TabBar`: each item `accessibilityRole="tab"` + `accessibilityState={{ selected }}`, labels "Explore"/"Runs"/"Messages"/"Profile"; the FAB `accessibilityLabel="Create run"`. Unread dot → `accessibilityLabel="Messages, new messages"` variant.
- `RatingStars` interactive: `accessibilityRole="adjustable"`, `accessibilityValue={{ min:1, max:5, now:value }}`, increment/decrement actions.
- Switches/segments/chips (settings toggles, TypeChips, filter chips): `accessibilityRole="switch"|"radio"` + state; `Input` already carries its label (verify `accessibilityLabel` falls back to the label prop).
- Guard: no eslint rule — the required prop makes `npm run typecheck` the enforcement (DoD 7); record that decision in an `eslint.config.js` comment so nobody re-adds a redundant `no-restricted-syntax` rule later.
- Acceptance: VoiceOver rotor traverses Explore header, run detail, chat composer with meaningful announcements.

**C2. Contrast audit (compute once, record in code comments in `theme.ts`).** WCAG ratios for the locked tokens ([design readme "Decisions locked"](../../run-everywhere-app-design/project/readme.md) — tokens do NOT change):

| Pair | Ratio | Verdict / action |
|---|---|---|
| `voltInk #0B0B0C` on `volt #CCFF00` | ≈ 16.7:1 | AAA — the directive's text-on-Volt check passes |
| `paper` on `ink900` | ≈ 18.7:1 | AAA (dark consoles, recap) |
| `ink500 #6B6B73` on `paper2 #F5F5F3` | ≈ 4.8:1 | AA pass — `textSecondary` fine for body |
| `ink400 #8E8E96` on `paper` | ≈ 3.2:1 | **Large-text only.** Sweep: `textMuted` must not be used below 14 px non-bold for essential text; swap such uses to `ink500` (audit with `rg "textMuted|ink400" src/`) |
| `discoverInk` white on `discover #1463FF` | ≈ 4.9:1 | AA pass |
| White on `challenge #FF3D2E` | ≈ 3.5:1 | Large/bold only — TypeChip labels are 11–13 px bold: **accepted brand exception**, logged in Decisions; chips always co-exist with redundant text |
| White on `social #7C5CFC` | ≈ 4.4:1 | Borderline; same chip exception |
| `go #00C271` on `paper` | ≈ 2.3:1 | Never use go as text/icon-only signal on light surfaces — go text/dots live on ink backgrounds or `goSoft` chips with ink text (audit `rg "colors.go" src/`) |

**C3. Dynamic type sanity.** Set `maxFontSizeMultiplier`: 1.1 on hero metrics/timers (`textStyles.metric`, live timer, points ring), 1.3 on condensed display titles/buttons (they clip fast), unlimited (system default) on `body`/`caption`. Implement as constants in `theme.ts` (`fontScaleCaps = { metric: 1.1, display: 1.3 }`) applied at the ~10 audit screens: welcome, sign-in, Explore (both modes), run detail, create review, chat, live, recap, profile, settings hub. Test at iOS Text Size max (non-accessibility) + Android 1.3. Fix wraps/clips (usually `numberOfLines` + `flexShrink`).

**C4. Screen-reader walk — 5 core flows** (VoiceOver + TalkBack, one pass each, log issues in `docs/store/a11y-notes.md`):
1. Welcome → sign-up → 4-step onboarding → tabs.
2. Explore (LIST mode) → run detail → REQUEST TO JOIN → intro modal → sent state.
3. Create wizard type → location (pin-drop announces "Map. Double-tap to drop start point"; the address line is the accessible readback) → details → review → publish.
4. Messages → chat → compose + send → back; notification center → row tap.
5. Run detail → START RUN → live screen (timer announced via `accessibilityLiveRegion`/`accessibilityLabel` refresh ≤ 1/30 s — not every second) → FINISH → recap → rate one runner.

**C5. Reduced motion.** Use reanimated's `useReducedMotion()` (respects both platforms' OS setting): recap ring + count-up + route draw-on render final values immediately; live pulse dots become static; TabBar FAB spring → plain opacity; press-scale (0.96) may remain (micro-interaction, not vestibular). Live-share page (P5 Edge Function HTML): wrap the pulse keyframe in `@media (prefers-reduced-motion: no-preference)`. Acceptance: toggle iOS Reduce Motion → recap shows final state instantly, no loops anywhere.

### D — Performance + Sentry

**D1. Map guardrails.** In `(tabs)/index`: cap rendered markers at **120** post-clustering (slice by distance from center; supercluster already collapses density); `tracksViewChanges={false}` on all `AppMarker`s after first layout (re-enable for the selected pin only, briefly, when its selected style changes); memoize pin components (`React.memo` keyed on `runId|selected|kmLabel`); clamp `runs_within_radius` result client-side at 200 rows before clustering. Acceptance: seed a 500-run region locally (loop-insert SQL in scratch, not committed), pan/zoom with perf monitor — no sustained JS-thread stalls, marker count ≤ 120.

**D2. List virtualization check.** `rg -l "ScrollView" src/app` — any screen rendering unbounded server lists (Explore list, search results, runs tabs, messages, chat, notifications, reviews, leaderboard, blocked) must use `FlatList`/`SectionList` with stable `keyExtractor`; chat keeps `inverted` + `onEndReached` paging (P3); add `getItemLayout` where rows are fixed-height (notifications, leaderboard). Acceptance: 200-message seeded chat scrolls without blank flashes.

**D3. Image caching.** Audit every avatar/photo render uses `expo-image` with `cachePolicy="memory-disk"` and `recyclingKey` (list rows) — P2's `Avatar` already does; check chat bubbles, leaderboard, roster, reviews. `transition={100}` max. Acceptance: airplane mode → previously seen avatars still render.

**D4. Sentry install + source maps** (never wired before — PLAN.md §1 lists it; installed in A1). Per current Sentry/Expo docs ([Expo guide](https://docs.expo.dev/guides/using-sentry/), [source maps](https://docs.sentry.io/platforms/react-native/sourcemaps/uploading/expo/)):
- `app.config.ts` plugins: `['@sentry/react-native/expo', { organization: '<org-slug>', project: 'runeverywhere' }]`.
- Create `metro.config.js` (repo has none): `const { getSentryExpoConfig } = require('@sentry/react-native/metro'); module.exports = getSentryExpoConfig(__dirname);`.
- `src/app/_layout.tsx`: `Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, enabled: !__DEV__, tracesSampleRate: 0.2, sendDefaultPii: false, beforeSend: scrubGeo, beforeBreadcrumb: scrubGeo })` where `scrubGeo` strips `lat`/`lng`/coordinate-looking fields from event extras/breadcrumbs (GPS is sensitive; crash reports must not leak tracks); export root as `Sentry.wrap(RootLayout)`.
- Secrets: `EXPO_PUBLIC_SENTRY_DSN` in `.env` + EAS env vars (all environments); `SENTRY_AUTH_TOKEN` as an EAS **secret** env var (build-time source-map upload).
- EAS Update path: after every `eas update`, run `npx sentry-expo-upload-sourcemaps dist` (a bin shipped inside `@sentry/react-native`; baked into the release runbook, F5).
- **Hidden test-crash trigger** (production builds have no Expo dev menu, and A5 gates `/dev/components` — DoD 13 needs a production-reachable trigger): 7 consecutive taps on the app-version row in `settings/index` call `Sentry.captureException(new Error('p7-test'))` and show a "Test event sent" toast. It ships in the store binary: one handled event, no crash, no visible UI — inert and store-safe.
- Acceptance (DoD 13): the hidden version-row trigger fired in a production build shows a **symbolicated** stack in Sentry for both a store build and an OTA-updated bundle.

**D5. Startup sanity.** Verify splash hides only after fonts + session resolve (P0/P1 wiring); `npx expo export --platform ios` and inspect bundle size (< 10 MB JS is the expectation; investigate if wildly larger). No further optimization work in v1.

### E — Store compliance

All authored artifacts live in `docs/store/`: `reviewer-notes-ios.md`, `reviewer-notes-play.md`, `demo-video-script.md`, `privacy-declarations.md`, `listing-copy.md`.

**E1. iOS privacy manifest + Info.plist finals** ([Expo privacy manifests guide](https://docs.expo.dev/guides/apple-privacy/)). Expo aggregates library manifests at build time, but static-pod gaps mean we declare app-level reasons too. `app.config.ts` `ios` block adds:
```ts
privacyManifests: {
  NSPrivacyTracking: false,
  NSPrivacyTrackingDomains: [],
  NSPrivacyAccessedAPITypes: [
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
  ],
},
```
(The standard RN/AsyncStorage/Expo set; re-verify reason codes against Apple's current list at execution.) Also in `ios.infoPlist`: `ITSAppUsesNonExemptEncryption: false` (HTTPS-only exemption — kills the export-compliance prompt). Final **purpose-string copy pass** (the E6 table is the single source; paste values here). Acceptance: `npx expo prebuild --clean` → `ios/` contains `PrivacyInfo.xcprivacy` with the four categories; archive validates in EAS build logs.

**E2. App Store privacy nutrition labels** (App Store Connect → App Privacy). Declare exactly (all "linked to identity" **except Diagnostics, declared "not linked"** — see its row; none "used for tracking"):

| Data type | Collected? | Purpose | Notes |
|---|---|---|---|
| Name, Email | Yes | App functionality | Account (`profiles`, auth) |
| Photos | Yes | App functionality | Avatar upload only |
| Precise Location | Yes | App functionality | Run start points, discovery, GPS tracks (`runs.start_point`, `run_tracks`), live share |
| Coarse Location | Yes | App functionality | Home city |
| Health & Fitness (Fitness) | Yes | App functionality | Workout data: distance/pace/elevation tracks; **plus Strava/Garmin imports if P6 flags are ON**. HealthKit *write-only* export alone is not collection, but `run_tracks` already is fitness data → declare regardless |
| Messages | Yes | App functionality | In-app chat stored server-side |
| User Content (Other) | Yes | App functionality | Reviews, reports, **manually typed safety-contact names/numbers** (NOT the Contacts category — no address-book access; Decisions) |
| Contacts | **No** | — | `expo-contacts` never installed (P5 decision) |
| Identifiers (User ID) | Yes | App functionality | Supabase UUID, Expo push token |
| Diagnostics (Crash data) | Yes | App functionality | Sentry, not linked to identity (`sendDefaultPii: false`) — declare "not linked" |

**E3. Play Data Safety form + deletion URL.** Mirror E2 in Play's taxonomy: Location (precise + approximate; collected, not shared), Personal info (name, email), Photos, Messages (in-app), Health & fitness (conditional per P6 flags), App activity, Device IDs (push token), Crash logs. All: encrypted in transit; **deletion available**. Play requires an account-deletion URL: add `delete-account.html` to the Netlify legal site — instructions ("Profile → Settings → Account & security → Delete account" + support email fallback for users without the app) — and paste its URL into the form. Also complete: **Foreground service permissions declaration** (`FOREGROUND_SERVICE_LOCATION` — Play requires a video showing the persistent-notification recording; reuse the E4 demo video), Content rating questionnaire (UGC + user interaction + location sharing → expect Teen/12+; answer honestly), Ads declaration: none. Acceptance: prebuild manifest audit — `ACCESS_BACKGROUND_LOCATION` is **absent** (P4 posture; if P4's contingency flipped it, add Play's background-location declaration + amend the video).

**E4. Reviewer notes + demo video.**
- `docs/store/reviewer-notes-ios.md` (pasted into App Review notes), covering PLAN.md §6 verbatim requirements: (1) background location = **user-started, bounded run-recording session only** (iOS `UIBackgroundModes: location`; recording stops at FINISH; no passive tracking); (2) **SOS composes an SMS in the OS composer — the user sends it; the app never contacts emergency services and never claims to** (Guideline 1.4.1-adjacent safety claims); (3) live share = tokenized page, 12 h expiry, user-initiated; (4) UGC moderation per 1.2: block + report in-app (point at `user/[id]` overflow), ToS link, safety-team triage; (5) demo account credentials (below); (6) two-account tip: reviewer can see seeded runs in Lisbon region via the demo account. Play version = same content minus 4.8, plus foreground-service rationale.
- **Demo account**: seed on the hosted project `reviewer@runeverywhere.app` / strong password, onboarded, home city Lisbon, member of one active run with chat history, one completed run with recap/points, **plus the invite-visibility run with explicit `invite_code = 'DEVLINK01'`** (hosted twin of P2's Track Repeats fixture, hosted by maya — required by B5 matrix rows 1–4 and Verification step 6, which run on production builds against hosted). Mirror `seed.sql` fixtures via SQL editor — hosted has no seed. Email confirmations ON (B4) — pre-confirm this account via the dashboard.
- `docs/store/demo-video-script.md` (~90 s, one take per platform, screen-recorded): 1) sign in (demo account) → 2) Explore map, open a run → 3) START RUN → permission prompt (iOS Always / Android notification appears) → 4) lock screen 15 s, show persistent notification / location indicator → 5) unlock, stats advanced → 6) toggle live share + show the browser page on a laptop in frame → 7) press-and-hold SOS → **OS SMS composer opens pre-filled, then CANCEL** (proves compose-only) → 8) FINISH → recap. Upload unlisted (YouTube/Drive) + link in both consoles.

**E5. Guideline 4.8 + account-deletion checklist** (run and record in `privacy-declarations.md`):
- [ ] Apple sign-in offered wherever Google is (iOS: sign-in + sign-up screens; P1 G4 hides Apple on Android — 4.8 applies per-platform, satisfied).
- [ ] Apple button rendered **first** (above Google) on both auth screens — reorder if P1 shipped Google-first.
- [ ] Apple flow limits collection to name/email and works with Hide My Email (relay) — retest sign-up with relay.
- [ ] Account deletion in-app (5.1.1(v)): discoverable path verified; deletion actually destroys auth user + storage (P5 F8; re-run P5 verification step 12 against production).
- [ ] No forced sign-in to view legal pages; ToS/Privacy links live.

**E6. Permission purpose strings — final copy pass** (single table; update `app.config.ts` plugin strings + `infoPlist` to match exactly):

| Key | Final copy |
|---|---|
| `NSLocationWhenInUseUsageDescription` | "Run Everywhere shows runs near you and lets you drop a start point on the map." |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | "Run Everywhere records your route while you run, so distance and pace keep counting with the screen locked." |
| `NSPhotoLibraryUsageDescription` | "Run Everywhere uses your photos to set your profile picture." |
| HealthKit strings (P6, if shipped) | Audit P6 plan's copy; must name the exact data written/read |
| Android — manifest audit | `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`; **no** `ACCESS_BACKGROUND_LOCATION`; run `npx expo prebuild --clean` and diff `AndroidManifest.xml` against this list — remove strays via `android.blockedPermissions` if a library injects any |

**E7. Store listings** (`docs/store/listing-copy.md` + assets):
- Name "Run Everywhere" (check availability in App Store Connect day 1 — fallback "Run Everywhere — Social Running"); subtitle/short description "Find runs near you. Run together."; description drafted from the design readme's voice (confident, no emoji); keywords (running, run club, social, GPS, race, jog, city).
- Category: Health & Fitness (both). Age rating per E3 questionnaires.
- Assets: iOS screenshots 6.9" + 6.5" (6–8: Explore map, run detail, chat, live run, recap, rewards — reuse polished A7 captures on device frames), 1024 px icon (exists — verify no alpha); Play: ≥ 4 phone screenshots, 512 px icon, 1024×500 feature graphic (Volt-on-ink wordmark from `run-everywhere-app-design/project/uploads/RE logo.svg`).
- Support URL + privacy URL = Netlify site; marketing URL optional.

### F — Release engineering (EAS Build / Submit / Update)

**F1. `eas.json` — final shape** (extends what exists: `cli.appVersionSource: "remote"`, three profiles, `production.autoIncrement: true` are already there; P1 added `environment` fields — verify):
```jsonc
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "environment": "development" },
    "preview":     { "distribution": "internal", "channel": "preview", "environment": "preview" },
    "production":  { "autoIncrement": true, "channel": "production", "environment": "production" }
  },
  "submit": {
    "production": {
      "ios": { "ascAppId": "<from App Store Connect>", "appleTeamId": "<team id>" },
      "android": { "serviceAccountKeyPath": "./play-service-account.json", "track": "internal" }
    }
  }
}
```
`play-service-account.json` (Play Console → API access → service account key) is **gitignored**; add the path to `.gitignore` now. First Android submission must be a manual AAB upload in the console (Google requires it before API submissions) — do this with the week-20 closed-test build (G1).

**F2. EAS Update (OTA).** Installed in A1. `eas update:configure` → adds `updates.url = https://u.expo.dev/<projectId>` and set `runtimeVersion: { policy: 'fingerprint' }` in `app.config.ts` (fingerprint auto-invalidates OTA compatibility whenever native config/deps change — safest for a solo dev). Channels map 1:1 to build profiles (`preview`, `production`). **OTA policy** (write into `docs/release-runbook.md`; PLAN.md §1 free tier ≤ 1k MAU):

| May ship OTA (`eas update --channel production`) | Must be a store build |
|---|---|
| JS bug fixes, copy/style changes, query/logic fixes, new JS-only screens | Anything touching native modules, config plugins, permissions, `app.config.ts` native keys, Expo SDK upgrades |
| Empty/error-state copy, a11y label fixes | `expo-updates`/Sentry config changes, icon/splash |
| — | Any change to the recording task's native option set |
| Rule: OTA only for fixes, never features, while on the free tier; every OTA followed by `npx sentry-expo-upload-sourcemaps dist` | Version bump + full store review |

**F3. Versioning.** Set `version: '1.0.0'` in `app.config.ts` (from 0.1.0). Build numbers/versionCodes are EAS-remote (`autoIncrement`) — initialize with `eas build:version:set` per platform. Git-tag `v1.0.0` at the submitted commit; subsequent OTAs tag `v1.0.0-ota.N`.

**F4. Store records.** App Store Connect: create the app (bundle `com.runeverywhere.app`, name per E7), fill App Privacy (E2), attach reviewer notes/video (E4), enable **phased release** on the version page. Play Console: create app (`com.runeverywhere.app`), Google-managed signing, complete all App content declarations (E3), set up `internal` → `closed` → `production` tracks.

**F5. `docs/release-runbook.md`** — one page, exact commands: production build (`eas build --profile production --platform all`), submit (`eas submit --platform ios|android --profile production`), OTA (`eas update --channel production --message "..."` + Sentry source-map upload), **rollback**: OTA → `eas update:republish --channel production --group <previous-group-id>` (drill this on `preview` — DoD 18); Android binary → halt staged rollout in console, roll a fixed build; iOS → pause phased release (existing users keep old version), submit a fix (expedited review request only for crashers); DB → migrations are forward-only, never rolled back by OTA — incompatible schema changes require a store-build gate (note prominently).

### G — Betas + pre-launch (week 21, Play clock starts week 20)

**G1. Play closed test — START DAY 1 OF WEEK 20** (the 14-day clock gates production access for post-2023 personal accounts — see Preconditions). `eas build --profile production --platform android` → manual AAB upload to the **closed** track → invite the 12+ tester list → confirm ≥ 12 opted in (console shows the count) → keep them opted in continuously through submission. Ship week-20 fixes to this track as new AABs (does not reset the clock; tester opt-in continuity is what counts). Review the **pre-launch report** on each upload: fix all crashes/ANRs; triage accessibility + security warnings into A/C fixes.

**G2. TestFlight.** Production-profile iOS build → TestFlight internal (immediate) → **external** group (≥ 10 testers) — external requires **Beta App Review**: attach the E4 notes early; a beta rejection here is a cheap dress rehearsal for App Review. Collect crash feedback via TestFlight + Sentry.

**G3. Beta exit criteria** (before H1): Sentry crash-free sessions ≥ 99.5 % over the final 3 beta days; no open P0/P1 bugs from `docs/store/qa-screens` audit or tester reports; pre-launch report clean.

### H — Submit + resubmission loop (week 22)

**H1. Submit.** Final production builds (both platforms, same commit, tagged `v1.0.0`) → `eas submit` → App Store: submit for review with phased release ON; Play: promote the closed-test build to **production, staged rollout 10 %** (raise 10 → 25 → 50 → 100 % over the following days as Sentry/vitals stay clean — post-phase task).

**H2. Resubmission playbook** (the whole week is reserve; respond to any rejection within 24 h via the console reply thread — do not re-submit blind):

| Likely rejection | Prepared response |
|---|---|
| iOS 2.5.4 / background location justification | Point to reviewer notes §1 + demo video timestamps; emphasize user-started bounded sessions, visible indicator, FINISH stops it |
| iOS 2.1 incomplete review (couldn't test) | Demo account creds re-verified against production; add a fresh video of the exact failing flow; check Supabase hosted status/logs during their review window |
| iOS 1.2 UGC concerns | Notes §4: report + block live in-app, write-only `reports` triage, ToS; screenshots of both flows |
| iOS 4.8 login services | Apple sign-in first-position screenshots; it satisfies the privacy-option requirement |
| iOS 5.1.1(v) deletion | In-app path screenshots + web instructions URL |
| Safety-claim objection (SOS) | Copy audit proof: no "emergency services" claim anywhere (C-grep `rg -i "emergency serv|911|112" src/` = only the negative disclaimer); video shows composer + cancel |
| Play foreground-service / location policy | FS declaration + video already filed (E3); re-link; confirm no `ACCESS_BACKGROUND_LOCATION` in the manifest |
| Play metadata/data-safety mismatch | Re-walk E3 against the built AAB's manifest; amend the form, not the app, when the form is wrong |

Each rejection: fix → new build only if binary/config changed (metadata/notes fixes need no build) → reply + resubmit. Escalate to App Review Board only if a policy reading is wrong twice.

### I — Verification pass (always last)

**I1. Automated gates.** `npm run typecheck` · `npm run lint` · `supabase db lint` · `npm run db:types && git diff --exit-code src/types/database.types.ts` (no migrations expected this phase — the diff must be empty) · if `.github/workflows/ci.yml` was missing (Preconditions), add it now running exactly these four.

**I2. Full-pass QA.** Execute the Verification script below end-to-end on production builds (not dev clients).

**I3. Evidence.** `docs/store/` holds: checked deep-link matrix, a11y notes, privacy declarations, reviewer notes, listing copy, QA screenshots, and finally the two acceptance screenshots (App Store "Ready for Distribution"/approved state; Play "Production — rolling out"). That pair IS the verify gate.

## Data model & security

**No schema changes.** P7 owns migration slots `00000000000070`–`00000000000079`; they are expected to stay empty. If a week-20 audit fix genuinely requires SQL (e.g. a missed RLS hole found during QA), it goes in `supabase/migrations/00000000000070_hardening_fixes.sql` and follows all prior conventions (RLS default-deny, `set search_path = ''`, `supabase db lint` + `npm run db:types` after). Hosted-dashboard changes made this phase (email confirmations ON, custom SMTP, reviewer account) are configuration, not schema — record them in `docs/release-runbook.md`. Client-side hardening never weakens the three-tier rule ([PLAN.md §2](../PLAN.md)): retries/offline caching are read-side only; mutations keep `retry: 0` precisely so no RPC double-fires.

## Design references

- **Flows for the QA walk (all seven, this phase touches every screen):** `Run Everywhere - Auth & Onboarding.dc.html`, `Run Everywhere - Discover Flow.dc.html` (source of the canonical "No runs match" empty pattern — icon circle / condensed-800-22 title / gray body / volt action — which `EmptyState` generalizes), `Run Everywhere - Create Flow.dc.html`, `Run Everywhere - Main Flow.dc.html`, `Run Everywhere - Reward Loop.dc.html` (recap animations → reduced-motion targets), `Run Everywhere - Profile Flow.dc.html`, `Run Everywhere - Flow Map.dc.html` (route/edge completeness cross-check for the A7 and B5 tables).
- **Contracts:** [IconButton.d.ts](../../run-everywhere-app-design/project/components/buttons/IconButton.d.ts) ("Never smaller than 44px for primary touch targets" — C1 backs this with roles/labels; 44 pt = `sizing.touchMin`), [MapPin.d.ts](../../run-everywhere-app-design/project/components/run/MapPin.d.ts) (labels/cluster semantics reused as a11y labels). No new component contracts — `EmptyState`/`ErrorState`/`OfflineBanner` are compositions of existing tokens per the directive.
- **Tokens:** full ink/paper ramp + `volt`/`warn` from [src/theme/theme.ts](../../src/theme/theme.ts); `motion.durBase` for the banner; C2's contrast table annotates `theme.ts` in comments — token **values never change** (design readme "Decisions locked" is canonical).
- **Reconciliation calls:** design prototypes show no offline/error states and no not-found screen — this plan defines them inside the existing visual language (uppercase titles, sentence-case bodies, one volt action, no emoji). White-on-Challenge/Social chip contrast is kept as a logged brand exception (C2). Prototype hexes are, as always, replaced by canonical tokens.

## Verification script

Production builds on devices A (iOS) + B (Android), hosted project, accounts maya/marco + the reviewer account.

1. Automated: the four I1 gates green.
2. **Offline sweep**: sign in, browse Explore/Your Runs/Messages/notifications/profile; airplane mode ON → banner appears < 2 s, all five screens still render cached data; open an unvisited run → `ErrorState` with offline copy; tap JOIN on a cached run → disabled/toast; airplane OFF → banner clears, pull-to-refresh everywhere works.
3. **Empty sweep** (fresh throwaway account, post-onboarding): Explore with max filters → "NO RUNS MATCH" + CLEAR FILTERS works; Your Runs all tabs, Messages, notifications, blocked, leaderboard (city with no points) — all show the designed empties from A7.
4. Recording offline: start a run, airplane mode mid-run → recording continues; FINISH offline → "SAVING FAILED — your run is safe on this phone." → reconnect → TRY AGAIN → recap. (P4 salvage path, now exercised via the offline column.)
5. **Deep-link matrix**: execute all 21 rows of B5 on both devices; check off `docs/store/deeplink-matrix.md`.
6. Invite replay: signed-out cold invite link → sign in → run detail (row 3). New-user variant: sign up → onboarding → run detail.
7. **A11y**: run the five C4 walks (VoiceOver on A, TalkBack on B); verify RatingStars adjusts by swipe, tabs announce selected state, live timer does not spam announcements. Reduce Motion ON → finish a seeded run → recap static; live-share page in Safari with reduced motion → no pulse.
8. Dynamic type max (C3 settings): screenshot the 10 audit screens — no clipping/overlap.
9. Units: switch to MI → Explore cards, detail, live console, recap, history all in mi + /mi; switch back.
10. Perf: 500-run seeded region — pan/zoom Explore, marker cap holds; 200-message chat scrolls clean; airplane-mode avatars render from cache.
11. Sentry: fire the hidden test-crash trigger (7 taps on the `settings/index` version row, D4) on both production builds + once from an OTA-updated `preview` build → three symbolicated events in Sentry.
12. OTA drill: `eas update --channel preview` a visible copy change → device (preview build) picks it up on second launch; `eas update:republish` the prior group → change reverts.
13. Store artifacts: IPA privacy manifest present (download build → inspect), Android manifest permission list matches E6, App Privacy + Data Safety forms match `privacy-declarations.md`, reviewer account signs in on a clean install, demo video plays from both consoles.
14. Betas: Play closed test shows ≥ 12 opted-in testers for ≥ 14 days; pre-launch report clean; TestFlight external build installed by an outside tester.
15. Submit (H1). Track daily; run the H2 playbook on any rejection. **Gate: both consoles show approved/rolling-out.** Archive the two acceptance screenshots (I3).

## Risks & gotchas

| Risk | Mitigation |
|---|---|
| iOS review rejects background location / safety claims (PLAN.md §6 top store risk) | Reviewer notes + demo video authored before submission (E4); SOS compose-only proven on video; copy grep in H2; week 22 is 100 % rejection reserve |
| Play 12-tester/14-day rule discovered late → launch slips past week 22 | Precondition + G1 starts the clock on week-20 day 1; testers recruited before the phase; org accounts are exempt (verify account type first — [policy](https://support.google.com/googleplay/android-developer/answer/14151465)) |
| "Run Everywhere" name taken in App Store Connect | Check day 1 of week 21 (F4); fallback name in E7 |
| Sentry plugin / privacy-manifest / expo-updates option names drift (docs verified 2026-07-04 via web, but APIs move) | D4/E1/F2 each carry a re-verify-at-execution note; `npx expo prebuild --clean` output + EAS build logs are ground truth; sources: [Expo Sentry guide](https://docs.expo.dev/guides/using-sentry/), [Sentry Expo source maps](https://docs.sentry.io/platforms/react-native/sourcemaps/uploading/expo/), [Expo apple-privacy](https://docs.expo.dev/guides/apple-privacy/) |
| Aggregated third-party privacy manifests miss a required-reason API → ITMS-91053 email post-submission | App-level declarations in E1 cover the standard categories; treat any ITMS warning email as an H2 metadata fix (add the category, rebuild) |
| Required `accessibilityLabel` on IconButton breaks many call sites at once | It's a compile-time sweep (~25 sites), done in one sitting; typecheck is the checklist |
| `networkMode: 'offlineFirst'` changes query timing subtly (e.g. paused queries look like loading) | A7's per-route offline column is the regression net; `ErrorState` auto-swaps copy when offline so paused ≠ silent |
| Mutation `retry: 0` surfaces more transient failures to users | Correct trade: `join_run`/`respond_to_join_request` are not safely repeatable; every mutation site already has inline error + manual retry from its phase |
| Custom-scheme invite links untappable in SMS/mail | B3 bounce page on Netlify; universal links deferred (Decisions) — accepted v1 gap for exotic clients |
| Email confirmations ON strands the reviewer or beta testers | Reviewer account pre-confirmed via dashboard; custom SMTP (B4) prevents rate-limit bounces; sign-up flow already handles `needsEmailConfirm` (P1) |
| OTA update lands mid-recording and changes task JS | expo-updates applies on next launch only; recording sessions survive restarts via the P4 buffer; fingerprint policy blocks native-incompatible updates |
| Phased/staged rollout hides a crash spike until % rises | Sentry release tracking per build number; hold each Play % step ≥ 48 h with crash-free ≥ 99.5 %; rollback runbook drilled (F5, DoD 18) |
| Contrast fixes tempt token changes | Forbidden — tokens are locked; C2 resolves everything by usage rules (large-text-only, backgrounds), never by editing `theme.ts` values |

## Decisions made by this plan

- **`EmptyState`/`ErrorState`/`OfflineBanner` are the only new components**, generalized from the Discover Flow "No runs match" pattern; all ad-hoc per-screen states are refactored onto them (directive: no new components beyond the shared pair).
- **Offline strategy = in-memory cache only** (`gcTime` 24 h, `networkMode: 'offlineFirst'`, NetInfo-driven `onlineManager`); no disk persistence (`react-query-persist-client`) in v1 — session-scoped offline browsing is enough for a running app and avoids cache-migration bugs.
- **Mutations never auto-retry** (`retry: 0`): the core RPCs are intentionally non-idempotent from the client's view; users retry via existing inline affordances.
- **Signed-out deep links are now preserved** (`pendingLink` slot, 30-min TTL) — deliberately reverses P2 Decision #16; one mechanism serves invites and notification cold-starts.
- **Invite sharing switches to an HTTPS bounce page** on the existing Netlify site (custom schemes aren't tappable in SMS); codes interpolate cleanly into query string and path segment because P2's `…22` migration made them URL-safe (`[A-Za-z0-9_-]`) — the page inherits that guarantee. Full universal links / App Links deferred post-v1 (needs owned domain + AASA/assetlinks and re-review).
- **Email confirmations turned ON in production + custom SMTP (Resend free tier)** — closes P1's explicit deferral; reviewer/demo account pre-confirmed via dashboard.
- **Map pin km-labels stay km** even for `units='mi'` profiles (map-visual system + stored truth); all textual surfaces respect `profiles.units` via P2's `src/lib/format.ts`, which A6 **extends in place** (units-aware signatures, all call sites migrated) rather than forking a second formatting module (closes P4's deferral).
- **`accessibilityLabel` becomes a required prop on `IconButton`** — the type system, not a checklist, enforces the audit.
- **Contrast policy**: tokens untouched; `ink400` restricted to large/secondary text, `go` never text-on-light, white-on-Challenge/Social chip text logged as a brand exception (large/bold, redundant with adjacent text). Text-on-Volt measured ≈ 16.7:1 — the directive's AA check passes with headroom.
- **Dynamic-type caps**: 1.1 on hero metrics, 1.3 on condensed display/buttons, uncapped body — condensed faces clip first; body readability wins.
- **Reduced motion via reanimated `useReducedMotion()`** for recap/pulses/FAB; press-scale retained; live-share page gets a CSS `prefers-reduced-motion` guard.
- **Marker guardrail numbers**: ≤ 120 rendered markers, ≤ 200 runs fed to supercluster, `tracksViewChanges` false post-layout — chosen for low-end-Android headroom, tunable in one place.
- **Sentry**: `@sentry/react-native` with the `@sentry/react-native/expo` config plugin + `getSentryExpoConfig` metro wrapper (verified current 2026-07-04); `enabled: !__DEV__`, `tracesSampleRate 0.2`, PII off, and a `scrubGeo` hook so crash telemetry never carries GPS coordinates.
- **The Sentry test crash ships in the store binary behind a hidden gesture** (7 taps on the `settings/index` version row, D4): production builds have no Expo dev menu and `/dev/components` is `__DEV__`-gated (A5), so DoD 13 needs a production-reachable trigger — a single handled `captureException` is inert and store-safe.
- **Privacy declarations**: safety contacts declared as user content, **not** the Contacts category (no address-book access — manual entry per P5); Health & Fitness declared unconditionally (run tracks are fitness data), with Strava/Garmin rows conditional on P6 flags; `NSPrivacyTracking: false`, no ATT.
- **`ITSAppUsesNonExemptEncryption: false`** — standard HTTPS exemption, removes the export-compliance prompt.
- **`runtimeVersion: { policy: 'fingerprint' }`** for expo-updates — automatic native-compatibility gating beats manual version discipline for a solo dev.
- **OTA policy = fixes only, features via store builds** while on the EAS free tier (≤ 1k MAU, PLAN.md §1); every OTA is followed by a Sentry source-map upload.
- **Play submission path**: first AAB uploaded manually (console requirement), closed test doubles as the 12-tester/14-day production-access proof, production starts at 10 % staged; iOS uses phased release.
- **`dev/components` gated behind `__DEV__`** (redirect) rather than deleted — the gallery remains a dev tool.
- **No P7 migrations expected**; slot `00000000000070` reserved for audit-discovered SQL fixes only.
- **CI catch-up owned by I1** if the PLAN.md §1 workflow was never committed — a verification concern, not a feature.

## Out of scope

- Universal links / Android App Links (owned domain, AASA/assetlinks hosting) — post-v1; B3's bounce page covers the practical need.
- Disk-persisted query cache / full offline mode (offline run *browsing* across launches, queued mutations) — post-v1 if metrics demand.
- Localization/i18n (P3's system-message codes left the door open) — post-v1; store listings ship English-only.
- iOS Live Activities, Android widget, app-icon badge counts, push digests/rate limiting — P5/P3 deferrals stay deferred (post-v1 backlog).
- Message reactions/edit/delete, typing indicators, server-side conversation search — P3 deferrals, post-v1.
- Leaderboard city-alias normalization, solo free-run recording, km splits, auto-pause, barometric D+ — P4/P5 deferrals, post-v1.
- In-app purchase/monetization, tablet/iPad layouts (`supportsTablet: false`), web app build — not planned for v1.
- Marketing site beyond the Netlify utility pages, ASO iteration, post-launch staged-rollout ramp to 100 % — operational follow-up after the phase gate (submissions accepted).
