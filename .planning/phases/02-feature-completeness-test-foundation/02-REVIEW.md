---
phase: 02-feature-completeness-test-foundation
reviewed: 2026-04-11T12:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/lib/types.ts
  - src/lib/similarity.ts
  - src/lib/gapFill.ts
  - src/lib/wear.ts
  - src/store/watchStore.ts
  - src/components/watch/WatchForm.tsx
  - src/components/watch/WatchCard.tsx
  - src/components/watch/WatchDetail.tsx
  - src/components/watch/WatchGrid.tsx
  - src/app/insights/page.tsx
  - src/components/insights/GoodDealsSection.tsx
  - src/components/insights/SleepingBeautiesSection.tsx
  - tests/similarity.test.ts
  - tests/gapFill.test.ts
  - tests/fixtures/watches.ts
  - tests/extractors/structured.test.ts
  - tests/extractors/html.test.ts
  - tests/extractors/index.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-11T12:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

The codebase is well-structured with clear separation of concerns: domain logic in `src/lib/`, state management in `src/store/`, and presentation in `src/components/`. The similarity engine, gap-fill scoring, and test suite are all thoughtfully designed. Types are centralized and strict mode is enabled. The test fixtures use a factory pattern with deterministic IDs, which is good practice.

Four warnings were identified: a filter logic bug that silently skips watches without a dial color, a shared mutable counter in the test fixture factory that leaks state across test files, redundant specialty detection calls in gap-fill, and an unsafe `as` cast on user input. Three info-level items cover minor improvements.

## Warnings

### WR-01: Dial color filter silently includes watches with no dialColor when filter is active

**File:** `src/store/watchStore.ts:116-122`
**Issue:** The dial color filter condition is `filters.dialColors.length > 0 && watch.dialColor && !filters.dialColors.includes(watch.dialColor)`. When a watch has `dialColor` of `undefined`, the second operand short-circuits to falsy, so the entire condition is `false` -- meaning the watch passes through the filter. If a user filters to "black" dials only, watches with no dial color set will still appear in results. This is likely unintended.
**Fix:**
```typescript
// Dial colors filter (any match)
if (
  filters.dialColors.length > 0 &&
  (!watch.dialColor || !filters.dialColors.includes(watch.dialColor))
) {
  return false
}
```

### WR-02: Test fixture `idCounter` leaks across test files

**File:** `tests/fixtures/watches.ts:3-8`
**Issue:** The module-level `let idCounter = 0` is shared across all test files that import `makeWatch`. Because Vitest may reuse module instances across files in the same worker, IDs are not reset between test suites. This means tests that assert on specific IDs or depend on fixture ordering may become flaky or order-dependent. While current tests do not assert on IDs directly, this is a latent reliability risk that will bite when tests grow.
**Fix:** Add a `resetFixtures()` helper and call it in `beforeEach`, or use a random seed per test file:
```typescript
export function resetIdCounter(): void {
  idCounter = 0
}
```

### WR-03: `detectSpecialty` called twice in `computeGapFill`

**File:** `src/lib/gapFill.ts:87-108` and `src/lib/gapFill.ts:142-144`
**Issue:** When `effectiveGoal === 'specialist'`, `detectSpecialty(owned)` is called once for the out-of-universe check (line 89) and again later (line 143) to determine `goalUsed`. Both calls iterate the full owned collection and compute the same maps. If the first call does not return early (i.e., the target is on-specialty), the function falls through and re-computes. This is not a correctness bug but wastes work and adds cognitive complexity -- a reader might wonder if the two calls could produce different results.
**Fix:** Hoist the `detectSpecialty` call above both usages and reuse the result:
```typescript
const spec = effectiveGoal === 'specialist' ? detectSpecialty(owned) : null

// ...use spec in the out-of-universe check...
// ...use spec.kind === 'none' for goalUsed fallback...
```

### WR-04: Unsafe `as WatchStatus` cast on select value without validation

**File:** `src/components/watch/WatchForm.tsx:233`
**Issue:** The `onValueChange` handler casts the raw string from the Select component with `value as WatchStatus`. If the Select component or constants ever diverge from the `WatchStatus` union, this would silently produce an invalid status value that gets persisted to localStorage. The `if (!value) return` guard only protects against empty strings, not invalid ones.
**Fix:** Validate the value against the known statuses before casting:
```typescript
onValueChange={(value) => {
  if (!value) return
  if (!WATCH_STATUSES.includes(value as WatchStatus)) return
  const next = value as WatchStatus
  // ...
}}
```

## Info

### IN-01: Duplicate `isDeal` logic across three files

**File:** `src/components/watch/WatchCard.tsx:28-32`, `src/components/watch/WatchGrid.tsx:18-24`, `src/components/insights/GoodDealsSection.tsx:13-21`
**Issue:** The "is this watch a deal?" check (`isFlaggedDeal || (marketPrice <= targetPrice)`) is implemented independently in three places. If the deal definition changes, all three must be updated in lockstep.
**Fix:** Extract a shared `isDeal(watch: Watch): boolean` utility into `src/lib/deals.ts` and import it in all three files.

### IN-02: Observations section uses unsorted distribution data

**File:** `src/app/insights/page.tsx:342-353`
**Issue:** `styleDistribution[0]` and `roleDistribution[0]` are used as if they are the most common items, but `calculateDistribution` returns entries from `Object.entries(counts)` which has no guaranteed order by count. The "most common" observation may show any arbitrary style/role rather than the actual highest-count one.
**Fix:** Sort the distribution arrays by `count` descending before returning them from `calculateDistribution`:
```typescript
return Object.entries(counts)
  .map(([label, count]) => ({
    label,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
  }))
  .sort((a, b) => b.count - a.count)
```

### IN-03: `SleepingBeautiesSection` includes grail watches in "sleeping" list

**File:** `src/components/insights/SleepingBeautiesSection.tsx:14`
**Issue:** Grail watches (status `'grail'`) are included in the "sleeping beauties" filter alongside owned watches. However, grail watches are aspirational -- a user likely does not own them yet, so "not worn in 30 days" is not a meaningful signal. The empty-state message says "every watch in your collection has been worn" which is misleading if grails are included.
**Fix:** Filter to `w.status === 'owned'` only, excluding grails from this particular insight.

---

_Reviewed: 2026-04-11T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
