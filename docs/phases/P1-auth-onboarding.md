# P1 — Auth + Onboarding (Weeks 2–3)

| | |
|---|---|
| **Depends on** | P0 scaffold (routes, theme tokens, Button/TypeChip/RunCard/TabBar, local Supabase stack, migration [`00000000000001_core.sql`](../../supabase/migrations/00000000000001_core.sql)) |
| **Provides to later phases** | Hosted Supabase project (linked, migrations pushed); real sign-in (email + Apple + Google) and session persistence; auth-state routing guards; completed `profiles` rows (`onboarded_at` set) that P2 discovery/create depend on; `avatars` Storage bucket + RLS; `Input` + `IconButton` components; generated `src/types/database.types.ts`; filed Strava Extended Access + Garmin developer applications (P6 lead time) |
| **Verify gate (PLAN.md §5)** | "Full signup → onboarding → tabs; two-user RLS smoke test" |

## Goal

Replace the scaffold's dev bypass with production auth: a hosted Supabase project, email/password with forgot-password deep links, native Sign in with Apple and Google wired to Supabase via `signInWithIdToken`, and centralized auth-state routing. New users complete a 4-step onboarding that fills their `profiles` row (photo → new `avatars` bucket, home city + `home_point` via reverse geocode, bands/languages/units/visibility, ToS acceptance) and land in the tabs. In parallel — because both have multi-week review queues — the Strava Extended Access and Garmin Connect Developer Program applications are filed on day 1.

## Definition of done

