# Phase implementation plans

Detailed, executable plans for each phase of [PLAN.md §5](../PLAN.md#5-build-order-each-phase-ends-runnable). Each doc is self-contained: a fresh session can pick one up and execute the phase without re-deriving decisions — scope, exact file paths, migration contents, commands, and a verification script are all spelled out.

| Phase | Weeks | Plan | Verify gate |
|---|---|---|---|
| **P0 Foundation** | 1 | [P0-foundation.md](P0-foundation.md) | Boots on both platforms; tabs navigate; gallery renders |
| **P1 Auth + onboarding** | 2–3 | [P1-auth-onboarding.md](P1-auth-onboarding.md) | Full signup → onboarding → tabs; two-user RLS smoke test |
| **P2 Core loop** | 4–7 | [P2-core-loop.md](P2-core-loop.md) | Create → discover → request → approve across two devices |
| **P3 Chat + notifications** | 8–9 | [P3-chat-notifications.md](P3-chat-notifications.md) | Realtime A→B; push with app killed; reminder fires |
| **P4 Live run + points + reviews** | 10–13 | [P4-live-run-points-reviews.md](P4-live-run-points-reviews.md) | Real outdoor run with screen locked; points idempotent; rating aggregates update |
| **P5 Gamification + profile + safety** | 14–16 | [P5-gamification-profile-safety.md](P5-gamification-profile-safety.md) | Leaderboard across week boundary; blocked user disappears everywhere; share URL works in a plain browser |
| **P6 Integrations** | 17–19 | [P6-integrations.md](P6-integrations.md) | Recorded run appears in Apple Health; Strava import for test athlete |
| **P6.5 Monetization (RevenueCat)** | 20–21 | [P6.5-monetization-revenuecat.md](P6.5-monetization-revenuecat.md) | Sandbox purchase unlocks Pro on both platforms; expiry re-locks; restore works after reinstall |
| **P7 Hardening + stores** | 22–24 | [P7-hardening-stores.md](P7-hardening-stores.md) | App Store + Play submissions accepted |

## How to execute a phase

1. Confirm every item in the doc's **Preconditions** section (each has a check command or file to inspect).
2. Work the **Workstreams** in order — tasks state exact paths, migration contents, install commands, and a per-task acceptance check.
3. Finish with the doc's **Verification script** (manual QA steps + `npm run typecheck` / `npm run lint` / `supabase db lint` / types-drift check).
4. A phase is done when its **Definition of done** checklist is fully ticked — every phase must end runnable and demoable.

## Conventions shared by all plans

- **Migration slots:** phase P*n* owns `supabase/migrations/000000000000<n>0`–`<n>9_*.sql` (P0 owns `…00`–`…09` and uses `…02`/`…03` for hardening; P6.5 borrows `…65`–`…69` from P6's range so filename order matches execution order); `00000000000001_core.sql` is the existing schema ground truth.
- **Three tiers ([PLAN.md §2](../PLAN.md#2-architecture)):** Postgres RLS + `SECURITY DEFINER` RPCs for capacity/points/trust; Edge Functions for outbound HTTP + secrets; the client never writes points, approvals, or rating aggregates.
- **Design source of truth:** `run-everywhere-app-design/project/` (tokens, `.d.ts` component contracts, `.dc.html` flows), reconciled per the "Decisions locked" list in its readme — Social is purple `#7C5CFC`, body font Saira, Volt `#CCFF00` is the single hero accent.
- **Ambiguities** each plan resolved are logged in its "Decisions made by this plan" section — change those deliberately, not accidentally.
