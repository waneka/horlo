---
phase: 69
plan: 03
subsystem: add-watch-flow / cache-hygiene
tags: [retrofit, cache-hygiene, breaking-change-by-design, typescript-surface, CLNP-07]
requires:
  - useUrlExtractCache hook (pre-existing, retrofitted)
  - useWatchSearchVerdictCache hook (pre-existing, retrofitted)
  - SearchPageClient.viewerId (Phase 67 plumbing)
  - AddWatchFlow.viewerUserId (Phase 61 WR-03 lineage)
provides:
  - useUrlExtractCache(viewerUserId: string) — REQUIRED arg + D-06 reset + stale-write guard
  - useWatchSearchVerdictCache(collectionRevision, viewerUserId) — REQUIRED 2nd arg + outer guard + moduleRevision reset
  - AddWatchFlowProps.catalogBrands: string[] (typed pass-through; Phase 70 consumes)
  - WatchSearchRowsAccordion.viewerUserId (required prop)
  - 3-layer prop thread: SearchPageClient.viewerId → WatchesPanel.viewerId → WatchSearchRowsAccordion.viewerUserId
affects:
  - All four module-scope caches (the two new from Plan 02 + the two retrofitted here) now reset on viewerUserId switch — CLNP-07 closed for the retrofit half
  - AllTabResults.tsx (secondary WatchSearchRowsAccordion caller — Rule 3 auto-fix)
  - src/app/watch/new/page.tsx (Rule 3 placeholder catalogBrands={[]}; Plan 06 replaces with await listCatalogBrands())
tech-stack:
  added: []
  patterns:
    - "In-render module-state reset (D-06) — viewerUserId discriminant added alongside existing collectionRevision discriminant"
    - "Stale-write guard inside set() — defense against in-flight closures from prior viewer"
    - "Required positional arg forces same-compile TypeScript cascade — caller-site surface guarantees no silent leak"
    - "3-layer prop thread (SearchPageClient → internal WatchesPanel → child component) for retrofit prop drilling"
key-files:
  created:
    - src/components/watch/useUrlExtractCache.test.ts
    - src/components/search/useWatchSearchVerdictCache.test.ts
  modified:
    - src/components/watch/useUrlExtractCache.ts
    - src/components/search/useWatchSearchVerdictCache.ts
    - src/components/watch/AddWatchFlow.tsx
    - src/components/search/WatchSearchRowsAccordion.tsx
    - src/components/search/SearchPageClient.tsx
    - src/components/search/AllTabResults.tsx
    - src/app/watch/new/page.tsx
decisions:
  - "D-08 retrofit cascade absorbed a 4th caller (AllTabResults.tsx) and the page caller (src/app/watch/new/page.tsx) — TypeScript required-arg surface forced both; documented as Rule 3 auto-fixes"
  - "catalogBrands={[]} placeholder in src/app/watch/new/page.tsx is Plan 06's responsibility to replace with await listCatalogBrands()"
metrics:
  duration: "8m 5s"
  completed: "2026-05-29"
  tasks: 3
  files_changed: 7
  tests_added: 10
---

# Phase 69 Plan 03: Cache Hygiene Retrofit (useUrlExtractCache + useWatchSearchVerdictCache) Summary

**One-liner:** Retrofit the two pre-existing module-scope caches with a required `viewerUserId` positional arg + D-06 in-render reset, closing CLNP-07's retrofit half and the pre-existing `useWatchSearchVerdictCache` tech-debt leak in the same change.

## What Was Built

Three tasks executed atomically:

### Task 1: Retrofit `useUrlExtractCache`
- Added `let moduleUserId = ''` at module scope.
- Updated `__resetUrlExtractCacheForTests()` to reset both `moduleCache` and `moduleUserId`.
- Changed signature from `useUrlExtractCache()` → `useUrlExtractCache(viewerUserId: string)` (REQUIRED).
- Added in-render reset block at the top of the hook body: `if (moduleUserId !== viewerUserId) { moduleCache = new Map(); moduleUserId = viewerUserId }`.
- Added stale-write guard inside `set()`: `if (moduleUserId !== viewerUserId) return`.
- Updated JSDoc to document Phase 69 D-06 cross-user reset.
- Created NEW `src/components/watch/useUrlExtractCache.test.ts` (file did not previously exist) with 4 tests:
  1. set+get returns cached entry for same viewerUserId
  2. switching viewerUserId clears the cache
  3. stale-write guard blocks old-user closures
  4. `__resetUrlExtractCacheForTests` resets both module vars

