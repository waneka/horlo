---
phase: 62-public-wear-pics-on-watch-detail
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/app/actions/wearEvents.ts
  - src/app/u/[username]/[tab]/page.tsx
  - src/app/w/[ref]/page.tsx
  - src/components/profile/WornCalendar.tsx
  - src/components/profile/WornTabContent.tsx
  - src/components/profile/WornTimeline.tsx
  - src/components/watch/WatchDetail.tsx
  - src/components/watch/WatchPhotoSection.tsx
  - src/data/wearEvents.ts
  - src/db/schema.ts
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 62: Code Review Report

**Reviewed:** 2026-05-27
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 62 surfaces public wear photos onto the `/w/[ref]` watch detail carousel and adds owner hide/unhide controls. The security-critical path (IDOR ownership re-check, `.strict()` Zod schema, D-11 visibility-never-written invariant, admin-client-only signing) is correctly implemented. The `getWearRailForViewer` function is byte-for-byte unchanged (D-17 guardrail confirmed). React #418 UTC pinning is consistently applied across all date formatters in the changed files.

Two blockers were found: a missing `photoUrl IS NOT NULL` filter in `getPublicWearPicsForWatch` that causes wear events without photos to appear as blank slides in the carousel, and a hardcoded `canComment={true}` in `WatchPhotoSection` that bypasses the gate logic resolved by the RSC. Three warnings cover the `u/[username]/[tab]` wear-photo signing path leaking non-owner paths through the admin client, a stale-cache risk from `revalidatePath('/w/[ref]', 'page')` using a pattern rather than an exact segment, and an optimistic hide revert that fires the wrong direction when `isHidden` changes between the closure capture and the server action completion.

---

## Critical Issues

### CR-01: `getPublicWearPicsForWatch` returns null-photo rows — blank slides in carousel

**File:** `src/data/wearEvents.ts:571-591`

**Issue:** `getPublicWearPicsForWatch` selects rows where `visibility='public'` and `hiddenFromDetail=false` but does NOT filter `photoUrl IS NOT NULL`. Wear events logged via `markAsWorn` (the quick-log path) have no `photoUrl` — they satisfy all three WHERE clauses and are returned. In `w/[ref]/page.tsx` line 178, the RSC iterates `rawWearPics` and tries to sign `pic.photoUrl`; the `if (pic.photoUrl)` guard at line 213 skips signing but still emits a `SignedWearPic` entry with `signedUrl: null`. In `WatchPhotoSection.tsx` a `null`-URL wear-pic slide renders as a blank `WatchIcon` placeholder with a "Worn · [date]" badge — a confusing, broken UI state for every non-photo wear event that is `visibility='public'`.

**Fix:** Add a `isNotNull(wearEvents.photoUrl)` predicate to the WHERE clause:

```typescript
import { and, eq, desc, isNotNull } from 'drizzle-orm'

export async function getPublicWearPicsForWatch(
  watchId: string,
): Promise<{ id: string; wornDate: string; photoUrl: string; hiddenFromDetail: boolean }[]> {
  const rows = await db
    .select({
      id: wearEvents.id,
      wornDate: wearEvents.wornDate,
      photoUrl: wearEvents.photoUrl,
      hiddenFromDetail: wearEvents.hiddenFromDetail,
    })
    .from(wearEvents)
    .where(
      and(
        eq(wearEvents.watchId, watchId),
        eq(wearEvents.visibility, 'public'),
        eq(wearEvents.hiddenFromDetail, false),
        isNotNull(wearEvents.photoUrl),  // only emit rows that have a photo
      ),
    )
    .orderBy(desc(wearEvents.wornDate))
  return rows as { id: string; wornDate: string; photoUrl: string; hiddenFromDetail: boolean }[]
}
```

Update the return type to `photoUrl: string` (non-nullable) since the predicate guarantees it, eliminating the `if (pic.photoUrl)` guard dance upstream.

---

### CR-02: `WatchPhotoSection` passes hardcoded `canComment={true}` to `WearCommentHost` — comment gate bypassed for all viewers

**File:** `src/components/watch/WatchPhotoSection.tsx:586`

