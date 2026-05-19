---
phase: 46-explore-shell-browse-archetypes
plan: "03"
subsystem: explore
tags: [explore, browse, archetypes, server-component, use-cache]
dependency_graph:
  requires: [46-01]
  provides: [EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05]
  affects: [src/app/explore, src/components/explore]
tech_stack:
  added: []
  patterns: [use-cache-server-component, null-hide-guard, a-z-jump-nav, browse-index-page]
key_files:
  created:
    - src/app/explore/page.tsx
    - src/components/explore/CollectorArchetypes.tsx
    - src/components/explore/BrowseModule.tsx
    - src/components/explore/HeroModule.tsx
    - src/components/explore/CuratedListsRail.tsx
    - src/components/explore/WhereCollectionsGo.tsx
    - src/app/explore/brands/page.tsx
    - src/app/explore/eras/page.tsx
    - src/app/explore/genres/page.tsx
  modified:
    - src/components/explore/__tests__/CollectorArchetypes.test.tsx
decisions:
  - "CollectorArchetypes accepts optional counts prop for testability (prop-injection pattern), while production path fetches via getBrowseArchetypeCounts() inside 'use cache'"
  - "Phase-47 null stubs omit 'use cache' — caching an unconditional null return is pointless overhead per PATTERNS.md"
  - "Brands index page kept uncached at page level; getBrowseBrandCounts() carries its own 'use cache' scope — avoids getCurrentUser() inside cache boundary (RESEARCH Pitfall 2)"
metrics:
  duration_minutes: 20
  completed_date: "2026-05-19"
  tasks_completed: 3
  files_created: 9
  files_modified: 1
---

# Phase 46 Plan 03: Explore Shell + Browse + Archetypes Summary

5-module /explore shell with two live modules (CollectorArchetypes, BrowseModule) plus three Phase-47 null stubs, and three Browse index pages (Brands with A-Z sticky nav, Eras, Genres), all wiring to /search via archetype/brand/era/genre facets.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 5-module shell + CollectorArchetypes + BrowseModule + Phase-47 null stubs | cfa088f | explore/page.tsx, CollectorArchetypes.tsx, BrowseModule.tsx, HeroModule.tsx, CuratedListsRail.tsx, WhereCollectionsGo.tsx, CollectorArchetypes.test.tsx |
| 2 | Brands, Eras, and Genres index pages | b101153 | brands/page.tsx, eras/page.tsx, genres/page.tsx |
| 3 | Checkpoint: /explore shell, modules, and index pages | — | Auto-approved (--auto mode) |

## Verification

- `npx tsc --noEmit` — no errors in plan files (pre-existing test file errors excluded per parallel execution note)
- `npx vitest run src/components/explore/__tests__/CollectorArchetypes.test.tsx` — 2 tests, all passed
  - null-hide on empty counts (EXPL-02)
  - 10-chip render on full counts (EXPL-05)
- Task 3 checkpoint auto-approved per `--auto` flag

## Acceptance Criteria Met

- `src/app/explore/page.tsx` imports and renders all five module components in `flex flex-col gap-6 md:grid md:grid-cols-2` container
- `CollectorArchetypes.tsx` has `'use cache'`, `cacheTag('explore', 'explore:archetypes')`, fetches `getBrowseArchetypeCounts`, returns null on empty
- `CollectorArchetypes.tsx` renders 10 chips; each chip has `min-h-[44px]` and links to `/search?tab=watches&archetype=`
- `BrowseModule.tsx` renders exactly 3 tiles linking to `/explore/brands`, `/explore/eras`, `/explore/genres`; each tile container has `min-h-12`
- Phase-47 stub components return `null`
- `brands/page.tsx` contains `id="letter-` section anchors with `scroll-mt-12` and a `sticky top-0` jump nav
- Each brand row links to `/search?tab=watches&brand=`, each era row to `&era=`, each genre row to `&genre=`
- `genres/page.tsx` page title is "Genres" (not "Archetypes") and rows have no editorial descriptions

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Adjustments

**1. CollectorArchetypes testability pattern**

The Wave 0 test scaffold showed `CollectorArchetypes({ counts: [] })` — passing counts as props. The component was designed with an optional `counts?: Array<{...}>` prop that, when passed, bypasses the DB fetch (no `getBrowseArchetypeCounts()` call). When not passed, it fetches normally. The `'use cache'` directive at the top of the function works correctly with this pattern: in production, the counts are fetched and cached; in tests, injected counts are used directly with `getBrowseArchetypeCounts` mocked via `vi.mock('@/data/browse')`.

## CSS Chain Assertions Verified

Per UI-SPEC § "CSS Chain Assertions":

1. **Archetype chip 44px touch target:** `min-h-[44px]` explicitly set on each chip button — present in CollectorArchetypes.tsx
2. **Browse tile 48px touch target:** `min-h-12` (48px) on each tile `<div>` — present in BrowseModule.tsx
3. **A–Z scroll-margin offset:** `scroll-mt-12` on every `<section id="letter-{X}">` — present in brands/page.tsx
5. **`flex-wrap` chip rail overflow:** `flex flex-wrap gap-2` on the chip rail — present in CollectorArchetypes.tsx; no `overflow-x-auto` (correct, wrapping is the intended behavior)

## Threat Flags

No new trust boundaries introduced beyond those documented in the plan's threat model. Verified:
- T-46-06 mitigated: no `getCurrentUser()` inside any `'use cache'` scope in BrowseModule or CollectorArchetypes
- T-46-07 mitigated: `await getCurrentUser()` in all four page Server Components (explore, brands, eras, genres)
- T-46-08 accepted: deep-link hrefs carry catalog-derived values only; validation is in Plan 02 Zod schema

## Self-Check: PASSED

Files exist:
- src/app/explore/page.tsx — FOUND
- src/components/explore/CollectorArchetypes.tsx — FOUND
- src/components/explore/BrowseModule.tsx — FOUND
- src/components/explore/HeroModule.tsx — FOUND
- src/components/explore/CuratedListsRail.tsx — FOUND
- src/components/explore/WhereCollectionsGo.tsx — FOUND
- src/app/explore/brands/page.tsx — FOUND
- src/app/explore/eras/page.tsx — FOUND
- src/app/explore/genres/page.tsx — FOUND

Commits exist:
- cfa088f (Task 1) — FOUND
- b101153 (Task 2) — FOUND
