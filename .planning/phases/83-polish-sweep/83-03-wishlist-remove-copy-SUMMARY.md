---
phase: 83-polish-sweep
plan: "03"
subsystem: watch-detail
tags:
  - ui
  - copy
  - polish
  - wishlist
  - dialog

dependency_graph:
  requires: []
  provides:
    - "Wishlist/grail-aware delete UX: softened copy + outline trigger variant"
  affects:
    - src/components/watch/WatchDetail.tsx

tech_stack:
  added: []
  patterns:
    - "Conditional JSX variant prop keyed on existing boolean derived value"

key_files:
  modified:
    - src/components/watch/WatchDetail.tsx

decisions:
  - "D-07: isWishlistLike gate (wishlist || grail) drives all conditional copy/variant — not re-derived, used directly at each site"
  - "D-08: Owned-watch delete UX untouched — Delete / Delete Watch / destructive remains"
  - "D-09: Wishlist copy = Remove from wishlist / You can add it back any time / confirm button stays destructive variant"
  - "D-10: Trigger button variant differs: outline for wishlist-like, destructive for owned"
  - "D-11: handleDelete, removeWatch, isWishlistLike derivation names unchanged"

metrics:
  duration: "~5 min"
  completed_date: "2026-07-14"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 83 Plan 03: Wishlist Remove Copy Summary

Softened the wishlist/grail delete UX in `WatchDetail.tsx` from "Delete" to "Remove from wishlist" copy on both the action button and confirmation dialog, with the trigger button downgraded from `destructive` to `outline` variant for wishlist-like watches.

## One-liner

Wishlist/grail delete UX softened to "Remove from wishlist" + outline trigger; owned-watch "Delete" + destructive stays untouched.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Conditional wishlist/grail-aware delete copy + variant | c868740e | src/components/watch/WatchDetail.tsx |

## What Changed

Single targeted edit inside the `<Dialog open={isDeleteDialogOpen}>` block (lines 302-331):

1. **DialogTrigger Button**: `variant={isWishlistLike ? 'outline' : 'destructive'}` with child text `{isWishlistLike ? 'Remove from wishlist' : 'Delete'}`.
2. **DialogTitle**: `{isWishlistLike ? 'Remove from wishlist' : 'Delete Watch'}`.
3. **DialogDescription**: inline ternary — wishlist branch produces `Remove {brand} {model} from your wishlist? You can add it back any time.`; owned branch retains `Are you sure you want to delete {brand} {model}? This action cannot be undone.`
4. **Confirm Button**: `{isWishlistLike ? 'Remove from wishlist' : 'Delete'}` with `variant="destructive"` on both branches (per D-09 — visual weight inside the confirm step is always destructive).

Nothing outside the Dialog block was touched. `handleDelete`, `removeWatch(watch.id)`, and `const isWishlistLike` are all unchanged.

## Verification

All acceptance criteria passed:

- `grep -c 'Remove from wishlist'` → **3** (trigger button label + dialog title + confirm button)
- `grep -c 'You can add it back any time'` → **1**
- `grep -c 'Delete Watch'` → **1** (owned branch preserved)
- `grep -c 'This action cannot be undone'` → **1** (owned branch preserved)
- `grep -c 'const isWishlistLike'` → **1** (unchanged derivation)
- `grep -c 'const handleDelete'` → **1** (unchanged handler name)
- `grep -c 'removeWatch(watch.id)'` → **1** (unchanged server action call)
- `npm run build` exits 0 (compiled successfully in 19.4s, 36/36 static pages)
- `npx vitest run tests/components/watch/WatchDetail.isChronometer.test.tsx` → 4 passed / 0 failed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. This change modifies only user-facing copy strings and a button variant prop. No new network endpoints, auth paths, or data access patterns introduced.

## Self-Check: PASSED

- File exists: `src/components/watch/WatchDetail.tsx` — FOUND
- Commit exists: `c868740e` — FOUND (`git log --oneline -1` = `c868740e feat(83-03): soften wishlist/grail delete UX to "Remove from wishlist" copy`)
