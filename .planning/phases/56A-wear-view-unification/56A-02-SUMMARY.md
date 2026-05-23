---
phase: 56A-wear-view-unification
plan: "02"
subsystem: wear-components
status: complete
tags: [wear, components, shared, keystone, d-12, sc-4]
dependency_graph:
  requires:
    - 56A-01  # getActiveWearsForUser DAL + Wave 0 RED scaffolds
  provides:
    - WearCard  # consumed by Plans 03 (WearsLane) and 04 (wear detail refactor)
    - WearCommentHost
    - WearOverflowMenu
  affects:
    - src/components/wear/
    - tests/components/wear/
tech_stack:
  added: []
  patterns:
    - WR-03 double-submit guard (useTransition + latched status)
    - @base-ui/react Sheet (bottom-sheet variant)
    - @base-ui/react DropdownMenu (overflow menu)
    - safe-area bottom padding inline calc
key_files:
  created:
    - src/components/wear/WearCard.tsx
    - src/components/wear/WearCommentHost.tsx
    - src/components/wear/WearOverflowMenu.tsx
  modified:
    - tests/components/wear/WearCard.test.tsx  # JSX import fix + trigger click for portal assertion
decisions:
  - D-12: WearCard is the single shared source for both /wears/[username] and /wear/[id]
  - D-10: WearCommentHost ships empty placeholder with Phase-57 seam markers
  - D-09: showAddToWishlist prop gates Add-to-wishlist; security enforced server-side
  - "Test scaffold fix: @base-ui/react portals dropdown popup; test must click trigger before asserting portal content"
metrics:
  duration: ~7m
  completed: "2026-05-23"
  tasks_completed: 3
  files_modified: 4
---

# Phase 56A Plan 02: Shared Wear Components (Keystone) Summary

**One-liner:** Three shared components — WearCard (D-12 single source), WearCommentHost (Phase-57 shell), WearOverflowMenu (D-01/D-08/D-09) — extracted and wire-ready for Plans 03 and 04.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | WearOverflowMenu (Copy link + gated Add-to-wishlist) | 3a794a7 | src/components/wear/WearOverflowMenu.tsx |
| 2 | WearCommentHost (bottom-sheet + inline, empty placeholder) | a1fa376 | src/components/wear/WearCommentHost.tsx |
| 3 | WearCard — shared content card (D-12) | 08aed97 | src/components/wear/WearCard.tsx, tests/components/wear/WearCard.test.tsx |

## What Was Built

### WearOverflowMenu (`src/components/wear/WearOverflowMenu.tsx`)

DropdownMenu-based "…" menu with:
- `MoreHorizontal` trigger, `min-h/w-[44px]`, `aria-label="More options"`, `onPhoto`-driven text color
- "Copy link" item always present (D-01) — `navigator.clipboard.writeText(permalinkUrl)`, silent
- "Add to wishlist" item conditionally rendered behind `{showAddToWishlist && (` (D-09)
- WR-03 double-submit guard verbatim from WywtSlide.tsx: `if (pending || status === 'added') return`
- Sonner toasts: "Added to wishlist" / "Could not add to wishlist. Try again." per UI-SPEC §Copywriting

### WearCommentHost (`src/components/wear/WearCommentHost.tsx`)

Two-variant comment host shell (D-10):
- `variant="bottom-sheet"`: Sheet + SheetContent `side="bottom" max-h-[60vh] overflow-y-auto` + SheetTitle "Comments" + "No comments yet." placeholder + `{/* Phase 57: shared comment component renders here */}` seam
- `variant="inline"`: `<section id="wear-comments">` with `border-t border-border px-4 pt-4 pb-6 md:max-w-[600px] md:mx-auto`, `<h2>Comments</h2>`, "No comments yet." placeholder + same Phase-57 seam marker
- Does NOT import SheetPortal (not exported by sheet.tsx)

### WearCard (`src/components/wear/WearCard.tsx`)

Single shared wear-content card (D-12, SC-4):
- Photo layer: branches on `signedUrl !== null` → `<WearPhotoClient>` / `<WearDetailHero>`; both render `WearPhotoOverlays` internally (no second overlay)
- `grep -c "next/image"` returns 0 — Pitfall F-2 respected
- WearOverflowMenu rendered `absolute top-3 right-3 z-20` over photo
- Bottom-sheet engagement row: `flex items-center px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]`, comment trigger `aria-label="Open comments"` text-white, LikeButton right
- Inline engagement row: `flex items-center px-4 py-3 border-t border-border md:max-w-[600px] md:mx-auto`, comment trigger `aria-label="View comments"` scrolls to `#wear-comments`
- WearCommentHost rendered after the row (variant-matched)
- `onCommentOpenChange?` prop exposes sheet state for Plan 03's embla swipe-pause

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed JSX namespace error in Plan 01 test scaffold**
- **Found during:** Task 3 (running `npm run test -- WearCard`)
- **Issue:** Plan 01 scaffold used `JSX.Element` without importing from 'react'; `tsconfig.json` requires explicit import in strict mode
- **Fix:** Added `import type { JSX } from 'react'` to `tests/components/wear/WearCard.test.tsx`
- **Files modified:** tests/components/wear/WearCard.test.tsx
- **Commit:** 08aed97

**2. [Rule 1 - Bug] Fixed D-09 test assertion for portal-rendered dropdown content**
- **Found during:** Task 3 (test run — 1 of 3 tests failed)
- **Issue:** `@base-ui/react/menu` portals the popup; menu items are not in the DOM until the trigger is clicked. `screen.getByText('Add to wishlist')` found nothing in the closed-dropdown state.
- **Fix:** Added `fireEvent.click(screen.getByRole('button', { name: 'More options' }))` before the assertion to open the dropdown and materialize its portal content. The Plan 01 comment "Plan 02 executor may extend as needed" explicitly permitted this.
- **Files modified:** tests/components/wear/WearCard.test.tsx
- **Commit:** 08aed97

## Verification

```
npm run test -- WearCard
✓ SC-4: @/components/wear/WearCard exports a function (single shared source)
✓ D-09: showAddToWishlist={false} → "Add to wishlist" item NOT present
✓ D-09: showAddToWishlist={true} → "Add to wishlist" item IS present
Tests: 3 passed (3)

npx tsc --noEmit → no errors referencing WearCard.tsx / WearCommentHost.tsx / WearOverflowMenu.tsx
grep -c "next/image" src/components/wear/WearCard.tsx → 0
```

## Known Stubs

- `WearCommentHost` both variants render `<p>No comments yet.</p>` as a placeholder. This is intentional per D-10: the real comment thread component is wired in Phase 57. Stubs are marked with `{/* Phase 57: shared comment component renders here */}` seam markers.

## Threat Surface Scan

No new security-relevant surfaces introduced. The `WearOverflowMenu` reuses `addToWishlistFromWearEvent` verbatim — its three-tier visibility gate + zod `.strict()` are server-side and unchanged. T-56A-04 and T-56A-05 mitigations from the plan's threat model are both implemented and asserted.

## Self-Check: PASSED

- [x] src/components/wear/WearCard.tsx — FOUND
- [x] src/components/wear/WearCommentHost.tsx — FOUND
- [x] src/components/wear/WearOverflowMenu.tsx — FOUND
- [x] commit 3a794a7 — FOUND (WearOverflowMenu)
- [x] commit a1fa376 — FOUND (WearCommentHost)
- [x] commit 08aed97 — FOUND (WearCard + test fix)
- [x] npm run test -- WearCard → 3/3 passed
