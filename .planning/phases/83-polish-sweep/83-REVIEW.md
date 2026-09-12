---
phase: 83-polish-sweep
reviewed: 2026-09-12T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/components/layout/DesktopTopNav.tsx
  - src/components/profile/WornTabContent.tsx
  - src/components/watch/WatchDetail.tsx
  - src/components/watch/WatchDetailHero.tsx
  - tests/components/layout/DesktopTopNav.test.tsx
  - tests/components/watch/WatchDetailHero.removeCopy.test.tsx
findings:
  critical: 1
  warning: 2
  info: 6
  total: 9
status: issues_found
---

# Phase 83: Code Review Report

**Reviewed:** 2026-09-12
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This is a re-review of `34c9b6ee..HEAD` after gap-closure plan 83-04 (commits `3d7638b5`, `28a3a2b3`). 83-04 moved the wishlist/grail "Remove from wishlist" copy into `WatchDetailHero.tsx`, the component `/w/[ref]` actually renders. Plan 83-03 had put that copy only in the legacy `WatchDetail.tsx`.

**Carry-forward status:**
- Prior WR-01 (unused `Button` import in `DesktopTopNav.tsx`) is **resolved**. The file now imports only `Search`, and `pathname` is still used by the `isPublicPath` gate, so nothing is left dangling.
- Prior IN-01/IN-02/IN-03 (`WornTabContent` narrowing to owned watches) are **still valid** and carried forward below. I traced `src/app/u/[username]/[tab]/page.tsx:493`: `ownedWatches` is the profile owner's `status === 'owned'` watches for every viewer, so non-owners do not get an empty dropdown.

**The 83-04 port is faithful.** The `WatchDetailHero.tsx:379-413` dialog matches the 83-03 `WatchDetail.tsx` branch exactly. The `isWishlistLike` flag covers wishlist and grail, the trigger uses `outline` for those and `destructive` for everything else, and the confirm button stays `destructive`. The new test file passes (5/5), and so does `DesktopTopNav.test.tsx` (12/12). The test renders the live component, not the dead one, and checks both that the new copy appears and that the old copy is gone.

**Main concern (CR-01):** the softened copy says "You can add it back any time." It also removes the red styling from the trigger. But `removeWatch` is a hard delete: it purges storage objects, and the database cascade-deletes wear history, other users' comments, likes and notes. Re-adding the watch creates a new row with none of that data. The locked decision D-10 assumed only "the user's own `watches` row and their uploaded photos" are removed, and the schema shows that is incomplete. Grail watches can carry wear history: the hero shows "Last worn" for grail, and `SleepingBeautiesSection` treats grail as owned. So the permanent-loss case is reachable through the low-stakes, reassuring flow.

**Secondary concern (WR-01):** `WatchDetail.tsx` is a 568-line component that nothing in `src/` renders. Two tests still import or scan it, which gives false confidence. This dead file is the root cause of the 83-03 UAT miss, and it is still in the tree.

## Critical Issues

### CR-01: "You can add it back any time" copy hides a permanent cascade delete

**File:** `src/components/watch/WatchDetailHero.tsx:381-393` (same copy mirrored in `src/components/watch/WatchDetail.tsx:303-315`)
**Issue:** For `wishlist` and `grail`, the trigger is restyled from `destructive` to `outline`, and the dialog says `Remove {brand} {model} from your wishlist? You can add it back any time.` The confirm button calls `removeWatch` (`src/app/actions/watches.ts:779-820`), which does two things:
1. `purgeWatchPhotos(...)` permanently removes the user's uploaded watch-photo storage objects.
2. `watchDAL.deleteWatch(...)` hard-deletes the `watches` row. Per `src/db/schema.ts`, that cascade-deletes:
   - `wear_events` (`:302`, `onDelete: 'cascade'`), and through them `wear_likes` (`:372`) and wear comments (`:396`)
   - `watch_likes` (`:334`)
   - `watch_photos` (`:353`)
   - `comments` on the watch (`:395`), including comments written by *other users*

Per-watch notes, target price and the flagged-deal state live on the row and are lost too. Re-adding creates a new `watches.id` with none of this attached. "Add it back" restores only the catalog link.

