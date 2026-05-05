---
phase: 29-nav-profile-chrome-cleanup
plan: 05
subsystem: ui

tags:
  - gap-closure
  - form-04
  - verdict-cache
  - module-scope
  - phase-29-regression
  - react
  - vitest

# Dependency graph
requires:
  - phase: 20-search-fit-card
    provides: useWatchSearchVerdictCache D-06 contract (revision-keyed invalidation, set/get semantics)
  - phase: 29-nav-profile-chrome-cleanup
    provides: Plan 29-04 per-request UUID `key` on AddWatchFlow + useLayoutEffect cleanup (the cause of the cache regression this plan closes)
provides:
  - Module-scoped verdict cache that survives AddWatchFlow remount triggered by the per-request UUID `key` boundary on /watch/new (CONTEXT D-15 "cache survives entry" honored)
  - Test-only `__resetVerdictCacheForTests()` export for deterministic cross-test isolation under module-scoped storage
  - Regression test (`AddWatchFlow.cacheRemount.test.tsx`) proving `getVerdictForCatalogWatch` is called exactly ONCE across remount + same-URL re-paste
affects:
  - phase-29-uat
  - phase-29-final-verification
  - any-future-plan-touching-useWatchSearchVerdictCache

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scoped React-hook backing store: hook is a thin readout over module-level `let` variables; clear-on-prop-change is sync mutation in render (NOT setState — module state has no React subscribers)"
    - "Test-only reset export pattern: `__resetVerdictCacheForTests()` exported from production module, called only from `beforeEach()` in tests; no production consumers (verified via grep)"
    - "vi.spyOn fetch with mockImplementation factory: Response bodies are single-read; mockResolvedValue would error on second invocation"

key-files:
  created:
    - tests/components/watch/AddWatchFlow.cacheRemount.test.tsx
  modified:
    - src/components/search/useWatchSearchVerdictCache.ts
    - tests/components/search/useWatchSearchVerdictCache.test.tsx

key-decisions:
  - "Module scope chosen over Client-wrapper hoist as the smallest-blast-radius variant of CONTEXT D-15 Option A (hoist above the key boundary). No React-tree restructure needed; AddWatchFlow.tsx + WatchSearchRowsAccordion.tsx call sites are zero-diff."
  - "Public API ({revision, get, set}) byte-identical to pre-fix to keep both consumers untouched."
  - "Stale-write guard preserved: set() short-circuits when moduleRevision moved during in-flight verdict compute (mirrors pre-fix Phase 20 D-06 behavior)."
  - "Test-only `__resetVerdictCacheForTests` exported with JSDoc warning that production code MUST NOT call it; production-purity verified via `grep -rn` on src/."

patterns-established:
  - "Module-scoped state for a custom hook: when the React useState semantics fight a key-boundary contract, lift the storage out of React-state-land entirely rather than restructuring the tree."
  - "Plan-level TDD on a refactor: existing 4 D-06 tests serve as the GREEN guardrail for the rewrite; new regression test asserts the post-fix invariant directly (mockGetVerdict called exactly ONCE across remount-and-re-paste)."

requirements-completed: [FORM-04]

# Metrics
duration: 5min
completed: 2026-05-05
---

# Phase 29 Plan 05: useWatchSearchVerdictCache Module-Scope Migration Summary

**Module-scoped Map + revision counter replaces useState-backed storage so the verdict cache survives the per-request UUID `key` boundary on /watch/new — closes Phase 29 FORM-04 UAT Gap 1 (CONTEXT D-15 "cache survives entry") with zero diff at the two consumer call sites.**

## Performance

- **Duration:** ~6 min (5 min 47 sec wall clock)
- **Started:** 2026-05-05T17:38:43Z
- **Completed:** 2026-05-05T17:44:30Z
- **Tasks:** 2
- **Files modified:** 3 (1 source, 2 tests — 1 modified + 1 created)

## Accomplishments

