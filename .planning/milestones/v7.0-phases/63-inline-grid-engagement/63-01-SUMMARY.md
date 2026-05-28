---
phase: 63-inline-grid-engagement
plan: "01"
subsystem: data-layer
tags: [reactions, comments, cache, likes, watch_likes, batched-counts, tdd]
dependency_graph:
  requires: []
  provides: [WatchCounts.liked, WatchCounts.canComment, viewer-counts-cache-bust]
  affects: [src/data/reactions.ts, src/app/actions/reactions.ts, src/app/actions/comments.ts]
tech_stack:
  added: []
  patterns: [inArray batched query (Q6), revalidateTag cache-tag closure]
key_files:
  created: []
  modified:
    - src/data/reactions.ts
    - src/app/actions/reactions.ts
    - src/app/actions/comments.ts
    - tests/data/getBatchedWatchCounts.test.ts
    - tests/actions/reactions.test.ts
    - tests/actions/comments.test.ts
decisions:
  - "Q6 uses inArray(watchLikes.watchId, watchIds) + eq(watchLikes.userId, viewerId) — single batched query, no N+1; viewerLikedSet built from result"
  - "canComment reuses existing allowedSet (zero new queries) — allowedSet already computed for Q5 gate"
  - "revalidateTag(viewer:{user.id}:counts, max) added INSIDE if(ownerProfile?.username) block in both actions — matches getBatchedWatchCountsCached cacheTag scope"
  - "updateTag(viewer:{user.id}:reactions) in toggleLikeAction preserved — serves LikeButton on detail page (distinct tag, distinct consumer)"
metrics:
  duration: "5m"
  completed_date: "2026-05-27"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 6
---

# Phase 63 Plan 01: Data Layer — WatchCounts Extension + D-12 Cache Fix Summary

Extend `getBatchedWatchCounts` to carry per-viewer `liked` and `canComment` fields via a single new Q6 query, and close the confirmed D-12 cache-tag gap in both engagement Server Actions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend WatchCounts + add Q6 viewer-liked query | 2245942 | src/data/reactions.ts, tests/data/getBatchedWatchCounts.test.ts |
| 2 | Add viewer:{userId}:counts revalidation to both Server Actions | 204a7ad | src/app/actions/reactions.ts, src/app/actions/comments.ts, tests/actions/reactions.test.ts, tests/actions/comments.test.ts |

## What Was Built

### Task 1: WatchCounts extension + Q6

`WatchCounts` interface (`src/data/reactions.ts:158-164`) widened with two new fields:

```typescript
export interface WatchCounts {
  likeCount: number
  commentCount: number
  liked: boolean       // NEW — viewer has liked this watch (seeded by Q6)
  canComment: boolean  // NEW — viewer is allowed to comment (= allowedSet membership)
}
```

Q6 added to `getBatchedWatchCounts` after Q5 comment counts, before the result Map build:

```typescript
const viewerLikedRows = await db
  .select({ watchId: watchLikes.watchId })
  .from(watchLikes)
  .where(and(eq(watchLikes.userId, viewerId), inArray(watchLikes.watchId, watchIds)))
const viewerLikedSet = new Set(viewerLikedRows.map((r) => r.watchId))
```

`canComment` reuses the existing `allowedSet` (zero new queries). Total query budget: ≤6 (Q1–Q6). `getBatchedWatchCountsCached` wrapper unchanged — delegates and the return type widens automatically.

### Task 2: D-12 cache-tag gap closed

In `toggleLikeAction` (`src/app/actions/reactions.ts:108-114`), inside the `if (ownerProfile?.username)` block, added:

```typescript
revalidateTag(`viewer:${user.id}:counts`, 'max')
```

This fires after `revalidateTag('profile:{username}')` and before `updateTag('viewer:{user.id}:reactions')`. The two tags serve distinct consumers:
- `viewer:{id}:counts` — `getBatchedWatchCountsCached` on the profile grid (the new per-card liked/canComment state)
- `viewer:{id}:reactions` — `getLikesForTargetCached` on the detail page LikeButton (untouched)

Same pattern applied to `addCommentAction` (`src/app/actions/comments.ts:166-167`).

## Test Results

All 30 target tests pass:

- `tests/data/getBatchedWatchCounts.test.ts`: 10/10 (7 existing + 3 new: liked:true, liked:false, canComment:false)
- `tests/actions/reactions.test.ts`: 7/7 (6 existing + 1 new: D-12 counts tag)
- `tests/actions/comments.test.ts`: 13/13 (12 existing + 1 new: D-12 counts tag)

Build gate: `npm run build` exits 0.

## Deviations from Plan

None — plan executed exactly as written. All instructions followed precisely:
- Q6 query shape matches PATTERNS.md exactly
- No new imports added to any file (watchLikes/inArray/and/eq already present in reactions.ts; revalidateTag already present in both action files)
- Cache tag string `viewer:${user.id}:counts` matches `getBatchedWatchCountsCached` cacheTag exactly

## Known Stubs

None. Both new fields (`liked`, `canComment`) are fully populated from live DB queries.

## Threat Flags

No new threat surface introduced. T-63-01 through T-63-04 in the plan's threat model are all addressed:
- T-63-02: `liked` scoped to `viewerId` (Q6 filters by `eq(watchLikes.userId, viewerId)`); cache entry tagged `viewer:{viewerId}:counts` — viewer A's liked state cannot be served to viewer B.
- T-63-04: Confirmed D-12 gap closed by adding `revalidateTag('viewer:{userId}:counts','max')` to both actions.

## Self-Check: PASSED

Files confirmed:
- `src/data/reactions.ts` — exists, `liked: boolean` at line 161, `canComment: boolean` at line 162, Q6 query at lines 285-290
- `src/app/actions/reactions.ts` — exists, `viewer:${user.id}:counts` revalidation at line 111
- `src/app/actions/comments.ts` — exists, `viewer:${user.id}:counts` revalidation at line 167

Commits confirmed:
- 2245942: feat(63-01): extend WatchCounts with liked+canComment; add Q6 viewer-liked query
- 204a7ad: feat(63-01): add viewer:{userId}:counts revalidation to toggleLikeAction and addCommentAction
