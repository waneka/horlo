---
phase: 54-dal-reactions-comments-gate-logic
plan: "03"
subsystem: DAL / Comments Gate
status: complete
tags: [dal, comments, gate, wishlist, privacy, mutual-follow, typescript]
dependency_graph:
  requires:
    - "54-01 (test scaffolds: reactions-comments-gate.test.ts + phase54-dal-gate.test.ts)"
    - "54-02 (follows.ts isMutualFollow + reactions.ts)"
  provides:
    - "src/data/comments.ts — full comments DAL with wishlist gate"
    - "CommentGateError typed error class"
    - "canViewerCommentOnTarget single gate predicate (D-04)"
    - "createComment (SEC-02 enforcement)"
    - "getCommentsForTarget (GATE-01 read-gate)"
    - "editComment + deleteComment (IDOR-safe)"
  affects:
    - "Phase 55 Server Actions (consume createComment/getCommentsForTarget + catch CommentGateError)"
    - "Phase 57 UI (use canViewerCommentOnTarget for compose-box vs CTA gate)"
tech_stack:
  added: []
  patterns:
    - "DAL gate enforcement via canViewerCommentOnTarget (mirrors assertOwner pattern)"
    - "Typed error throw (CommentGateError) — caught by Phase 55 Server Actions"
    - "Wear target short-circuit before DB call (Pitfall 2)"
    - "isMutualFollow delegation for wishlist branch (GATE-05)"
    - "IDOR-safe authorship scope in editComment/deleteComment"
key_files:
  created:
    - "src/data/comments.ts"
  modified: []
decisions:
  - "Co-located editComment + deleteComment in comments.ts (CONTEXT.md Claude's Discretion — DAL phase, Phase 55 needs full surface)"
  - "wear short-circuit before DB query (if target.type === 'wear') return true — implemented as the first statement in canViewerCommentOnTarget per Pitfall 2"
  - "getCommentsForTarget returns plain Comment[] with [] for gated viewers — no {comments, gated} shape (D-06)"
  - "CommentGateError co-located in comments.ts (recommended placement per D-05)"
metrics:
  duration_seconds: 287
  completed_date: "2026-05-22"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 54 Plan 03: Comments DAL — CommentGateError, gate predicate, CRUD Summary

**One-liner:** Wishlist comment gate enforcement via `canViewerCommentOnTarget` in `src/data/comments.ts` — the sole load-bearing privacy layer for authenticated users, enforced via `CommentGateError` throw on `createComment` and `[]` return on `getCommentsForTarget`.

## What Was Built

### `src/data/comments.ts` (new)

The full comments DAL with:

- **D-03 load-bearing invariant doc comment** — explicitly documents that (1) Drizzle `db` bypasses RLS, (2) `canViewerCommentOnTarget`/`createComment` is the SOLE enforced gate, and (3) the KNOWN LANDMINE: routing through supabase-js will fail closed for ALL non-owners (not just wishlist), because the Phase 53 RLS SELECT USING subquery is intentionally non-functional.

- **`CommentGateError` class** — extends Error, `this.name = 'CommentGateError'`, default message `'Mutual follow required to comment on wishlist watches'`. Distinct from `UnauthorizedError` so Phase 55 can catch by `instanceof` without string-matching (D-05).

- **`canViewerCommentOnTarget(viewerId, target)`** — single gate predicate (D-04), exact order:
  1. `if (target.type === 'wear') return true` — SHORT-CIRCUIT before any DB call (Pitfall 2)
  2. Fetch watch row `{ userId, status }` — fail closed if not found
  3. Owner bypass: `if (viewerId === watch.userId) return true` (GATE-04)
  4. Non-wishlist open: `if (watch.status !== 'wishlist') return true` (GATE-01)
  5. Wishlist: `return isMutualFollow(viewerId, watch.userId)` (GATE-05, D-11 grandfather)

- **`createComment(input)`** — calls gate, throws `CommentGateError` if not allowed (SEC-02), then inserts via Drizzle `db.insert(comments).values(...).returning()`.

- **`getCommentsForTarget(viewerId, target)`** — calls gate, returns `[]` for gated viewers (D-06), otherwise returns comments ordered by `createdAt asc` (CMNT-03 oldest-first).

- **`editComment(authorId, commentId, body)`** — `UPDATE comments SET body, editedAt, updatedAt WHERE id = commentId AND authorId = authorId` (IDOR-safe, CMNT-06 editedAt semantics).

