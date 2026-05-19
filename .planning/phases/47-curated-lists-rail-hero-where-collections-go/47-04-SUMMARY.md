---
phase: 47-curated-lists-rail-hero-where-collections-go
plan: "04"
subsystem: verification-and-requirements-traceability
tags: [verification, bugfix, requirements, wave-3]
dependency_graph:
  requires: [47-01, 47-02, 47-03]
  provides: [Wave-2-bug-fixes, EXPL-06..09-traceability-complete]
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
    - .planning/REQUIREMENTS.md
decisions:
  - "WhereCollectionsGo deduplicates threePaths by id after wrap-around to prevent duplicate React keys when pool < 3"
  - "RailListCard conditionally renders <img> only when coverUrl is non-null to prevent empty-src full page re-download"
  - "EXPL-06..09 requirements traceability marked Complete after human-verify checkpoint approved"
metrics:
  duration: "~15m (3 tasks including human-verify checkpoint)"
  completed_date: "2026-05-19"
  tasks_completed: 3
  files_changed: 3
---

# Phase 47 Plan 04: Verification + Requirements Traceability Summary

Full-suite verification, production build confirmation, two Wave 2 bug fixes, human-verify checkpoint approval, and EXPL-06..09 requirements traceability marked Complete.

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

### Task 2: Visual + mobile + Hero-propagation verification (human-verify checkpoint)

Operator-approved visual confirmation of all five acceptance criteria:
- Hero renders full-bleed with no black bar / letterbox / collapsed height
- Where Collections Go at 360px is a legible numbered vertical stack with connectors
- /explore/lists sort works; list detail renders styled markdown + editorial rows; watch taps reach /catalog
- /explore/paths groups paths by path-type section
- Pinning/unpublishing a list updates the Hero immediately on reload

**Checkpoint status:** APPROVED by operator.

### Task 3: Update requirements traceability

Marked EXPL-06, EXPL-07, EXPL-08, and EXPL-09 as complete in `.planning/REQUIREMENTS.md`:
- Checkboxes changed from `- [ ]` to `- [x]` in the Explore Page (EXPL) section
- Traceability table rows updated from `Pending` to `Complete`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (bug fixes) | `67ec7ad` | fix(47-04): patch Wave 2 duplicate-key + empty-src bugs |
| Task 3 | `0e10add` | docs(47-04): mark EXPL-06..09 complete in requirements traceability |

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
- Human-verify checkpoint (Task 2): APPROVED by operator
- EXPL-06..09 requirements update (Task 3): COMPLETE — all four marked Complete in traceability table

## Threat Flags

No new security-relevant surface introduced (this plan is verification + planning doc update only, per threat model).

| Threat | Status |
|--------|--------|
| T-47-16: False-positive verification | Mitigated — visual dev-server check (Task 2) approved by operator before traceability update |
| T-47-17: Stale unpublished Hero post-verification | Mitigated — Task 2 explicitly verified pin/unpublish propagation |

## Self-Check: PASSED

- `src/components/explore/WhereCollectionsGo.tsx` — contains seenIds dedup logic: VERIFIED
- `src/components/explore/RailListCard.tsx` — `{list.coverUrl && (<img ...>)}` conditional: VERIFIED
- Commit `67ec7ad` — fix(47-04) bug patches: FOUND
- Commit `0e10add` — docs(47-04) EXPL-06..09 traceability: FOUND
- `grep "EXPL-0[6789]" .planning/REQUIREMENTS.md | grep -c "Complete"` returns 4: VERIFIED
- All Phase 47 test files passing: VERIFIED
- Production build with 3 new routes: VERIFIED
- Human-verify checkpoint: APPROVED