- Migrated `src/components/search/useWatchSearchVerdictCache.ts` from `useState<{rev, map}>` to module-scoped `let moduleCache: Map` + `let moduleRevision: number`. The hook is now a thin readout over module state; clear-on-revision-change is sync render-time mutation (not setState — module state has no React subscribers).
- Public API `{revision, get, set}` is byte-identical to pre-fix. Both consumers (`src/components/watch/AddWatchFlow.tsx:114` and `src/components/search/WatchSearchRowsAccordion.tsx:47`) are zero-diff.
- Added test-only `__resetVerdictCacheForTests()` export. Production-code purity verified: `grep -rn "__resetVerdictCacheForTests" src/` returns only the export site, no consumers.
- Updated existing 4 D-06 tests with `beforeEach(__resetVerdictCacheForTests)` for deterministic cross-test isolation under module-scoped storage. All 4 tests still GREEN.
- Created regression test `tests/components/watch/AddWatchFlow.cacheRemount.test.tsx` proving Gap 1 closed: `expect(mockGetVerdict).toHaveBeenCalledTimes(1)` after remount-and-re-paste.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate useWatchSearchVerdictCache.ts to module-scoped state + add `__resetVerdictCacheForTests` + update existing test file** — `e3f691d` (refactor)
2. **Task 2: Add regression test `AddWatchFlow.cacheRemount.test.tsx` (key-change cache survival)** — `61f0820` (test)

_Note: Both tasks declared `tdd="true"`. Task 1 acted as a behavior-preserving refactor — the existing 4 D-06 tests were the GREEN guardrail (passed at baseline against the useState impl, still pass against module-scope). Task 2 added a new test that proves the post-fix invariant directly. The pre-fix RED state was already established in the Phase 29 UAT diagnostic; re-reverting Task 1 to demonstrate RED was unnecessary._

## Files Created/Modified

- `src/components/search/useWatchSearchVerdictCache.ts` — Rewritten with module-scoped Map + revision counter; `useState` import + call removed; `__resetVerdictCacheForTests` exported; public API unchanged.
- `tests/components/search/useWatchSearchVerdictCache.test.tsx` — Imports `beforeEach` and `__resetVerdictCacheForTests`; calls reset in beforeEach inside `describe('D-06 useWatchSearchVerdictCache (Plan 05)')`. The 4 existing `it(...)` blocks UNCHANGED.
- `tests/components/watch/AddWatchFlow.cacheRemount.test.tsx` (NEW) — Mocks `next/navigation`, `@/app/actions/verdict`, `@/app/actions/watches`, `sonner`. Spies `globalThis.fetch` via `mockImplementation` (factory — Response bodies are single-read). Renders `<AddWatchFlow key="mount-1" .../>`, types URL, clicks Extract, waits for verdict-ready (3 CTAs visible), rerenders with `key="mount-2"`, types same URL, clicks Extract, asserts `mockGetVerdict.toHaveBeenCalledTimes(1)`.

## Decisions Made

**Hoisting strategy revised from Plan 29-04's accept-the-reset.** Plan 29-04 picked CONTEXT D-15 Option B ("let cache reset per remount") with the rationale that the React tree restructure for Option A was too large. UAT proved Option B literally cannot honor D-15 — the cache hook is `useState`-based and lives BELOW the `<AddWatchFlow key={flowKey}>` boundary (line 114), so the per-request UUID nukes it on every entry. Plan 29-05 picks the **smallest-blast-radius variant of Option A**: instead of restructuring the React tree to hoist the hook above the key boundary, move the storage out of React-state-land entirely and into module scope. The hook becomes a thin presentation API over the module variables. Net effect: the cache now survives the `key` boundary; AddWatchFlow + WatchSearchRowsAccordion don't change at all.

**Test-only reset export over alternatives.** Considered (a) using a vi.resetModules() + dynamic re-import per test, (b) exposing the cache via a setter prop, (c) accepting test-order coupling. (a) is heavy and fragile across hoisted vi.mock; (b) breaks the byte-identical public API requirement; (c) is brittle. Exporting a `__`-prefixed reset symbol is the cleanest pattern, and grep-based production-purity check enforces it never leaks into src/.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `mockResolvedValue` on the fetch spy returned a single Response object that fails on the second consumption ("Body is unusable: Body has already been read")**

- **Found during:** Task 2 (first run of the new regression test)
- **Issue:** Plan literal used `vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(...))`. Both pastes call `fetch('/api/extract-watch')`, but Response bodies are single-read. The first `await res.json()` consumed the body; the second paste's `await res.json()` threw "Body is unusable: Body has already been read", surfacing as `extraction-failed` state on the second paste — and the assertion `expect(mockGetVerdict).toHaveBeenCalledTimes(1)` would either pass for the wrong reason (fetch failed before reaching the verdict path) or fail (depending on which Response instance was checked when).
- **Fix:** Switched to `mockImplementation(async () => new Response(...))` so each fetch invocation gets a fresh Response with a fresh body.
- **Files modified:** `tests/components/watch/AddWatchFlow.cacheRemount.test.tsx`
- **Verification:** Test goes from FAIL ("Body is unusable: Body has already been read") to PASS in 263ms; `verdict-ready` re-renders on the second paste (3 CTAs visible) and `mockGetVerdict` is called exactly once.
- **Committed in:** `61f0820` (Task 2 commit, rolled in before final commit)