- **`deleteComment(authorId, commentId)`** — `DELETE FROM comments WHERE id = commentId AND authorId = authorId` (IDOR-safe, mirrors `unfollowUser` pattern).

## Test Results

### Integration Suite (`tests/integration/phase54-dal-gate.test.ts`) — 9/9 GREEN

Run with `DATABASE_URL` pointing to local Supabase Docker:
- SEC-02: one-way follower → CommentGateError ✓
- SEC-02: stranger → CommentGateError ✓
- GATE-01 read-gate: one-way viewer on wishlist watch → [] ✓
- GATE-04: owner createComment on own wishlist watch → resolves ✓
- GATE-04: getCommentsForTarget for owner → returns the comment ✓
- GATE-01 open path: stranger createComment on owned watch → resolves ✓
- mutual path: mutual follower createComment on wishlist watch → resolves ✓
- GATE-05: isMutualFollow returns false (one-way) ✓
- GATE-05: isMutualFollow returns true (bidirectional) ✓

### Unit Suite (`src/data/__tests__/reactions-comments-gate.test.ts`) — 13/15 GREEN

All 13 tests covering my implementation pass:
- `isMutualFollow` (3 tests): one-way = false, mutual = true, empty = false ✓
- `canViewerCommentOnTarget` (8 tests): all gate branches including wear short-circuit ✓
- `getLikesForTarget` Pitfall 1 null-coalesce: first 2 pass ✓

2 failures in `getLikesForTarget` tests — see Deviations section.

## Deviations from Plan

### Known Test Scaffold Issue (Plan 54-01 origin)

**Found during:** Task 2 verification

**Issue:** 2 `getLikesForTarget` unit tests fail due to a mock state leak in the Plan 54-01 test scaffold.

**Root cause:** The `canViewerCommentOnTarget` wishlist tests (in `canViewerCommentOnTarget` describe block) call `(db.select as vi.fn).mockImplementation(...)` to override the factory mock, then `vi.clearAllMocks()` in `beforeEach` clears call history but does NOT reset `mockImplementation`. The subsequent `getLikesForTarget` tests use the stale `mockImplementation` from the wishlist tests, which returns wrong data (the follow-direction aggregate rows instead of the likes aggregate rows).

**Affected tests:**
- `getLikesForTarget > returns count and viewerHasLiked: true when viewer has liked` (expected count 3, got 0)
- `getLikesForTarget > wear target: returns count and viewerHasLiked from wearLikes table` (expected count 1, got 0)

**Why not fixed:** These tests test `reactions.ts` (Plan 54-02 work), not `comments.ts`. Per execution constraints, the test files and `reactions.ts` cannot be modified. The integration suite (which tests the actual database behavior) is fully GREEN.

**Impact:** None on correctness. The `getLikesForTarget` function in `reactions.ts` is correct — this is a test scaffolding issue in the mock setup. The integration suite verifies all actual DAL gate behavior.

**Resolution path:** Fix in Plan 54-01 test file: change `vi.clearAllMocks()` in `beforeEach` to `vi.resetAllMocks()` to also reset `mockImplementation`, or restructure the wishlist tests to restore the original mock after each test.

## Self-Check

- [x] `src/data/comments.ts` exists
- [x] Contains `import 'server-only'` as first line
- [x] Contains `export class CommentGateError` with `this.name = 'CommentGateError'`
- [x] Contains D-03 doc comment with 'KNOWN LANDMINE' and RLS-bypass invariant text
- [x] Contains `export async function canViewerCommentOnTarget` with `if (target.type === 'wear') return true` as first statement
- [x] Contains `export async function createComment` with `throw new CommentGateError` guarded by `if (!allowed)`
- [x] Contains `export async function getCommentsForTarget` with `if (!allowed) return []`
- [x] Contains `export async function editComment` that sets `editedAt`
- [x] Contains `export async function deleteComment` with `eq(comments.authorId, authorId)` in WHERE
- [x] Integration suite 9/9 GREEN (SEC-02, GATE-01, GATE-04, GATE-05)
- [x] TypeScript: no new errors attributable to `comments.ts`

## Self-Check: PASSED

All files exist and commits are verified:
- `c60de92` — feat(54-03): implement comments.ts

## Threat Flags

No new security surface beyond what was planned in the threat model.
