---
phase: 63-inline-grid-engagement
reviewed: 2026-05-27T13:20:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/data/reactions.ts
  - src/app/actions/reactions.ts
  - src/app/actions/comments.ts
  - src/components/watch/WatchCommentSheet.tsx
  - src/app/u/[username]/[tab]/page.tsx
  - src/components/profile/CollectionTabContent.tsx
  - src/components/profile/WishlistTabContent.tsx
  - src/components/profile/ProfileWatchCard.tsx
  - tests/data/getBatchedWatchCounts.test.ts
  - tests/actions/reactions.test.ts
  - tests/actions/comments.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-05-27T13:20:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 63 adds inline like + compose-only comment chips to profile grid cards. I traced
the cache-scoping contract, the comment gate, the N+1 budget, optimistic-rollback
correctness, and the D-12 revalidation in both actions against the phase-specific risk
list. The security-critical surfaces hold up:

- **Comment gate is server-enforced** — `createComment` re-runs `canViewerCommentOnTarget`
  and throws `CommentGateError`; the hidden 💬 chip is UX-only, not a security gap.
- **No request-time API inside `'use cache'`** — `getBatchedWatchCountsCached` only calls
  `cacheTag` + the pure DAL fn; `viewerId` is resolved in the page (uncached, line 188)
  and passed in, so cache keys are per-viewer (no cross-viewer leak).
- **No N+1** — the new `liked` set (Q6) is a single `inArray(watchLikes.watchId, watchIds)`.
- **D-12 revalidation present** — both `toggleLikeAction` and `addCommentAction` fire
  `revalidateTag('viewer:{userId}:counts', 'max')`; verified by passing tests.
- **IDOR-safe DAL** — `createLike`/`deleteLike`/`editComment`/`deleteComment` are all
  `(userId, target)`-scoped.
- **Chip handlers `preventDefault()` + `stopPropagation()`** — no unintended `<Link>` nav.
- All 30 new tests pass (`npx vitest run` on the three files).

No BLOCKERs. Three WARNINGs concern a visible count-desync between the optimistic chip and
the static count line, a code/docstring contradiction in the query-budget comments, and a
misleading error path. Four INFO items cover dead/stale comments and a minor unused import.

## Warnings

### WR-01: Static count line shows stale counts while the chip shows the optimistic value (visible double-count desync)

**File:** `src/components/profile/ProfileWatchCard.tsx:181-183, 194, 227-244`
**Issue:** A non-owner card renders BOTH the engagement chips (image overlay) and the
bottom static count line (`CardContent`, lines 227-244). The chips read the optimistic
`likeCountState` / `commentCountState`; the bottom line reads the raw `likeCount` /
`commentCount` props. The bottom line is NOT gated on `!isOwner`, so for a non-owner who
likes a watch or posts a comment, the same card simultaneously displays two different
counts — e.g. the ♥ chip flips to `3` while the bottom `♥ 2 · 💬 1` line stays at `2`.
The mismatch persists until a navigation away/back re-hydrates the cache (D-12). This
also makes the optimistic update look broken to the user.
**Fix:** Drive the bottom static line from the same state the chips use (or hide it for
non-owners, since the chips already surface the counts). Minimal change — read the live
state in the bottom line:
```tsx
const showLike = likeCountState > 0
const showComment = commentCountState > 0
{(showLike || showComment) && (
  <p className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
    {showLike && (<><Heart className="size-3" aria-hidden />{likeCountState}</>)}
    {showLike && showComment && <span className="mx-1">·</span>}
    {showComment && (<><MessageCircle className="size-3" aria-hidden />{commentCountState}</>)}
  </p>
)}
```
(For owners, `likeCountState`/`commentCountState` are seeded from the same props, so this
stays correct on the owner path too.)

### WR-02: `getBatchedWatchCounts` docstring claims Q2/Q3 are skipped, but the code always runs them