**2. [Rule 3 - Blocking] `ReturnType<typeof vi.spyOn>` does not match `vi.spyOn(globalThis, 'fetch')` overload — TS2322 typecheck error**

- **Found during:** Task 2 (typecheck filter run after the test went GREEN)
- **Issue:** Plan literal declared `let fetchSpy: ReturnType<typeof vi.spyOn>`. TypeScript strict mode resolved this to a generic `MockInstance<(this: unknown, ...args: unknown[]) => unknown>` shape, which is not assignable from the narrower fetch-overloaded `MockInstance<{ (input: URL | RequestInfo, init?: RequestInit | undefined): Promise<Response>; ... }>` produced by the actual call. NEW typecheck error introduced in the new file.
- **Fix:** Imported `MockInstance` as a type from `vitest` and typed the spy as `MockInstance<typeof globalThis.fetch>`. Tried the intermediate `ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>` form first, but `'fetch'` is not in the typed key set of `globalThis` per the project's tsconfig.
- **Files modified:** `tests/components/watch/AddWatchFlow.cacheRemount.test.tsx` (added `type MockInstance` to vitest import; updated spy declaration)
- **Verification:** `npx tsc --noEmit --project tsconfig.json 2>&1 | grep "AddWatchFlow.cacheRemount.test.tsx"` returns no output; test still GREEN after the type fix.
- **Committed in:** `61f0820` (Task 2 commit, rolled in before final commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes were necessary for correctness — (1) without the factory fetch mock the regression assertion would be invalid; (2) without the type fix the new file would introduce a regression in the project's typecheck. Neither expanded scope; both were corrections to plan literals that didn't survive contact with the runtime.

## Issues Encountered

- The Phase 29 UAT diagnostic (Gap 1) accurately predicted that pre-fix the cache could not survive the per-request UUID key boundary. The fix landed cleanly with no behavioral surprises in the source rewrite — both deviations were in the new test file (mock semantics + type signature), not in the cache hook itself.

## User Setup Required

None — no external service configuration required. Module-scope is a process-internal change; no env vars, no DB schema, no auth surface modified.

## Next Phase Readiness

- **Plan 29-06 unblocked.** That plan addresses Gap 2 (StrictMode-safe cleanup for the useLayoutEffect added in Plan 29-04). It does not touch `useWatchSearchVerdictCache`, so the module-scope migration here is independent.
- **UAT-2 sweep ready.** The phase-end UAT can now re-run the original Test 8 ("Re-enter /watch/new and paste the same URL — verdict should appear near-instantly"). Expected: verdict appears near-instantly because `getVerdictForCatalogWatch` is skipped (cache hit on catalogId).
- **Phase 20 D-06 contract preserved.** All 4 existing tests still GREEN under module-scoped storage with `beforeEach(__resetVerdictCacheForTests)` insulation.

## Self-Check: PASSED

Verification of claimed artifacts:

- `src/components/search/useWatchSearchVerdictCache.ts` — FOUND (modified)
- `tests/components/search/useWatchSearchVerdictCache.test.tsx` — FOUND (modified)
- `tests/components/watch/AddWatchFlow.cacheRemount.test.tsx` — FOUND (created)
- Commit `e3f691d` (Task 1: refactor) — FOUND in `git log`
- Commit `61f0820` (Task 2: test) — FOUND in `git log`

Test verification:
- `tests/components/search/useWatchSearchVerdictCache.test.tsx`: 4/4 GREEN
- `tests/components/watch/AddWatchFlow.cacheRemount.test.tsx`: 1/1 GREEN
- `tests/components/watch/AddWatchFlow.test.tsx`: 2/2 GREEN
- `tests/components/watch/WatchForm.test.tsx`: 11/11 GREEN
- Phase 29 unit sweep (`UserMenu.test.tsx` + `ProfileTabs.test.tsx`): 20/20 GREEN
- Typecheck filter (modified files only): clean (no NEW errors)
- Production-purity (`grep -rn __resetVerdictCacheForTests src/` excluding the export site): no matches

---
*Phase: 29-nav-profile-chrome-cleanup*
*Completed: 2026-05-05*
