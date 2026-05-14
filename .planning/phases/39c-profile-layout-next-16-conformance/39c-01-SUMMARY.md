---
phase: 39c-profile-layout-next-16-conformance
plan: "01"
subsystem: profile-layout
tags: [skeleton, loading-boundary, next16, server-component]
dependency_graph:
  requires: []
  provides: [ProfileShellSkeleton, loading.tsx segment boundary]
  affects: [src/app/u/[username]/layout.tsx (Plan 03 will consume ProfileShellSkeleton)]
tech_stack:
  added: []
  patterns: [shadcn Skeleton primitive composition, Next 16 loading.tsx segment convention]
key_files:
  created:
    - src/app/u/[username]/profile-shell-skeleton.tsx
    - src/app/u/[username]/loading.tsx
  modified: []
decisions:
  - "Skeleton outer wrapper is <div> (not <main>) — layout.tsx owns the <main> wrapper; loading.tsx owns a separate <main> for the segment boundary per loading.md:88"
  - "No a11y labels added — follows VerdictSkeleton/SearchResultsSkeleton precedent (no role=status/aria-label on skeletons)"
  - "Fixed 5 tab pills matching ProfileTabs base tabs (collection/wishlist/worn/notes/stats)"
metrics:
  duration: "~3 minutes"
  completed: 2026-05-14
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 39c Plan 01: ProfileShellSkeleton + loading.tsx Summary

Chrome-only profile loading skeleton (D-39c-06) and Next 16 segment boundary that renders it, delivering zero outer-CLS on the public-branch swap.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Author ProfileShellSkeleton chrome-only skeleton | bc24023 | src/app/u/[username]/profile-shell-skeleton.tsx |
| 2 | Author loading.tsx segment boundary | 4706d3a | src/app/u/[username]/loading.tsx |

## Files Created

### `src/app/u/[username]/profile-shell-skeleton.tsx`

Chrome-only presentational Server Component. Single import (`Skeleton` primitive). Named export `ProfileShellSkeleton`. Renders 4 Skeleton blocks per 39C-UI-SPEC element-by-element contract:

| Element | Classes | Dimension |
|---------|---------|-----------|
| Avatar circle | `size-24 rounded-full` | 96px (matches `AvatarDisplay size={96}`) |
| Name placeholder | `h-6 w-48` | 24px × 192px |
| Tab pills (×5) | `h-9 w-20 shrink-0 rounded-md` | 36px × 80px each |
| Content card | `h-64 w-full rounded-xl border` | 256px height |

Outer wrapper: `<div className="space-y-6" data-testid="profile-shell-skeleton">`.

### `src/app/u/[username]/loading.tsx`

2-statement Next 16 segment loading boundary. Synchronous default export `Loading()`. Renders `<ProfileShellSkeleton />` inside `<main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">` — byte-equivalent to `layout.tsx:50,113` so the skeleton-to-layout swap is zero outer-CLS.

## Verification

- All Task 1 acceptance criteria: PASS (file exists, named export, correct import, 4 Skeleton occurrences, all UI-SPEC dimensions, data-testid, no font-medium, no raw colors, no use client directive)
- All Task 2 acceptance criteria: PASS (file exists, default export Loading, correct import, matching main className, ProfileShellSkeleton rendered, no use client, no async/await)
- `npm run build`: PASS — compiled successfully in 7.5s, no new errors
- Pre-existing lint errors in `layout.tsx` and `FilterBar.tsx` are out of scope (not caused by this plan)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Both files are self-contained presentational components with no data dependencies. No stubs or placeholder data present.

## Threat Flags

None. Both files are pure presentational Server Components with no network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- [x] `src/app/u/[username]/profile-shell-skeleton.tsx` — created (bc24023)
- [x] `src/app/u/[username]/loading.tsx` — created (4706d3a)
- [x] bc24023 exists in git log
- [x] 4706d3a exists in git log
