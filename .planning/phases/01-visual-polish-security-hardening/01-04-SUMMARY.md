---
phase: 01-visual-polish-security-hardening
plan: 04
subsystem: ui-layout
tags: [responsive, mobile, drawer, grid, sheet]
requires:
  - src/components/ui/sheet.tsx (01-01)
  - src/components/layout/ThemeToggle.tsx (01-01)
provides:
  - MobileNav hamburger drawer component
  - Mobile filter drawer on collection home
  - WatchDetail 2-col responsive grid (lg:grid-cols-[2fr_1fr])
  - Mobile-safe Preferences page widths
affects:
  - src/components/layout/Header.tsx
  - src/app/page.tsx
  - src/components/filters/FilterBar.tsx
  - src/components/watch/WatchDetail.tsx
  - src/app/preferences/page.tsx
tech-stack:
  added: []
  patterns:
    - "base-ui Dialog/Sheet trigger uses `render` prop (not `asChild`)"
    - "Mobile drawer trigger hidden on md+ via `md:hidden` / `lg:hidden`"
    - "Desktop sidebar hidden <lg via `hidden lg:block`"
    - "Main content column uses `min-w-0` to allow flex children to shrink below intrinsic size"
key-files:
  created:
    - src/components/layout/MobileNav.tsx
  modified:
    - src/components/layout/Header.tsx
    - src/app/page.tsx
    - src/components/filters/FilterBar.tsx
    - src/components/watch/WatchDetail.tsx
    - src/app/preferences/page.tsx
decisions:
  - "SheetTrigger uses the `render` prop (base-ui pattern) matching existing DialogTrigger usage in WatchDetail, not `asChild`"
  - "WatchDetail left column holds image + title + actions (not just image+header); right column holds the 4 spec cards stacked vertically"
  - "Preferences page kept its existing max-w-3xl container; only the narrow `max-w-xs` sub-containers were widened to `w-full sm:max-w-xs` so 375px viewport has breathing room"
  - "FilterBar root got `w-full` but no token migration — Plan 01-05 owns all classname token cleanup"
metrics:
  duration: ~15 min
  tasks: 2
  files: 6
  completed: 2026-04-11
---

# Phase 01 Plan 04: Responsive Layout Fixes Summary

Mobile-friendly layout for Header (hamburger drawer), home page filters (Sheet drawer <lg), WatchDetail (2fr_1fr grid), and Preferences page (full-width form containers at 375px).

## What Changed

### Task 1: MobileNav drawer + Header wiring (commit a07d766)

- New `src/components/layout/MobileNav.tsx` wraps shadcn Sheet with:
  - `Menu` icon trigger button, `h-11 w-11 md:hidden` — only visible below md
  - SheetContent side=left width 72, containing nav links (Collection / Insights / Preferences) with active-route highlight via `usePathname`
  - ThemeToggle pinned below a divider
  - Local `open` state closes the drawer after nav clicks
- `Header.tsx` imports and renders `<MobileNav />` as the first child of the left cluster; gap tightened to `gap-2 md:gap-8` so the hamburger sits snug against the logo on mobile. Desktop `<nav className="hidden md:flex">` untouched.
- **Base-UI note:** `SheetTrigger` accepts a `render={<Button .../>}` prop (not `asChild`) — matches the existing `DialogTrigger` pattern in WatchDetail.

### Task 2: Filter drawer + WatchDetail grid + Preferences widths (commit 313643b)

**`src/app/page.tsx`:**
- Desktop sidebar now `hidden lg:block lg:w-64` — only visible at lg+
- Header row of main content now contains a `lg:hidden` "Filters" button (`SlidersHorizontal` icon) that opens a Sheet drawer with `<FilterBar />`
- StatusToggle moved into the same header cluster as the mobile filter trigger
- Main content column given `min-w-0` to prevent WatchGrid children from forcing horizontal overflow inside the flex row

**`src/components/filters/FilterBar.tsx`:**
- Root div gained `w-full` so it fills the drawer width without introducing raw-palette changes (Plan 01-05 owns token migration)

