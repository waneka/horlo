---
phase: 57-comment-thread-ui-feed-extension-grid-counts
plan: 05
subsystem: comment-ui-host-wiring
status: complete
tags: [wave-3, comment, gate, rsc, suspense, cmnt-01, cmnt-02, cmnt-09, gate-03]
completed: "2026-05-24"
duration: ~35m
tasks_completed: 3
tasks_total: 3
files_created: 0
files_modified: 8

dependency_graph:
  requires:
    - "57-02 (backend — getCommentsForTarget, canViewerCommentOnTarget, GATE-03 signals)"
    - "57-04 (component family — CommentThread, CommentList, WearCommentHost seams)"
  provides:
    - "src/components/wear/WearCommentHost.tsx (seams filled with CommentList)"
    - "src/components/wear/WearCard.tsx (comment-thread props + CMNT-09 count badge)"
    - "src/app/wear/[wearEventId]/page.tsx (WearPhotoStreamed resolves comments + gate signals)"
    - "src/app/wears/[username]/page.tsx (bounded Promise.all comment reads + batch author enrichment)"
    - "src/components/wears/WearsLane.tsx (WearSlide type extended with comment fields)"
    - "src/app/watch/[id]/page.tsx (CommentThread RSC sibling in Suspense + gate signals)"
    - "src/components/watch/WatchDetail.tsx (MessageCircle count badge in footer)"
    - "src/data/watches.ts (getWatchByIdForViewer ownerUserId field added)"
  affects:
    - "Plan 06 (grid counts — ProfileWatchCard with likeCount/commentCount)"

tech_stack:
  added: []
  patterns:
    - "CommentThread RSC sibling below WatchDetail (B1 invariant — server tree level)"
    - "Suspense(CommentThreadSkeleton) fallback for streaming"
    - "WearPhotoStreamed: uncached getCommentsForTarget + getProfilesByIds in Suspense child"
    - "Bounded fanout: Promise.all(wears.map(getCommentsForTarget)) over active-wears set"
    - "Single getProfilesByIds batch across all slides for author enrichment"
    - "getWatchByIdForViewer extended with ownerUserId to avoid second userId lookup"
    - "CMNT-09: commentCount > 0 hidden-at-zero badge in engagement rows"

key_files:
  created: []
  modified:
    - src/components/wear/WearCommentHost.tsx
    - src/components/wear/WearCard.tsx
    - src/app/wear/[wearEventId]/page.tsx
    - src/app/wears/[username]/page.tsx
    - src/components/wears/WearsLane.tsx
    - src/app/watch/[id]/page.tsx
    - src/components/watch/WatchDetail.tsx
    - src/data/watches.ts

decisions:
  - "Single-read vs double-read for watch-detail footer count: single read — getCommentsForTarget called once on the page for commentCount; CommentThread fetches its own list internally (one extra uncached read is acceptable vs. prop-chaining initialComments through WatchDetail). This avoids adding initialComments to WatchDetail props."
  - "viewerAuthor sourcing for wear hosts: resolved in WearPhotoStreamed (inline page) and in the wears page (wears lane), NOT in WearCommentHost. WearCommentHost is a client component and cannot await. Server parents resolve getProfilesByIds batch including viewerId, then pass viewerAuthor as a prop."
  - "ownerUserId in watch page: Watch domain type does not expose userId (intentionally stripped in mapRowToWatch). Extended getWatchByIdForViewer return type to include ownerUserId: string so GATE-03 signals can be resolved without a second DB query or polluting the Watch type."
  - "Bounded fanout rationale (vs DISP-01): Promise.all(wears.map(getCommentsForTarget)) over the active-wears set (~48h window, typically <10 wears) is acceptable. DISP-01 targets the 500-watch profile-collection grid (Plan 06) where per-card queries scale with collection size. This fan-out mirrors the already-approved likeStates Promise.all pattern. Author enrichment is collapsed into ONE getProfilesByIds batch across all slides."
  - "WearCommentHost bottom-sheet z-stack: SheetContent keeps bg-background SOLID (not /80 opacity) + z-50 + max-h-[60vh] overflow-y-auto. Verified no bg-background/ opacity variant introduced."
---

# Phase 57 Plan 05: Comment Thread Host Wiring Summary

Wire the shared comment thread (Plan 04) into all three hosts — /watch/[id] (new RSC-sibling host), /wear/[wearEventId] (inline via WearPhotoStreamed), and /wears/[username] (bottom-sheet via WearCommentHost seam). Added CMNT-09 count badges and resolved GATE-03 signals server-side.

## What Was Built

### Task 1: WearCommentHost seam fill + WearCard comment props