**Issue:** `WearCommentHost` receives `canComment={true}` unconditionally, regardless of the gate state resolved by the RSC (follower requirement, watch visibility, owner suppression). The RSC in `w/[ref]/page.tsx` computes `canComment` and `canCommentDisplay` correctly for the watch-level thread, but that logic is not threaded into `WatchPhotoSection`/`WearCommentHost`. As a result:

1. A viewer who fails the comment gate for a `visibility='wishlist'` watch can still post comments on the wear pic via the bottom sheet.
2. The owner receives a comment compose box on their own wear pics (the `suppressCompose` pattern used for the watch-level thread has no equivalent here).

The `WatchPhotoSection` component already receives `viewerId`, `ownerUserId`, and `ownerUsername` — the RSC-resolved gate signal just isn't threaded.

**Fix:** Add a `canCommentOnWears` prop to `WatchPhotoSectionProps` and pass the server-resolved value from the page:

```typescript
// In WatchPhotoSectionProps:
canCommentOnWears?: boolean

// In WatchPhotoSection body (replace hardcoded true):
canComment={canCommentOnWears ?? false}
```

In `w/[ref]/page.tsx` Branch 1 (line ~318) and Branch 2 D-06 (line ~563), pass:
```typescript
canCommentOnWears={!isOwner && canComment}
```

This mirrors `canCommentDisplay` semantics for the wear-pic social layer.

---

## Warnings

### WR-01: Worn-tab wear-photo signing in `u/[username]/[tab]/page.tsx` uses admin client without path-prefix scope check — signs arbitrary storage paths from the DB

**File:** `src/app/u/[username]/[tab]/page.tsx:446-466`

**Issue:** `getWearEventsForViewer` returns the raw `photoUrl` column from `wear_events` — a storage path string written by the client at upload time (`${userId}/${wearEventId}.jpg`, enforced server-side in `logWearWithPhoto`). The worn-tab RSC signs these paths via `supabaseAdmin.storage.from('wear-photos').createSignedUrl(path, 3600)` without verifying that `path` starts with `${profile.id}/`. The admin client has service-role privileges and will sign any path in the `wear-photos` bucket, regardless of whose folder it is in.

In practice, `getWearEventsForViewer` scopes to `eq(wearEvents.userId, profileUserId)` — so paths returned ARE owned by `profileUserId`. However, a data-integrity defect or a future DAL change that returns cross-user events would silently cause the admin client to mint signed URLs for another user's storage objects without any application-layer check.

**Fix:** Add a path-prefix guard before signing:

```typescript
// After line 458 (within the map callback):
if (!path.startsWith(`${profile.id}/`)) {
  wearPhotoSignedMap.set(path, null)
  return
}
const { data } = await supabaseAdmin.storage
  .from('wear-photos')
  .createSignedUrl(path, 3600)
wearPhotoSignedMap.set(path, data?.signedUrl ?? null)
```

The same pattern is applied in `w/[ref]/page.tsx` for watch-photos but is absent here for wear-photos.

---

### WR-02: `revalidatePath('/w/[ref]', 'page')` in `hideWearPicAction` / `unhideWearPicAction` — path segment pattern does not revalidate the viewer's actual URL

**File:** `src/app/actions/wearEvents.ts:327, 358`

**Issue:** `revalidatePath('/w/[ref]', 'page')` passes the dynamic segment TEMPLATE, not an actual path. Next.js `revalidatePath` with a dynamic segment pattern (containing `[...]`) invalidates ALL pages matching that pattern only when the second argument is `'layout'`. When the second argument is `'page'`, Next.js requires an exact pathname (e.g. `/w/abc123-...`). With the pattern form, the revalidation silently no-ops in `'page'` scope — the hide/unhide toggle is applied in the DB but the cached page is not purged.

The owner sees the optimistic UI update immediately (client-side `useOptimistic`), so the bug is invisible to the owner. However, a second browser tab or a hard refresh will serve the stale cached page until the cache TTL expires.

