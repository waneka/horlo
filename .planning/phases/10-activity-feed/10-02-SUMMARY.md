---
phase: 10-activity-feed
plan: 02
subsystem: read-side-feed-engine
tags: [drizzle, postgres, keyset-pagination, rls, privacy, zod, server-actions, vitest, tdd]

# Dependency graph
requires:
  - plan: 10-01
    provides: |
      activities RLS expanded to own-or-followed (outer gate) +
      shared feed types (@/lib/feedTypes) + cacheComponents flag
provides:
  - "getFeedForUser(viewerId, cursor, limit) DAL — keyset-paginated JOIN with two-layer privacy (RLS + DAL WHERE)"
  - "aggregateFeed(rows) pure function — F-08 time-window collapse for runs of >=3 same-(userId, type) rows within 1h"
  - "loadMoreFeed Server Action — Zod-strict page-2+ pagination composing getFeedForUser + aggregateFeed"
  - "RawFeedPage interface exported from @/data/activities (distinct from the post-aggregation FeedPage)"
affects: [10-03, 10-04, 10-05, 10-06, 10-07, 10-08, 10-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw vs. aggregated page types: DAL emits RawFeedRow[]; aggregator converts to FeedRow[]; Server Action returns FeedRow[] with nextCursor"
    - "Integration-test gate via hasLocalDb (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) — seeded tests skip cleanly in CI without local Supabase"
    - "Keyset cursor as Drizzle sql-tag tuple comparison `(created_at, id) < ($ts, $id)` passed in WHERE alongside other predicates — no custom SQL files required"

key-files:
  created:
    - src/lib/feedAggregate.ts
    - src/app/actions/feed.ts
    - tests/lib/feedAggregate.test.ts
    - tests/data/getFeedForUser.test.ts
    - tests/actions/feed.test.ts
  modified:
    - src/data/activities.ts

key-decisions:
  - "Split RawFeedPage (DAL output, RawFeedRow[]) from FeedPage (public post-aggregation, FeedRow[]) — prevents the wider aggregated union from leaking into DAL callers that want to aggregate themselves, and keeps the Server Action composition type-correct"
  - "Integration-test suite uses describe.skip without NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — mirrors the existing precedent in tests/data/isolation.test.ts so unit tests stay green in CI without Supabase"
  - "Unit test Part A uses a mock-Drizzle chainable builder that records every .from/.innerJoin/.where/.orderBy/.limit call — exact SQL shape (3 innerJoins, orderBy with 2 args, limit+1) is asserted without needing a DB"
  - "aggregateFeed does not read the wall clock — timestamps are parsed only from input rows' ISO strings, so the pure-function contract holds (determinism test fixtures seed year-2020 timestamps to prove it)"
  - "Normalize metadata at the DAL edge (JSONB -> { brand, model, imageUrl }) with typeof guards, so legacy activities rows with partial or null metadata render without crashing downstream UI"

patterns-established:
  - "RawFeedPage / FeedPage split is the contract for every future feed-reading surface: SSR initial render calls getFeedForUser directly and aggregates itself (or not); the Server Action loadMoreFeed composes and returns the aggregated shape"
  - "Integration tests under tests/data/*.test.ts can co-locate a unit-test describe block (always-on) and an integration describe block (gated on hasLocalDb) in a single file"

requirements-completed: [FEED-01, FEED-02, FEED-03, FEED-04]

# Metrics
duration: ~10 min
completed: 2026-04-21
---

# Phase 10 Plan 02: Read-Side Engine Summary

**Landed the Network Activity feed's read-side backbone: a two-layer-privacy keyset-paginated JOIN DAL, a pure-function time-window aggregator for F-08 bulk collapse, and a Zod-strict `loadMoreFeed` Server Action — 28 unit tests (12 + 8 + 8) green plus an 11-case integration suite that runs whenever a local Supabase stack is available.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-21T23:20:26Z
- **Completed:** 2026-04-21T23:30:17Z
- **Tasks:** 3 (all TDD: RED test, then GREEN implementation)
- **Files created/modified:** 6 (1 lib, 1 action, 1 DAL extension, 3 test files)
- **Commits:** 7 task commits + this metadata commit

## Accomplishments

- **`aggregateFeed()` pure function** at `src/lib/feedAggregate.ts` implementing F-08: consecutive runs of `>=3` same-(userId, type) rows where `type ∈ {watch_added, wishlist_added}` within a 1-hour window collapse into a single `AggregatedRow` with `count`, `collapsedIds`, `representativeMetadata` (from the most-recent row), `firstCreatedAt` (head), and `lastCreatedAt` (tail). `watch_worn` short-circuits and is never aggregated. The function is deterministic — no `Date.now()` or any other wall-clock read, timestamps are parsed exclusively from the input rows' ISO strings. 12 behavioral tests pin every edge case: empty, singleton, sub-threshold runs, multi-actor, cross-type, window-break, and determinism (year-2020 fixtures prove the absence of wall-clock dependence).

- **`getFeedForUser()` DAL** extension at `src/data/activities.ts`: single-JOIN keyset-paginated query over `activities INNER JOIN profiles INNER JOIN profile_settings INNER JOIN follows` with:
  - **F-05 own-filter** via `not(eq(activities.userId, viewerId))`
  - **F-06 two-layer privacy** — outer `profile_public = true` gate, inner per-event gate switched on `activities.type` against `collection_public` / `wishlist_public` / `worn_public`
  - **FEED-03 keyset** — tuple-comparison cursor `(created_at, id) < ($cursorCreatedAt, $cursorId)` using Drizzle's `sql` tag; ORDER BY `createdAt DESC, id DESC` matches the cursor direction for correctness
  - **Pitfall 11 fix** — explicit column selection (no `SELECT *` over joined tables); payload stays minimal as collections grow
  - **limit + 1 sentinel** — one extra row tells us `hasMore` without a second query
  - **Metadata normalizer** — typeof guards tolerate null / partial JSONB so legacy activity rows still render downstream

- **`loadMoreFeed` Server Action** at `src/app/actions/feed.ts`: `'use server'` directive, `getCurrentUser()` auth gate, two `.strict()` Zod schemas (outer `{ cursor }` and inner `{ createdAt: datetime, id: uuid }`), composes `getFeedForUser` then `aggregateFeed`. Rejects null cursors — page 1 is rendered by the home Server Component, so the action exists only for subsequent pages per F-04. DAL failures log `[loadMoreFeed]` prefix and surface `"Couldn't load more."` (not a raw error).

- **RawFeedPage vs FeedPage split** — introduced `export interface RawFeedPage` on `src/data/activities.ts` for the DAL's output shape (`RawFeedRow[]`), kept the existing `FeedPage` in `src/lib/feedTypes.ts` as the post-aggregation shape (`FeedRow[]`). Lets callers pick the precise contract: SSR can read raw and defer aggregation to the client; the Server Action aggregates server-side and returns the wider type.

## Task Commits

1. **Task 1 RED — failing tests for aggregateFeed** — `e4ad196` (test)
2. **Task 1 GREEN — aggregateFeed implementation** — `1d27e22` (feat)
3. **Task 2 RED — failing tests for getFeedForUser DAL** — `84f3fc0` (test)
4. **Task 2 GREEN — getFeedForUser implementation** — `b70c0cf` (feat)
5. **Task 3 RED — failing tests for loadMoreFeed Server Action** — `cb3bad9` (test)
6. **Task 3 GREEN — loadMoreFeed implementation** — `23238c2` (feat)
7. **Post-GREEN fix — narrow DAL return type to RawFeedPage; tighten test types** — `0f31dd4` (fix)

Plan metadata commit is made after this SUMMARY is written (bundles SUMMARY.md + STATE.md + ROADMAP.md).

## Files Created/Modified

- `src/lib/feedAggregate.ts` — new; pure F-08 aggregator, 71 lines
- `src/data/activities.ts` — modified; preserves existing `logActivity` export, adds `RawFeedPage` interface + `getFeedForUser` DAL (~100 new lines)
- `src/app/actions/feed.ts` — new; `loadMoreFeed` Server Action, 56 lines
- `tests/lib/feedAggregate.test.ts` — new; 12 behavioral tests, 196 lines
- `tests/data/getFeedForUser.test.ts` — new; 8 unit + 11 integration tests, ~540 lines
- `tests/actions/feed.test.ts` — new; 8 Server Action branches, 132 lines

## SQL Shape

### Generated query (canonical form as emitted by Drizzle)

```sql
SELECT
  activities.id,
  activities.type,
  activities.created_at,
  activities.watch_id,
  activities.metadata,
  activities.user_id,
  profiles.username,
  profiles.display_name,
  profiles.avatar_url
FROM activities
INNER JOIN profiles
  ON profiles.id = activities.user_id
INNER JOIN profile_settings
  ON profile_settings.user_id = activities.user_id
INNER JOIN follows
  ON follows.follower_id = $viewerId
  AND follows.following_id = activities.user_id
WHERE
  activities.user_id <> $viewerId                                -- F-05
  AND profile_settings.profile_public = true                      -- F-06 outer
  AND (                                                           -- F-06 inner
    (activities.type = 'watch_added'     AND profile_settings.collection_public = true)
    OR (activities.type = 'wishlist_added' AND profile_settings.wishlist_public  = true)
    OR (activities.type = 'watch_worn'     AND profile_settings.worn_public      = true)
  )
  AND (activities.created_at, activities.id) < ($cursorCreatedAt, $cursorId)   -- if cursor
ORDER BY activities.created_at DESC, activities.id DESC
LIMIT $limit + 1;
```

### Plan quality note (EXPLAIN ANALYZE)

The canonical Postgres plan for this shape on a production data volume uses an index scan on `activities_user_created_at_idx` (composite on `(user_id, created_at)`) when `follows` is probed first — the query planner typically resolves follows (small, viewer-scoped) then nested-loop-joins into activities using the composite index for ordering + filtering.

**Manual EXPLAIN ANALYZE not run during this executor session** because no local Supabase stack was attached (integration tests were skipped). This is left as a verifier-side check: run the DAL against a seeded local DB and confirm the `activities_user_created_at_idx` index appears in the EXPLAIN output. The integration suite in `tests/data/getFeedForUser.test.ts` activates automatically when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set (11 cases: FEED-01, FEED-02, F-05, four F-06 branches, not-followed exclusion, 25-row keyset, stable-cursor insert, same-timestamp tiebreaker).

## Decisions Made

- **`RawFeedPage` split from `FeedPage`.** Discovered at build-time (Rule 1): typing the DAL's return as `FeedPage` (`FeedRow[]`) broke `aggregateFeed(rows)` — the aggregator expects `RawFeedRow[]` and `FeedRow` is a union. Introducing a narrower DAL return type resolved it cleanly without weakening the public post-aggregation contract. Future SSR callers that want raw rows now get the precise type; `loadMoreFeed` composes up to `FeedRow[]` at its boundary.
- **Integration tests gated on env vars, unit tests inline.** The plan's acceptance criteria asked for 10+ `it()` cases proving privacy and keyset behavior against a real DB. Rather than split into two files, co-located an always-on Drizzle-mock unit suite (SQL shape assertions) with a `describe.skipIf(!hasLocalDb)` integration suite seeding real profiles and activity rows. Matches the precedent in `tests/data/isolation.test.ts`. Verifier can flip env vars to run the full integration suite locally.
- **Metadata normalizer at the DAL edge.** Activities rows from before Phase 7's metadata-JSONB convention may have `null` metadata. Returning `{ brand: '', model: '', imageUrl: null }` keeps the UI resilient without burdening every row component with null checks — this is Rule 2 (correctness requirement).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DAL return type mismatch with Server Action consumer**

- **Found during:** `npm run build` after Task 3 landed.
- **Issue:** The plan's function signature typed `getFeedForUser(): Promise<FeedPage>`, but `FeedPage.rows` is `FeedRow[]` (the post-aggregation union). Passing those rows into `aggregateFeed(rows)` — which expects `RawFeedRow[]` — caused a TypeScript compile error: `Argument of type 'FeedRow[]' is not assignable to parameter of type 'RawFeedRow[]'`. Unit tests did not catch this because they invoke the function directly without composing it; the build did.
- **Fix:** Introduced a narrower `RawFeedPage` interface on `src/data/activities.ts` (`rows: RawFeedRow[]`) and retyped `getFeedForUser()` to return `Promise<RawFeedPage>`. `FeedPage` in `@/lib/feedTypes.ts` is preserved as the public post-aggregation shape used by the Server Action. No breaking change — there were no existing imports of `FeedPage` as a DAL return type yet.
- **Files modified:** `src/data/activities.ts`
- **Verification:** `npm run build` green after fix; full test suite still 1549 passing.
- **Committed in:** `0f31dd4` (bundled with the lint fixes).

**2. [Rule 1 - Lint] Test files triggered `@typescript-eslint/no-explicit-any`**

- **Found during:** `npm run lint` after Task 3.
- **Issue:** Integration tests used `(row as any).id` to extract IDs from the `FeedRow` discriminated union, and a handful of unused imports remained (`HOUR`, `eq`, `inArrayFn`).
- **Fix:** Added typed `rowId(row: FeedRow): string | null` and `rowCreatedAt(row: FeedRow): string` helpers; replaced every `as any` with a call. Removed unused imports and added a swallow-comment to the best-effort `afterAll` cleanup (`{} catch { /* comment */ }`).
- **Files modified:** `tests/data/getFeedForUser.test.ts`, `tests/lib/feedAggregate.test.ts`
- **Verification:** `npm run lint` — zero errors/warnings on files introduced by Plan 10-02. (Pre-existing lint errors in unrelated files remain per the scope-boundary rule.)
- **Committed in:** `0f31dd4` (same commit as fix #1 — they landed together).

**Total deviations:** 2 auto-fixed (Rule 1 - Bug: type mismatch; Rule 1 - Lint: test types). No architectural decisions needed.

**Impact on plan:** None on plan scope. The DAL / Server Action / aggregator all implement exactly what the plan described; only the internal return type annotation was tightened.

## Issues Encountered

- **Next.js Turbopack build caught the type mismatch, not `tsc` directly.** Worth noting for the verifier: `npm run build` is the strictest type check in this repo (there's no standalone `npm run type-check`). Always run it before declaring a plan done.
- **Pre-existing lint errors in unrelated test files** (70 errors across `tests/actions/*`, `tests/data/isolation.test.ts`, `tests/proxy.test.ts`). None caused by this plan. Logged for future cleanup; out of scope per the scope-boundary rule.

## User Setup Required

None. No new secrets, no new env vars. The Supabase migration from Plan 01 is the only runtime-affecting change in Phase 10 so far and it's already committed (deferred to `supabase db push --linked` in Plan 09 / verify).

**To run the integration suite locally:** set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (both from `supabase status` against a local stack) and run `npm test -- tests/data/getFeedForUser.test.ts`. 11 additional tests activate.

## Next Phase Readiness

- **Plan 10-05 (ActivityRow + feed assembly)** can import `{ aggregateFeed }` from `@/lib/feedAggregate`, `{ getFeedForUser }` from `@/data/activities`, and `{ loadMoreFeed }` from `@/app/actions/feed`.
- **Plan 10-03..09** can rely on the DAL's two-layer privacy enforcement — no further gate logic needed at the component level.
- **RawFeedPage** is the DAL contract for the home Server Component's initial render (pass `cursor = null`, aggregate on the server, pass `FeedRow[]` to the client).

No blockers for the rest of Phase 10.

## Self-Check: PASSED

Verified via shell checks:

- `src/lib/feedAggregate.ts` — FOUND; contains `ONE_HOUR_MS = 60 * 60 * 1000`, `export function aggregateFeed`, NO `Date.now()` call
- `src/data/activities.ts` — FOUND; preserves `export async function logActivity`; adds `export async function getFeedForUser` with 3 `.innerJoin` calls, `not(eq(activities.userId, viewerId))`, all four privacy-settings checks, `(created_at, id) < ...` tuple, `orderBy(desc, desc)`, `limit + 1`
- `src/app/actions/feed.ts` — FOUND; `'use server'` is line 1; has `.strict()`, `z.string().uuid()`, `z.string().datetime()`, `[loadMoreFeed]` error prefix
- `tests/lib/feedAggregate.test.ts` — FOUND, 12 `it()` cases, all passing
- `tests/data/getFeedForUser.test.ts` — FOUND, 8 unit + 11 integration-gated `it()` cases
- `tests/actions/feed.test.ts` — FOUND, 8 `it()` cases, all passing
- Commits `e4ad196`, `1d27e22`, `84f3fc0`, `b70c0cf`, `cb3bad9`, `23238c2`, `0f31dd4` — ALL FOUND in `git log`
- `npm test` — 1549 passing, 14 skipped (3 pre-existing + 11 Plan 10-02 integration-gated)
- `npm run build` — green
- `npm run lint` — zero errors/warnings on Plan 10-02 files

---
*Phase: 10-activity-feed*
*Completed: 2026-04-21*
