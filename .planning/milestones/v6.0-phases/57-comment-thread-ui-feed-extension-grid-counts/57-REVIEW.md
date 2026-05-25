---
phase: 57-comment-thread-ui-feed-extension-grid-counts
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - src/data/reactions.ts
  - src/data/activities.ts
  - src/data/comments.ts
  - src/data/profiles.ts
  - src/data/watches.ts
  - src/app/actions/comments.ts
  - src/lib/feedTypes.ts
  - src/components/home/ActivityRow.tsx
  - src/components/comment/CommentThread.tsx
  - src/components/comment/CommentList.tsx
  - src/components/comment/CommentItem.tsx
  - src/components/comment/CommentCompose.tsx
  - src/components/comment/CommentGateLocked.tsx
  - src/components/comment/CommentThreadSkeleton.tsx
  - src/components/comment/types.ts
  - src/components/watch/WatchDetail.tsx
  - src/components/wear/WearCard.tsx
  - src/components/wear/WearCommentHost.tsx
  - src/components/wears/WearsLane.tsx
  - src/components/profile/ProfileWatchCard.tsx
  - src/components/profile/SortableProfileWatchCard.tsx
  - src/components/profile/CollectionTabContent.tsx
  - src/components/profile/WishlistTabContent.tsx
  - src/app/watch/[id]/page.tsx
  - src/app/wear/[wearEventId]/page.tsx
  - src/app/wears/[username]/page.tsx
  - src/app/u/[username]/[tab]/page.tsx
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 57: Code Review Report

**Reviewed:** 2026-05-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 57 ships the comment-thread UI, the feed `commented` activity extension, and the profile grid like/comment count badges. I reviewed all 26 files with special attention to the two security-critical content-leak guards (FEED-07/D-12 feed gate and DISP-01/D-10 batched comment-count gate), comment authorization (GATE-03 + author-scoped edit/delete), and Next.js 16 Cache Components correctness.

**Security-critical guards — verdict:**
- **FEED-07 / D-12 (activities.ts):** The EXISTS subquery direction is **correct**. `f1.follower_id = viewerId AND f1.following_id = targetOwnerId` (viewer→owner) joined with `f2` reversed (owner→viewer) keys off `targetOwnerId`, not the actor. Mutual-follow with the *target owner* is required. Legacy/missing `watchStatus` rows fail closed via NULL comparison. Verified against schema (`follows.follower_id`/`following_id`). No leak.
- **DISP-01 / D-10 (reactions.ts `getBatchedWatchCounts`):** The comment-count gate is **correct and cannot be bypassed**. Likes are open for all watchIds; comment counts are restricted to `allowedWatchIds` at the SQL level AND re-filtered through `allowedSet` in JS (defence-in-depth). Confirmed via drizzle-orm 0.45.2 source that `inArray(col, [])` compiles to `WHERE false`, so the empty-`allowedWatchIds` case returns zero comment rows (gate holds). Query count is bounded (constant ≤5, no N+1). One doc/impl mismatch noted below (WR-03), not a leak.
- **GATE-03 / author-scoped edit-delete:** `canViewerCommentOnTarget`, `editComment`, and `deleteComment` are all author/owner-scoped at the WHERE-clause level (IDOR-safe). `CommentItem` only renders edit/delete controls when `viewerId === comment.authorId`, with the Server Action + DAL as the authoritative backstop. Sound.
- **Cache Components:** `CommentThread`, `WearCommentHost`, `CommentList` carry no `'use cache'`; all dynamic comment reads are inside `<Suspense>`. The viewer-scoped cache wrappers (`getBatchedWatchCountsCached`, `getLikesForTargetCached`) correctly key on `viewerId`. No viewer-dependent read is wrongly cached.

The one BLOCKER is a correctness defect in the comment-thread skeleton's Suspense behavior interacting with the watch page's pre-thread `await`, plus a state-rollback bug. Details below.

## Critical Issues

### CR-01: Optimistic-insert rollback restores a stale list, dropping concurrent/successful comments