1. Hosted Supabase project exists, is linked (`supabase link`), and `supabase db push` has applied migrations `00000000000001`, `00000000000010`, `00000000000011` cleanly.
2. `.env` strategy works: app runs against the local stack **and** the hosted project by swapping `.env`; EAS environment variables are configured for the `development` profile.
3. Email sign-up (name/email/password/ToS checkbox) creates an auth user, the trigger-created `profiles` row carries `display_name`, and `tos_accepted_at` is set.
4. Email sign-in works; wrong password shows an inline error, not a crash.
5. Forgot-password round trip: request email → tap link on the same device → app opens via `runeverywhere://forgot-password?code=…` → new password form → sign-in with the new password succeeds.
6. Sign in with Apple works on an iOS device; first-time Apple users get `display_name` prefilled from the Apple credential.
7. Google sign-in works on iOS and Android dev builds via `signInWithIdToken`.
8. Session persists across app kill + relaunch (AsyncStorage; verified on device).
9. Routing guard: signed-out → `(auth)/welcome`; signed-in + `onboarded_at IS NULL` → `onboarding/profile`; signed-in + onboarded → `(tabs)`; guard is centralized in `src/app/_layout.tsx`.
10. "Enter app (dev)" button and `devSignIn` are deleted; app is unreachable without a real session.
11. Onboarding step 1 saves avatar (visible via public URL), `display_name`, `bio`.
12. Onboarding step 2 saves `home_city` and `home_point` (verify `home_point` non-null in table editor after using "Use current location").
13. Onboarding step 3 saves `pace_band`, `distance_band`, `languages`.
14. Onboarding step 4 saves `units`, `visibility`, sets `onboarded_at`, shows the success screen, and "START EXPLORING" lands in `(tabs)`.
15. Relaunching after onboarding goes straight to `(tabs)`; relaunching mid-onboarding returns to `onboarding/profile` with saved values prefilled.
16. Two-user RLS smoke script passes locally (`supabase/tests/rls_smoke.sql`) and in the hosted SQL editor: cross-user profile update = 0 rows; own `points_total` update = permission denied; cross-user avatar object insert = RLS error; hidden profile invisible to the other user but visible to self.
17. `avatars` bucket: owner-only write enforced (per #16), public read URL renders in the app.
18. Strava Extended Access and Garmin Connect Developer Program applications submitted; `docs/integrations/applications.md` records dates, accounts, and copy used.
19. `/dev/components` gallery renders `Input` (default/invalid/disabled/multiline/adorned) and `IconButton` (all variants).
20. CI green: `npm run typecheck`, `npm run lint`, `supabase db lint`, and `src/types/database.types.ts` diff-clean against a fresh `npm run db:types`.

## Preconditions

| Precondition | How to check |
|---|---|
| P0 verify gate passed (boots both platforms, tabs navigate, gallery renders) | `npx expo run:ios` / `run:android`; tap through tabs and `/dev/components` |
| Local Supabase stack works with seed | `supabase start && supabase db reset` — seeded `maya@example.com` / `marco@example.com` sign-ins exist (`password123`) |
| Supabase account (owner org for the hosted project) | Log in at supabase.com/dashboard; `supabase login` succeeds |
| Apple Developer Program membership active | developer.apple.com → Membership; needed for Sign in with Apple capability + device builds |
| Google Cloud account (OAuth clients; Maps keys already envisioned) | console.cloud.google.com accessible |
| EAS project linked | `app.config.ts` → `extra.eas.projectId` filled; if not, run `eas init` (needed for EAS env vars, not for local `expo run`) |
| iOS device (recommended) + Android device/emulator with Play services | Apple sign-in is most reliable on a physical device signed into an Apple ID |
| Strava account + Garmin account (application logins) | Can log in at strava.com and developer.garmin.com |
| supabase CLI ≥ 2.x installed | `supabase --version` |

## Workstreams

### A — Third-party API applications (start day 1; PLAN.md §6 lead-time risk)

External review queues gate P6; file both applications before writing any code.

**A1. Publish minimal legal pages (prerequisite for both applications and Google OAuth consent).**
- Create `docs/legal/privacy-policy.md` and `docs/legal/terms-of-service.md` in the repo (source of truth), covering: data collected (account email, profile, GPS start points, later run tracks), Supabase as processor, no sale of data, deletion by request, contact email.
- Publish both as static HTML on Netlify free tier (drag-and-drop deploy of an exported HTML folder; site name e.g. `runeverywhere-legal.netlify.app`). Record the two public URLs in `docs/integrations/applications.md`.
- These same URLs back the in-app "Terms of Service" / "Privacy Policy" links (Workstream F).
- Acceptance: both URLs load in an incognito browser.

**A2. Strava — create API app, then apply for Extended Access.**
- Create the API application at <https://www.strava.com/settings/api>: name "Run Everywhere", category "Training", website = legal-pages site (until a product page exists), Authorization Callback Domain = `<project-ref>.supabase.co` (the P6 `strava-*` Edge Function host; editable later).
- Context (verified 2026-07): since the June 2026 developer-program update, new apps sit in the **Standard tier — capped at 10 connected athletes**; the **Extended Access tier** (higher caps, partner APIs, no dev subscription required) requires an application review — [announcement](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428), [developer program](https://communityhub.strava.com/developers-knowledge-base-14/our-developer-program-3203), [API policy](https://www.strava.com/legal/api_policy). Upgrade/apply from the API Settings dashboard.
- What to write in the application: consumer mobile app for social running; requests read-only scopes `activity:read`, `profile:read_all` to import a runner's completed runs into their own Run Everywhere history; no leaderboards rebuilt from Strava data, no AI training, data shown only to the owning athlete; expected athletes 1k year one; link privacy policy; note the app is pre-launch and feature-flagged (PLAN.md §5 P6).
- Acceptance: application submitted (or, if Strava requires ≥10 connected athletes before Extended review, the Standard-tier app is created and the upgrade path + re-check date are logged) — record status + Client ID (never the secret) in `docs/integrations/applications.md`.

**A3. Garmin — apply to the Connect Developer Program.**
- Apply via the request-access form at <https://developer.garmin.com/gc-developer-program/> (Overview → Request Access): business-use program, no fees; Garmin confirms status within ~2 business days, then grants an **evaluation environment** for the [Activity API](https://developer.garmin.com/gc-developer-program/activity-api/); production keys require a later app review ([FAQ](https://developer.garmin.com/gc-developer-program/program-faq/)).
- What to write: Run Everywhere (solo developer / pre-launch), requests the **Activity API** (push of completed running activity summaries + details) so users can attach watch-recorded runs; est. volume <10k users; privacy policy URL from A1.
- Acceptance: application submitted; confirmation email + evaluation-key status logged in `docs/integrations/applications.md`.

**A4. Create `docs/integrations/applications.md`** — a tracking table: provider | account email | date filed | tier/status | IDs (public only) | next action + date. Update it whenever either review advances. (Secrets live in a password manager, never in the repo.)

### B — Hosted Supabase project + environment strategy

**B1. Create + link the hosted project.**
- Dashboard → New project: name `runeverywhere`, region closest to you (EU-west for the Lisbon-seeded dev), Postgres 15, generate a strong DB password (password manager).
- Commands: `supabase login`, then `supabase link --project-ref <PROJECT_REF>` (writes nothing secret to the repo; ref is stored in `supabase/.temp`).
- Acceptance: `supabase projects list` shows the project as linked.

**B2. Push migrations.**
- `supabase db push` (after Workstream C lands the two new migrations, run it again — push is idempotent by migration table).
- Do **not** seed the hosted project with `supabase/seed.sql` (dev fixtures are local-only; `db push` never runs seed — correct behavior).
- Acceptance: dashboard Table editor shows `profiles`, `runs`, `run_members`, `favorites` with RLS enabled; `select * from supabase_migrations.schema_migrations` lists all applied versions.

**B3. Hosted Auth configuration (dashboard → Authentication).**
- URL Configuration: Site URL `runeverywhere://`; Redirect URLs add `runeverywhere://**` (mirrors [`supabase/config.toml`](../../supabase/config.toml)).
- Email provider: signups ON, **Confirm email OFF for P1** (matches local; revisit in P7 — see Decisions), minimum password length **8**, password requirements **letters and digits**.
- Providers → Apple: enable; "Client IDs" = `com.runeverywhere.app` (bundle id; native id_token flow needs no secret).
- Providers → Google: enable; "Authorized Client IDs" = comma-separated Web client ID, iOS client ID, Android client ID (created in Workstream G); no secret needed for the id_token flow.
- Acceptance: settings saved; test in G/H tasks.

**B4. Capture keys + env strategy.**
- From dashboard → Project Settings → API: copy Project URL and the **anon (publishable) key**. Never the service-role key into anything `EXPO_PUBLIC_*`.
- Repo env files:
  - `.env` (gitignored) — the *active* backend. Local values by default.
  - Extend `.env.example` with a commented "hosted" block and the new vars (all safe-to-commit *names*, empty values): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `GOOGLE_SIGNIN_IOS_URL_SCHEME`, `GOOGLE_MAPS_API_KEY_IOS`, `GOOGLE_MAPS_API_KEY_ANDROID`.
  - Add `.env.hosted.example` documenting the hosted shape (URL `https://<ref>.supabase.co`); developer keeps a real gitignored `.env.hosted` and swaps with `cp .env.hosted .env` + restart Metro with `--clear` (EXPO_PUBLIC vars are baked at bundle time).
  - Verify `.gitignore` covers `.env` and `.env.hosted` (add if missing).
- EAS: create environment variables (dashboard → project → Environment variables, or `eas env:create`) for environments `development`/`preview`/`production`: the five `EXPO_PUBLIC_*`/`GOOGLE_*` vars above pointing at the **hosted** project. Edit [`eas.json`](../../eas.json): add `"environment": "development" | "preview" | "production"` to the matching build profiles.
- Update `README.md`: replace the "Enter app (dev)" paragraph with sign-in instructions and the local-vs-hosted `.env` swap.
- Acceptance: `npx expo start` with hosted `.env` → sign-in against hosted works (after Workstream F); with local `.env` → seeded users work.

### C — Migrations, storage bucket, generated types

P1 owns migration slots `00000000000010`–`00000000000019`. Two new files; apply with `supabase db reset` locally, `supabase db push` hosted. Full SQL outline in **Data model & security** below.

**C1. `supabase/migrations/00000000000010_avatars_storage.sql`** — `avatars` bucket (public read, 5 MB, jpeg/png/webp) + 4 `storage.objects` policies (public read; owner-only insert/update/delete keyed on first path segment = `auth.uid()`).
- Acceptance: `supabase db reset` clean; `select * from storage.buckets` shows `avatars`.

**C2. `supabase/migrations/00000000000011_profiles_onboarding.sql`** — `touch_updated_at` trigger on `profiles`; column-level UPDATE grants so clients can never write `points_total`/`level`/`rating_*` (server-authoritative caches per PLAN.md §2); RPC `set_home_location(p_lat, p_lng, p_city)`.
- Acceptance: `supabase db lint --level warning` clean; as an authenticated user, `update profiles set points_total = 1` fails with permission denied.

**C3. Generate DB types (first time).**
- With local stack running migrations-current: `npm run db:types` → creates `src/types/database.types.ts`. Commit it.
- Update `src/lib/supabase.ts` to `createClient<Database>(…)` (import from `@/types/database.types`).
- Extend CI (`.github/workflows/ci.yml`, `db` job) with a drift gate: after `supabase db start`, run `supabase gen types typescript --local > /tmp/db.types.ts && diff /tmp/db.types.ts src/types/database.types.ts`.
- Acceptance: `npm run typecheck` passes; re-running `npm run db:types` produces no git diff.

**C4. RLS smoke script `supabase/tests/rls_smoke.sql`** (new dir). Content per **Verification script** step 12: role-played `authenticated` sessions via `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'`, one `begin…rollback` block per expected-failure case (errors abort a tx). Runs locally via `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_smoke.sql`; same statements paste into the hosted SQL editor.
- Acceptance: script output matches the expected results documented in its header comments.

### D — Design-system components (port per `.d.ts` contracts)

P0 audit: shipped = `Button`, `TypeChip`, `RunCard`, `TabBar` ([PLAN.md §4](../PLAN.md)). P1 ports the two this phase needs.

**D1. `src/components/ui/Input.tsx`** — port of [`Input.d.ts`](../../run-everywhere-app-design/project/components/forms/Input.d.ts), adapted to RN:
- Props: `label?`, `value`, `onChangeText`, `placeholder?`, `secureTextEntry?`, `keyboardType?`, `autoCapitalize?`, `autoComplete?`, `multiline?` (+`numberOfLines`), `leading?: ReactNode`, `trailing?: ReactNode`, `hint?`, `invalid?`, `disabled?`, `testID?`. (Web `type`/`onChange`/`rows` become the RN equivalents.)
- Visuals (from `Input.jsx` reference): uppercase micro-label `fonts.displayExtra` 12px, `tracking.label`, `colors.ink500`, 8 marginBottom; field row: bg `semantic.bgSurface` (disabled: `bgSunken`), border `borderWidth.mid`, color `ink200` → focus `ink900` → invalid `colors.danger`, radius `radius.sm`, height `sizing.controlH` (multiline: auto, padding 12/14), text `fonts.bodyMedium` @ `tMd`; hint 12px below, `ink400` (invalid: `danger`).
- Acceptance: gallery (`src/app/dev/components.tsx`) gains an "Inputs" section: default, focused (interact), invalid+hint, disabled, multiline, leading-icon, trailing (password eye).

**D2. `src/components/ui/IconButton.tsx`** — port of [`IconButton.d.ts`](../../run-everywhere-app-design/project/components/buttons/IconButton.d.ts):
- Props: `variant?: 'surface'|'ink'|'volt'|'ghost'|'danger'`, `size?: 'sm'|'md'|'lg'` (36/44/52), `round?`, `active?` (ink bg + volt glyph), `disabled?`, `onPress`, `children` (icon node, `lucide-react-native` or inline SVG), `accessibilityLabel` (required).
- Visuals per `IconButton.jsx`: surface = paper bg + `ink200` mid border + `shadows.sm`; ink = ink900; volt = volt bg/ink glyph; ghost transparent; danger = `dangerSoft` bg + `danger` glyph; press scale `motion.pressScale`; disabled opacity 0.4.
- Acceptance: gallery gains an "Icon buttons" section with all 5 variants + `round` + `active`.

**D3. Screen-local primitives (not part of the ported design system — see Decisions):**
- `src/components/onboarding/OnboardingHeader.tsx` — optional back `IconButton` (surface, round) + volt progress bar (5px, `ink100` track) + `STEP n/4` label (`displayExtra` 12, `ink400`), matching the flow HTML header.
- `src/components/onboarding/SelectChip.tsx` — 42px pill chip, selected = ink900 bg/white text, unselected = white bg/`ink200` mid border (from the flow's `chipStyle`). Props: `label`, `selected`, `onPress`.
- `src/components/onboarding/Segmented.tsx` — full-width segmented control, 48px segments in a `mid`-bordered 10px-radius white container; selected segment ink900/white. Props: `options: {value,label}[]`, `value`, `onChange`.
- `src/components/auth/ProviderButton.tsx` — `provider: 'apple' | 'google'`; apple = ink900 bg, white glyph+label; google = white bg, `ink200` mid border, colored G glyph; 50px, uppercase condensed label "CONTINUE WITH APPLE/GOOGLE"; glyph paths copied from the flow HTML (`react-native-svg`).
- Acceptance: used by Workstreams F/H screens; render correctly on both platforms.

### E — Session store + routing guards (replace the dev bypass)

**E1. Harden `src/lib/supabase.ts`.**
- AsyncStorage persistence is already configured (verified: `storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false`). Keep it.
- Add `flowType: 'pkce'` to `auth` options (required for the forgot-password `?code=` exchange, F4).
- Make the export non-null: if `EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY` are missing, `throw new Error('Supabase env missing — copy .env.example to .env (see README)')` at module init. Remove the `| null` type; delete downstream null-guards.
- Type the client: `createClient<Database>(…)`.
- Acceptance: with `.env` absent the app crashes with that exact message; with it, typecheck passes with the typed client.

**E2. Extend `src/stores/session.ts`.**
- State: `status: 'loading'|'signedOut'|'signedIn'`; `session: Session|null`; `profile: Database['public']['Tables']['profiles']['Row'] | null`; `profileStatus: 'idle'|'loading'|'ready'|'error'`; `recovering: boolean` (password-recovery deep link in progress).
- Actions: `init()` — `getSession()` + `onAuthStateChange`; on signed-in, fetch own profile (`from('profiles').select('*').eq('id', uid).single()`) → `profileStatus 'ready'` (or `'error'` on failure); on signed-out clear profile. `refreshProfile()` — refetch on demand (onboarding writes call it explicitly). `setRecovering(b)`. `signOut()`.
- Delete `devSignIn` entirely.
- Acceptance: typecheck; guard behavior in E3.

**E3. Centralize the guard in `src/app/_layout.tsx`.**
- Add an `AuthGate` component inside the providers using `useSegments()` + `router.replace` in a `useEffect`:
  - `status === 'loading'` or (`signedIn` && `profileStatus === 'loading'`) → render `null` (splash stays up).
  - `profileStatus === 'error'` → minimal inline error view (`textStyles.body` message + `Button label="RETRY"` → `refreshProfile()`).
  - `recovering === true` → no redirects (keeps the user on `(auth)/forgot-password` while resetting).
  - `signedOut` && segment ≠ `(auth)` → `router.replace('/(auth)/welcome')`.
  - `signedIn` && `!profile?.onboarded_at` && segment ≠ `onboarding` → `router.replace('/onboarding/profile')`.
  - `signedIn` && `profile?.onboarded_at` && segment ∈ {`(auth)`, `onboarding`} → `router.replace('/(tabs)')`.
- Register `<Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />`.
- Remove the now-duplicate `<Redirect>` logic from `src/app/(auth)/_layout.tsx` and `src/app/(tabs)/_layout.tsx` (keep their Stack/Tabs rendering; `(tabs)` keeps `status==='loading' → null` as belt-and-braces or drops it — either, guard owns routing).
- Acceptance: the three routing states in Definition of done #9 behave; deep-linking `runeverywhere://forgot-password` while signed out stays on the reset screen.

**E4. Remove the bypass + add a temporary sign-out.**
- `src/app/(auth)/welcome.tsx`: delete the "Enter app (dev)" `Button` and the `useSession` import for it; keep hero + GET STARTED → `/(auth)/sign-up`, LOG IN → `/(auth)/sign-in` (matches the flow's splash screen).
- `src/app/(tabs)/profile.tsx`: add `Button label="SIGN OUT" variant="ghost"` wired to `useSession().signOut()` (placeholder until P5's full profile; required for two-account testing on one device).
- Acceptance: no `devSignIn` references remain (`grep -r devSignIn src/` empty); sign-out returns to welcome.

### F — Email/password auth screens

All screens: `KeyboardAvoidingView` + `ScrollView`, gutter `sizing.gutter`, bg `colors.paper2`, titles per `textStyles.screenTitle`, validation with `zod` (already installed), single volt primary per screen. Error mapping (from supabase-js `AuthApiError.code`): `invalid_credentials` → "Wrong email or password."; `user_already_exists`/`email_exists` → "That email is already registered — log in instead."; `weak_password` → "Use 8+ characters with a number."; `over_email_send_rate_limit` → "Too many emails sent — try again later."; anything else → "Something went wrong. Try again." Buttons show a disabled working state (label → "LOGGING IN…" etc.); never spinners-only.

**F1. `src/lib/auth.ts`** — thin service module so screens stay presentational:
- `signUpWithEmail({ displayName, email, password })` → `supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })`; if a session is returned (confirmations off), immediately `update profiles set tos_accepted_at = now()` for `auth.uid()`; if no session (confirmations later enabled), return a `needsEmailConfirm` flag.
- `signInWithEmail({ email, password })`.
- `requestPasswordReset(email)` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'runeverywhere://forgot-password' })`.
- `completePasswordReset(code, newPassword)` → `supabase.auth.exchangeCodeForSession(code)` then `supabase.auth.updateUser({ password: newPassword })`.
- `signInWithApple()`, `signInWithGoogle()` (Workstream G).
- Zod schemas: `displayName` 1–40 chars; email `.email()`; password min 8 + `/\d/` (mirrors hosted policy, B3).
- Acceptance: unit-free; exercised through the screens below.

**F2. `src/app/(auth)/sign-in.tsx`** (design: "LOGIN" frame of the flow file):
- Back `IconButton` → `router.back()`; title "WELCOME BACK"; sub "Log in to keep running with your people." (`textStyles.caption` @ `tMd`).
- `Input label="EMAIL"` (email keyboard, no autocap, `autoComplete="email"`); `Input label="PASSWORD"` with trailing eye toggle (`secureTextEntry` flip) and a "FORGOT?" link (condensed 12, `colors.discover`) right-aligned beside the label → `/(auth)/forgot-password`.
- `Button label="LOG IN"` → `signInWithEmail`; on success do nothing (AuthGate routes). Inline error hint under the password field.
- "OR" hairline divider; `ProviderButton apple` (iOS only, see G4) then `ProviderButton google`.
- Footer: "New here? **CREATE ACCOUNT**" → `/(auth)/sign-up`.
- States: idle / working (button disabled) / error (invalid inputs + hint).
- Acceptance: seeded local user logs in; wrong password shows the inline error.

**F3. `src/app/(auth)/sign-up.tsx`** (design: "REGISTER 1", shown as step 1/4 there — see Decisions on step counting):
- Back `IconButton`; title "CREATE ACCOUNT"; sub "Start with the basics."
- `Input label="FULL NAME"` (`autoComplete="name"`), `Input label="EMAIL"`, `Input label="PASSWORD"` (eye toggle, hint "Use 8+ characters with a number.").
- ToS row (required): 22px checkbox (ink900 fill + volt check when on, per flow HTML) + "I agree to the **Terms of Service** and **Privacy Policy**." — bold spans open the A1 URLs via `Linking.openURL`.
- "OR" divider + the same two `ProviderButton`s (deviation from the flow file — see Decisions).
- Sticky footer `Button label="CONTINUE"` (disabled until schema valid + ToS checked) → `signUpWithEmail`; on success AuthGate lands on `onboarding/profile`. If `needsEmailConfirm`, render a "Check your email" panel (future-proofing; unreachable while confirmations are off).
- Acceptance: new local user reaches onboarding step 1; `profiles.display_name` and `tos_accepted_at` populated.

**F4. `src/app/(auth)/forgot-password.tsx`** — two modes in one route:
- **Request mode** (default): title "RESET PASSWORD"; `Input label="EMAIL"`; `Button label="SEND RESET LINK"` → `requestPasswordReset`; success state swaps the form for "Check your email — open the link on this phone." + "BACK TO LOG IN".
- **Reset mode**: activated when `useLocalSearchParams()` contains `code` (deep link `runeverywhere://forgot-password?code=…`; the group segment is elided so the path maps to this route). On mount with `code`: `setRecovering(true)`, call `completePasswordReset` in two stages — exchange first, then show `Input label="NEW PASSWORD"` + `Input label="CONFIRM PASSWORD"` + `Button label="SET NEW PASSWORD"` → `updateUser`; on success `setRecovering(false)` (AuthGate then routes to tabs/onboarding) and show a brief "Password updated" hint.
- Handle Supabase error redirect params (`error`, `error_code=otp_expired` → "That link expired — request a new one.") and the PKCE cross-device failure (exchange throws because the code verifier lives on the requesting device) → same message + request mode.
- Local email testing: Mailpit inbox at `http://127.0.0.1:54324` (bundled with `supabase start`); hosted: real inbox.
- Acceptance: Definition of done #5 on a physical device (both cold start and warm app).

### G — Apple + Google sign-in (native, `signInWithIdToken`)

**G1. Install native modules (dev clients must be rebuilt afterwards):**
```sh
npx expo install expo-apple-authentication expo-crypto expo-image-picker expo-file-system @react-native-google-signin/google-signin
npm install base64-arraybuffer
```
(`expo-image-picker`/`expo-file-system`/`base64-arraybuffer` are for Workstream H, installed in the same rebuild. `@react-native-google-signin/google-signin` must resolve to ^16 per PLAN.md §1 — verify in `package.json`.)
- Acceptance: `npx expo run:ios` and `run:android` rebuild and boot.

**G2. `app.config.ts` changes (exact keys):**
- `ios.usesAppleSignIn: true`.
- `plugins` add: `'expo-apple-authentication'`; `['expo-image-picker', { photosPermission: 'Run Everywhere uses your photos to set your profile picture.' }]`; `['@react-native-google-signin/google-signin', { iosUrlScheme: process.env.GOOGLE_SIGNIN_IOS_URL_SCHEME }]` (the reversed iOS client id, `com.googleusercontent.apps.<id>`).
- Acceptance: `npx expo prebuild --no-install --platform ios` (throwaway check or just `run:ios`) succeeds with the plugin config.

**G3. Google Cloud setup (one project, e.g. "Run Everywhere"):**
- OAuth consent screen: External, app name, support email; Publishing status *Testing* with your test Google accounts is fine for P1 (privacy URL from A1 when publishing later).
- Credentials → three OAuth client IDs: **iOS** (bundle `com.runeverywhere.app`); **Android** (package `com.runeverywhere.app` + SHA-1s: local debug keystore via `keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android`, plus the EAS-managed keystore SHA-1 from `eas credentials -p android` for EAS builds); **Web application** (no redirect URIs needed — it is the `webClientId` audience for the id token).
- Fill `.env` (+ EAS env vars): `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `GOOGLE_SIGNIN_IOS_URL_SCHEME`.
- Supabase: hosted per B3; local — edit [`supabase/config.toml`](../../supabase/config.toml) adding `[auth.external.apple] enabled = true, client_id = "com.runeverywhere.app"` and `[auth.external.google] enabled = true, client_id = "<ios-client-id>,<web-client-id>"` (client IDs are public identifiers, safe to commit), plus `[auth] minimum_password_length = 8`.
- Acceptance: `supabase stop && supabase start` reloads config without error.

**G4. `signInWithApple()` in `src/lib/auth.ts`:**
- Guard: `Platform.OS === 'ios' && await AppleAuthentication.isAvailableAsync()` — screens hide the Apple `ProviderButton` otherwise (Android keeps only Google; Guideline 4.8 applies to the iOS app, satisfied).
- Flow: `rawNonce = Crypto.randomUUID()`; `hashed = await Crypto.digestStringAsync(CryptoDigestAlgorithm.SHA256, rawNonce)`; `credential = await AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME, EMAIL], nonce: hashed })`; `supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken!, nonce: rawNonce })`.
- Apple returns `fullName` **only on first authorization**: if `credential.fullName?.givenName` and the fetched profile's `display_name` is empty, immediately `update profiles set display_name = [given, family].join(' ')` then `refreshProfile()`.
- `ERR_REQUEST_CANCELED` → silent return.
- Acceptance: fresh Apple ID relay sign-in creates a `profiles` row with a non-empty `display_name`; AuthGate routes to onboarding.

**G5. `signInWithGoogle()` in `src/lib/auth.ts`:**
- `GoogleSignin.configure({ webClientId: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, iosClientId: EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID })` once (module scope); `await GoogleSignin.hasPlayServices()`; `const res = await GoogleSignin.signIn()`; v16 response shape: `res.type === 'success'` → `res.data.idToken`, `res.type === 'cancelled'` → silent; missing `idToken` → throw with message pointing at the webClientId config.
- `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`. Prefill: profile `display_name` empty → use `res.data.user.name` (same immediate-update pattern as G4).
- Acceptance: Google sign-in works on both platforms against local and hosted (local requires G3's config.toml block).

### H — Onboarding wizard (4 steps + success)

Routes under `src/app/onboarding/` with a `_layout.tsx` Stack (headers hidden, `OnboardingHeader` rendered inside each screen). Every step **persists on CONTINUE** (write-through; no draft store — see Decisions), prefills from `useSession().profile`, calls `refreshProfile()` after writes **except** the final `onboarded_at` write (deferred — see H5). Write helpers live in `src/lib/profile.ts`: `updateProfile(patch)` (typed `.update().eq('id', uid).select().single()`), `uploadAvatar(localUri)`, `setHomeLocation(lat,lng,city)` (RPC). Each step: sticky footer `Button label="CONTINUE"` (working state while saving; inline error hint + stay on failure).

**H1. `src/app/onboarding/_layout.tsx`** — plain `<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper2 } }} />`.

**H2. `src/app/onboarding/profile.tsx` — step 1/4 "ADD YOUR PROFILE"** (design "REGISTER 2" merged with identity fields — see Decisions):
- `OnboardingHeader` (no back button on step 1) progress 25%.
- Avatar picker: 124px circle (`ink100` placeholder, 3px ink900 border) + 38px volt camera badge; caption "Tap to add a profile photo". Tap → `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1,1], quality: 0.7, exif: false })`; on select show local preview immediately, upload on CONTINUE.
- `uploadAvatar`: read via `expo-file-system` `readAsStringAsync(uri, { encoding: 'base64' })` (import from `expo-file-system/legacy` on SDK 56) → `decode()` from `base64-arraybuffer` → `supabase.storage.from('avatars').upload('${uid}/avatar.jpg', arrayBuffer, { contentType: 'image/jpeg', upsert: true })` → `avatar_url = getPublicUrl(path).data.publicUrl + '?v=' + Date.now()` (cache-bust).
- `Input label="DISPLAY NAME"` (required 1–40, prefilled from profile — covers Apple/Google users), `Input label="BIO" multiline` (0–160, counter in hint).
- If `profile.tos_accepted_at` is null (OAuth sign-ups): show the same ToS checkbox row as F3, required; CONTINUE writes `tos_accepted_at = now()` with the rest.
- CONTINUE → upload (if a new photo picked) + `updateProfile({ display_name, bio, avatar_url?, tos_accepted_at? })` → `refreshProfile()` → `router.push('/onboarding/location')`. Photo optional.
- Acceptance: object exists at `avatars/<uid>/avatar.jpg`; public URL renders; row updated.

**H3. `src/app/onboarding/location.tsx` — step 2/4 "WHERE DO YOU RUN?"** (design "REGISTER 2" city block + step-4 location card):
- Header back → step 1; progress 50%.
- Ink900 card explaining location use (copy from flow: "Run Everywhere uses your location to show runs nearby and share your start point with people you run with.") + `Button label="USE CURRENT LOCATION"`:
  - `Location.requestForegroundPermissionsAsync()`; denied → hint "You can type your city instead." (no re-prompt loop).
  - `Location.getCurrentPositionAsync({ accuracy: Accuracy.Balanced })` → `Location.reverseGeocodeAsync({ latitude, longitude })` → take `city` (fallback `subregion`/`region`) into the input; keep coords in local state; button flips to the connected/"go" style (border `colors.go`) with label "LOCATION SET".
- `Input label="HOME CITY"` with leading map-pin icon (required, ≤40 chars; editable after geocode).
- CONTINUE → coords present ? `setHomeLocation(lat, lng, city)` RPC : `updateProfile({ home_city: city })` → `refreshProfile()` → push `/onboarding/preferences`.
- States: locating (button working), permission-denied hint, geocode-empty fallback (leave input focused).
- Acceptance: with location granted, `home_point` is non-null (check Studio); manual-city path leaves `home_point` null but saves `home_city`.

**H4. `src/app/onboarding/preferences.tsx` — step 3/4 "HOW DO YOU RUN?"** (design "ONBOARDING PREFS"):
- Header back; progress 75%. Sub "We use this to match you with the right runs."
- "USUAL PACE" — `Segmented` over the **schema's 4 `pace_band` values** (see Decisions): EASY / STEADY / QUICK / FAST; volt-dot description line below, per selection: easy "6:30 /km and up — relaxed, conversational." · steady "5:30–6:30 /km — steady, sustainable effort." · quick "4:45–5:30 /km — brisk training pace." · fast "Sub 4:45 /km — quick, competitive sessions." Default `steady`.
- "USUAL DISTANCE" — **single-select** `SelectChip` row over `distance_band`: SHORT "up to 5K" / MID "5–10K" / LONG "10K–half" / ULTRA "beyond half" (labels uppercase, range as 12px sub-caption). Default `mid`.
- "LANGUAGES · pick any" — multi-select `SelectChip`s: English/Português/Español/Français/Deutsch/Italiano storing uppercase ISO codes `EN PT ES FR DE IT` (matches seed format). Default `['EN']`.
- CONTINUE → `updateProfile({ pace_band, distance_band, languages })` → `refreshProfile()` → push `/onboarding/finish`.
- Acceptance: row shows chosen enum values; enums reject nothing (UI can only produce valid values).

**H5. `src/app/onboarding/finish.tsx` — step 4/4 "ALMOST THERE" + success state** (design step-4 frame repurposed + "SUCCESS" frame — see Decisions):
- Header back; progress 100%.
- "UNITS" — `Segmented` KM / MI (`units_pref`), default `km`.
- "PROFILE VISIBILITY" — three stacked selectable cards (white, mid border; selected = ink900 border + check): EVERYONE "Anyone can view your profile" / MEMBERS "Only people in your runs" / HIDDEN "Only you" → `profile_visibility`. Default `everyone`.
- Footer caption "You can change any of this later in Settings."
- `Button label="FINISH"` → `updateProfile({ units, visibility, onboarded_at: new Date().toISOString() })` — **do not** call `refreshProfile()` yet (the AuthGate would instantly bounce to tabs and skip the success screen) — then set local `done` state → render the success view full-screen: ink900 bg, volt glow, 108px volt check circle (reanimated spring pop, `motion` tokens), "YOU'RE IN", subline `"${home_city} is full of runners. Let's find your first one."` (fallback "There are runners near you right now. Let's find your first run."), `Button label="START EXPLORING"` → `await refreshProfile(); router.replace('/(tabs)')`.
- Acceptance: Definition of done #14–15.

### I — Verification pass

Run the full **Verification script** below on: iOS device (hosted backend), Android device/emulator (hosted), plus the RLS smoke locally and on hosted. Fix, re-run, then update `docs/integrations/applications.md` statuses and tick the Definition of done. Phase ends demoable: fresh install → sign up → onboard → tabs.

## Data model & security

Two migrations (P1 slots; 14-digit prefixes).

### `supabase/migrations/00000000000010_avatars_storage.sql`

```sql
-- Bucket: public-read avatar images, owner-only writes. Path convention:
--   avatars/<auth.uid()>/avatar.jpg   (first folder segment = owner uuid)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "avatar images are publicly readable"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

