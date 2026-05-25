---
phase: 54-dal-reactions-comments-gate-logic
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/data/follows.ts
  - src/data/reactions.ts
  - src/data/comments.ts
  - src/data/__tests__/reactions-comments-gate.test.ts
  - tests/integration/phase54-dal-gate.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 54: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 54 implements the load-bearing privacy DAL for likes and comments. I reviewed the
security-critical gate logic with an adversarial eye, tracing every branch of
`canViewerCommentOnTarget`, the bidirectional `isMutualFollow` query, every IDOR-scoped
mutation, and the null-coalesce paths.

**The core security invariants hold.** Specifically:

- `canViewerCommentOnTarget` has the correct branch order and fails CLOSED on watch-not-found
  (`comments.ts:76`). Wear short-circuits before any DB call; owner bypass precedes the
  wishlist gate; non-wishlist is open; wishlist falls through to `isMutualFollow`. No inversion,
  no missing branch.
- `createComment` throws `CommentGateError` when the gate returns false (SEC-02 enforced at
  `comments.ts:108`).
- `getCommentsForTarget` returns `[]` for a gated viewer before any content query runs (D-06 —
  no content and no count leaked, `comments.ts:137-138`).
- `isMutualFollow` is a SINGLE bidirectional query with two FILTER aggregates, requiring BOTH
  directions `>= 1` (GATE-05, `follows.ts:81-94`). It is genuinely not two `isFollowing` calls.
- `deleteLike` (`reactions.ts:99,108`), `deleteComment` (`comments.ts:194`), and `editComment`
  (`comments.ts:173`) all scope their WHERE by the caller's `userId`/`authorId` — IDOR is blocked
  at the query level.
- `getLikesForTarget` uses `coalesce(bool_or(...), false)` and `?? 0` / `?? false` mapper
  fallbacks (`reactions.ts:36,40,45,49`) — no NULL leaks through.

No Critical findings. The Warnings below concern a correctness gap in `editComment`'s
return contract, a privacy-scope observation on wear-target comments, and two test-integrity
issues that weaken the suite's ability to catch regressions.

## Warnings

### WR-01: `editComment` silently returns `undefined` typed as `Comment` on a non-author (IDOR) call

**File:** `src/data/comments.ts:164-177`
**Issue:** `editComment` declares `Promise<Comment>` and ends with `return rows[0]`. The WHERE
clause is `and(eq(comments.id, commentId), eq(comments.authorId, authorId))`. When a non-author
attempts the edit (the IDOR case this WHERE is designed to block), zero rows match,
`.returning()` yields `[]`, and the function returns `rows[0]` — which is `undefined`.

Because `tsconfig.json` enables `strict` but NOT `noUncheckedIndexedAccess`, TypeScript types
`rows[0]` as `Comment` (never `Comment | undefined`), so the compiler does not flag this. The
IDOR is correctly *blocked* (no row mutated), but the function reports success: a Phase 55 Server
Action calling `const c = await editComment(...)` then reading `c.id` / `c.body` will dereference
`undefined` and crash at runtime — or, worse, silently treat a no-op edit as having succeeded
and return a stale optimistic UI state.

This diverges from the established codebase pattern. `updateWatch` (`src/data/watches.ts:275-277`)
and `deleteWatch` (`src/data/watches.ts:289-291`) both explicitly check `if (!updated[0]) throw`
for exactly this not-found-or-access-denied case. `editComment` should mirror that pattern.

**Fix:**
```typescript
export async function editComment(
  authorId: string,
  commentId: string,
  body: string,
): Promise<Comment> {
  const now = new Date()
  const rows = await db
    .update(comments)
    .set({ body, editedAt: now, updatedAt: now })
    .where(and(eq(comments.id, commentId), eq(comments.authorId, authorId)))
    .returning()

  if (!rows[0]) {
    throw new Error(
      `Comment not found or access denied: commentId=${commentId}, authorId=${authorId}`,
    )
  }
  return rows[0]
}
```

### WR-02: `createComment` return type does not account for a possible empty `.returning()`

**File:** `src/data/comments.ts:110-120`
**Issue:** Same `return rows[0]` shape as WR-01. For an `INSERT ... RETURNING` the row is in
practice always produced, so this is lower risk than `editComment`. However, the DB carries CHECK
constraints (`comments_body_length`, `comments_exactly_one_target`, per `schema.ts:354-356`). If a
constraint is violated the insert throws (acceptable). The latent issue is the same type-safety
gap: `noUncheckedIndexedAccess` is off, so `rows[0]` is typed `Comment` even though Drizzle's
runtime contract for `.returning()` is an array that *could* be empty. A defensive guard makes the
contract explicit and prevents a silent `undefined`-as-`Comment` from ever escaping this function.

**Fix:**
```typescript
  const rows = await db
    .insert(comments)
    .values({ /* ... */ })
    .returning()

  if (!rows[0]) {
    throw new Error('createComment: insert returned no row')
  }
  return rows[0]
```

### WR-03: Comment gate treats every wear target as fully public, ignoring `wear_events.visibility`

**File:** `src/data/comments.ts:64-66` (and read path `comments.ts:140-152`)
**Issue:** `canViewerCommentOnTarget` returns `true` unconditionally for `target.type === 'wear'`,
and `getCommentsForTarget` then returns the full comment thread for any wear target to any
authenticated viewer. But `wear_events` carry a three-tier `visibility` enum
(`public` | `followers` | `private`, `schema.ts:305`). A viewer who cannot see a `private` or
`followers`-only wear event can still:
  1. read every comment on it via `getCommentsForTarget` (content + authorship leak), and
  2. create a comment on it via `createComment` (the gate returns true → no throw).