This is reachable with real data:
- **Demoted watches:** `83-CONTEXT.md` (deferred section) says watches demoted from owned to wishlist/grail keep their wear events.
- **Grail watches:** this same component treats grail as a worn watch (`WatchDetailHero.tsx:326`, the "Last worn" line appears for `owned || grail`), and `SleepingBeautiesSection.tsx:14` counts grail as owned.

So a grail watch with months of wear history, photos and friends' comments is deleted permanently behind outline styling and copy that promises it can come back. The D-10 rationale ("only the user's own `watches` row and their uploaded photos are removed") misstates what the database actually deletes, so the locked decision does not cover this.

**Fix:** Keep the softer copy only when nothing unrecoverable is attached. Otherwise fall back to the destructive framing. The page RSC already knows `lastWornDate` and `commentCount`, so no new query is needed for the common cases:
```tsx
const hasUnrecoverableData =
  lastWornDate != null ||
  (commentCount ?? 0) > 0 ||
  (signedPhotos?.length ?? 0) > 0 ||
  (initialLikeState?.count ?? 0) > 0 ||
  Boolean(watch.notes)
const softRemove = isWishlistLike && !hasUnrecoverableData

<DialogTrigger render={<Button variant={softRemove ? 'outline' : 'destructive'} />}>
  {isWishlistLike ? 'Remove from wishlist' : 'Delete'}
</DialogTrigger>
...
<DialogDescription>
  {softRemove
    ? `Remove ${watch.brand} ${watch.model} from your wishlist? You can add it back any time.`
    : `Remove ${watch.brand} ${watch.model}? Its photos, wear history, likes and comments will be permanently deleted.`}
</DialogDescription>
```
Alternatively, drop the "You can add it back any time." sentence entirely. Either way, reopen D-09/D-10 with the operator, since their premise was wrong. Add a test case for a grail watch with a `lastWornDate` that asserts the destructive framing.

## Warnings

### WR-01: `WatchDetail.tsx` is a dead 568-line component that tests still cover

**File:** `src/components/watch/WatchDetail.tsx:1-568`; `tests/no-raw-img.test.ts:5-24`; `tests/components/watch/WatchDetail.isChronometer.test.tsx:42`
**Issue:** No file under `src/` imports `WatchDetail` (`grep` for `WatchDetail'` / `<WatchDetail ` in `src/` returns nothing). `/w/[ref]` renders `WatchDetailHero` plus the context block. Two test files still target the dead file:
- `WatchDetail.isChronometer.test.tsx` renders it.
- `no-raw-img.test.ts` scans it.

A green test run therefore says nothing about the live UI. That is exactly how 83-03 shipped a fix to UAT that users could never see. The 83-03 copy edit (`WatchDetail.tsx:303-330`) is still there. The next change to the delete flow will land in two places or drift, and anyone grepping for "Remove from wishlist" will find a copy that doesn't render.
**Fix:** Delete `src/components/watch/WatchDetail.tsx`. Point `no-raw-img.test.ts` at `WatchDetailHero.tsx`, and move the isChronometer assertions to whichever live component renders that spec. If deletion is deferred to Phase 85, at least add a static guard (`// @vitest-environment node`, per project memory) that fails if `WatchDetail.tsx` still exists without an importer. Also put a `@deprecated — not rendered; see WatchDetailHero` header on the file.

### WR-02: Delete, mark-worn and flag-deal failures give the user no feedback

**File:** `src/components/watch/WatchDetailHero.tsx:144-170`
**Issue:** `handleDelete` only acts on `result.success`. `removeWatch` can return `{ success: false, error: 'Not authenticated' | 'Not found' | 'Failed to delete watch' }` (`watches.ts:781, 816-818`). On failure the dialog stays open, the buttons re-enable, and nothing tells the user it failed, so it looks like the click did nothing. `handleMarkAsWorn` and `handleFlagDealChange` have the same problem. With the flag-deal checkbox this is worse: it snaps back to its old value with no explanation. 83-04 did not introduce this, but it edited the dialog next to it and the new test only covers the happy path.
**Fix:**
```tsx
const [deleteError, setDeleteError] = useState<string | null>(null)
const handleDelete = () => {
  setDeleteError(null)
  startTransition(async () => {
    const result = await removeWatch(watch.id)
    if (result.success) router.push('/')
    else setDeleteError(result.error ?? 'Something went wrong. Try again.')
  })
}
// inside DialogContent, above DialogFooter:
{deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
```
Use the project's toast pattern if it has one for the other two handlers.