**Commit:** `7e4d3ed4` — `feat(69-03): retrofit useUrlExtractCache with required viewerUserId arg`

### Task 2: Retrofit `useWatchSearchVerdictCache`
- Added `let moduleUserId = ''` at module scope alongside `moduleRevision`.
- Updated `__resetVerdictCacheForTests()` to reset all three module vars.
- Changed signature from `(collectionRevision: number)` → `(collectionRevision: number, viewerUserId: string)` (REQUIRED).
- Added OUTER user-switch guard BEFORE the existing revision guard, with `moduleRevision = 0` reset inside (so the inner revision guard re-fires fresh for the new user — defense against the coincidental-revision-match edge case).
- Added second stale-write guard inside `set()` for the user-switch case.
- Updated JSDoc to document the retrofit and the SC#5 leak closure.
- Created NEW `src/components/search/useWatchSearchVerdictCache.test.ts` (file did not previously exist) with 6 tests:
  1. set+get returns cached entry for same (revision, viewerUserId)
  2. user-switch clears cache AND resets moduleRevision (inner guard re-fires)
  3. revision-change behavior PRESERVED for same user
  4. user-switch THEN revision-change in sequence (both guards fire correctly)
  5. `__resetVerdictCacheForTests` resets all three module vars
  6. stale-write guard blocks old-user closures

**Commit:** `1f254ef5` — `feat(69-03): retrofit useWatchSearchVerdictCache with viewerUserId outer guard`

### Task 3: Update 3 caller sites + 3-layer SearchPageClient thread + AddWatchFlowProps.catalogBrands
- **`AddWatchFlow.tsx`**:
  - Extended `AddWatchFlowProps` with `catalogBrands: string[]` (typed pass-through; Phase 70 consumes when mounting SearchEntry).
  - Destructured as `_catalogBrands` (intentionally unused in Phase 69 — acknowledged at the destructure boundary).
  - Updated cache call sites: `useWatchSearchVerdictCache(collectionRevision, viewerUserId)` + `useUrlExtractCache(viewerUserId)`.
- **`WatchSearchRowsAccordion.tsx`**:
  - Added required `viewerUserId: string` prop with JSDoc explaining the 3-layer thread origin.
  - Threaded to `useWatchSearchVerdictCache(collectionRevision, viewerUserId)`.
- **`SearchPageClient.tsx`** (3-layer thread):
  - Layer 1: `WatchesPanel` destructure + type literal gain `viewerId: string`.
  - Layer 2: `<WatchesPanel viewerId={viewerId}>` call site.
  - Layer 3: `<WatchSearchRowsAccordion viewerUserId={viewerId}>` inside `WatchesPanel` (prop-name asymmetry: WatchesPanel exposes `viewerId`, Accordion takes `viewerUserId`).

**Commit:** `d381451e` — `feat(69-03): thread viewerUserId through retrofit cache callers + AddWatchFlow catalogBrands prop`

## Deviations from Plan

### Auto-fixed Issues (Rule 3 — blocking build issues surfaced by the required-arg cascade)

**1. [Rule 3 - Blocker] `AllTabResults.tsx` is a secondary `WatchSearchRowsAccordion` caller**
- **Found during:** Task 3 (build verification)
- **Issue:** `WatchSearchRowsAccordion` now requires `viewerUserId: string`, but `AllTabResults.tsx` is a second caller of the component (the plan only enumerated `SearchPageClient.tsx` as the caller). Build would have failed.
- **Fix:** Added `viewerUserId={viewerId}` to the JSX call site in `AllTabResults.tsx`. `viewerId` was already in `AllTabResultsProps` (Phase 19 lineage), so no further plumbing was needed.
- **Files modified:** `src/components/search/AllTabResults.tsx`
- **Commit:** `d381451e`