**File:** `src/components/comment/CommentList.tsx:81-103`
**Issue:** `handleSubmit` closes over the `comments` value captured at render time. On the failure path it calls `setComments(comments)` — restoring the *captured* snapshot rather than reverting via a functional update. This is a latent data-loss bug:

- The optimistic insert (`setComments([optimistic, ...comments])`) and the rollback (`setComments(comments)`) both reference the stale `comments` closure.
- If any state change lands between submit and the action's resolution — e.g. an edit via `handleUpdate`, a delete via `handleDeleteOptimistic`, or a second optimistic insert — the failure-path `setComments(comments)` blows those changes away by overwriting the entire array with the pre-submit snapshot. `disabled={pending}` blocks a *second compose submit*, but it does NOT block `CommentItem` edit/delete transitions (each `CommentItem` owns its own `useTransition`), so an in-flight edit/delete that resolves before a failed post will be silently reverted.

The reconcile path (lines 96-100) correctly uses `setComments((prev) => ...)`; the insert and rollback paths must use the same functional form.

**Fix:**
```tsx
function handleSubmit(body: string) {
  if (!viewerId) return
  const fallbackAuthor: CommentAuthor = viewerAuthor ?? { username: 'me', displayName: null, avatarUrl: null }
  const optimistic: CommentWithAuthor = { /* ...as before... */ }

  // Functional insert — do not capture `comments`
  setComments((prev) => [optimistic, ...prev])

  startTransition(async () => {
    const result = await addCommentAction({ type: target.type, id: target.id, body })
    if (!result.success) {
      // Functional rollback — remove only the optimistic row, preserving any
      // concurrent edits/deletes that landed while the action was in flight.
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
      if (result.code === 'gate') setCanComment(false)
      console.error('[CommentList] action failed:', result.error)
      return
    }
    setComments((prev) =>
      prev.map((c) => (c.id === optimistic.id ? { ...result.data, author: optimistic.author } : c)),
    )
    setComposeKey((k) => k + 1)
  })
}
```

## Warnings

### WR-01: `handleRollbackDelete` compares a `Date` against a possibly-`string` `createdAt`, producing wrong re-insert order

**File:** `src/components/comment/CommentList.tsx:114-130`
**Issue:** `handleRollbackDelete` finds the insert index via `c.createdAt < comment.createdAt`. After a *successful* server reconcile (post-edit or post-insert), `result.data.createdAt` comes from the Server Action across the RSC/action boundary. Drizzle `timestamp` columns deserialize as `Date` in the optimistic path (`new Date()` on line 71/73) but the server-returned `Comment` may surface `createdAt` as a string depending on serialization. Mixed `Date`/`string` comparison with `<` coerces inconsistently (string lexicographic vs. numeric `valueOf`), so a rolled-back delete can be re-inserted at the wrong position. The list is small so the visual impact is minor, but ordering is part of the CMNT-03 newest-first contract.

**Fix:** Normalize to epoch millis before comparing:
```tsx
const target = new Date(comment.createdAt).getTime()
const insertIdx = prev.findIndex((c) => new Date(c.createdAt).getTime() < target)
```

### WR-02: `getBatchedWatchCounts` docstring claims Q2/Q3 are skipped, but they always execute

**File:** `src/data/reactions.ts:175-234`
**Issue:** The docstring (lines 181-186) states: *"When there are no foreign wishlist watches ... Q2 and Q3 are skipped → ≤3 queries total (T-57-08)."* The implementation unconditionally issues both follows queries (lines 226-234) regardless of whether `wishlistOwnerIds` is empty. With an empty array, drizzle compiles `inArray(..., [])` to `WHERE false`, so the queries still round-trip to Postgres (they return zero rows but are NOT skipped). The behavior is correct and safe, but the "≤3 queries" / "skipped" claim is false — this matters because the inline comment at lines 224-225 explicitly says "Both queries always run", directly contradicting the function docstring. A future reader optimizing against the docstring could break the constant-budget guarantee.