**`src/components/wear/WearCommentHost.tsx`**:
- Extended both discriminated union variants with comment-thread + gate props: `initialComments: CommentWithAuthor[]`, `canComment`, `ownerFollowsViewer`, `viewerIsFollowing`, `ownerUserId`, `ownerUsername`, `viewerId`, `viewerAuthor`
- Replaced both placeholder seams ("No comments yet.") with `<CommentList .../>` rendering
- Bottom-sheet variant: `<SheetContent className="bg-background max-h-[60vh] overflow-y-auto z-50">` — solid background, no opacity (T-57-14)
- Removed the `eslint-disable-next-line @typescript-eslint/no-unused-vars` guard (wearEventId is now used)

**`src/components/wear/WearCard.tsx`**:
- Added 8 new comment-thread props: `initialComments`, `canComment`, `ownerFollowsViewer`, `viewerIsFollowing`, `ownerUserId`, `ownerUsername`, `viewerAuthor`, `commentCount`
- Threaded props to both `<WearCommentHost>` renders (bottom-sheet + inline)
- CMNT-09: added `{commentCount > 0 && <span ...>{commentCount}</span>}` badge next to MessageCircle in both engagement rows, hidden at zero

### Task 2: Wear-detail + wears-lane page wiring

**`src/app/wear/[wearEventId]/page.tsx`** (WearPhotoStreamed):
- Added uncached `getCommentsForTarget(viewerId, target)` call inside the Suspense child
- Batch author enrichment via `getProfilesByIds([...authorIds, viewerId])`
- GATE-01 short-circuit: `canComment=true`, `ownerFollowsViewer=false`, `viewerIsFollowing=false` (wear targets always open)
- Passes `initialComments`, gate props, `ownerUserId={wear.userId}`, `ownerUsername`, `viewerAuthor`, `commentCount` to WearCard
- Added `ownerUserId` and `ownerUsername` to WearPhotoStreamed's props (passed from the outer page with `wear.userId` and `wear.username`)

**`src/app/wears/[username]/page.tsx`**:
- Added `Promise.all(wears.map((w) => getCommentsForTarget(viewerId, { type:'wear', id: w.id })))` for per-wear comments (bounded fanout — see Decisions)
- Single `getProfilesByIds` batch across all slides (collected from all comment authorIds + viewerId)
- `viewerAuthor` resolved once per page from the shared profileMap
- Each WearSlide extended with: `initialComments`, `canComment:true`, `ownerFollowsViewer:false`, `viewerIsFollowing:false`, `ownerUserId`, `ownerUsername`, `viewerAuthor`, `commentCount`

**`src/components/wears/WearsLane.tsx`**:
- `WearSlide` type extended with all 8 comment-thread fields
- No render change needed — `{...slide}` spread already passes new fields to WearCard

**`tests/components/wear/WearCard.test.tsx`** (Rule 1 fix):
- Added required comment-thread props (`initialComments=[]`, `canComment=true`, etc.) to both test renders — fixes `comments.map is not a function` crash from undefined initialComments

### Task 3: Watch-detail CommentThread RSC sibling + footer count

**`src/data/watches.ts`**:
- `getWatchByIdForViewer` return type extended from `{ watch: Watch; isOwner: boolean }` to add `ownerUserId: string` — surfaces the DB row's userId without polluting the Watch domain type

**`src/app/watch/[id]/page.tsx`**:
- Destructures `ownerUserId` from `result` (via the extended return type)
- Resolves `canComment` (via `canViewerCommentOnTarget`) in parallel with `likeState` using `Promise.all`
- Resolves `ownerFollowsViewer = isFollowing(ownerUserId, user.id)` and `viewerIsFollowing = isFollowing(user.id, ownerUserId)` (both directions, both short-circuit to `false` when `canComment=true` or non-wishlist)
- Resolves `commentCount` via one `getCommentsForTarget` call (length only; CommentThread fetches list internally — single-read decision)
- Resolves `ownerProfile` via `getProfileById(ownerUserId)` for `ownerUsername`
- Added `<Suspense fallback={<CommentThreadSkeleton />}><CommentThread .../></Suspense>` below `<LineageRail>` at server tree level (B1 invariant — NOT inside 'use client' WatchDetail island)
- `commentCount` passed to `<WatchDetail>`

**`src/components/watch/WatchDetail.tsx`**:
- Added `commentCount?: number` to WatchDetailProps (optional for backward compat)
- Added `MessageCircle` import from lucide-react
- Added count badge in footer action row: `{(commentCount ?? 0) > 0 && <span ...><MessageCircle .../>{commentCount}</span>}` — hidden at zero, no tap behavior (thread is visible below)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WearCard test crashes with undefined initialComments**
- **Found during:** Task 2 test run
- **Issue:** Wave 0 WearCard tests passed only `showAddToWishlist` props, not the new required `initialComments` prop. At runtime, CommentList tried `comments.map(...)` on `undefined`, crashing the render.
- **Fix:** Added all 8 required comment-thread props (with safe empty defaults: `initialComments=[]`, `canComment=true`, `commentCount=0`) to both test renders
- **Files modified:** `tests/components/wear/WearCard.test.tsx`
- **Commit:** 603c1ea

