---
phase: 43-polish-pass
plan: "03"
subsystem: profile-tabs
tags: [ui, collection, wishlist, ux, plsh-05]
dependency_graph:
  requires: []
  provides: [add-watch-button-above-grid]
  affects: [CollectionTabContent, WishlistTabContent]
tech_stack:
  added: []
  patterns: [base-ui-button-render-prop, render-prop-link-pattern]
key_files:
  created:
    - tests/components/profile/CollectionTabContent.test.tsx
    - tests/components/profile/WishlistTabContent.test.tsx
  modified:
    - src/components/profile/CollectionTabContent.tsx
    - src/components/profile/WishlistTabContent.tsx
    - src/components/profile/WishlistTabContent.test.tsx
decisions:
  - "Use Button render={<Link>} pattern (not asChild) — this project uses @base-ui/react/button which exposes a render prop, not radix/shadcn's asChild pattern"
  - "Removed AddWatchCard import from WishlistTabContent entirely — unlike CollectionTabContent, the wishlist empty-state never used AddWatchCard (uses direct Button+Link); the import was exclusive to the grid tile"
  - "Removed returnTo prop from OwnerWishlistGrid — prop was only threaded to AddWatchCard; removing AddWatchCard from the grid made the prop dead code"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-17T05:37:50Z"
  tasks_completed: 2
  files_modified: 5
---

# Phase 43 Plan 03: Add-Watch Button Relocation Summary

Relocated the add-watch CTA from an end-of-grid `AddWatchCard` tile to a right-aligned button above the grid in both the collection and wishlist tabs (PLSH-05 / D-06, D-07).

## What Was Built

**CollectionTabContent.tsx** — Added a right-aligned `Button` (rendered as a `Link` to `/watch/new?returnTo=...`) inside the existing `mb-4 flex items-center gap-2` filter row, after the search input. Gated by `isOwner`. Removed the `{isOwner && <AddWatchCard returnTo={pathname || null} />}` line from the end of the populated grid. Empty-state branches untouched (D-08).

**WishlistTabContent.tsx** — Added a `<div className="mb-4 flex justify-end">` header row wrapping a `Button` (rendered as a `Link` to `/watch/new?status=wishlist&returnTo=...`) in `WishlistTabContent` immediately before the `<OwnerWishlistGrid>` return, so `isOwner` is in scope without threading a new prop. Removed `<AddWatchCard variant="wishlist">` from inside `OwnerWishlistGrid`. Cleaned up now-unused `AddWatchCard` import and `returnTo` prop from `OwnerWishlistGrid`. Empty-state branches untouched (D-08).

**Tests** — Created `tests/components/profile/CollectionTabContent.test.tsx` and `tests/components/profile/WishlistTabContent.test.tsx`. Updated pre-existing `src/components/profile/WishlistTabContent.test.tsx` to reflect PLSH-05 behavior (button above grid vs. end-of-grid card).

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add "Add to Collection" button to CollectionTabContent | d090f60 |
| 2 | Add "Add to Wishlist" button to WishlistTabContent | 4782135 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used `render={<Link>}` prop instead of `asChild`**
- **Found during:** Task 1 TypeScript check
- **Issue:** The plan spec called for `<Button asChild ...>` wrapping `<Link>`, but this project uses `@base-ui/react/button` which does not support the `asChild` prop. The correct pattern is `<Button render={<Link href="..." />}>children</Button>` — matching existing usage in the codebase (e.g., `CollectionTabContent.tsx` line 120, `WishlistTabContent.tsx` line 70).
- **Fix:** Changed all button+link instances to the `render={<Link>}` pattern.
- **Files modified:** `src/components/profile/CollectionTabContent.tsx`, `src/components/profile/WishlistTabContent.tsx`

**2. [Rule 1 - Bug] Updated pre-existing WishlistTabContent test to reflect PLSH-05**
- **Found during:** Task 2 test run
- **Issue:** `src/components/profile/WishlistTabContent.test.tsx` (Phase 20.1 legacy test) asserted `getByLabelText('Add to Wishlist')` which matched the `AddWatchCard`'s `aria-label`. After removing the tile, this assertion broke.
- **Fix:** Updated the test title and assertion to check for the link-role element (`getByRole('link', { name: 'Add to Wishlist' })`) which matches the base-ui `Button render={<Link>}` rendered element in that test's `next/link` mock context.
- **Files modified:** `src/components/profile/WishlistTabContent.test.tsx`

**3. [Rule 2 - Cleanup] Removed unused `AddWatchCard` import and dead `returnTo` prop from `OwnerWishlistGrid`**
- **Found during:** Task 2
- **Issue:** After removing the `AddWatchCard` grid tile from `WishlistTabContent`, the `AddWatchCard` import and `returnTo` prop on `OwnerWishlistGrid` became dead code. The plan said to preserve the import but the plan assumed `WishlistTabContent`'s empty state used `AddWatchCard` — it does not (it uses a direct `Button+Link`). Leaving dead imports causes lint noise and potential TypeScript "declared but never read" warnings.
- **Fix:** Removed the `AddWatchCard` import and `returnTo` prop from `OwnerWishlistGrid` (the prop was solely used to pass to `AddWatchCard`).
- **Files modified:** `src/components/profile/WishlistTabContent.tsx`

## Known Stubs

None. Both components render functional buttons pointing to correct `/watch/new` routes.

## Threat Flags

None. No new trust boundaries introduced. The `returnTo` values continue to be `encodeURIComponent`-encoded before insertion into the href, matching existing `AddWatchCard` behavior.

## Self-Check: PASSED

- CollectionTabContent.tsx: FOUND
- WishlistTabContent.tsx: FOUND
- tests/components/profile/CollectionTabContent.test.tsx: FOUND
- tests/components/profile/WishlistTabContent.test.tsx: FOUND
- SUMMARY.md: FOUND
- Commit d090f60: FOUND
- Commit 4782135: FOUND
