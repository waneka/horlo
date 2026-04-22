---
phase: 12-visibility-ripple-in-dal
plan: 04
subsystem: profile-tab-page, wishlist-action
tags: [visibility, privacy, dal, three-tier, wywt-10]
dependency_graph:
  requires: [12-02]
  provides: [consumer-call-sites-updated, wishlist-visibility-gate]
  affects: [src/app/u/[username]/[tab]/page.tsx, src/app/actions/wishlist.ts, src/components/profile/WornTabContent.tsx]
tech_stack:
  added: []
  patterns: [three-tier-visibility-check, self-bypass-G5, profile-public-outer-gate-G4, lazy-follow-check]
key_files:
  created: []
  modified:
    - src/app/u/[username]/[tab]/page.tsx
    - src/app/actions/wishlist.ts
    - src/components/profile/WornTabContent.tsx
decisions:
  - "WornTabContent empty state added after hooks (React Rules of Hooks compliance) rather than before useMemo calls"
  - "Lazy follow check: only queries follows table when visibility='followers'; skips for 'public' and 'private' tiers"
  - "LockedTabCard import retained in page.tsx (still used by collection, wishlist, notes, stats tabs)"
metrics:
  duration: ~8min
  completed: "2026-04-22T20:53:54Z"
  tasks: 2
  files: 3
---

# Phase 12 Plan 04: Consumer Call-Site Cleanup Summary

Close the two Class A consumer call sites that referenced the old DAL surface, and replace the wishlist action's `wornPublic` gate with a three-tier per-row visibility check.

## What Was Built

**Task 1 — `src/app/u/[username]/[tab]/page.tsx`**

The file already had `getWearEventsForViewer` in its import and both call sites (worn tab line 170, stats tab line 213) from a prior partial update. The remaining work:

- Removed the worn-tab `LockedTabCard` branch (was lines 107-115): the `if (tab === 'worn' && !isOwner && !settings.wornPublic)` conditional returning `<LockedTabCard tab="worn" .../>` was deleted and replaced with an explanatory comment documenting the Phase 12 rationale (per-row visibility makes tab-level lock unreachable).
- Updated a stale comment in the stats tab section that still referenced `getPublicWearEventsForViewer` and `worn_public=false`.
- Added an empty state to `WornTabContent` for when `events.length === 0`: owner sees "No wear events yet — log your first wear from the Collection tab." and non-owners see "No public wear events to show." The empty state was placed after the `useMemo` hooks to comply with React's Rules of Hooks.

**Confirmation that `getPublicWearEventsForViewer` has zero call sites:** `grep -rn "getPublicWearEventsForViewer" src/` returns only the DAL comment in `src/data/wearEvents.ts` (line 83) documenting the rename — zero live call sites.

**Empty state UX outcome:** `WornTabContent` did NOT have an empty state prior to this plan. The executor added one (Rule 2 — missing critical functionality: without an empty state, the worn tab would render a blank filter bar with no watch options after the LockedTabCard guard was removed).

**Task 2 — `src/app/actions/wishlist.ts addToWishlistFromWearEvent`**

Replaced the `wornPublic`-gated JOIN with a three-tier per-row visibility check:

| Changed | Before | After |
|---------|--------|-------|
| Import | `eq` only | `eq, and` |
| Schema import | `wearEvents, watches, profileSettings` | adds `follows` |
| SELECT projection | `wornPublic: profileSettings.wornPublic` | `profilePublic: profileSettings.profilePublic, visibility: wearEvents.visibility` |
| Visibility gate | `if (row.actorId !== user.id && !row.wornPublic)` | `isSelf` G-5 + `row.profilePublic` G-4 + per-row `visibility` check + lazy `isFollower` follow query |
| Error strings | 1 uniform "Wear event not found" | 3 uniform "Wear event not found" (missing row + canSee=false; both return identical string) |

Three-tier logic (implemented in TypeScript after fetching the row):
```
canSee =
  isSelf ||                                          // G-5 self-bypass
  (row.profilePublic &&                              // G-4 outer gate
    (row.visibility === 'public' ||                  // public tier
      (row.visibility === 'followers' && isFollower))) // followers tier
// private tier → canSee = false for non-self
```

The follow check is lazy — only issued when `visibility === 'followers'`. The `'public'` tier skips the follow query; the `'private'` tier short-circuits to `canSee = false` without it.

## Files Modified

### `src/app/u/[username]/[tab]/page.tsx`
- Lines 107-115 (LockedTabCard worn branch): deleted, replaced with explanatory comment
- Lines 198-200 (stats tab comment): updated stale `getPublicWearEventsForViewer` reference

### `src/app/actions/wishlist.ts`
- Line 5: added `and` to drizzle import
- Line 8: added `follows` to schema import
- Lines 23-43: JSDoc updated to document three-tier gate and trust model
- Lines 59-112: SELECT projection + visibility gate completely rewritten

### `src/components/profile/WornTabContent.tsx`
- Lines 63-78: empty state added after hooks (events.length === 0 branch)

## Verification

```
grep -rn "getPublicWearEventsForViewer" src/  # 0 call sites (only DAL comment)
grep -n "wornPublic" src/app/actions/wishlist.ts  # 0
grep -n "wearEvents.visibility" src/app/actions/wishlist.ts  # 1 (line 70)
grep -c "Wear event not found" src/app/actions/wishlist.ts  # 3
grep -n "isSelf" src/app/actions/wishlist.ts  # 3 (G-5 self-bypass present)
grep -n "row.profilePublic" src/app/actions/wishlist.ts  # 1 (G-4 outer gate)
npm run build  # PASSED (✓ Compiled successfully)
```

All Plan 01 matrix cells that this plan owns are now green. The WYWT-11 column-drop final cell (removing `worn_public` column from `profile_settings`) remains for Plan 06.

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Missing critical functionality] WornTabContent empty state**
- **Found during:** Task 1
- **Issue:** After removing the LockedTabCard worn-tab branch, non-owner viewers with no visible wears would see a blank filter bar (Select + ViewTogglePill rendered with empty data) rather than a meaningful empty state.
- **Fix:** Added `events.length === 0` guard in `WornTabContent` rendering owner-appropriate ("log your first wear") vs non-owner-appropriate ("No public wear events to show.") copy. Placed after `useMemo` hooks to comply with React's Rules of Hooks.
- **Files modified:** `src/components/profile/WornTabContent.tsx`
- **Commit:** af3f587

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- [x] `src/app/u/[username]/[tab]/page.tsx` — exists, LockedTabCard worn branch removed, getWearEventsForViewer used in import + 2 call sites
- [x] `src/app/actions/wishlist.ts` — exists, three-tier gate implemented, wornPublic removed
- [x] `src/components/profile/WornTabContent.tsx` — exists, empty state added
- [x] Commit af3f587 — exists (Task 1)
- [x] Commit 158137e — exists (Task 2)
- [x] Build passes: `✓ Compiled successfully in 4.2s`
