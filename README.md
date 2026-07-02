# Run Everywhere

Social running app — create runs, discover runs near you on a map, run together, get rewarded.

- **Plan & architecture:** [docs/PLAN.md](docs/PLAN.md)
- **Design source of truth:** [run-everywhere-app-design/](run-everywhere-app-design/) (tokens, component contracts, flow prototypes)
- **Stack:** Expo SDK 56 (React Native + TypeScript, expo-router) · Supabase (Postgres + PostGIS, Auth, Realtime, Storage, Edge Functions) · react-native-maps (Google provider) · TanStack Query + Zustand

## Prerequisites

- Node 22+, npm
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (local backend)
- Xcode (iOS) and/or Android Studio — a **development build** is required; Expo Go cannot run `react-native-maps`

## Local development

```sh
# 1. Install dependencies
npm install

# 2. Start the local Supabase stack (Postgres + PostGIS, Auth, Studio)
supabase start          # prints the anon key
supabase db reset       # applies supabase/migrations + seed.sql

# 3. Configure the app
cp .env.example .env    # paste the anon key from `supabase start`

# 4. Run a development build
npx expo run:ios        # or: npx expo run:android
```

Seeded logins (local only): `maya@example.com` / `marco@example.com`, password `password123`. Until Phase 1 wires real auth screens, the welcome screen's **"Enter app (dev)"** button skips sign-in.

A component gallery of the ported design system lives at the `/dev/components` route (linked from the Explore screen in dev).

### Useful scripts

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |
| `npm run db:types` | Regenerate `src/types/database.types.ts` from the local DB |

## Project layout

```
src/app/          expo-router routes — (auth), (tabs) w/ Volt center-FAB tab bar, create/ wizard, dev/
src/components/   design-system components ported from the design bundle
src/theme/        theme.ts — 1:1 token port of run-everywhere-app-design/project/tokens/*.css
src/lib/          supabase client, query client
src/stores/       zustand stores (session)
assets/fonts/     Saira + Saira Condensed (bundled locally, per design readme)
supabase/         migrations (schema source of truth), seed.sql, Edge Functions
docs/PLAN.md      full production plan: architecture, data model, phases, risks, costs
```

## Building & releasing (EAS)

```sh
npm i -g eas-cli && eas login
eas init                                # links the project, fills extra.eas.projectId
eas build --profile development        # dev client for both platforms
eas build --profile production
eas submit --platform ios              # / android
```

Store setup notes (privacy manifests, background-location review notes, Guideline 4.8 / Sign in with Apple) are covered in [docs/PLAN.md §Phase 7](docs/PLAN.md).
