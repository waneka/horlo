---
phase: 05
plan: 01
subsystem: similarity-rewire
tags:
  - refactor
  - similarity
  - zustand
requirements:
  - DATA-05
dependency-graph:
  requires: []
  provides:
    - "src/lib/filtering.ts::filterWatches"
    - "SimilarityBadge prop-threading contract (collection + preferences)"
  affects:
    - "src/components/insights/SimilarityBadge.tsx"
    - "src/components/watch/WatchCard.tsx"
    - "src/components/watch/WatchDetail.tsx"
tech-stack:
  added: []
  patterns:
    - "Pure function extraction from Zustand store"
    - "Optional prop + store fallback for staged migration"
key-files:
  created:
    - "src/lib/filtering.ts"
  modified:
    - "src/components/insights/SimilarityBadge.tsx"
    - "src/components/watch/WatchCard.tsx"
    - "src/components/watch/WatchDetail.tsx"
decisions:
  - "SimilarityBadge props are required (collection, preferences); callers hold the staged fallback"
  - "WatchCard and WatchDetail accept optional collection/preferences props with TEMP store fallback for Plan 05-03 removal"
metrics:
  tasks_completed: 2
  tasks_total: 2
  completed: "2026-04-14"
---

# Phase 05 Plan 01: Similarity Rewire + filterWatches Extraction Summary

**One-liner:** DATA-05 prop contract established — SimilarityBadge reads collection and preferences from props, and a pure `filterWatches` helper now mirrors the store's filter logic byte-for-byte.

## What Was Built

1. **`src/lib/filtering.ts`** — new pure helper `filterWatches(watches, filters)`. Copied byte-for-byte from `useWatchStore.getFilteredWatches` (status → styleTags → roleTags → dialColors → priceRange). Not yet wired by any caller; Plan 05-03 will consume it.
2. **`SimilarityBadge`** — removed `useWatchStore` and `usePreferencesStore` imports. Component now takes `collection: Watch[]` and `preferences: UserPreferences` as required props and calls `analyzeSimilarity(watch, collection, preferences)` directly.
3. **`WatchDetail`** — added optional `collection?: Watch[]` and `preferences?: UserPreferences` props, threaded `effectiveCollection`/`effectivePreferences` (prop ?? store) into both the gapFill computation and the `<SimilarityBadge />` call. Store reads remain for the fallback and are marked `TEMP Plan 05-01` for removal in Plan 05-03.
4. **`WatchCard`** — same optional-prop + TEMP fallback pattern for gapFill, even though it does not render SimilarityBadge directly. This establishes the uniform prop contract Plan 05-03 consumes.

## Decisions Made

- **Required props on SimilarityBadge, optional on callers:** The badge is the DATA-05 target, so its props are hard-required. Callers (WatchCard/WatchDetail) keep optional props + store fallback so this plan is self-contained and the build stays green before Plan 05-03 rewires the grid.
- **WatchCard scoped in despite not rendering SimilarityBadge:** The plan explicitly names WatchCard as a call site because it was reading the same stores for gap-fill. Threading props now keeps the migration uniform with WatchDetail and avoids a mid-phase re-touch.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written. The only interpretive call was scoping WatchCard (which does not render SimilarityBadge but does read the same two stores for gap-fill). The plan instructed treating WatchCard as a call site, so the TEMP-fallback pattern was applied there as well.

## Verification

- `src/lib/filtering.ts` exists and exports `filterWatches` — PASS
- `grep -E "useWatchStore|usePreferencesStore" src/components/insights/SimilarityBadge.tsx` returns no output — PASS
- `grep "collection: Watch\[\]" src/components/insights/SimilarityBadge.tsx` — PASS
- `grep "preferences: UserPreferences" src/components/insights/SimilarityBadge.tsx` — PASS
- `grep "TEMP Plan 05-01" src/components/watch/WatchCard.tsx` — PASS
- `grep "TEMP Plan 05-01" src/components/watch/WatchDetail.tsx` — PASS
- `npm run build` — exits 0
- `npm test -- --run` — 663 tests passed, 3 skipped

## Commits

| Task | Commit    | Message |
| ---- | --------- | ------- |
| 1    | `8af5c28` | feat(05-01): extract filterWatches pure helper |
| 2    | `b3ab708` | refactor(05-01): thread collection + preferences as props into SimilarityBadge |

## Self-Check: PASSED

- FOUND: src/lib/filtering.ts
- FOUND: commit 8af5c28
- FOUND: commit b3ab708
- SimilarityBadge store imports removed
- Build and full test suite green