**`src/components/watch/WatchDetail.tsx`:**
- Outer wrapper now `<div className="grid gap-8 lg:grid-cols-[2fr_1fr]">`
- **Left column:** image (full width of its column, aspect-square, max-w-md), title + status badge + model + reference, and the action buttons (Mark as Worn / Edit / Delete) in a wrap-friendly flex row
- **Right column:** the four spec cards (Specifications, Pricing, Classification, Tracking) now stack vertically via `grid gap-6` (instead of the previous `grid lg:grid-cols-2`) — they read as a tight info column on the right
- Below lg, grid collapses to single column by default (no `grid-cols-1` override needed)
- SimilarityBadge and Notes sit outside the grid as full-width sections below
- Next/image usage preserved from Plan 01-03

**`src/app/preferences/page.tsx`:**
- Three sub-containers changed from `max-w-xs` to `w-full sm:max-w-xs`:
  - Case Size grid (Min/Max inputs)
  - Overlap Tolerance select
  - Collection Goal select
- Outer container (`max-w-3xl px-4`) already mobile-safe; no change needed
- Checkbox grids already use `flex-wrap gap-4` which wraps cleanly at 375px
- No preference logic touched

## Verification

- `npm run build` green (both tasks)
- `npm run lint` green (only pre-existing warnings in `src/lib/extractors/*` — out of scope)
- `npm test` green — 44 tests pass (smoke, no-raw-img, images, ssrf, theme)
- Acceptance criteria `grep` checks all pass:
  - `src/components/layout/MobileNav.tsx` exists and contains `Sheet` + `md:hidden`
  - `Header.tsx` imports `MobileNav`
  - `WatchDetail.tsx` contains `lg:grid-cols-[2fr_1fr]`
  - `page.tsx` contains `Sheet`, `lg:hidden`, `hidden lg:block`

Manual 375px walkthrough deferred to phase-close verification per plan's `<done>` clause.

## Deviations from Plan

### [Rule 3 - Blocking] SheetTrigger API (`asChild` → `render`)

- **Found during:** Task 1, initial MobileNav creation
- **Issue:** Plan's example code used shadcn's `<SheetTrigger asChild>` pattern, but this project's Sheet primitive is built on `@base-ui/react/dialog`, which uses a `render` prop instead
- **Fix:** Switched to `<SheetTrigger render={<Button ... />}>` pattern, matching existing `DialogTrigger` usage in `WatchDetail.tsx` (the project's only prior `base-ui` trigger example)
- **Files modified:** `src/components/layout/MobileNav.tsx`, `src/app/page.tsx`
- **Commits:** a07d766, 313643b

### [Rule 3 - Blocking] WatchDetail flex row → min-w-0

- **Found during:** Task 2, home page filter layout
- **Issue:** The home page's `<div className="flex-1">` main content can overflow its flex parent at mobile widths because flex items default to `min-width: auto`
- **Fix:** Added `min-w-0` to the flex-1 main column so WatchGrid items shrink correctly
- **Files modified:** `src/app/page.tsx`
- **Commit:** 313643b

## Known Stubs

None.

## Threat Flags

None. The changes are pure layout/presentation — no new network endpoints, auth paths, or data boundaries introduced. T-01-30 (drawer overflow) is mitigated via `overflow-y-auto` on the mobile FilterBar SheetContent; T-01-31 accepted per plan.

## Self-Check: PASSED

- FOUND: src/components/layout/MobileNav.tsx
- FOUND: src/components/layout/Header.tsx (imports MobileNav)
- FOUND: src/app/page.tsx (Sheet + lg:hidden + hidden lg:block)
- FOUND: src/components/filters/FilterBar.tsx (w-full)
- FOUND: src/components/watch/WatchDetail.tsx (lg:grid-cols-[2fr_1fr])
- FOUND: src/app/preferences/page.tsx (w-full sm:max-w-xs)
- FOUND: commit a07d766 (Task 1)
- FOUND: commit 313643b (Task 2)