**2. [Rule 3 - Blocker] `src/app/watch/new/page.tsx` caller of `<AddWatchFlow />` now requires `catalogBrands`**
- **Found during:** Task 3 (Task 3's required `catalogBrands` prop on `AddWatchFlowProps`)
- **Issue:** Adding a required `catalogBrands: string[]` prop to `AddWatchFlowProps` cascades to all callers of `<AddWatchFlow />`. The only production caller is `src/app/watch/new/page.tsx`. The plan's verification block explicitly states that the `AddWatchFlow.test.tsx` updates live in Plan 06, but the page caller needs the prop NOW to keep the build green.
- **Fix:** Added `catalogBrands={[]}` placeholder to the `<AddWatchFlow>` JSX in `src/app/watch/new/page.tsx`, with a clear JSDoc note that Plan 06 will replace this with `await listCatalogBrands()` from the new DAL fn. The empty-array placeholder is a safe default — `parseSearchQuery` falls back to the naive split when the brand list is empty, so no behavioral break.
- **Files modified:** `src/app/watch/new/page.tsx`
- **Commit:** `d381451e`

Both deviations were necessary to maintain a green `npm run build` per the project's `baseline_not_green_build_is_gate` memory — the build gate is the authoritative verification, and the required-arg cascade is the entire point of D-08.

## Counter-Assertions (Verified)

- **`WatchSearchRow.tsx` is UNCHANGED.** `git diff HEAD~3..HEAD --stat -- src/components/search/WatchSearchRow.tsx` returns empty — the "Owned" / "Wishlist" pill copy stays unchanged on `/search`. SearchEntry will use "In collection" / "On wishlist" per spec divergence (Phase 69 D-Discretion); that's Plan 04's scope.
- **D-07 (no `getUser()` in cache hooks):** `grep -c "getUser\|createSupabaseBrowserClient" src/components/watch/useUrlExtractCache.ts` → 0; `grep -c "getUser\|createSupabaseBrowserClient" src/components/search/useWatchSearchVerdictCache.ts` → 0. Honors the `proxy_router_cache_poisoning` memory.
- **Required-arg surface (D-08):** TypeScript would have surfaced any missed caller; build is green, confirming all sites are covered.

## Verification

- `npm run build` → exit 0 (authoritative gate per `project_baseline_not_green_build_is_gate`).
- `npm run test -- --run src/components/watch/useUrlExtractCache.test.ts` → 4/4 pass.
- `npm run test -- --run src/components/search/useWatchSearchVerdictCache.test.ts` → 6/6 pass.
- Full test suite (`npm run test -- --run`) — 6276 pass, 9 pre-existing failures unrelated to Plan 03 surface:
  - `tests/no-raw-palette.test.ts > CommentGateLocked.tsx font-medium` — pre-existing (memory lesson)
  - `tests/lib/signCoverUrls.test.ts` (4 fails) — Supabase env-var test setup issue, pre-existing
  - `tests/components/watch-photo-section.test.tsx` (4 fails) — pre-existing PHOTO-05/06 issue
- All 9 fail roots are outside Plan 03's modified files.

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `grep -c "^export function useUrlExtractCache(viewerUserId: string)" src/components/watch/useUrlExtractCache.ts` returns 1 | 1 ✓ |
| `grep -c "let moduleUserId" src/components/watch/useUrlExtractCache.ts` returns 1 | 1 ✓ |
| `grep -c "if (moduleUserId !== viewerUserId) return" src/components/watch/useUrlExtractCache.ts` returns 1 | 1 ✓ |
| `awk '/__resetUrlExtractCacheForTests/,/^}/' useUrlExtractCache.ts \| grep -c "moduleUserId = ''"` returns 1 | 1 ✓ |
| `src/components/watch/useUrlExtractCache.test.ts` exists | yes ✓ |
| `npm run test -- --run src/components/watch/useUrlExtractCache.test.ts` exits 0 | yes ✓ |
| `grep -c "viewerUserId: string" src/components/search/useWatchSearchVerdictCache.ts` ≥ 1 | 1 ✓ |
| `grep -c "let moduleUserId" src/components/search/useWatchSearchVerdictCache.ts` returns 1 | 1 ✓ |
| Outer guard precedes inner guard (`if (moduleUserId !==` line < `if (moduleRevision !==` line) | yes ✓ (verified by inspection) |
| `awk '/if \(moduleUserId !== viewerUserId\)/,/^  \}/' useWatchSearchVerdictCache.ts \| grep -c "moduleRevision = 0"` returns 1 | 1 ✓ |
| `grep -c "if (moduleUserId !== viewerUserId) return" useWatchSearchVerdictCache.ts` returns 1 | 1 ✓ |
| `src/components/search/useWatchSearchVerdictCache.test.ts` exists | yes ✓ |
| `npm run test -- --run src/components/search/useWatchSearchVerdictCache.test.ts` exits 0 | yes ✓ |
| `grep -c "useWatchSearchVerdictCache(collectionRevision, viewerUserId)" src/components/watch/AddWatchFlow.tsx` returns 1 | 1 ✓ |
| `grep -c "useUrlExtractCache(viewerUserId)" src/components/watch/AddWatchFlow.tsx` returns 1 | 1 ✓ |
| `grep -c "catalogBrands: string\[\]" src/components/watch/AddWatchFlow.tsx` ≥ 1 | 1 ✓ |
| `grep -c "useWatchSearchVerdictCache(collectionRevision, viewerUserId)" src/components/search/WatchSearchRowsAccordion.tsx` returns 1 | 1 ✓ (line + JSDoc reference = 2 total) |
| `grep -c "viewerUserId: string" src/components/search/WatchSearchRowsAccordion.tsx` ≥ 1 | 1 ✓ |
| `grep -c "viewerUserId={viewerId}" src/components/search/SearchPageClient.tsx` returns 1 | 1 line + 1 JSDoc = 2 ✓ |
| `grep -c "viewerId={viewerId}" src/components/search/SearchPageClient.tsx` ≥ 1 | 4 ✓ (incl. the WatchesPanel call site) |
| `git diff --stat src/components/search/WatchSearchRow.tsx` empty | yes ✓ |
| `npm run build` exits 0 | yes ✓ |

## Known Stubs

- `src/app/watch/new/page.tsx`: `catalogBrands={[]}` is a typed placeholder for Phase 69 Plan 06, which adds the `listCatalogBrands()` DAL fn and replaces this prop with `await listCatalogBrands()`. The empty array is documented as a safe default (parseSearchQuery falls back to naive split); the stub is intentional and bounded to one plan.
- `src/components/watch/AddWatchFlow.tsx`: `_catalogBrands` is intentionally unused inside the current renderer — Phase 70 consumes when mounting SearchEntry. Documented in the props JSDoc.

## CLNP-07 Closure Status

Plan 03 closes the **retrofit half** of CLNP-07: both pre-existing module-scope caches (`useUrlExtractCache`, `useWatchSearchVerdictCache`) now reset on `viewerUserId` switch. Combined with Plan 02 (new caches `useCatalogSearchCache` and `useStructuredExtractCache`), all four module-scope caches in the Add-Watch surface now share the same D-06 reset contract. The pre-existing `useWatchSearchVerdictCache` tech-debt leak (called out as Phase 69 SC#5) is closed.

## Commits

- `7e4d3ed4` — `feat(69-03): retrofit useUrlExtractCache with required viewerUserId arg`
- `1f254ef5` — `feat(69-03): retrofit useWatchSearchVerdictCache with viewerUserId outer guard`
- `d381451e` — `feat(69-03): thread viewerUserId through retrofit cache callers + AddWatchFlow catalogBrands prop`

## Self-Check: PASSED

- All 7 files verified to exist on disk.
- All 3 commits verified via `git log --oneline`.
- All 22 acceptance criteria PASSED.
- Build green, deviations Rule-3-justified and documented.