create policy "users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
```

### `supabase/migrations/00000000000011_profiles_onboarding.sql`

```sql
-- 1) Keep profiles.updated_at honest (clients cannot write it — see grants).
create function public.touch_updated_at ()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end; $$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at ();

-- 2) Column-level write protection: the RLS policy allows own-row UPDATE, but
--    points_total / level / rating_avg / rating_count / created_at / updated_at
--    are server-maintained caches (PLAN.md §2 — client never writes points or
--    rating aggregates). Default table-wide grant is revoked and re-granted
--    per column.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, bio, avatar_url, home_city, home_point,
              pace_band, distance_band, languages, units, visibility,
              tos_accepted_at, onboarded_at)
  on public.profiles to authenticated;

-- 3) Home location writer: validates coordinates, sets city + geography point
--    atomically. SECURITY INVOKER — RLS (own row) and the column grants above
--    still apply.
create function public.set_home_location (
  p_lat double precision,
  p_lng double precision,
  p_city text
) returns public.profiles
language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.profiles;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90
     or p_lng not between -180 and 180 then
    raise exception 'invalid coordinates';
  end if;
  if p_city is null or btrim(p_city) = '' or char_length(btrim(p_city)) > 40 then
    raise exception 'invalid city';
  end if;

  update public.profiles
  set home_city = btrim(p_city),
      home_point = extensions.st_setsrid (
        extensions.st_makepoint (p_lng, p_lat), 4326)::extensions.geography
  where id = (select auth.uid ())
  returning * into v_row;

  if v_row is null then
    raise exception 'not authenticated';
  end if;
  return v_row;