**Fix:** Either (a) actually short-circuit when `wishlistOwnerIds.length === 0` (skip Q2/Q3, set `mutualSet = new Set()`), or (b) correct the docstring to say all 5 queries always run (with Q2/Q3 degenerating to `WHERE false`). Prefer (a) for the stated budget:
```ts
let mutualSet = new Set<string>()
if (wishlistOwnerIds.length > 0) {
  const viewerFollowsOwners = await db.select(...).where(...)
  const ownersFollowViewer = await db.select(...).where(...)
  // ...intersection...
  mutualSet = new Set([...viewerFollowsSet].filter((id) => ownersFollowSet.has(id)))
}
```

### WR-03: Watch page issues a redundant uncached comment read for the count badge

**File:** `src/app/watch/[id]/page.tsx:69-71` and `src/components/comment/CommentThread.tsx:34`
**Issue:** The page computes `commentCount` by calling `getCommentsForTarget(user.id, target)` and taking `.length` (line 70), and then `CommentThread` (rendered in the Suspense block) calls `getCommentsForTarget(viewerId ?? '', target)` *again* (line 34). Each call runs `canViewerCommentOnTarget` (a watch row read + possible mutual-follow check) plus the full comment SELECT. That is two full uncached comment reads + two gate evaluations per watch-detail render. The code comment acknowledges this ("this one extra uncached read is acceptable") but it is avoidable and doubles the comment-table load on the hottest detail route. It is also a correctness footgun: the two reads are not transactionally consistent — a comment inserted between them yields a badge count that disagrees with the rendered thread.

**Fix:** Resolve the comment list once in the page (or in `CommentThread`) and thread the count down, mirroring the wear page which computes `commentCount = initialComments.length` from a single read. Pass `initialComments`/`commentCount` into `CommentThread` rather than re-fetching, or move the badge inside the Suspense subtree so a single read feeds both.

### WR-04: `deleteCommentAction` reads with `commentsTable?.id` — masks an undefined-table programming error

**File:** `src/app/actions/comments.ts:298-302`
**Issue:** The pre-delete owner lookup uses `eq(commentsTable?.id, parsed.data.commentId)`. The optional chaining on `commentsTable` (an imported, always-defined schema object) is dead defensiveness: if `commentsTable` were ever `undefined` (bad import/refactor), `commentsTable?.id` evaluates to `undefined`, and `eq(undefined, value)` produces a malformed/`undefined`-column WHERE clause rather than a clear crash. This would silently change the row-match semantics of a DELETE-adjacent read. Every other call site uses `commentsTable.id` / `comments.id` directly.

**Fix:** Remove the optional chaining: `eq(commentsTable.id, parsed.data.commentId)`. If the concern is import safety, fail loud instead of silently degrading.

### WR-05: `CommentGateLocked` State 3 renders `null`, leaving no compose box on a benign mutual-follow race

**File:** `src/components/comment/CommentList.tsx:88-90` + `src/components/comment/CommentGateLocked.tsx:67-69`
**Issue:** When a gate rejection arrives at the action (`result.code === 'gate'`), `CommentList` flips `canComment` to `false` and renders `CommentGateLocked`. If at that moment the viewer is actually mutual-follow on the client's signals (`viewerIsFollowing` true and `ownerFollowsViewer` true — e.g. a stale server gate vs. a just-completed follow-back), `CommentGateLocked` falls through both states and returns `null`. The user is then left with neither a compose box nor any locked-state message — a dead UI with no path forward and no explanation. The "defensive fallback: render nothing" comment treats an inconsistent state as benign, but the user-visible result is a silently disappeared comment box.

**Fix:** Render an explicit retry/refresh affordance (or re-enable compose) in the fallback branch instead of `null`, e.g. a "Refresh to comment" prompt, so the viewer is never stranded.

### WR-06: `getCommentsForTarget` runs the gate query twice per call (own SELECT + redundant gate)