**File:** `src/data/reactions.ts:186-189` vs `:226-237`
**Issue:** The function docstring states: *"When there are no foreign wishlist watches …
Q2 and Q3 are skipped → ≤4 queries total (T-57-08)."* The implementation unconditionally
issues both `viewerFollowsOwners` (Q2) and `ownersFollowViewer` (Q3) regardless of
`wishlistOwnerIds` (the inline comment at lines 226-228 even says *"Both queries always
run (constant query budget)"*). The two comments directly contradict each other, and the
actual budget is always ~6, never ≤4. Not a correctness defect (the count is still
constant — no N+1), but the misleading docstring will cause a future maintainer to
"optimize" toward a state the code does not implement, or to mistrust the T-57-08 budget.
**Fix:** Reconcile the comments. Either update the docstring to "Q2 and Q3 always run
(constant 6-query budget); `inArray([])` evaluates to `false` with no extra round-trip
when there are no foreign wishlist watches," or actually guard Q2/Q3 behind
`if (wishlistOwnerIds.length > 0)` (and seed the result sets to empty when skipped) to
match the documented ≤4 path.

### WR-03: `WatchCommentSheet` shows a generic "try again" error even on a gate rejection

**File:** `src/components/watch/WatchCommentSheet.tsx:52-56`
**Issue:** `addCommentAction` can return `{ success: false, code: 'gate', error: <gate msg> }`
when the wishlist mutual-follow gate fails server-side. `handleSubmit` ignores `result.code`
and always shows `toast.error('Failed to post comment. Please try again.')`. The 💬 chip is
normally hidden for gated viewers, but the gate is evaluated at page-load time; if the
follow relationship changes between load and submit (owner unfollows, or stale cached
`canComment`), a real gate rejection surfaces as a misleading "try again" message that
implies a transient failure when retrying will never succeed.
**Fix:** Branch on the discriminant the action already provides:
```tsx
if (!result.success) {
  toast.error(result.code === 'gate'
    ? "You can no longer comment on this watch."
    : 'Failed to post comment. Please try again.')
  console.error('[WatchCommentSheet] action failed:', result.error)
  return
}
```

## Info

### IN-01: Unused type import in batched-counts test

**File:** `tests/data/getBatchedWatchCounts.test.ts:2`
**Issue:** `import type { Mock } from 'vitest'` is imported but never referenced in this
file (the other two action tests use `Mock`; this one does not). Dead import.
**Fix:** Remove the line. (Test-file lint noise — does not affect the runtime gate.)

### IN-02: Anon empty-Map type literal is duplicated inline instead of using `WatchCounts`

**File:** `src/app/u/[username]/[tab]/page.tsx:377-378`
**Issue:** The anon-path empty Map and the `counts` Record both inline
`{ likeCount: number; commentCount: number; liked: boolean; canComment: boolean }`. This
is the exported `WatchCounts` interface (`src/data/reactions.ts:158`) re-spelled by hand in
the page and again in `CollectionTabContent`/`WishlistTabContent` props. Drift risk if a
field is added to `WatchCounts`.
**Fix:** Import and reuse `WatchCounts` (`Record<string, WatchCounts>`) in the page and the
two tab-content prop types rather than re-declaring the shape.

### IN-03: Stale "≤5 queries" comment in the N+1 test contradicts the ≤6 assertion

**File:** `tests/data/getBatchedWatchCounts.test.ts:195-197`
**Issue:** The test comment says *"Per RESEARCH Pattern 5: ≤5 queries total"* and lists
five queries, but the assertion (line 214) and the test name both use `≤6` after the Q6
`liked` query was added. The comment was not updated alongside the assertion.
**Fix:** Update the comment to "≤6 queries (Q1–Q5 + Q6 viewer-liked set)" to match the
assertion.

### IN-04: `deleteCommentAction` reads the comment row without author scoping

**File:** `src/app/actions/comments.ts:320-324`
**Issue:** The read-then-delete pattern selects the full comment row by `id` only (no
`authorId` predicate) to resolve the owner for cache invalidation. The code comment
acknowledges this and the actual delete (`deleteComment`) is `(id, authorId)`-scoped, so
there is no destructive IDOR. The read does, however, run before the authorship check and
returns `watchId`/`wearEventId` for any comment id. Risk is low (only FK ids used for a
cache tag), but a tighter pattern would scope the read or move it after a successful delete.
**Fix:** Optional — `SELECT … WHERE id = :id AND authorId = :user.id`, or derive the owner
from the value returned by a `.returning()` on `deleteComment` instead of a separate read.

---

_Reviewed: 2026-05-27T13:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
