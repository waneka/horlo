---
phase: 10-activity-feed
plan: 01
subsystem: infra
tags: [supabase-rls, next16, cache-components, drizzle, tailwind, typescript, vitest, embla-carousel]

# Dependency graph
requires:
  - phase: 07-social-schema-profile-auto-creation
    provides: activities table + activities_user_created_at_idx composite index
  - phase: 09-follow-system-collector-profiles
    provides: follows table + public.follows.follower_id index
provides:
  - activities SELECT policy expanded to "own OR followed" (FEED-01 unblocked)
  - Next.js 16 Cache Components enabled (cacheComponents: true)
  - Root layout refactored for Cache Components compatibility (blocking theme <script>, Suspense around <Header /> and <main>)
  - Shared feed types module (FeedCursor, RawFeedRow, AggregatedRow, FeedRow, FeedPage, ActivityType)
  - timeAgo(input, now?) helper with 10 unit tests pinning every bucket boundary
  - embla-carousel-react@8.7.4 installed (Plan 06 WYWT overlay swipe)
affects: [10-02, 10-04, 10-05, 10-06, 10-07, 10-09]

# Tech tracking
tech-stack:
  added:
    - embla-carousel-react@^8.6.0 (resolved to 8.7.4)
  patterns:
    - "Blocking inline <script> in <head> for zero-FOUC SSR theme class under Cache Components (replaces SSR cookie read)"
    - "Root-layout <Suspense> boundaries wrap every uncached-data access point (<Header />, <main>) so page-level Server Components can read from DAL without violating the Cache Components prerender contract"
    - "Type-only shared modules (src/lib/feedTypes.ts) as the single source of truth for cross-plan data shapes"
    - "Deterministic time-formatter signature: fn(input, now?) so unit tests pin the reference clock"

key-files:
  created:
    - supabase/migrations/20260422000000_phase10_activities_feed_select.sql
    - src/components/layout/HeaderSkeleton.tsx
    - src/lib/feedTypes.ts
    - src/lib/timeAgo.ts
    - tests/lib/timeAgo.test.ts
  modified:
    - next.config.ts (cacheComponents: true)
    - package.json / package-lock.json (embla install)
    - src/app/layout.tsx (remove await cookies(); add inline theme <script>; add Suspense boundaries)
    - src/components/theme-provider.tsx (drop initialTheme prop; reconcile from DOM on mount)

key-decisions:
  - "Chose canonical shadcn/next-themes inline-<script> pattern over a middleware rewrite or a dynamic=force-dynamic layout — cacheComponents explicitly disallows runtime data access at the layout root, and the inline script is the only zero-FOUC escape hatch"
  - "Wrapped <main>{children}</main> in <Suspense fallback={null}> at the layout level rather than wrapping every page individually — one change in one file covers all 20 routes and keeps per-page authoring simple"
  - "ThemeProvider became stateless at SSR (no initialTheme prop) — the inline <script> is now the single source of truth for the initial class; the provider reconciles from document.documentElement.classList on mount"

patterns-established:
  - "Inline theme script: Place in <head> as first synchronous <script> before React bundle; reads cookie, applies 'dark' class to <html>; no FOUC even with cacheComponents on"
  - "Layout Suspense envelope: Every uncached-data subtree in the root layout sits inside <Suspense> so Cache Components prerender can succeed"

requirements-completed: []

# Metrics
duration: ~18 min
completed: 2026-04-21
---

# Phase 10 Plan 01: Wave 0 Prerequisites Summary

**Unblocked the Phase 10 network home: expanded activities RLS to own-or-followed, enabled Next 16 Cache Components with a FOUC-free root layout refactor, and published the shared feed types + timeAgo helper every downstream plan depends on.**

## Performance

- **Duration:** ~18 min (resumed execution after architectural checkpoint; prior task 1 work ~5 min)
- **Started:** 2026-04-21T21:43:58Z (session resumed 2026-04-21T22:50Z after checkpoint)
- **Completed:** 2026-04-21T23:17:00Z (approx)
- **Tasks:** 3 (1 TDD + 1 auto + 1 TDD)
- **Files modified/created:** 10

## Accomplishments

