---
phase: 20-collection-fit-surface-polish-verdict-copy
plan: 04
subsystem: watch-detail
tags: [typescript, react, server-component, verdict, integration-tests, dal]

# Dependency graph
requires:
  - phase: 20-collection-fit-surface-polish-verdict-copy
    plan: 02
    provides: computeVerdictBundle + computeViewerTasteProfile at src/lib/verdict/composer.ts + viewerTasteProfile.ts
  - phase: 20-collection-fit-surface-polish-verdict-copy
    plan: 03
    provides: CollectionFitCard pure-renderer at src/components/insights/CollectionFitCard.tsx
  - phase: 20-collection-fit-surface-polish-verdict-copy
    plan: 01
    provides: VerdictBundle type contract at src/lib/verdict/types.ts; tests/app/watch-page-verdict.test.ts scaffold
provides:
  - "WatchPage Server Component that computes VerdictBundle per D-03/D-07 (FIT-01/FIT-03)"
  - "WatchDetail migrated to accept precomputed verdict prop and render CollectionFitCard"
  - "catalogId?: string | null added to Watch interface — exposes Phase 17 DB FK in domain type"
  - "SimilarityBadge.tsx deleted — single consumer migrated"
  - "4 integration tests covering same-user/cross-user framing + D-07 empty-collection + bundle prop"