This is consistent with the documented D-04 decision ("any wear" is open) and is therefore an
intentional Phase 54 scope choice, not an accidental inversion — which is why it is a Warning, not
a Blocker. But the wear-visibility dimension is real and the gate predicate is explicitly billed
as "the single source of truth for create, read, and the Phase 57 UI" (`comments.ts:56-57`). If
Phase 55/57 wire comments onto non-public wear tiles without layering a separate visibility check,
this becomes a privacy leak. Flag it now so the downstream phase does not assume this gate already
covers wear visibility.

**Fix:** Either (a) document explicitly at the wear short-circuit that wear-visibility gating is
deferred to the caller, so Phase 55 does not assume coverage:
```typescript
  // Wear targets bypass the wishlist gate (GATE-01). NOTE: this does NOT enforce
  // wear_events.visibility (public/followers/private) — the caller MUST gate visibility
  // separately before invoking comment read/write on a non-public wear (see Phase 11 WYWT-09).
  if (target.type === 'wear') return true
```
or (b) fold a wear-visibility check into the predicate (fetch `wear_events.userId` + `visibility`,
allow owner always, allow `public` to all, allow `followers` only when `isFollowing`).

### WR-04: Integration-test `cleanup()` does not delete `watch_likes` / `wear_likes` rows it claims to order

**File:** `tests/integration/phase54-dal-gate.test.ts:68-80`
**Issue:** The cleanup comment declares the FK order "comments → watch_likes → wear_likes →
watches → ..." but the body never issues a delete against `watchLikes` or `wearLikes` — neither
table is even imported. Today the suite inserts no like rows, so this is latent. But the moment a
future test (or a copy-paste of this scaffold) seeds a like on `wishlistWatchId`/`ownedWatchId`,
`afterAll` will try to `db.delete(watches)` while a `watch_likes.watch_id` FK still references the
row. The watch_likes FK is `ON DELETE CASCADE` (`schema.ts:324`), so the watch delete would
actually succeed and cascade — meaning the misleading comment hides the fact that the explicit
ordered cleanup is incomplete and relies on cascade by accident. The comment and the code
disagree, which is a maintenance trap in a security-test fixture.

Additionally, `db.delete(comments).where(inArray(comments.authorId, allIds))` only removes comments
*authored by* test users. A comment authored by a non-test user on a test watch (not produced here,
but possible in an extended fixture) would block the `watches` delete. Since `comments.watchId` is
`ON DELETE CASCADE` (`schema.ts:366`) the watch delete would still cascade, again masking the gap.

**Fix:** Either delete the misleading FK-order comment and rely explicitly on cascade, or make the
cleanup match the comment:
```typescript
import { ..., watchLikes, wearLikes } from '@/db/schema'
// ...
await db.delete(comments).where(inArray(comments.authorId, allIds))
await db.delete(watchLikes).where(inArray(watchLikes.userId, allIds))
await db.delete(wearLikes).where(inArray(wearLikes.userId, allIds))
await db.delete(watches).where(inArray(watches.userId, allIds))
```

## Info

### IN-01: Unit-test mock cannot distinguish a `.limit(1)` watch-row query from a no-limit aggregate

**File:** `src/data/__tests__/reactions-comments-gate.test.ts:34-46`
**Issue:** `defaultSelectImpl` resolves `mockRows` for BOTH the `.limit(1)` path and the bare
`then` (no-limit) path, returning the same array regardless of which query shape the
implementation actually used. This means the unit suite would still pass if
`canViewerCommentOnTarget` accidentally dropped its `.limit(1)`, or if `isMutualFollow` started
calling `.limit()`. The mock validates resolved-value handling, not query shape — so a structural
regression in how the DAL builds its query would not be caught here. The real query shape is only
exercised by the (skip-by-default) integration suite. Acceptable for a unit test, but worth noting
that "green unit suite" does not prove the query shape contract.

**Fix:** No change required for correctness. If stronger guarantees are wanted, assert on the mock
call chain (e.g., that `.limit` was/was not invoked) per branch.

### IN-02: `mergeListEntries` default `profilePublic: true` is a fail-OPEN default for a privacy field

**File:** `src/data/follows.ts:198`
**Issue:** `profilePublic: s?.profilePublic ?? true` defaults to public when the
`profile_settings` row is missing. The schema default is also `true` (`schema.ts:256`) and a row
is expected for every user, so this is consistent. But for a privacy-adjacent field, a missing-row
fallback that defaults OPEN is a pattern worth a deliberate note — if a user ever lacks a settings
row, their follower/following list entry is rendered as public rather than failing closed. Not in
Phase 54's stated scope (this is pre-existing list-loader code, not the gate), hence Info.

**Fix:** Confirm the invariant "every user has a `profile_settings` row" is enforced (DB trigger /
backfill). If it can be violated, consider defaulting this privacy field closed.

### IN-03: `getLikesForTarget` requires `viewerId` but never returns "not authenticated" semantics

**File:** `src/data/reactions.ts:28-51`
**Issue:** The function takes `viewerId: string` and folds it into `bool_or(userId = viewerId)`.
If a caller passes an empty string or a sentinel for an unauthenticated viewer, the query runs and
returns `viewerHasLiked: false` — which is the desired outcome — but there is no explicit contract
note that `viewerId` is always the trusted session id (never client-supplied). The phase context
emphasizes these functions take an explicit trusted `viewerId`. The contract is implied by the
`server-only` import and the JSDoc on sibling functions, but `getLikesForTarget` itself has no
note. Minor documentation gap.

**Fix:** Add a one-line JSDoc note that `viewerId` MUST be the authenticated session id resolved
server-side, mirroring the IDOR notes on `deleteLike` / `deleteComment`.

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