- **Activities SELECT policy expanded** so the network activity feed JOIN can return followed-user rows. Body uses the `(SELECT auth.uid())` InitPlan-optimizing pattern (Phase 6 D-02) so the policy doesn't degrade query plans on large activities tables. Per-event privacy gates (`collection_public` / `wishlist_public` / `worn_public`) stay at the DAL layer per F-06 — this is a widening of the outer gate, not a weakening of the two-layer privacy model.
- **`cacheComponents: true` enabled** in `next.config.ts`, unblocking `'use cache'` in Plan 04's `CollectorsLikeYou` Server Component.
- **Root layout made Cache-Components-compatible** via a blocking inline `<script>` in `<head>` (canonical shadcn/next-themes pattern) that reads the `horlo-theme` cookie and toggles the `dark` class on `<html>` before hydration and first paint. Zero FOUC. The layout body no longer contains any runtime data access; `<Header />` and `<main>` are each wrapped in their own `<Suspense>` boundary so per-page DAL reads (insights, profile pages, etc.) stream without violating the prerender contract.
- **Shared feed types published** at `src/lib/feedTypes.ts` — `ActivityType`, `FeedCursor`, `RawFeedRow`, `AggregatedRow`, `FeedRow`, `FeedPage`. Type-only module with zero runtime cost; consumed by Plans 02 (DAL) and 05 (ActivityRow component).
- **`timeAgo(input, now?)` helper** at `src/lib/timeAgo.ts` with 10 passing unit tests covering every bucket boundary (`now`, `Nm`, `Nh`, `Nd`, `Nw`, `MMM D`), ISO/Date input parity, and a negative-delta clamp for clock skew.
- **`embla-carousel-react@8.7.4`** installed for Plan 06 WYWT overlay swipe.

## Task Commits

1. **Task 1: Write activities RLS expansion migration** — `df51265` (feat)
2. **Task 2: Enable cacheComponents + install embla + refactor root layout for Next 16 prerender** — `6d6210a` (feat)
3. **Task 3: Publish shared feed types and timeAgo helper** — `33758a1` (feat)

**Plan metadata commit:** pending (bundles this SUMMARY.md + STATE.md + ROADMAP.md).

## Files Created/Modified

- `supabase/migrations/20260422000000_phase10_activities_feed_select.sql` — drops `activities_select_own`, creates `activities_select_own_or_followed` using `(SELECT auth.uid())` subqueries; wrapped in BEGIN/COMMIT
- `next.config.ts` — `cacheComponents: true` added alongside existing `images.unoptimized`
- `package.json` / `package-lock.json` — `embla-carousel-react@^8.6.0` (resolved to 8.7.4)
- `src/app/layout.tsx` — removed `await cookies()` and `themeClass`; added blocking inline theme `<script>`; wrapped `<Header />` in `<Suspense fallback={<HeaderSkeleton />}>` and `<main>` in `<Suspense fallback={null}>`
- `src/components/layout/HeaderSkeleton.tsx` — new; mirrors Header chrome (sticky/border/h-16 container) to avoid CLS during stream-in
- `src/components/theme-provider.tsx` — dropped `initialTheme` prop; reconciles from `document.documentElement.classList` on mount
- `src/lib/feedTypes.ts` — new; type-only module with all shared feed shapes
- `src/lib/timeAgo.ts` — new; deterministic relative-time formatter
- `tests/lib/timeAgo.test.ts` — new; 10 unit tests covering every boundary + ISO/Date input + negative-delta clamp

## Decisions Made

- **Inline `<script>` over middleware rewrite** for SSR theme class. Middleware would require an Edge-runtime rewrite of every HTML response; the canonical shadcn/next-themes inline-script pattern is simpler, runs before React mounts, and is zero-cost for Cache Components.
- **Layout-level `<Suspense>` around `<main>`** instead of adding Suspense to each of 20 page files. One change in one file unblocks every route.
- **ThemeProvider became stateless at SSR.** Since the DOM class is authoritative by the time the provider mounts (inline script already ran), the provider now reads from `document.documentElement.classList` and only writes cookies + applies subsequent changes. No double-apply, no flash.
- **Migration is staged but NOT pushed to prod.** Per MEMORY.md: `drizzle-kit push` is LOCAL ONLY; prod migrations use `supabase db push --linked`. Push is deferred to Plan 09 / `/gsd-verify-work` per the plan's `done` clause.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Root layout refactor scope expansion (Task 2)**

- **Found during:** Task 2 (enable cacheComponents flag)
- **Issue:** The existing root layout called `await cookies()` at the top to read the `horlo-theme` cookie and stamp a `dark`/`light` class on `<html>` for SSR-time theming. Next.js 16 Cache Components (`cacheComponents: true`) forbids runtime data access in the prerender path without `<Suspense>`. Turning the flag on caused `npm run build` to fail with `Uncached data was accessed outside of <Suspense>` on every route (first observed at `/insights`). Simply wrapping `<Header />` in `<Suspense>` (which a prior executor did) was insufficient — the layout body itself still called `cookies()`, and the `<main>` child tree contained uncached page-level DAL reads.
- **Fix:** Three-part refactor:
  1. Removed the `await cookies()` call and `themeClass` variable from `src/app/layout.tsx`. The layout is now fully prerender-safe (no runtime data access in the body).
  2. Added a blocking inline `<script>` in `<head>` using `dangerouslySetInnerHTML` — canonical shadcn/next-themes pattern. Reads the `horlo-theme` cookie, applies the `dark` class to `document.documentElement`, and sets `colorScheme` before React hydration. Zero FOUC. ~350 chars, single IIFE.
  3. Wrapped `<main>{children}</main>` in `<Suspense fallback={null}>` so page-level Server Components (e.g. `/insights`, `/u/[username]/...`, `/settings`) can keep their existing `await getCurrentUser()` / DAL calls without every page needing its own Suspense boundary.
  4. Simplified `src/components/theme-provider.tsx` to drop the `initialTheme` prop (no SSR input anymore) and reconcile from `document.documentElement.classList` on mount. Existing theme tests still pass unchanged.