affects: [20-05-search-accordion-action, 20-06-catalog-page-and-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component compute → Client Component render (Pattern 4 from RESEARCH): page.tsx computes VerdictBundle, threads as plain prop to WatchDetail"
    - "D-07 empty-collection guard: collection.length > 0 check before any computeViewerTasteProfile or computeVerdictBundle call"
    - "Parallel async: Promise.all([computeViewerTasteProfile, getCatalogById]) within the collection.length > 0 branch"
    - "catalogId null-check before getCatalogById call: watch.catalogId ? getCatalogById(watch.catalogId) : Promise.resolve(null)"
    - "vi.hoisted pattern for mock variables in vitest integration tests (avoids initialization order bug with vi.mock hoisting)"

key-files:
  created: []
  modified:
    - src/app/watch/[id]/page.tsx
    - src/components/watch/WatchDetail.tsx
    - src/lib/types.ts
    - src/data/watches.ts
    - tests/app/watch-page-verdict.test.ts
  deleted:
    - src/components/insights/SimilarityBadge.tsx

key-decisions:
  - "catalogId?: string | null added to Watch interface. The Phase 17 DB schema had catalogId on the watches table but mapRowToWatch never exposed it in the domain type. Plan 04 adds the field as optional nullable (backward-compatible) and maps it in mapRowToWatch."
  - "vi.hoisted() required for integration test mock variables. vitest hoists vi.mock() calls before imports, so mock variables defined with const in module scope aren't initialized when the factory runs. vi.hoisted() creates the variables in a block that runs before hoisting, avoiding the ReferenceError."
  - "SimilarityBadge deletion confirmed safe: only two live consumers existed (the file itself + WatchDetail). CollectionFitCard comments referencing SimilarityBadge.tsx:78 for copy provenance are non-import references and remain."

requirements-completed: [FIT-01, FIT-03]

# Metrics
duration: 6min
completed: 2026-04-30
---

# Phase 20 Plan 04: Watch Detail Integration Summary

**Wired the verdict module into `/watch/[id]/page.tsx` (Server Component compute per D-03/D-07) and migrated `WatchDetail.tsx` from `<SimilarityBadge>` to `<CollectionFitCard>` — the similarity engine no longer ships in the WatchDetail client bundle. Deleted `SimilarityBadge.tsx`. 4 integration tests green.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-30T01:29:00Z
- **Completed:** 2026-04-30T01:35:00Z
- **Tasks:** 2
- **Files created:** 0
- **Files modified:** 5 (page.tsx, WatchDetail.tsx, types.ts, watches.ts, watch-page-verdict.test.ts)
- **Files deleted:** 1 (SimilarityBadge.tsx)

## Accomplishments

- `src/app/watch/[id]/page.tsx` — Server Component now imports `computeVerdictBundle` + `computeViewerTasteProfile` + `getCatalogById`. When `collection.length > 0`, runs parallel fetch of viewer taste profile and catalog entry, then computes bundle with `framing: isOwner ? 'same-user' : 'cross-user'`. Threads `verdict: VerdictBundle | null` to WatchDetail. When collection is empty (D-07), `verdict = null` and no card renders.
- `src/components/watch/WatchDetail.tsx` — replaced `<SimilarityBadge>` import/usage with `<CollectionFitCard>`. Added `verdict?: VerdictBundle | null` to `WatchDetailProps` with JSDoc documenting D-03/D-04 intent. Destructures `verdict = null` for backward compat.
- `src/lib/types.ts` — added `catalogId?: string | null` to `Watch` interface. Phase 17 DB schema had the FK column but the domain type never exposed it. Addition is backward-compatible (optional field, existing callers unaffected).
- `src/data/watches.ts` — added `catalogId: row.catalogId ?? null` to `mapRowToWatch`. Preserves `null` (not coerced to `undefined`) so callers can distinguish "catalog not linked" from "field not fetched".
- `src/components/insights/SimilarityBadge.tsx` — DELETED. Single consumer migrated.
- `tests/app/watch-page-verdict.test.ts` — replaced 4 `it.todo` scaffolds with 4 real integration tests using `vi.hoisted()` for correct mock initialization order.

## Task Commits

Each task committed atomically with `--no-verify` per parallel-agent contract:

1. **Task 1 TDD GREEN: WatchPage verdict + 4 integration tests** — `715024f` (feat)
2. **Task 2: Migrate WatchDetail + delete SimilarityBadge** — `51250d7` (feat)

## Files Created/Modified

### Modified

- `src/app/watch/[id]/page.tsx` — added verdict computation block (D-03/D-07) and `verdict` prop on WatchDetail.
- `src/components/watch/WatchDetail.tsx` — replaced SimilarityBadge with CollectionFitCard; added verdict prop; removed engine from client bundle.
- `src/lib/types.ts` — added `catalogId?: string | null` to Watch interface (Phase 17 FK exposure).
- `src/data/watches.ts` — added `catalogId: row.catalogId ?? null` to `mapRowToWatch`.
- `tests/app/watch-page-verdict.test.ts` — replaced 4 it.todo scaffolds with 4 real integration tests.

### Deleted

- `src/components/insights/SimilarityBadge.tsx` — dead code after single consumer (WatchDetail) migrated.

## Decisions Made

- **`catalogId?: string | null` on Watch interface.** The plan's action block documented this as a conditional step ("if catalogId is NOT on the Watch interface, add it"). The DB schema had the FK column (`catalogId`) on `watches` and `mapRowToWatch` in `src/data/watches.ts` already set it, but the domain `Watch` type never declared the field, causing TypeScript errors at the page's `watch.catalogId` access. Added as optional nullable — backward-compatible with all existing callers.

- **`vi.hoisted()` pattern for integration test mocks.** The plan's test template used top-level `const mockX = vi.fn()` before `vi.mock(...)`. Vitest hoists `vi.mock()` calls to the top of the file before imports run, but `const` declarations in module scope haven't been initialized yet at that point, causing a `ReferenceError: Cannot access 'mockGetCurrentUser' before initialization`. Fixed by wrapping mock variable creation in `vi.hoisted(() => ({ ... }))`, which executes in the hoisting phase. This is the correct vitest pattern for typed mock spies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Expose `catalogId` in Watch domain type and DAL mapper**

- **Found during:** Task 1 GREEN — `watch.catalogId` in page.tsx caused a TypeScript error because `Watch` interface did not declare the field.
- **Issue:** Phase 17 added `catalogId` as a nullable FK column on the `watches` table and `linkWatchToCatalog()` in the DAL sets it. But `mapRowToWatch()` never mapped it back to the domain type, and `Watch` never declared it. This meant the field was invisible to all callers even though the DB had it.
- **Fix:** Added `catalogId?: string | null` to `Watch` interface in `src/lib/types.ts` and `catalogId: row.catalogId ?? null` to `mapRowToWatch` in `src/data/watches.ts`.
- **Files modified:** `src/lib/types.ts`, `src/data/watches.ts`
- **Commit:** `715024f` (folded into Task 1 GREEN commit)

**2. [Rule 1 - Bug] vi.hoisted() pattern for integration test mock variables**

- **Found during:** Task 1 RED — test run crashed with `ReferenceError: Cannot access 'mockGetCurrentUser' before initialization`.
- **Issue:** The plan's test template defined mock variables as top-level `const mockX = vi.fn()` and then referenced them inside `vi.mock(...)` factory functions. Vitest hoists `vi.mock()` calls before module-scope variable initializations run, so the factory captures uninitialized bindings.
- **Fix:** Wrapped all mock variable declarations in `vi.hoisted(() => ({ ... }))`, which runs in the hoisting phase before `vi.mock()` factories execute.
- **Files modified:** `tests/app/watch-page-verdict.test.ts`
- **Commit:** `715024f` (applied before commit, correct test shape in final file)

## Issues Encountered

- **Worktree branch base mismatch (resolved).** Worktree was at `0dcdf85` (old main, pre-Phase-17). Required `git reset --soft c94ca0d` to land on the orchestrator-provided base, then `git restore --staged . && git restore .` to restore Phase 17-20 working tree files (which appeared as staged deletions after the soft reset).

## Known Stubs

None. All deliverables are fully wired.

## Threat Flags

None. All trust boundary mitigations from the plan's threat model are satisfied:
- T-20-04-01: verdict inputs are viewer's own collection + target watch (through `getWatchByIdForViewer` privacy gate) — no cross-user collection leak.
- T-20-04-02: VerdictBundle fields are viewer-owned data (viewer's watches in mostSimilar, categorical strings, booleans) — no PII or foreign data.
- T-20-04-03: `watch.catalogId` null-checked before `getCatalogById` call; non-existent IDs return null and composer falls through to confidence < 0.5 fallback.
- T-20-04-04: accepted per plan — confidence column is a public reads field.

## Self-Check

Files verified to exist on disk:

- `src/app/watch/[id]/page.tsx` — FOUND
- `src/components/watch/WatchDetail.tsx` — FOUND
- `tests/app/watch-page-verdict.test.ts` — FOUND (4 real tests, 0 todos)
- `src/lib/types.ts` — FOUND (catalogId field added)
- `src/data/watches.ts` — FOUND (mapRowToWatch updated)
- `src/components/insights/SimilarityBadge.tsx` — DELETED (confirmed absent)

Commits verified to exist:

- `715024f` (Task 1: WatchPage verdict + integration tests) — FOUND
- `51250d7` (Task 2: WatchDetail migration + SimilarityBadge deletion) — FOUND

Test suite:

- `npx vitest run tests/app/watch-page-verdict` → 4/4 PASS
- `npx vitest run tests/components tests/app` → 473 passed, 3 pre-existing failures in `tests/app/explore.test.tsx` (logged in `deferred-items.md` since Plan 01)

D-09 byte-lock verified:

- `git diff HEAD -- src/lib/similarity.ts` → empty (unchanged)

## Self-Check: PASSED

---
*Phase: 20-collection-fit-surface-polish-verdict-copy*
*Completed: 2026-04-30*