end; $$;
```

**RLS review notes**
- `profiles` SELECT (`visibility <> 'hidden' or own`) and UPDATE (own row) policies from `00000000000001_core.sql` are unchanged; P1 adds column-grant hardening only. No INSERT/DELETE policies exist → trigger-only creation, cascade-only deletion — correct.
- No new tables. `connected_accounts` is **P6**; Workstream A only files external applications, no schema.
- Manual-city onboarding path writes `home_city` via plain UPDATE (grant covers it); RPC is used only when coordinates exist.
- The storage policies rely on the `<uid>/…` path convention; the client must never construct another user's prefix (enforced server-side regardless).

## Design references

- **Flow file:** [`Run Everywhere - Auth & Onboarding.dc.html`](../../run-everywhere-app-design/project/Run%20Everywhere%20-%20Auth%20&%20Onboarding.dc.html) — 7 screens: SPLASH (welcome, already built in P0), LOGIN, REGISTER 1 (name/email/password/ToS), REGISTER 2 (photo + home city), ONBOARDING PREFS (pace/distance/languages), PERMISSIONS + CONNECT (location card + Strava/Health/Garmin connect rows), SUCCESS (volt check, "YOU'RE IN", "START EXPLORING"). Copy strings in Workstreams F/H are lifted from this file.
- **Component contracts:** [`Input.d.ts`](../../run-everywhere-app-design/project/components/forms/Input.d.ts), [`IconButton.d.ts`](../../run-everywhere-app-design/project/components/buttons/IconButton.d.ts), [`Button.d.ts`](../../run-everywhere-app-design/project/components/buttons/Button.d.ts) (already ported). Reference implementations in the sibling `.jsx` files.
- **Token groups** (all already in [`src/theme/theme.ts`](../../src/theme/theme.ts)): ink ramp + volt + signal colors; `fonts.display*`/`body*`; `typeScale`, `tracking`, `textStyles`; `spacing`, `radius`, `sizing.controlH/gutter`; `shadows.sm/volt`; `motion.pressScale`.
- **Reconciliation calls** (PLAN.md "Design reconciliation" + shipped schema win): flow file's 3 pace options and multi-select distance chips are reconciled to the schema's 4 `pace_band` values and single `distance_band` (details in Decisions); step-4 "Connect your apps" rows are P6 and dropped from P1; go-green `#00C271` appears only as the "location set"/connected state, per the design readme; buttons uppercase verb-first, no emoji anywhere.