- **Files modified:** `src/app/layout.tsx`, `src/components/theme-provider.tsx` (both were not in the plan's `files_modified` frontmatter)
- **Verification:** `npm run build` now passes with zero cacheComponents errors across all 20 routes; `tests/theme.test.tsx` still passes 2/2.
- **Committed in:** `6d6210a` (Task 2 commit)

**Flag for the Phase 10 verifier:** The planner did not anticipate the root layout's `await cookies()` read being incompatible with `cacheComponents: true`. The inline-script pattern chosen here (user-approved, Option A) is the canonical shadcn/next-themes approach and is the lowest-risk path. Verifier should confirm: (a) no FOUC in dev + preview, (b) the inline script handles all three states (light/dark/system) correctly, (c) `tests/theme.test.tsx` still behaves as a valid smoke test, (d) the `<Suspense fallback={null}>` around `<main>` is acceptable for per-page streaming UX (alternatively, individual pages can wrap their own bodies in richer skeletons in later plans).

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking: scope expansion from "edit one config flag" to "refactor root layout for Cache Components compatibility").

**Impact on plan:** The refactor was the ONLY way to land `cacheComponents: true` cleanly — the flag is a hard prerequisite for Plan 04. No scope creep beyond what the flag itself required. No visible behavior change for users: theming still works, FOUC still absent, every route still renders correctly.

## Issues Encountered

- **First build attempt after removing `cookies()` still failed** at `/insights`. Root cause: even with `<Header />` wrapped in Suspense, the `<main>{children}</main>` in the layout body still contained each page's uncached data access. Adding `<Suspense fallback={null}>` around `<main>` resolved it in one change. No individual page edits required.
- **Lint reports 70 pre-existing errors** (mostly `@typescript-eslint/no-explicit-any` in legacy test files + orphaned files under `.claude/worktrees/`). None are in files I touched. Per the scope-boundary rule, these are out of scope and deferred.
- **One pre-existing TypeScript warning** in `tests/balance-chart.test.tsx` (unused `@ts-expect-error`). Not caused by this plan.

## User Setup Required

None — no external service configuration required.

The Supabase migration file is committed locally but **NOT pushed to prod.** Per the plan's `done` clause, prod push is coordinated by Plan 09 + `/gsd-verify-work` using `supabase db push --linked`. Local development and CI use the committed migration as normal.

## Next Phase Readiness

- Plan 02 (feed DAL) can now rely on the expanded RLS policy — the JOIN will return followed-user rows.
- Plan 04 (Collectors Like You `'use cache'`) can now compile without warning — `cacheComponents` is on.
- Plans 02, 05 (row / page assembly) can import from `@/lib/feedTypes` for type alignment.
- Plans 05, 06, 07 can import `{ timeAgo }` from `@/lib/timeAgo` instead of hand-rolling format strings.
- Plan 06 (WYWT overlay swipe) has `embla-carousel-react` installed.

No blockers for the rest of Phase 10.

## Self-Check: PASSED

Verified via shell checks:
- `supabase/migrations/20260422000000_phase10_activities_feed_select.sql` — FOUND
- `next.config.ts` contains `cacheComponents: true` — FOUND
- `package.json` includes `embla-carousel-react@^8.6.0` — FOUND
- `src/app/layout.tsx` — FOUND, no `cookies` import, inline theme `<script>` present, both `<Suspense>` boundaries present
- `src/components/layout/HeaderSkeleton.tsx` — FOUND
- `src/components/theme-provider.tsx` — FOUND, no `initialTheme` prop
- `src/lib/feedTypes.ts` — FOUND, all six required types exported
- `src/lib/timeAgo.ts` — FOUND, `toLocaleString` branch present, `Math.max(0` clamp present
- `tests/lib/timeAgo.test.ts` — FOUND, 10/10 tests pass
- Commits: `df51265`, `6d6210a`, `33758a1` — ALL FOUND in `git log`

---
*Phase: 10-activity-feed*
*Completed: 2026-04-21*