**Fix:** Either use `'layout'` scope to match the pattern, or pass the watch's actual path. Since `watchId` is available in the action, the watch's per-user `id` isn't the same as the `ref` URL segment — the safest fix is `'layout'` scope:

```typescript
revalidatePath('/w/[ref]', 'layout')
```

Or, if the watch's `catalogId`/route ref is known, pass the exact path. Using `'layout'` is the more practical option without an extra lookup.

---

### WR-03: Optimistic hide revert in `WatchPhotoSection` can flip to wrong direction under concurrent transitions

**File:** `src/components/watch/WatchPhotoSection.tsx:710-720`

**Issue:** The `onPointerDown` handler for the eye/eye-off toggle captures `isHidden` from the render closure at click time and passes it as the revert value in the failure branch:

```typescript
const action = isHidden ? unhideWearPicAction : hideWearPicAction
const result = await action(...)
if (!result.success) {
  applyOptimisticHide({ wearEventId: wp.wearEventId, hidden: isHidden })  // reverts to captured value
  toast.error(...)
}
```

`isHidden` in the closure is the value at click time. If the user clicks the toggle again while the first server action is in-flight (two rapid taps), the second `startTransition` fires with a new `isHidden` value (already optimistically flipped by the first). If the first action fails and reverts using the stale captured `isHidden`, the revert sets `hidden` back to the original pre-first-tap state — which is correct. However if the second action also fails, it reverts to the `isHidden` value captured at the second tap — which is the state AFTER the first optimistic flip, not the server ground truth. The result is the hidden state being stuck in whatever the second-tap's closure captured, diverging from the DB.

**Fix:** Capture the intended "new" state rather than reverting to a captured snapshot, or add a `data-state` attribute on the element to read the actual current server-side state. The minimal fix is to make the revert value explicit:

```typescript
const newHidden = !isHidden
startTransition(async () => {
  applyOptimisticHide({ wearEventId: wp.wearEventId, hidden: newHidden })
  const action = isHidden ? unhideWearPicAction : hideWearPicAction
  const result = await action({ wearEventId: wp.wearEventId, watchId })
  if (!result.success) {
    applyOptimisticHide({ wearEventId: wp.wearEventId, hidden: isHidden }) // revert to pre-tap state
    toast.error("Couldn't update. Try again.")
  }
})
```

This doesn't eliminate the race but removes the stale-closure layer — the revert is now `isHidden` (the same-transition captured value) not a separately-captured variable that could drift. The deeper fix is to disable the button while a transition is pending (`isPending` from a per-item `useTransition`).

---

## Info

### IN-01: `getPublicWearPicsForWatch` comment says "stub for Wave 0" — should be removed

**File:** `src/data/wearEvents.ts:568`

**Issue:** The comment reads "NOTE: This is a stub for Wave 0 test collection. Full implementation in Plan 02." Phase 62 Plan 02 has shipped (62-02-SUMMARY.md exists). The comment is now stale and misleading — it implies the function is incomplete when it is the production implementation.

**Fix:** Remove or update the comment to reflect the shipped state.

---

### IN-02: `WatchPhotoSection` passes `ownerFollowsViewer={false}` and `viewerIsFollowing={false}` hardcoded to `WearCommentHost`

**File:** `src/components/watch/WatchPhotoSection.tsx:587-588`

**Issue:** Both gate signals are hardcoded `false`. This means `CommentGateLocked` will always render as State 0 (anonymous / not-following, no follow-back signal) when `canComment=false`. Since CR-02 above shows `canComment` is currently always `true`, this is dormant — but once CR-02 is fixed and the gate can be `false`, the locked state copy will be incorrect for viewers who follow the owner or who the owner follows.

These signals are available in the RSC (resolved for `CommentThread`) but not threaded into `WatchPhotoSection`. They should be added alongside the `canCommentOnWears` prop recommended in CR-02.

**Fix:** Add `ownerFollowsViewerForWears` and `viewerIsFollowingForWears` props to `WatchPhotoSectionProps` (or reuse the existing `ownerFollowsViewer`/`viewerIsFollowing` props once the component signature is updated for CR-02) and pass them down from the RSC alongside `canCommentOnWears`.

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
