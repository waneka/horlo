---
phase: 05
plan: 03
subsystem: server-component-rewire
tags:
  - server-components
  - refactor
  - insights
  - preferences
requirements:
  - DATA-05
dependency-graph:
  requires:
    - "src/lib/filtering.ts::filterWatches (Plan 05-01)"
    - "SimilarityBadge prop-threading contract (Plan 05-01)"
  provides:
    - "src/components/watch/CollectionView.tsx::CollectionView"
    - "src/components/preferences/PreferencesClient.tsx::PreferencesClient"
    - "Server-rendered home, insights, and preferences pages"
  affects:
    - "src/app/page.tsx"
    - "src/app/insights/page.tsx"
    - "src/app/preferences/page.tsx"
    - "src/components/watch/WatchGrid.tsx"
    - "src/components/watch/WatchCard.tsx"
    - "src/components/filters/FilterBar.tsx"
tech-stack:
  added: []
  patterns:
    - "Async Server Component page fetches user + DAL data, passes to thin client subtree"
    - "useTransition-driven Server Action call from client wrappers"
    - "Store reads narrowed to filter state only (no collection data)"
key-files:
  created:
    - "src/components/watch/CollectionView.tsx"
    - "src/components/preferences/PreferencesClient.tsx"
  modified:
    - "src/app/page.tsx"
    - "src/app/insights/page.tsx"
    - "src/app/preferences/page.tsx"
    - "src/components/watch/WatchGrid.tsx"
    - "src/components/watch/WatchCard.tsx"
    - "src/components/filters/FilterBar.tsx"
decisions:
  - "WatchGrid still reads filters.status from watchStore to branch wishlist deal-sort — smallest diff vs plumbing another prop"
  - "PreferencesClient uses local-state mirror + fire-and-forget savePreferences; keeps per-field live save semantics from the Zustand version"
  - "FilterBar computes priceCap locally from maxPrice prop (instead of useMemo) since the parent-level maxPrice is already memoized"
metrics:
  tasks_completed: 3
  tasks_total: 3
  completed: "2026-04-14"
---

# Phase 05 Plan 03: List Pages → Server Components Summary

**One-liner:** Home, insights, and preferences pages are now Server Components that fetch from the DAL; CollectionView + PreferencesClient are the new client wrappers and WatchGrid/WatchCard/FilterBar no longer read collection data from Zustand.

## What Was Built

1. **`src/app/page.tsx` → async Server Component.** Three lines: `getCurrentUser` → parallel DAL fetch → `<CollectionView />`. No `'use client'`, no hydration guard, no store reads.
2. **`src/components/watch/CollectionView.tsx` (new client wrapper).** Owns filter-state reads from `watchStore`, runs `filterWatches(watches, filters)` via `useMemo`, computes a `maxPrice` across the full collection, and threads `collection` + `preferences` down to `WatchGrid`. All of the layout JSX (sidebar, header, mobile sheet, status toggle) moved here from the old client page.
3. **`src/components/watch/WatchGrid.tsx`.** Now receives `watches`, `collection`, `preferences` as props. The only remaining store read is a single selector `s => s.filters.status` used to branch the wishlist deal-sort (smallest diff option per plan). Each `<WatchCard />` receives `collection` + `preferences`.
4. **`src/components/watch/WatchCard.tsx`.** Plan 05-01 TEMP store fallback removed. `collection` and `preferences` are now required props. `useWatchStore` and `usePreferencesStore` imports gone entirely.
5. **`src/components/filters/FilterBar.tsx`.** Added `maxPrice: number` prop; removed the `watches` read from the store and the `useMemo` that computed the price cap. Store usage narrowed to `filters`, `setFilter`, `resetFilters` — no more collection reads.
6. **`src/app/insights/page.tsx` → async Server Component (DATA-05 core).** Removed `'use client'`, `useWatchStore`, `usePreferencesStore`, `useIsHydrated`, and every `useMemo` block. All distribution math is now plain `const` computations at the top of the async function, plus two extracted helpers (`computeWearInsights`, `computeCollectionValue`) for readability. `BalanceChart`, `GoodDealsSection`, `SleepingBeautiesSection` unchanged (already prop-driven).
7. **`src/app/preferences/page.tsx` → async Server Component.** Eight-line file: `getCurrentUser` → `getPreferencesByUser` → `<PreferencesClient />`.
8. **`src/components/preferences/PreferencesClient.tsx` (new client wrapper).** Migrates the full preferences form body verbatim; replaces `usePreferencesStore` with a local `useState` seeded from the `preferences` prop. Every `updatePreferences` call fires the existing `savePreferences` Server Action through `useTransition`. The Server Action already calls `revalidatePath('/preferences')` (Phase 3 D-13), so the next navigation re-renders the Server Component page with fresh data.

