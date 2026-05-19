---
phase: 47-curated-lists-rail-hero-where-collections-go
plan: "03"
subsystem: explore-hero-paths-components
tags: [hero, curated-lists, collection-paths, server-components, use-cache, tdd, wave-2]
dependency_graph:
  requires: [phase-47-plan-01, phase-45-cms-tables, phase-46-explore-shell]
  provides: [HeroModule-live, WhereCollectionsGo-live, PathCard, explore-paths-route, HeroFeature-type]
  affects:
    - src/components/explore/HeroModule.tsx
    - src/components/explore/WhereCollectionsGo.tsx
    - src/components/explore/PathCard.tsx
    - src/app/explore/paths/page.tsx
    - src/app/explore/page.tsx
    - src/lib/heroTypes.ts
tech_stack:
  added: []
  patterns:
    - use-cache-server-component-with-cacheTag
    - discriminated-union-forward-compat
    - weekly-rotation-via-epoch-week-index
    - tdd-red-green-per-component
    - numbered-vertical-stack-mobile-horizontal-desktop
key_files:
  created:
    - src/lib/heroTypes.ts
    - src/components/explore/PathCard.tsx
    - src/app/explore/paths/page.tsx
  modified:
    - src/components/explore/HeroModule.tsx
    - src/components/explore/WhereCollectionsGo.tsx
    - src/app/explore/page.tsx
    - src/components/explore/__tests__/HeroModule.test.tsx
    - src/components/explore/__tests__/WhereCollectionsGo.test.tsx
decisions:
  - "HeroFeature discriminated union defined in src/lib/heroTypes.ts (not inlined) for SEED-008 forward-compat"
  - "cacheTag('explore:hero') alone on HeroModule (not 'explore') per D-09 — Hero revalidates on editorial changes, not generic explore invalidation"
  - "PathCard takes pathWithNodes as a single prop (not path + nodes separately) to match the getPathWithNodes return shape"
  - "Seed watch rendered as node #1 in PathCard with synthetic id and null rationale"
  - "WhereCollectionsGo wrap-around: slice(startIdx, startIdx+3) then prepend from start when short — handles both < 3 paths and end-of-array cases"
metrics:
  duration: "~8m"
  completed_date: "2026-05-19"
  tasks_completed: 3
  files_changed: 9
---

# Phase 47 Plan 03: Hero Module + Where Collections Go + /explore/paths Summary

Quality-gated featured-list hero with pin override and weekly rotation, 3-path collection paths module with mobile vertical stack and desktop horizontal sequence, and the /explore/paths see-all route grouped by path-type — replacing all three return-null stubs.

## What Was Built

### Task 1: HeroModule + HeroFeature type + explore-shell slot

**`src/lib/heroTypes.ts`** — Exports `HeroFeature` discriminated union on `format`: `{ format: 'featured_list'; list: CuratedListHero }` | `{ format: 'featured_collector' }`. SEED-008 forward-compat shape; only `featured_list` is wired this phase.

**`src/components/explore/HeroModule.tsx`** — Replaced return-null stub. Async Server Component with `'use cache'` / `cacheTag('explore:hero')` / `cacheLife('hours')`. Selection logic:
- `Promise.all` of `getCmsSettings()` + `getPublishedLists(50)`, then `getListItemCount` per list.
- D-08 quality gate: eligible iff `itemCount >= 3` AND `coverUrl` truthy AND `introMarkdown` truthy.
- D-09 pin override: checks `pinnedListId` + `pinExpiresAt`; falls back to rotation if pinned list not in eligible pool.
- D-07 weekly rotation: sorts eligible pool by `publishedAt` asc then `id`, selects `sorted[week % sorted.length]`.
- Full-bleed CSS chain: `aspect-video / overflow-hidden / min-h-[200px]` container; `absolute inset-0 w-full h-full object-cover` image; gradient overlay; bottom-anchored text block.
- No `getCurrentUser()` (T-47-12 verified).

**`src/app/explore/page.tsx`** — Wrapped `<HeroModule />` in `<div className="md:col-span-2">` to span full width on desktop (UI-SPEC Discretion).

**`src/components/explore/__tests__/HeroModule.test.tsx`** — Converted 5 `it.todo` scaffolds to 4 live `it()` tests: empty pool returns null, pinned list rendered, weekly rotation fallback, ineligible pin fallback. All 4 pass.

### Task 2: WhereCollectionsGo + PathCard

**`src/components/explore/WhereCollectionsGo.tsx`** — Replaced return-null stub. Async Server Component with `'use cache'` / `cacheTag('explore', 'explore:paths')` / `cacheLife('hours')`. D-13 weekly rotation with wrap-around slice. Fetches `getPathWithNodes` per selected path. No `getCurrentUser()` (T-47-12 verified).