## Info

### IN-01: Worn filter dropdown no longer lists non-owned watches that still have wear events (carried forward)

**File:** `src/components/profile/WornTabContent.tsx:70-79`
**Issue:** `watchOptions` now comes from `ownedWatches` (`page.tsx:493`, `status === 'owned'`), while `events` and `watchMap` still cover every status. Events for watches that are now `sold`, `wishlist` or `grail` still render under "All watches", but you can't filter to them. `sold` is the most likely case in practice. This matches D-04 and the deferred note in CONTEXT.
**Fix:** No change for this phase. If UAT surfaces it, union `ownedWatches` with `watchMap` entries that have at least one event.

### IN-02: `LogTodaysWearButton` picker also narrowed to owned watches (carried forward)

**File:** `src/components/profile/WornTabContent.tsx:159`
**Issue:** The same `watchOptions` array feeds `LogTodaysWearButton`, so its picker is now owned-only too. That is likely correct (`WatchPickerDialog.tsx:91` also says only owned watches can be worn), but the POLISH-02 spec does not mention it.
**Fix:** No code change. Note it in the 83-02 SUMMARY as a deliberate side effect.

### IN-03: `watchOptions` items no longer include `imageUrl` (carried forward)

**File:** `src/components/profile/WornTabContent.tsx:70-79`
**Issue:** Items are now `{id, brand, model}`, not `WatchSummary` with `imageUrl`. No current consumer reads `imageUrl`, so nothing breaks today.
**Fix:** None. Future thumbnail pickers should read `watchMap[id].imageUrl`.

### IN-04: Test header comment says the file "MUST FAIL today"

**File:** `tests/components/watch/WatchDetailHero.removeCopy.test.tsx:10-12`
**Issue:** The RED-phase note ("This file MUST FAIL today… GREEN lands in Task 2") went stale once `28a3a2b3` landed. A future reader could think a passing run means the test is broken.
**Fix:** Replace it with a one-line description of what the file locks down, e.g. "Locks the wishlist/grail vs owned delete-dialog copy on the live hero."

### IN-05: New test skips the confirm action and the `sold` branch

**File:** `tests/components/watch/WatchDetailHero.removeCopy.test.tsx:51-172`
**Issue:**
- No case clicks the confirm button and checks that `removeWatch('w1')` runs and `router.push('/')` follows. The `useRouter` mock creates a new `vi.fn()` on every call, so it can't be asserted as written.
- `sold` is the one status that falls through to the `Delete` branch without being `owned`, and it has no test.
- The grail case does not check that `cannot be undone` / `Delete Watch` are absent. The wishlist case does.

**Fix:** Hoist `const push = vi.fn()` and return it from the mock. Add a confirm-click test, a `status: 'sold'` case that expects `Delete`, and the missing absence checks in the grail case.

### IN-06: Duplicate `href` key in the `window.location` stub

**File:** `tests/components/layout/DesktopTopNav.test.tsx:168-173`
**Issue:** The object literal defines both `href: ''` and `set href(v)`. esbuild warns about it on every run ("Duplicate key \"href\" in object literal"). The setter wins, so the data property is dead and reading `location.href` returns `undefined`. The test works only because nothing reads it. This predates the phase, but the file is in scope.
**Fix:** Drop the `href: ''` line, or add a matching `get href() { return '' }`.

---

_Reviewed: 2026-09-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Resolution Log

- **CR-01** — resolved 2026-09-12 (operator choice: drop the sentence). Body now `Remove {brand} {model} from your wishlist?` in `WatchDetailHero.tsx`; tests assert `/add it back/` absent; 83-CONTEXT D-09 amended. Legacy `WatchDetail.tsx` left untouched (dead island, WR-01).
- WR-01, WR-02, IN-01..IN-06 — open (advisory; not addressed in 83-04).