## Verification script

Manual QA (hosted backend unless noted; account A = fresh email, account B = second email):

1. Fresh install (delete app), cold start → lands on welcome; no dev-bypass button.
2. GET STARTED → sign-up: CONTINUE disabled until name/email/valid password/ToS; password hint text matches design copy.
3. Submit sign-up (account A) → app lands on onboarding step 1 without manual navigation.
4. Step 1: pick a photo (crop UI appears), set bio, CONTINUE. In Supabase Studio: `profiles.display_name/bio/avatar_url/tos_accepted_at` set; Storage has `avatars/<uid>/avatar.jpg`; open `avatar_url` in a browser — image loads.
5. Step 2: USE CURRENT LOCATION → OS prompt → city fills; CONTINUE. Studio: `home_city` + non-null `home_point`.
6. Step 3: change pace to FAST, distance LONG, add PT; CONTINUE. Studio row matches.
7. Step 4: MI + MEMBERS; FINISH → success screen with city subline → START EXPLORING → tabs.
8. Kill app, relaunch → straight to tabs (session persisted, no flicker to auth).
9. Profile tab → SIGN OUT → welcome. Log in again (email) → straight to tabs (already onboarded).
10. Forgot password: request for account A; open the email link **on the device** → app opens in reset mode → set new password → routed onward; old password now fails, new one works. Also verify an expired/second-device link shows the "link expired — request a new one" message.
11. Apple sign-in (iOS device, account B via Apple ID): first sign-in → onboarding with prefilled name; abandon after step 2 (kill app), relaunch → back at step 1 with saved values. Complete onboarding. Google sign-in: repeat on Android with a third account or delete account B's user in the dashboard first.
12. **Two-user RLS smoke** — locally: `supabase db reset` then `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_smoke.sql`; on hosted: paste the same blocks into the SQL editor. Expected results (using seeded uuids `…0001` maya / `…0002` marco locally; the two real users' uuids on hosted):
    a. As marco: `update public.profiles set bio='x' where id='<maya>'` → `UPDATE 0`.
    b. As marco: `update public.profiles set points_total = 99999 where id='<marco>'` → `ERROR: permission denied for table profiles` (column grant).
    c. As marco: `insert into storage.objects (bucket_id, name) values ('avatars', '<maya>/avatar.jpg')` → new-row RLS violation.
    d. As maya: `update public.profiles set visibility='hidden' where id='<maya>'` → `UPDATE 1`; then as marco `select count(*) from public.profiles where id='<maya>'` → `0`; as maya herself → `1`.
    Each expected-error case sits in its own `begin … rollback` block; sessions are role-played with `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'`.
13. Two-device sanity: account A on iOS + account B on Android signed in simultaneously; B's Explore/profile screens never show A's hidden data (visibility from 12d).

Automated gates (all must pass; first two + db lint run in CI):

```sh
npm run typecheck
npm run lint
supabase db lint --level warning
supabase db reset                        # migrations + seed apply cleanly
npm run db:types && git diff --exit-code src/types/database.types.ts
```

## Risks & gotchas

| Risk | Mitigation |
|---|---|
| App Store Guideline 4.8 — Google offered without Apple (PLAN.md §6) | Apple button ships in this phase, same screens, listed first, equal prominence; hidden only on Android |
| Apple returns `fullName`/email **only on first authorization** | G4 captures it immediately; onboarding step 1 lets the user fix an empty name. To retest: Settings → Apple ID → Sign-In & Security → Sign in with Apple → revoke the app |
| Google `DEVELOPER_ERROR` / null idToken on Android | Almost always a SHA-1/client-id mismatch — register both debug-keystore and EAS-keystore SHA-1s (G3); `webClientId` must be the **Web** client id |
| PKCE reset link opened on another device/browser → exchange fails | F4 shows "link expired — request a new one" and returns to request mode; QA step 10 covers it |
| Hosted built-in SMTP is heavily rate-limited (a few emails/hour) and not for production | Acceptable for P1 dev volumes; custom SMTP + email confirmations are P7 hardening. Avoid burning sends when testing resets |
| New native modules mean Expo Go and stale dev clients break | All installs batched in G1 with an immediate `expo run:ios/android` rebuild; README already mandates dev builds |
| AuthGate redirect loops or skipped success screen | Guard rules are exhaustive and mutually exclusive (E3); the `onboarded_at` write defers `refreshProfile` until START EXPLORING (H5); `recovering` flag suspends redirects during reset |
| Reverse geocode returns no `city` (rural/odd locales) | Fallback chain city → subregion → region; manual input always available and required-validated |
| Storage RLS gives opaque 4xx from the client | RLS smoke (12c) proves policies at SQL level first; client errors then indicate a wrong path prefix, not policy drift |
| Strava/Garmin reviews stall past P6 (PLAN.md §6) | Applications filed day 1 (Workstream A) with re-check dates in the tracking doc; HealthKit remains the guaranteed P6 integration; both integrations feature-flagged |
| Seeded local users vs hosted users diverge in QA scripts | RLS smoke parameterizes uuids; hosted test users are created through the real sign-up flow (never seeded) |

## Decisions made by this plan

1. **Onboarding = 4 post-auth routes** (`profile`, `location`, `preferences`, `finish`); the flow file counts the sign-up form as "Step 1/4", but OAuth users skip it, so the app renumbers steps 1–4 after authentication. PLAN.md §4's "onboarding/ (4 steps)" is satisfied literally.
2. **Success screen lives inside `finish.tsx`** as a post-save state, not a 5th route — keeps the route contract at 4 steps and simplifies the guard.
3. **Schema wins over flow-file options:** pace = 4 schema bands (EASY/STEADY/QUICK/FAST, new pace copy derived from the design's 3 descriptions); distance = single-select of the 4 `distance_band` values (design's multi-select 5K…Trail chips don't fit the single-enum column).
4. **Languages stored as uppercase ISO-639-1 codes** (`EN`, `PT`, …), matching the seed's `'{EN,PT}'` format; six options from the design.
5. **Design step 4 "Connect your apps" (Strava/Health/Garmin) is dropped from P1** (P6 scope); the step-4 slot instead captures `units` + `visibility` (required by scope, absent from the design), reusing design patterns (segmented control, selectable cards) and its "change later in Settings" caption. Location permission moves to step 2 where it is actually used.
6. **ToS placement:** email flow = required checkbox on sign-up (per design), written to `tos_accepted_at` right after the session exists; OAuth flow = same checkbox on onboarding step 1 when `tos_accepted_at` is null. Enforcement is client-side; no DB constraint added (schema untouched).
7. **Provider buttons also appear on sign-up** (design shows them on login only) — OAuth users start from GET STARTED too; keeps Apple/Google parity on every screen with third-party login.
8. **`flowType: 'pkce'`** on the supabase client; forgot-password uses `redirectTo: 'runeverywhere://forgot-password'` and `exchangeCodeForSession` — no extra route beyond PLAN.md §4's list (group segment elision maps the path).
9. **Email confirmations stay OFF on hosted for P1** (mirrors `config.toml` comment "enable in hosted project for production"); flipping them on + custom SMTP is P7. `signUpWithEmail` already handles the no-session case for that future.
10. **`src/lib/supabase.ts` becomes non-null** and throws a descriptive error when env is missing — post-P1 the app is meaningless without a backend; removes null-guards everywhere.
11. **Routing centralized in a root `AuthGate`** (`useSegments` + `router.replace`); the `<Redirect>`s in `(auth)/_layout` and `(tabs)/_layout` are removed as duplicates. A `recovering` flag suspends redirects during password reset.
12. **Write-through onboarding** (each step persists on CONTINUE, prefilled from `profiles`) instead of a zustand draft store — survives app kills, needs no new store; relaunch resumes at step 1 with saved values.
13. **Deferred `refreshProfile` on FINISH** so the success screen isn't skipped by the guard; store refresh happens on START EXPLORING.
14. **Column-level UPDATE grants on `profiles`** added in P1 (revoke + re-grant writable columns): the core migration's own-row policy would otherwise let users write their own `points_total`/`level`/`rating_*`, violating PLAN.md §2's server-authoritative rule. Plus a `touch_updated_at` trigger since clients can no longer write `updated_at`.
15. **`set_home_location` RPC (SECURITY INVOKER)** for coordinate writes — validates ranges and avoids hand-built WKT in the client; manual-city path uses a plain column update.
16. **Avatar upload pattern:** `expo-image-picker` (library only, square crop, quality 0.7) + `expo-file-system` legacy base64 read + `base64-arraybuffer` → `storage.upload` with `upsert: true` at fixed path `<uid>/avatar.jpg`; `avatar_url` stores the public URL with a `?v=` cache-buster. Photo optional; display name and home city required.
17. **Bucket limits:** 5 MB, `image/jpeg|png|webp` — enforced in the bucket row, not app code.
18. **Migration filenames:** `00000000000010_avatars_storage.sql`, `00000000000011_profiles_onboarding.sql` (P1 slots `…10`–`…19`).
19. **Env strategy:** single active `.env` + committed `.env.example`/`.env.hosted.example` templates; hosted values for device builds come from EAS environment variables referenced by an `"environment"` key per `eas.json` profile. OAuth client IDs are committed (public identifiers); secrets never enter the repo.
20. **Google client config committed to `supabase/config.toml`** for local id-token verification (`[auth.external.google] client_id = "<ios>,<web>"`), Apple likewise with the bundle id.
21. **Legal pages** self-written v1, hosted on Netlify free tier (public repo pages would require a plan change); markdown source kept in `docs/legal/`.
22. **Defaults:** pace `steady`, distance `mid`, languages `['EN']`, units `km`, visibility `everyone` — no locale detection dependency in P1.
23. **Temporary SIGN OUT button** on the `(tabs)/profile` placeholder — required for multi-account QA; replaced by P5's real profile/settings.
24. **CI gains a types-drift step** in the existing `db` job (regenerate against `supabase db start` and diff `src/types/database.types.ts`).

## Out of scope

- Explore map, run discovery, create wizard, run detail/join — **P2**.
- "Connect your apps" onboarding rows and any Strava/Garmin/HealthKit OAuth or data flow (only the *applications* are filed here) — **P6**; `connected_accounts` table — **P6**.
- Chat, push notifications, notification permission prompts, `push_tokens` — **P3**.
- Points ledger, levels, reviews (P1 only *protects* the cache columns) — **P4**.
- Full profile screen, profile editing, settings (incl. changing units/visibility post-onboarding), report/block — **P5**.
- Email confirmations, custom SMTP, account deletion, MFA, deep-link QA matrix, privacy manifests — **P7**.
- Avatar moderation/resizing pipeline (client-side crop + 5 MB cap suffices for v1) — revisit if abused, earliest **P7**.
- `invite/[code]` deep link route — **P2** (the scheme + guard groundwork lands here).
