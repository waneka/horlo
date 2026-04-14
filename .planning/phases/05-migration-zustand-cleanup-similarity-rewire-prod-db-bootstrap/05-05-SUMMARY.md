---
phase: 05
plan: 05
subsystem: zustand-final-cleanup
tags:
  - refactor
  - zustand
  - cleanup
requirements:
  - DATA-05
dependency-graph:
  requires:
    - "Plan 05-01 (filterWatches extraction, SimilarityBadge prop contract)"
    - "Plan 05-03 (list pages → Server Components)"
    - "Plan 05-04 (watch detail/edit pages → Server Components)"
  provides:
    - "Filter-only watchStore (no persist, no CRUD, no collection data)"
    - "Phase 5 DATA-05 code refactor structurally complete"
  affects:
    - "src/store/watchStore.ts"
    - "src/store/preferencesStore.ts (deleted)"
    - "src/lib/hooks/useIsHydrated.ts (deleted)"
tech-stack:
  added: []
  patterns:
    - "Zustand demoted to ephemeral filter state (no middleware)"
key-files:
  created: []
  modified:
    - "src/store/watchStore.ts"
  deleted:
    - "src/store/preferencesStore.ts"
    - "src/lib/hooks/useIsHydrated.ts"
    - "src/lib/hooks/ (empty directory)"
decisions:
  - "watchStore final shape matches 05-RESEARCH.md Pattern 4 verbatim — filter, setFilter, resetFilters; nothing else"
  - "Empty src/lib/hooks/ directory removed (no other hooks live there)"
metrics:
  tasks_completed: 2
  tasks_total: 2
  completed: "2026-04-14"
  duration: "~5min"
---

# Phase 05 Plan 05: Zustand Final Cleanup Summary

**One-liner:** watchStore is now 30 lines of filter-only Zustand; preferencesStore and useIsHydrated are gone, and all 7 Phase 5 grep gates pass.

## What Was Built

1. **`src/store/watchStore.ts` reduced to filter-only.** Removed `persist` middleware, the `watches: Watch[]` slice, all CRUD methods (`addWatch`, `updateWatch`, `deleteWatch`, `markAsWorn`), the `getWatchById` / `getFilteredWatches` selectors, the `generateId` helper, and the entire `persist(...)` wrapper (name, version, partialize, migrate). The file now exactly matches the target shape from `05-RESEARCH.md § Pattern 4`: `WatchFilters` interface (still exported because `src/lib/filtering.ts::filterWatches` imports it), `defaultFilters` const, and a `useWatchStore` create with `filters`, `setFilter`, `resetFilters`. 150 lines → 31 lines.
2. **`src/store/preferencesStore.ts` deleted.** Plan 05-03 moved preferences to `PreferencesClient` (local state seeded from a Server Component prop), so nothing imports the old store.
3. **`src/lib/hooks/useIsHydrated.ts` deleted.** Plans 05-03 and 05-04 converted every page that used it to a Server Component, so no caller remains. The empty `src/lib/hooks/` directory was also removed.

## Decisions Made

- **Verbatim adoption of Pattern 4 shape.** The plan called out the exact target shape; no additional cleverness needed. Filter state is intentionally kept in Zustand (rather than `useState` or URL params) because the existing consumers (`CollectionView`, `FilterBar`, `WatchGrid`) already hook into the store — moving filter state would be a much larger diff for zero behavior change.
- **Empty hooks directory removed.** `src/lib/hooks/` contained only `useIsHydrated.ts`. After deletion the directory was empty so it was removed too — nothing else lives under that path.

## Deviations from Plan

### Auto-fixed Issues

None. The plan executed exactly as written.

### Validation Note (not a deviation)

Validation gate #7 in `05-VALIDATION.md` is documented as `npm test -- --run src/lib/similarity`. The actual similarity test file lives at `tests/similarity.test.ts` (not under `src/lib/`), so vitest's filter `src/lib/similarity` matches no test files and exits 1 ("No test files found"). Running the equivalent filter that does match — `npm test -- --run similarity` — yields **12/12 passed** in `tests/similarity.test.ts`. The full suite (`npm test -- --run`) is also green at **697 passed | 3 skipped**. The intent of gate #7 (similarity regression check stays green) is satisfied.

## Verification

### 05-VALIDATION.md Grep Gates

| # | Gate | Command | Result |
|---|------|---------|--------|
| 1 | watchStore filter-only | `grep -E "persist\|addWatch\|deleteWatch\|markAsWorn\|updateWatch\|watches\s*:" src/store/watchStore.ts` | empty PASS |
| 2 | insights page is Server Component | `grep "'use client'" src/app/insights/page.tsx` | empty PASS |
| 3 | SimilarityBadge no store imports | `grep -E "useWatchStore\|usePreferencesStore" src/components/insights/SimilarityBadge.tsx` | empty PASS |
| 4 | useIsHydrated removed from app | `grep -rn "useIsHydrated" src/app/` | empty PASS |
| 5 | no `'use client'` on converted pages | `grep "'use client'" src/app/page.tsx src/app/insights/page.tsx src/app/preferences/page.tsx` | empty PASS |
| 6 | build clean | `npm run build` | exit 0 PASS |
| 7 | similarity tests green | `npm test -- --run similarity` (see Validation Note above re: filter path) | 12/12 passed PASS |

### Additional Acceptance

- `grep "export interface WatchFilters" src/store/watchStore.ts` — PASS (still exported for filterWatches helper)
- `grep "zustand/middleware" src/store/watchStore.ts` — empty PASS
- `test -f src/store/preferencesStore.ts` — file does not exist PASS
- `test -f src/lib/hooks/useIsHydrated.ts` — file does not exist PASS
- `grep -rn "usePreferencesStore" src/` — empty PASS
- `grep -rn "useIsHydrated" src/` — empty PASS
- Full test suite: 697 passed | 3 skipped (700 total) PASS

## Known Stubs

None. The Phase 5 code refactor portion is structurally complete. Only Plan 05-06 (OPS-01 runbook execution checkpoint) remains.

## Commits

| Task | Commit    | Message |
| ---- | --------- | ------- |
| 1    | `e4fefac` | refactor(05-05): strip watchStore to filter-only shape |
| 2    | `46ea841` | refactor(05-05): delete dead preferencesStore and useIsHydrated hook |

## Self-Check: PASSED

- FOUND: src/store/watchStore.ts (filter-only, 31 lines)
- FOUND: commit e4fefac
- FOUND: commit 46ea841
- MISSING (intentionally): src/store/preferencesStore.ts
- MISSING (intentionally): src/lib/hooks/useIsHydrated.ts
- All 7 05-VALIDATION.md grep gates pass
- Build clean, full test suite (697) green
