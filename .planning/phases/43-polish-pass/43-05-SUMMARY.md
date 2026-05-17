---
phase: 43-polish-pass
plan: "05"
subsystem: profile-watch-grid
tags: [gap-closure, spacing, button-variant, css-chain, equal-height]
dependency_graph:
  requires: [43-02, 43-03]
  provides: [GAP-43-01-closed, GAP-43-02-closed]
  affects: [ProfileWatchCard, CollectionTabContent, WishlistTabContent]
tech_stack:
  added: []
  patterns: [tailwind-spacing-split, shadcn-button-outline]
key_files:
  modified:
    - src/components/profile/ProfileWatchCard.tsx
    - src/components/profile/CollectionTabContent.tsx
    - src/components/profile/WishlistTabContent.tsx
decisions:
  - "pt-3 -> pt-2 on header div for tighter brand/model top padding"
  - "p-3 -> px-3 py-2 on CardContent to shrink vertical padding while preserving horizontal"
  - "variant=default -> variant=outline on populated-grid add buttons only; empty-state CTAs left unchanged per D-08"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 43 Plan 05: Gap Closure (GAP-43-01 + GAP-43-02) Summary

Two pure-frontend tweaks closing UAT gaps from Phase 43 polish pass: tighter watch card vertical spacing and outline-style add-watch buttons.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Tighten ProfileWatchCard vertical spacing (GAP-43-01) | 60ae402 | src/components/profile/ProfileWatchCard.tsx |
| 2 | Change add-watch buttons to outline variant (GAP-43-02) | 9de6a04 | src/components/profile/CollectionTabContent.tsx, src/components/profile/WishlistTabContent.tsx |

## What Was Built

**GAP-43-01 (PLSH-04):** Reduced vertical padding on `ProfileWatchCard` to make the collection and wishlist grid cards visibly shorter. The header div top padding was reduced from `pt-3` to `pt-2`, and `CardContent` padding was split from `p-3` to `px-3 py-2` (horizontal preserved, vertical reduced). The equal-height CSS chain — `h-full flex flex-col` on Card, `flex-1` on CardContent, `aspect-[3/4]` on the image div — is fully intact.

**GAP-43-02 (PLSH-05):** Changed the `variant` prop on the two populated-grid add-watch buttons from `"default"` (filled primary) to `"outline"` (border, transparent fill). The "Add to Collection" button in `CollectionTabContent` and the "Add to Wishlist" button in `WishlistTabContent` are now secondary-weighted. All other button attributes (size, className, href, copy, render pattern) are unchanged. Empty-state CTAs remain `variant="default"` per D-08.

## Verification

**Equal-height CSS chain assertions (CHAIN_INTACT):**
- `h-full flex flex-col` on Card: PASS
- `flex-1` on CardContent: PASS
- `aspect-[3/4]` on image div: PASS
- `pt-3` removed (replaced with `pt-2`): PASS
- `px-3 py-2` present on CardContent: PASS

**Outline variant assertions (OUTLINE_APPLIED):**
- `variant="outline"` in CollectionTabContent: PASS
- `variant="outline"` in WishlistTabContent: PASS
- `variant="default"` count in CollectionTabContent: 2 (empty-state buttons untouched)
- `variant="default"` count in WishlistTabContent: 1 (empty-state button untouched)
- `size="sm"`, `min-h-[44px]`, copy, and `render={<Link.../>}` unchanged on both buttons: PASS

**TypeScript:** No errors in modified profile component files.

## Deviations from Plan

None — plan executed exactly as written. The accidental edit to the main repo file (not the worktree) was identified and corrected before committing; only worktree files were committed.

## Known Stubs

None — these are presentational class/prop changes with no data flow. No placeholder or hardcoded empty values introduced.

## Threat Flags

None — pure Tailwind class string and prop changes. No new network endpoints, auth paths, file access patterns, or schema changes. Confirmed by plan threat model: T-43-G05-01 accept disposition.

## Self-Check

- [x] `src/components/profile/ProfileWatchCard.tsx` modified (60ae402)
- [x] `src/components/profile/CollectionTabContent.tsx` modified (9de6a04)
- [x] `src/components/profile/WishlistTabContent.tsx` modified (9de6a04)
- [x] Commits 60ae402 and 9de6a04 exist on worktree-agent-ab3fdb31eb4ad1570

## Self-Check: PASSED