**File:** `src/data/comments.ts:139-159`
**Issue:** `getCommentsForTarget` calls `canViewerCommentOnTarget` (line 143), which for a watch target does a `watches` row read + (for wishlist) an `isMutualFollow` read, and then runs the comment SELECT. Combined with WR-03's double invocation on the watch page, a single watch-detail render performs up to four watch-row reads and two mutual-follow checks purely for comment gating. Not a correctness bug in isolation, but the gate + read are repeatedly re-derived where one resolution could be shared. Worth consolidating the gate result through the render path rather than re-evaluating it in each DAL entry point.

**Fix:** Have the page resolve `canComment` once (it already does on `/watch/[id]:47-50`) and pass an `allowed` flag into a gate-free list reader, or memoize `canViewerCommentOnTarget` per request via React `cache()` (as `getTasteOverlapData` already does in follows.ts).

## Info

### IN-01: `ActionResult.code` is typed `string`, not the `'gate'` literal — discriminant is stringly-typed

**File:** `src/lib/actionTypes.ts:9`
**Issue:** `code?: string` means the `result.code === 'gate'` check in `CommentList.tsx:89` is not type-checked against a known set. A typo (`'Gate'`, `'gated'`) would compile and silently never match. The phase explicitly chose a structural discriminant "without string-matching the error message," but the discriminant itself is an untyped string.
**Fix:** Narrow to a union: `code?: 'gate' | 'not_found' | 'rate_limited'` (extend as needed), or define an `ActionErrorCode` type alias.

### IN-02: Duplicated author-enrichment logic across three call sites

**File:** `src/components/comment/CommentThread.tsx:36-57`, `src/app/wear/[wearEventId]/page.tsx:180-194`, `src/app/wears/[username]/page.tsx:92-111`
**Issue:** The "collect unique authorIds, push viewerId, `getProfilesByIds`, map to `CommentWithAuthor` with `fallbackAuthor`" sequence is copy-pasted in three places with the identical `fallbackAuthor = { username: 'unknown', displayName: null, avatarUrl: null }` literal. Drift risk if the enrichment contract changes.
**Fix:** Extract a `enrichComments(rawComments, viewerId)` helper in a server-only module returning `{ initialComments, viewerAuthor }`.

### IN-03: `ActivityType` union duplicated in two modules with a hand-maintained sync comment

**File:** `src/lib/feedTypes.ts:16` and `src/data/activities.ts:21`
**Issue:** `ActivityType` is declared identically in both files, kept in sync only by a comment ("both must be kept in sync") to avoid an import cycle. Adding a new activity type requires editing both; the comment is the only guard.
**Fix:** Since `feedTypes.ts` is type-only and `activities.ts` already imports `RawFeedRow`/`FeedCursor` from it, have `activities.ts` import `ActivityType` from `feedTypes.ts` too (type-only imports do not create a runtime cycle) and delete the local copy.

### IN-04: `CommentThreadSkeleton` shape does not match the rendered thread (no compose box, no avatars)

**File:** `src/components/comment/CommentThreadSkeleton.tsx:3-14`
**Issue:** The skeleton renders three thin bars under a title, but the real `CommentThread` leads with a compose box (or locked card) and avatar+body rows. The layout shift on resolve is noticeable. Cosmetic only.
**Fix:** Mirror the real structure: a taller compose-box placeholder block followed by avatar-circle + two-line rows.

### IN-05: Magic threshold `450`/`480`/`500` repeated as inline literals in CommentCompose

**File:** `src/components/comment/CommentCompose.tsx:45,61,65` and `src/components/comment/CommentItem.tsx:119`
**Issue:** The 500-char max, 450 reveal threshold, and 480 warning threshold are inline magic numbers, with `maxLength={500}` separately hard-coded in two textareas (`CommentCompose:52`, `CommentItem:119`). The 500 limit must also stay in sync with the Zod `.max(500)` (comments.ts action) and the DB CHECK. No single source of truth.
**Fix:** Hoist `COMMENT_MAX_LENGTH = 500`, `COMMENT_COUNTER_REVEAL = 450`, `COMMENT_COUNTER_WARN = 480` to a shared constants module imported by both components and the Zod schema.

---

_Reviewed: 2026-05-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
