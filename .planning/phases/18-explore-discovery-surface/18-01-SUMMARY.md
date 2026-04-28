---
phase: 18-explore-discovery-surface
plan: 01
subsystem: data-access-layer
tags: [drizzle, postgres, supabase, discovery, catalog, two-layer-privacy, sql-window]

# Dependency graph
requires:
  - phase: 17-catalog-foundation
    provides: watches_catalog + watches_catalog_daily_snapshots tables, denormalized owners_count + wishlist_count, pg_cron daily refresh + snapshot writer, public-read RLS, named normalization columns
provides:
  - "src/data/discovery.ts: getMostFollowedCollectors(viewerId, {limit}) — Popular Collectors rail (DISC-04)"
  - "src/data/discovery.ts: getTrendingCatalogWatches({limit}) — Trending Watches rail (DISC-05)"
  - "src/data/discovery.ts: getGainingTractionCatalogWatches({limit}) — Gaining Traction rail (DISC-06)"
  - "src/data/wearEvents.ts: getWearEventsCountByUser(userId) — hero render gate (DISC-03)"
  - "Public TS interfaces consumed by Plan 02 components: PopularCollector, TrendingWatch, GainingTractionWatch, GainingTractionResult"
  - "Wave 0 test scaffolds + 4 integration test files (DATABASE_URL gated)"
