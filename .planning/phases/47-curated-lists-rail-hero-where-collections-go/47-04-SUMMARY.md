---
phase: 47-curated-lists-rail-hero-where-collections-go
plan: "04"
subsystem: verification-and-requirements-traceability
tags: [verification, bugfix, requirements, wave-3]
dependency_graph:
  requires: [47-01, 47-02, 47-03]
  provides: [Wave-2-bug-fixes, EXPL-06..09-traceability-pending-human-verify]
  affects:
    - src/components/explore/WhereCollectionsGo.tsx
    - src/components/explore/RailListCard.tsx
    - .planning/REQUIREMENTS.md
tech_stack:
  added: []
  patterns: [set-dedup-wrap-around, conditional-img-render]
key_files:
  created: []
  modified:
    - src/components/explore/WhereCollectionsGo.tsx
    - src/components/explore/RailListCard.tsx
decisions:
  - "WhereCollectionsGo deduplicates threePaths by id after wrap-around to prevent duplicate React keys when pool < 3"
  - "RailListCard conditionally renders <img> only when coverUrl is non-null to prevent empty-src full page re-download"
  - "EXPL-06..09 requirements traceability update deferred to continuation agent after human-verify approval"
metrics:
  duration: "~10m (partial — awaiting human-verify checkpoint)"
  completed_date: "2026-05-19"
  tasks_completed: 1
  files_changed: 2
---

# Phase 47 Plan 04: Verification + Requirements Traceability Summary

Full-suite verification, production build confirmation, and two Wave 2 bug fixes applied. Awaiting human-verify checkpoint (Task 2) before updating requirements traceability (Task 3).

## What Was Built

### Task 1: Full-suite + build + integration verification

**Test suite results:** All Phase 47 test files pass (14 tests across 3 component test files + 4 weekIndex tests + 2 curatedLists tests = 20 passing Phase 47 tests). Pre-existing failures in unrelated test files (WywtPostDialog, AddWatchFlow, settings preferences, etc.) are carryover from STATE.md and were present before Phase 47 work began.

**TypeScript check:** `npx tsc --noEmit` — zero errors in any Phase 47 source file. Pre-existing errors in `u/[username]/layout.tsx`, `RecentlyEvaluatedRail.test.tsx`, `SearchPageClient.test.tsx`, and test helpers are carryover from STATE.md.

**Production build:** `npm run build` succeeds. Route manifest confirms all three new routes:
- `/explore/lists` — sortable see-all grid
- `/explore/lists/[id]` — markdown editorial detail
- `/explore/paths` — see-all grouped by path-type

**Integration seam check:** `src/app/explore/page.tsx` renders all five modules (`HeroModule`, `CollectorArchetypes`, `BrowseModule`, `CuratedListsRail`, `WhereCollectionsGo`). None of the three Phase 47 components is a bare `return null`-only stub — each has a real implementation (HeroModule: 114 lines, WhereCollectionsGo: 82 lines, CuratedListsRail: 59 lines).

**Cache-poisoning check (RESEARCH Pitfall 1):** `getCurrentUser` references in HeroModule.tsx, WhereCollectionsGo.tsx, and CuratedListsRail.tsx are comments-only explaining the pattern — none are actual function calls. Confirmed compliant.

**Wave 2 bug fixes** (applied as Rule 1 deviations):
1. WhereCollectionsGo duplicate React keys — fixed by deduplicating `threePaths` by id after wrap-around
2. RailListCard empty-string img src — fixed by conditional render only when `coverUrl` is truthy

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (bug fixes) | `67ec7ad` | fix(47-04): patch Wave 2 duplicate-key + empty-src bugs |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WhereCollectionsGo duplicate React keys when pool < 3**
- **Found during:** Task 1 — Wave 2 known issues assessment (parallel execution notes)
- **Issue:** The wrap-around slice `allPaths.slice(0, needed)` could repeat a path that was already in `threePaths` when the published-paths pool has fewer than 3 paths, resulting in duplicate `pathWithNodes.id` keys passed to React
- **Fix:** Added Set-based deduplication in `WhereCollectionsGo.tsx` — filter wrapped extras by whether their id is already in `seenIds`
- **Files modified:** `src/components/explore/WhereCollectionsGo.tsx`
- **Commit:** `67ec7ad`

**2. [Rule 1 - Bug] RailListCard passes empty string as img src when no cover image**
- **Found during:** Task 1 — Wave 2 known issues assessment (parallel execution notes)
- **Issue:** `src={list.coverUrl ?? ''}` passes an empty string to `<img>` when `coverUrl` is null. An empty `src=""` triggers a browser full page re-download.
- **Fix:** Changed to conditionally render `<img>` only when `list.coverUrl` is non-null/truthy
- **Files modified:** `src/components/explore/RailListCard.tsx`
- **Commit:** `67ec7ad`

## Known Stubs

None. All three Phase 47 components have real implementations.

## Verification Status

- `npm test -- --run` for Phase 47 test files: 20 tests passing
- `npx tsc --noEmit` for Phase 47 source files: zero errors
- `npm run build`: succeeds, all three new routes in manifest
- Integration seam: 5 modules in explore/page.tsx, no bare return-null stubs, no getCurrentUser in cache scopes
- Human-verify checkpoint (Task 2): PENDING — awaiting operator visual confirmation
- EXPL-06..09 requirements update (Task 3): PENDING — deferred until Task 2 approved

## Threat Flags

No new security-relevant surface introduced (this plan is verification + planning doc update only, per threat model).

| Threat | Status |
|--------|--------|
| T-47-16: False-positive verification | Mitigated — visual dev-server check (Task 2) required before phase closure |
| T-47-17: Stale unpublished Hero post-verification | Mitigated — Task 2 explicitly verifies pin/unpublish propagation |

## Self-Check: PASSED

- `src/components/explore/WhereCollectionsGo.tsx` — contains seenIds dedup logic: VERIFIED
- `src/components/explore/RailListCard.tsx` — `{list.coverUrl && (<img ...>)}` conditional: VERIFIED
- Commit `67ec7ad` — fix(47-04) bug patches: FOUND
- All Phase 47 test files passing: VERIFIED
- Production build with 3 new routes: VERIFIED