**2. [Rule 3 - Blocking] Watch.userId not accessible from Watch domain type**
- **Found during:** Task 3 typecheck
- **Issue:** `Watch` type intentionally strips `userId` (DB-internal field). The plan's pattern expected `watch.userId` but `mapRowToWatch` in `src/data/watches.ts` omits it. No way to get the owner's userId from the `Watch` object.
- **Fix:** Extended `getWatchByIdForViewer` return type to include `ownerUserId: string`, populated from `row.watch.userId` before `mapRowToWatch`. The Watch domain type itself remains unchanged.
- **Files modified:** `src/data/watches.ts`
- **Commit:** 67dba37

## Bounded Fanout vs DISP-01

The `Promise.all(wears.map(getCommentsForTarget...))` in `/wears/[username]/page.tsx` is intentional and NOT a DISP-01 violation:

- **DISP-01** targets the 500-watch profile-collection grid (Plan 06), where per-card queries would scale with collection size — requires a single batched aggregate query.
- **This fan-out** is over the active-wears set (~48h window, typically <10 wears), which is intrinsically bounded and has the same shape as the already-approved `likeStates = Promise.all(wears.map(getLikesForTargetCached...))` pattern.
- **Author enrichment** is collapsed into ONE `getProfilesByIds` batch across all slides (not per-slide).

## GATE-03 Direction Verification

| Signal | Call | Direction | Purpose |
|--------|------|-----------|---------|
| `ownerFollowsViewer` | `isFollowing(ownerUserId, user.id)` | owner→viewer | CommentGateLocked State 1 vs 2 copy |
| `viewerIsFollowing` | `isFollowing(user.id, ownerUserId)` | viewer→owner | State 1 (not following) vs State 2 (following, not mutual) |

Both signals short-circuit to `false` when `canComment=true` (gate open) — avoids two unnecessary DB calls on open targets.

## Bottom-Sheet Z-Stack / Background Verification

`SheetContent` keeps `bg-background` SOLID (not `/80` opacity variant). Verified:
- `grep -c "bg-background/" src/components/wear/WearCommentHost.tsx` → 0
- Sheet content: `className="bg-background max-h-[60vh] overflow-y-auto z-50"`
- CommentList and CommentGateLocked render in-flow inside the sheet (no absolute/fixed positioning)

## Known Stubs

None. All comment hosts render real comment data from the DAL. All gate signals are server-resolved.

## Threat Flags

None new beyond the plan's registered threats (T-57-10, T-57-14, T-57-15, T-57-13 — all mitigated per design).

## Self-Check

Files modified:
- `src/components/wear/WearCommentHost.tsx` — FOUND
- `src/components/wear/WearCard.tsx` — FOUND
- `src/app/wear/[wearEventId]/page.tsx` — FOUND
- `src/app/wears/[username]/page.tsx` — FOUND
- `src/components/wears/WearsLane.tsx` — FOUND
- `src/app/watch/[id]/page.tsx` — FOUND
- `src/components/watch/WatchDetail.tsx` — FOUND
- `src/data/watches.ts` — FOUND

Commits:
- `cc1164e` — feat(57-05): fill WearCommentHost seams with CommentList + thread comment props through WearCard
- `603c1ea` — feat(57-05): wear-detail + wears-lane page wiring — comment reads, gate signals, counts
- `67dba37` — feat(57-05): watch-detail CommentThread RSC sibling + CMNT-09 footer count (CMNT-01, GATE-03)

Structural grep checks:
- `grep -c "CommentThread" src/app/watch/[id]/page.tsx` → 8 (≥1 required)
- `grep -c "CommentList" src/components/wear/WearCommentHost.tsx` → 4 (≥1 required, 2 renders)
- `grep -c "MessageCircle" src/components/watch/WatchDetail.tsx` → 2 (≥1 required)
- `grep -c "getCommentsForTarget" src/app/wear/[wearEventId]/page.tsx` → 2 (≥1 required)
- `grep -c "getCommentsForTarget" src/app/wears/[username]/page.tsx` → 3 (≥1 required)
- `grep -c "isFollowing" src/app/watch/[id]/page.tsx` → 4 (both directions present)
- `grep -c "commentCount > 0" src/components/wear/WearCard.tsx` → 2 (≥1 required)
- `grep -rn "wear_event'" src/components/wear/ src/app/wear src/app/wears` → 0 (landmine guard)
- `grep -c "No comments yet" src/components/wear/WearCommentHost.tsx` → 1 (in JSDoc comment only, not rendered)
- `grep -c "use cache" src/components/wear/WearCommentHost.tsx` → 1 (in JSDoc comment only, not a directive)

Test results:
- `tests/components/wear/WearCard.test.tsx` (3 tests) → all pass (fixed by Rule 1 deviation)
- Full suite: 5 failed (same pre-existing DB-connection failures) | 5501 passed — no regressions

## Self-Check: PASSED