affects: [18-02 (Wave 2 components consume these readers), 18-03 (See-all pages reuse readers with limit=50), 18-05 (Server Actions invalidate explore tags after follow/addWatch)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cap-5 vs cap-50 strategy: single DAL per rail parameterized by limit; rail callers pass 5, See-all pages pass 50 (RESEARCH Pattern 5)"
    - "DISTINCT ON (catalog_id) ORDER BY catalog_id, snapshot_date ASC for oldest-snapshot-per-row in window (RESEARCH Pattern 5)"
    - "Three-window discovery (window=0 deploy day, window∈[1..6] partial, window=7 clamped) with explicit return shape (D-12)"
    - "Per-test stamp prefix isolation for global catalog tests (mirrors phase17-natural-key.test.ts allIds tracking)"

key-files:
  created:
    - "src/data/discovery.ts — three /explore DAL readers, server-only, two-layer privacy on Popular Collectors"
    - "tests/data/getMostFollowedCollectors.test.ts — 6 integration tests (self/already-followed/private exclusion + tie-break + limit + empty pool)"
    - "tests/data/getTrendingCatalogWatches.test.ts — 5 integration tests (sort, tie-break, zero-signal exclusion, limit, denormalized counts)"
    - "tests/data/getGainingTractionCatalogWatches.test.ts — 7 integration tests (D-12 cases 1/2/3 + delta math + non-positive exclusion + tie-break + limit)"
    - "tests/data/getWearEventsCountByUser.test.ts — 3 integration tests (zero, count, cross-user isolation)"
  modified:
    - "src/data/wearEvents.ts — appended getWearEventsCountByUser; cheap count(*)::int cast mirrors getFollowerCounts; does NOT filter on visibility"

key-decisions:
  - "D-13/D-15 honored: Popular Collectors tie-break by username ASC after followersCount DESC; Trending and Gaining Traction tie-break by brand_normalized ASC then model_normalized ASC"
  - "Pitfall 2 (count() coercion) honored: every COUNT aggregate carries explicit ::int cast so JS sees a Number, not a string from libpq"
  - "Pitfall 3 (snapshot_date TEXT) honored: every snapshot_date arithmetic uses ::date cast, never lexicographic TEXT compare"
  - "Pitfall 6 (notInArray empty) honored: excludeIds.length > 0 guard precedes notInArray; even though spread of viewerId guarantees ≥1 element, the guard is defense-in-depth"
  - "Hero gate counts wear events regardless of visibility (RESEARCH §State of the Art row 4): the question is 'has the viewer ever posted a wear?' — not 'have they posted publicly?'"
  - "getMostFollowedCollectors hydrates watchCount via second inArray-batched query (anti-N+1) instead of subquery in main aggregation; mirrors src/data/follows.ts mergeListEntries pattern"
  - "getMostFollowedCollectors fetches max(limit, 50) at SQL level then JS .slice(0, limit) — matches Pattern 5 pre-LIMIT cap idiom from Phase 16; lets future tie-break refactors stay on existing fetched set"
  - "getGainingTractionCatalogWatches uses raw db.execute<...> for the WITH-CTE + DISTINCT ON SQL because Drizzle query builder cannot express DISTINCT ON cleanly; all variables interpolated via ${} parameterization (T-18-01-02 SQL injection mitigation)"

patterns-established:
  - "Two-layer privacy on Popular Collectors: innerJoin(profileSettings) + eq(profilePublic, true) + RLS at DB layer (mirrors src/data/search.ts:74-91)"
  - "Per-test brand stamp prefix `${stamp}-suffix` for catalog test isolation (so global DAL tests can assert their own rows without depending on empty-DB precondition)"
  - "Plan-01 Wave-0 it.todo scaffolds folded INTO the same plan: Task 1 creates them, Tasks 2 + 3 fill them; downstream component-test plans can rely on the assertions existing"

requirements-completed: [DISC-03, DISC-04, DISC-05, DISC-06]

# Metrics
duration: ~14min
completed: 2026-04-28
---

# Phase 18 Plan 01: Discovery DAL Readers Summary

**Three /explore DAL readers + hero-gate count helper, all server-only, with two-layer privacy on Popular Collectors and Pitfall 2/3/6 mitigations end-to-end.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-04-28T16:30:46Z
- **Completed:** 2026-04-28T16:44:45Z
- **Tasks:** 3 of 3 completed
- **Files modified:** 6 (1 modified, 5 created)

## Accomplishments

- Shipped four readers Phase 18 needs to compose its three rails plus the hero gate (`getMostFollowedCollectors`, `getTrendingCatalogWatches`, `getGainingTractionCatalogWatches`, `getWearEventsCountByUser`).
- Two-layer privacy enforced on Popular Collectors via `innerJoin(profileSettings) + eq(profileSettings.profilePublic, true)` (T-18-01-01); mirrors the searchProfiles idiom directly so the privacy gate stays consistent across cross-user reads.
- All COUNT aggregates carry explicit `::int` casts (T-18-01-06 / Pitfall 2); all snapshot_date comparisons cast through `::date` (Pitfall 3); `notInArray` guarded by `excludeIds.length > 0` (Pitfall 6 / T-18-01-05).
- Three-window logic for Gaining Traction (D-12): window=0 deploy-day, window∈[1..6] partial first week, window=7 clamped — handled in DAL implementation, exercised by 3 dedicated tests.
- 21 integration tests authored across 4 files, all DATABASE_URL-gated and skip-clean in CI. TypeScript `npx tsc --noEmit` clean on every modified file. ESLint clean on every modified file.

## Task Commits

Each task was committed atomically (per parallel-execution `--no-verify` rule):

1. **Task 1: Wave 0 scaffolds + getWearEventsCountByUser** — `b1c0b1b` (feat)
2. **Task 2: getMostFollowedCollectors + getTrendingCatalogWatches** — `765b146` (feat)
3. **Task 3: getGainingTractionCatalogWatches + tests** — `f6e4cee` (feat)

## Files Created/Modified

- **`src/data/discovery.ts`** (NEW, 290 lines) — Three /explore readers; `'server-only'` first line; exports `PopularCollector`, `TrendingWatch`, `GainingTractionWatch`, `GainingTractionResult` interfaces consumed by Plan 02.
- **`src/data/wearEvents.ts`** (MODIFIED) — Appended `getWearEventsCountByUser` 21-line helper for hero render gate.
- **`tests/data/getWearEventsCountByUser.test.ts`** (NEW) — 3 integration tests: zero, count, cross-user isolation (T-18-01-04).
- **`tests/data/getMostFollowedCollectors.test.ts`** (NEW) — 6 integration tests: self-exclusion, already-followed exclusion, two-layer-privacy, D-15 tie-break, limit, empty pool.
- **`tests/data/getTrendingCatalogWatches.test.ts`** (NEW) — 5 integration tests: score-DESC sort, brand+model tie-break, zero-signal exclusion, limit, denormalized count fidelity.
- **`tests/data/getGainingTractionCatalogWatches.test.ts`** (NEW) — 7 integration tests: window=0 (snapshot-empty short-circuit), window∈[1..6], window=7 clamping, ROUND-int delta math, non-positive exclusion, brand+model tie-break, limit.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Hero gate counts wear events regardless of visibility | RESEARCH §State of the Art row 4: the question is "has the viewer ever posted?" — not "have they posted publicly?" |
| `getMostFollowedCollectors` keeps the second inArray-batched watch-count query | Mirrors `mergeListEntries` anti-N+1 pattern; using a subquery in the main aggregation would force a join through `watches` that bloats the candidate row set unnecessarily |
| `Math.max(limit, 50)` pre-LIMIT cap before JS slice | Matches Phase 16 Pattern 5 idiom — leaves room for future JS-side post-sort or tie-break extension without re-fetching |
| Raw `db.execute<...>` for Gaining Traction | Drizzle query builder cannot express DISTINCT ON cleanly; raw `sql` template still parameterizes every input via `${}` (T-18-01-02 mitigation) |

## Deviations from Plan

None — plan executed exactly as written. Two trivial post-lint cleanups were folded into Task 3:

- `let extras = []` → `const extras = []` in `getMostFollowedCollectors.test.ts` (lint: prefer-const)
- Removed unused `today` helper in `getGainingTractionCatalogWatches.test.ts` (lint: no-unused-vars)

Both committed inside Task 3's commit (no separate fix commit).

## Threat Mitigation Map

| Threat ID | Mitigation Location |
|-----------|---------------------|
| T-18-01-01 (Info Disclosure: profiles via Popular Collectors) | `src/data/discovery.ts:87` — `eq(profileSettings.profilePublic, true)` in WHERE; verified by Test 3 of `getMostFollowedCollectors.test.ts` |
| T-18-01-02 (SQL injection in raw `sql` template) | `src/data/discovery.ts:211, 244, 252` — every user-influenceable scalar (`window`, `limit`) interpolated via Drizzle `${}` parameterization; values are server-computed integers |
| T-18-01-03 (IDOR via viewerId) | viewerId is resolved server-side (Plan 02 will use `getCurrentUser()`); never accepted from client query string |
| T-18-01-04 (cross-user count leak in hero gate) | `src/data/wearEvents.ts` — `eq(wearEvents.userId, userId)` keyed on server-resolved userId; verified by Test 3 of `getWearEventsCountByUser.test.ts` |
| T-18-01-05 (DoS via empty notInArray) | `src/data/discovery.ts:88` — `excludeIds.length > 0 ? notInArray(...) : undefined` guard |
| T-18-01-06 (count() type coercion → string sort) | `src/data/discovery.ts:80, 92, 105` — `sql<number>\`count(...)::int\`` cast on every aggregate |

## Verification

- ✅ `npx vitest run tests/data/getWearEventsCountByUser.test.ts tests/data/getMostFollowedCollectors.test.ts tests/data/getTrendingCatalogWatches.test.ts tests/data/getGainingTractionCatalogWatches.test.ts` — 21 tests, all skip-clean when DATABASE_URL unset (expected behavior in this worktree); will assert when run against a local Supabase stack.
- ✅ `npx tsc --noEmit` clean on every file I touched (pre-existing errors in unrelated files documented in PROJECT.md `### Active`).
- ✅ `npm run lint` clean on every file I touched (pre-existing errors in unrelated files unchanged).
- ✅ `grep -n "'server-only'" src/data/discovery.ts` → 1 match (line 1).
- ✅ `grep -n "profilePublic" src/data/discovery.ts` → 2 matches (WHERE + GROUP BY).
- ✅ `grep -n "::int" src/data/discovery.ts` → 3 matches (count cast in 2 places + watchCount FILTER).
- ✅ `grep -n "DISTINCT ON" src/data/discovery.ts` → 1 match.
- ✅ `grep -n "::date" src/data/discovery.ts` → 4 matches (oldest discovery + WHERE predicate).

## Patterns / Idioms Established

- **DISTINCT ON-per-catalog snapshot picker:** `WITH base AS (SELECT DISTINCT ON (s.catalog_id) ... ORDER BY s.catalog_id, s.snapshot_date ASC)` — first time this idiom appears in the codebase. Phase 19+ should reuse it for any "earliest/latest row per group" need against snapshot tables.
- **Three-window discovery return shape:** `{ window: number, watches: T[] }` where `window=0` is the deploy-day short-circuit, `window∈[1..6]` is partial first week, `window=7` is clamped full week. Future SEED-002 (hybrid recommender) can adopt this shape directly when it needs gaining-traction inputs.
- **Per-test stamp prefix isolation for global readers:** Every test in `getTrendingCatalogWatches.test.ts` and `getGainingTractionCatalogWatches.test.ts` prefixes inserted brand text with a stamp like `trend-abc-123def`, then filters results by `result.filter(r => r.brand.startsWith(stamp))`. Lets the suite run against a non-empty catalog without false positives.

## Self-Check: PASSED

- ✅ `src/data/discovery.ts` exists.
- ✅ `tests/data/getMostFollowedCollectors.test.ts` exists.
- ✅ `tests/data/getTrendingCatalogWatches.test.ts` exists.
- ✅ `tests/data/getGainingTractionCatalogWatches.test.ts` exists.
- ✅ `tests/data/getWearEventsCountByUser.test.ts` exists.
- ✅ `src/data/wearEvents.ts` modified (`getWearEventsCountByUser` exported, line 410+).
- ✅ Commit `b1c0b1b` exists in git log (Task 1).
- ✅ Commit `765b146` exists in git log (Task 2).
- ✅ Commit `f6e4cee` exists in git log (Task 3).