## Decisions Made

- **WatchGrid keeps a single `filters.status` store read.** The plan explicitly gave the executor a choice: move the wishlist deal-sort into `CollectionView` or leave it in `WatchGrid` reading from the store. Leaving it in `WatchGrid` is the smaller diff and keeps `CollectionView` focused on composition rather than re-implementing a tiny sort branch. The store read is a targeted selector on `filters.status` only — no collection data touches the grid.
- **PreferencesClient uses local-state mirror + fire-and-forget save.** The old client page called `usePreferencesStore().updatePreferences()` on every keystroke/checkbox. Preserving that UX through the Server-Component boundary means: (a) mirror the prop into local state so inputs feel instant, (b) dispatch `savePreferences(patch)` through `useTransition` on every change, (c) rely on `revalidatePath('/preferences')` from the Server Action to re-seed from fresh data on next nav. No Suspense, no pending overlay — keeps the refactor minimal and the existing interaction pattern intact.
- **FilterBar drops the `useMemo` for `priceCap`.** `CollectionView` already memoizes `maxPrice` across the full collection. Recomputing `priceCap` inline in `FilterBar` is cheaper than the `useMemo` overhead because the input is already stable per parent render.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written. The only interpretive call was the WatchGrid deal-sort location, and the plan explicitly authorized executor discretion.

## Verification

- `grep "'use client'" src/app/page.tsx src/app/insights/page.tsx src/app/preferences/page.tsx` — no output PASS
- `grep -r "useIsHydrated" src/app/page.tsx src/app/insights/page.tsx src/app/preferences/page.tsx` — no output PASS (watch/[id] pages still reference it — out of scope, Plan 05-04)
- `grep -E "useWatchStore|usePreferencesStore" src/components/watch/WatchCard.tsx` — no output PASS
- `grep "TEMP Plan 05-01" src/components/watch/WatchCard.tsx` — no output PASS
- `grep "maxPrice" src/components/filters/FilterBar.tsx` — PASS (prop declared)
- `grep "getWatchesByUser" src/app/page.tsx src/app/insights/page.tsx` — PASS
- `grep "getPreferencesByUser" src/app/preferences/page.tsx` — PASS
- `src/components/watch/CollectionView.tsx` exists and imports `filterWatches` PASS
- `src/components/preferences/PreferencesClient.tsx` exists with `'use client'` PASS
- `npm run build` — exits 0 PASS
- `npm test -- --run` — 697 passed | 3 skipped PASS

## Commits

| Task | Commit    | Message |
| ---- | --------- | ------- |
| 1    | `61cb5ca` | refactor(05-03): convert home to Server Component with CollectionView wrapper |
| 2    | `8c50771` | refactor(05-03): convert insights page to Server Component (DATA-05) |
| 3    | `c5023fb` | refactor(05-03): convert preferences page to Server Component + PreferencesClient wrapper |

## Self-Check: PASSED

- FOUND: src/components/watch/CollectionView.tsx
- FOUND: src/components/preferences/PreferencesClient.tsx
- FOUND: commit 61cb5ca
- FOUND: commit 8c50771
- FOUND: commit c5023fb
- All grep acceptance criteria pass
- Build clean, full test suite green