**`src/components/explore/PathCard.tsx`** — New sub-component taking `pathWithNodes` prop (seed watch + nodes). Renders:
- D-14: `<Badge variant="secondary" className="text-xs">{path.pathType}</Badge>` above path sequence.
- D-11 mobile (`flex flex-col gap-3 md:hidden`): numbered badges (`bg-accent text-accent-foreground size-6 rounded-full`), connector lines (`w-px flex-1 bg-border min-h-[24px]`, omitted on last node), watch link + rationale.
- D-12 desktop (`hidden md:flex gap-4 items-start`): `w-44 space-y-2` blocks with `aspect-square rounded-md bg-muted overflow-hidden` image chain, `ChevronRight` between nodes.
- All watch nodes link to `/catalog/${node.catalogId}` (D-14).

**`src/components/explore/__tests__/WhereCollectionsGo.test.tsx`** — Converted 5 `it.todo` scaffolds to 5 live `it()` tests: empty returns null, renders 3 paths, uses rotation, "Explore all paths" link, path-type chip. All 5 pass.

### Task 3: /explore/paths see-all route

**`src/app/explore/paths/page.tsx`** — Server Component. `await getCurrentUser()` first (outside cache scope, auth assertion). Fetches `getPublishedPaths(100)` + `getPathWithNodes` per path. Groups by `pathType` into a `Map<PathType, paths>`. Iterates `PATH_TYPES` in canonical order; renders a `<section>` per type that has ≥1 path (empty sections omitted per EXPL-02). Imports `PATH_TYPES` from `@/lib/pathTypes` (not from `'use server'` action file, D-05). Reuses `PathCard` sub-component.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (RED) | `c91add5` | test(47-03): add failing HeroModule tests |
| Task 1 (GREEN) | `90a3384` | feat(47-03): implement HeroModule with quality gate, pin override, weekly rotation |
| Task 2 (RED) | `6f362e2` | test(47-03): add failing WhereCollectionsGo tests |
| Task 2 (GREEN) | `3acb103` | feat(47-03): implement WhereCollectionsGo and PathCard |
| Task 3 | `54914cf` | feat(47-03): add /explore/paths see-all route grouped by path-type |

## Verification

- `npm test -- --run HeroModule.test.tsx` — 4 live tests, all pass
- `npm test -- --run WhereCollectionsGo.test.tsx` — 5 live tests, all pass
- `npx tsc --noEmit` — no new errors in plan files (pre-existing errors in `u/[username]/layout.tsx`, `RecentlyEvaluatedRail.test.tsx`, `SearchPageClient.test.tsx` are carryover from STATE.md)
- `cacheTag('explore:hero')` appears exactly once in HeroModule.tsx (not `cacheTag('explore', 'explore:hero')`)
- No `getCurrentUser()` function calls in HeroModule.tsx or WhereCollectionsGo.tsx (T-47-12 compliance)
- Hero `md:col-span-2` wrapper present in explore/page.tsx

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All three components are fully wired — HeroModule and WhereCollectionsGo replace their return-null stubs with live implementations, PathCard is newly created with full dual-layout rendering.

## Threat Flags

No new security-relevant surface introduced beyond the plan's `<threat_model>`. T-47-10/T-47-11/T-47-12/T-47-13 mitigations verified:
- Draft/unpublished lists excluded by `getPublishedLists` + quality gate (T-47-10)
- Stale pin drops ineligible pinned list (T-47-11)
- No `getCurrentUser()` in cached scopes (T-47-12)
- Draft paths excluded by `getPublishedPaths` (T-47-13)

## Self-Check: PASSED

- `src/lib/heroTypes.ts` — exists, exports HeroFeature union with both variants: FOUND
- `src/components/explore/HeroModule.tsx` — exists, min_lines > 40, cacheTag('explore:hero'): FOUND
- `src/components/explore/WhereCollectionsGo.tsx` — exists, cacheTag('explore', 'explore:paths'): FOUND
- `src/components/explore/PathCard.tsx` — exists, mobile md:hidden + desktop hidden md:flex: FOUND
- `src/app/explore/paths/page.tsx` — exists, getCurrentUser first, PATH_TYPES from @/lib/pathTypes: FOUND
- `src/app/explore/page.tsx` — md:col-span-2 wrapper on HeroModule: FOUND
- Commit `c91add5` — test RED HeroModule: FOUND
- Commit `90a3384` — feat HeroModule: FOUND
- Commit `6f362e2` — test RED WhereCollectionsGo: FOUND
- Commit `3acb103` — feat WhereCollectionsGo + PathCard: FOUND
- Commit `54914cf` — feat /explore/paths route: FOUND
- 9 live tests pass (4 HeroModule + 5 WhereCollectionsGo): VERIFIED
