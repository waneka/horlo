# Phase 54: DAL — Reactions, Comments + Gate Logic - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 5 (3 new, 1 edit, 1 new integration test, 1 new unit test)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/data/reactions.ts` | service / DAL | CRUD | `src/data/follows.ts` (followUser / unfollowUser / isFollowing) | exact |
| `src/data/comments.ts` | service / DAL + gate | CRUD + request-response | `src/data/follows.ts` (DAL pattern) + `src/lib/auth.ts` (typed error + doc-comment) | role-match composite |
| `src/data/follows.ts` (EDIT) | service / DAL | request-response | `src/data/follows.ts:54-69` isFollowing + `src/data/follows.ts:146-153` FILTER aggregate | exact — sibling extension |
| `tests/integration/phase54-dal-gate.test.ts` | test | request-response | `tests/integration/phase34-rls.test.ts` (localhost guard + Drizzle db mix) + `tests/integration/phase15-wear-detail-gating.test.ts` (seeding/cleanup) | exact |
| `src/data/__tests__/reactions-comments-gate.test.ts` | test | CRUD | `src/data/__tests__/watches-leftjoin.test.ts` (vi.mock('@/db') scaffold) | exact |

---

## Pattern Assignments

### `src/data/reactions.ts` (DAL, CRUD)

**Analogs:** `src/data/follows.ts` lines 1-9, 22-48

**Imports pattern** (`src/data/follows.ts` lines 1-9):
```typescript
import 'server-only'

import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { watchLikes, wearLikes } from '@/db/schema'
```
Note: `follows.ts` imports `{ and, desc, eq, inArray, sql }` at line 4. `reactions.ts` needs `{ and, eq, sql }` at minimum; no `desc`/`inArray` needed. The `bool_or` aggregate is expressed via `sql<boolean>` — no additional import.

**Idempotent insert pattern — onConflictDoNothing** (`src/data/follows.ts` lines 22-30):
```typescript
await db
  .insert(follows)
  .values({ followerId, followingId })
  .onConflictDoNothing()
```
Copy this for `createLike`. The `watch_likes_unique_pair` / `wear_likes_unique_pair` UNIQUE constraints are the backstop (LIKE-05). No throw on duplicate — silent no-op.

**IDOR-safe delete pattern** (`src/data/follows.ts` lines 36-48):
```typescript
export async function unfollowUser(
  followerId: string,
  followingId: string,
): Promise<void> {
  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId),
      ),
    )
}
```
Copy this for `deleteLike`. The WHERE must include both `userId = viewerId` AND the target FK — prevents a user from unliking another user's like row.

**count(*) FILTER aggregate pattern** (`src/data/follows.ts` lines 146-153):
```typescript
db
  .select({
    userId: watches.userId,
    watchCount: sql<number>`count(*) FILTER (WHERE ${watches.status} = 'owned')::int`,
    wishlistCount: sql<number>`count(*) FILTER (WHERE ${watches.status} IN ('wishlist','grail'))::int`,
  })
  .from(watches)
  .where(inArray(watches.userId, ids))
  .groupBy(watches.userId),
```
This is the verified `sql<T>` FILTER aggregate idiom. For `getLikesForTarget` (D-07), apply the same pattern with `count(*)::int` and `coalesce(bool_or(...), false)` for `viewerHasLiked`. `coalesce` is required because `bool_or` returns NULL over an empty group (Pitfall 1 in RESEARCH.md).

**Full target-discriminated getLikesForTarget shape** (derived — see RESEARCH.md §Code Examples):
```typescript
export async function getLikesForTarget(
  viewerId: string,
  target: { type: 'watch' | 'wear'; id: string },
): Promise<LikesResult> {
  if (target.type === 'watch') {
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
        viewerHasLiked: sql<boolean>`coalesce(bool_or(${watchLikes.userId} = ${viewerId}), false)`,
      })
      .from(watchLikes)
      .where(eq(watchLikes.watchId, target.id))
    return { count: rows[0]?.count ?? 0, viewerHasLiked: rows[0]?.viewerHasLiked ?? false }
  } else {
    // wearLikes branch — mirrors above with wearLikes.wearEventId
  }
}
```

**server-only guard:** First line of the file must be `import 'server-only'` — every file in `src/data/` uses this (Pitfall 6 in RESEARCH.md).

---

### `src/data/comments.ts` (DAL + gate, CRUD + request-response)

**Analogs:**
- Typed error class shape: `src/lib/auth.ts` lines 6-11
- DAL invariant doc-comment: `src/lib/auth.ts` lines 61-69
- Row existence check for gate predicate: `src/data/follows.ts` lines 54-68
- Idempotent + IDOR-safe patterns: same as reactions.ts above

**Typed error class — CommentGateError** (copy shape from `src/lib/auth.ts` lines 6-11):
```typescript
export class UnauthorizedError extends Error {
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}
```
`CommentGateError` is a direct sibling — same three-line constructor shape, different class name and default message. Lives in `src/data/comments.ts` (D-05 / CONTEXT.md). Phase 55 Server Action catches it by `instanceof CommentGateError` — distinct class required, NOT `UnauthorizedError` reuse.

**DAL invariant doc-comment pattern** (`src/lib/auth.ts` lines 61-69):
```typescript
// assertOwner — first call in every CMS Server Action (D-06).
// Layout guard alone is insufficient (Partial Rendering does not re-execute layout on navigation).
//
// CR-01 accuracy note: the CMS DAL runs through the Drizzle `db` client, which
// connects directly to Postgres via DATABASE_URL and therefore BYPASSES RLS.
// For every Phase 45 code path, `assertOwner()` is the SOLE enforced write gate
// — the layout redirect is UX only. The RLS write policies in the Phase 45
// migration are a backstop that only takes effect on a future Supabase-JS-client
// access path (e.g. Phase 47 public reads); they do NOT protect any DAL call here.
```
`comments.ts` must open with a doc-comment block in this exact style (D-03). Mirror the structure: load-bearing claim first, CR note, then the known landmine. The full text is in RESEARCH.md §Pattern 6.

**Row existence check idiom** (`src/data/follows.ts` lines 54-68) — template for the `isMutualFollow` call inside `canViewerCommentOnTarget`:
```typescript
export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId),
      ),
    )
    .limit(1)
  return rows.length > 0
}
```

**canViewerCommentOnTarget gate predicate shape** (derived from CONTEXT.md D-04 + D-11 + Pitfall 2):
```typescript
export async function canViewerCommentOnTarget(
  viewerId: string,
  target: { type: 'watch' | 'wear'; id: string },
): Promise<boolean> {
  if (target.type === 'wear') return true           // GATE-01: wears always open
  const watchRows = await db
    .select({ userId: watches.userId, status: watches.status })
    .from(watches)
    .where(eq(watches.id, target.id))
    .limit(1)
  const watch = watchRows[0]
  if (!watch) return false                          // not found — fail closed
  if (viewerId === watch.userId) return true        // GATE-04: owner bypass
  if (watch.status !== 'wishlist') return true      // non-wishlist: open to all authenticated
  return isMutualFollow(viewerId, watch.userId)     // GATE-05: wishlist requires mutual
}
```

**createComment throw pattern** (derived from assertOwner → throw in `src/lib/auth.ts:78`):
```typescript
// Inside createComment:
const allowed = await canViewerCommentOnTarget(authorId, target)
if (!allowed) throw new CommentGateError()
// then proceed with db.insert
```

**getCommentsForTarget read + gate** (D-06 — plain Comment[], returns [] when gated):
```typescript
export async function getCommentsForTarget(
  viewerId: string,
  target: { type: 'watch' | 'wear'; id: string },
): Promise<Comment[]> {
  const allowed = await canViewerCommentOnTarget(viewerId, target)
  if (!allowed) return []
  // db.select from comments where target FK, orderBy createdAt asc
  // chronological index: comments_watch_id_created_at_idx / comments_wear_event_id_created_at_idx
}
```

**Explicit param convention** (established pattern from `src/data/follows.ts` all public functions): DAL functions take explicit `viewerId`/`authorId` string params — never read session inside the DAL. Session resolution belongs to the Phase 55 Server Action calling `getCurrentUser()`.

---

### `src/data/follows.ts` (EDIT — add isMutualFollow)

**Insertion point:** After `isFollowing` at line 69, before the `// Follower / following list DAL` section comment at line 71.

**Import change needed:** Add `or` to the existing `drizzle-orm` import at line 4.

Current line 4:
```typescript
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
```
After edit:
```typescript
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
```
(Pitfall 4 in RESEARCH.md — `or` is not currently imported.)

**isMutualFollow sibling shape** — mirrors `isFollowing` (lines 54-68) but checks both directions in one query using the FILTER aggregate idiom from lines 146-149:

The `isFollowing` idiom to mirror:
```typescript
// src/data/follows.ts lines 54-68
export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId),
      ),
    )
    .limit(1)
  return rows.length > 0
}
```

The FILTER aggregate idiom to extend (lines 146-149):
```typescript
watchCount: sql<number>`count(*) FILTER (WHERE ${watches.status} = 'owned')::int`,
```

`isMutualFollow` combines `or()` for the WHERE (scope to only the two relevant rows) plus two `FILTER (WHERE ...)` aggregates for the directional counts — single round-trip, GATE-05 compliant. Full derived query shape is in RESEARCH.md §Pattern 2 and §Code Examples.

**Doc-comment:** Add a JSDoc comment matching the `isFollowing`/`followUser`/`unfollowUser` style: one sentence describing what it checks, a note that it is a single-query bidirectional sibling (not a composition of `isFollowing`), and the GATE-05 reference.

---

### `tests/integration/phase54-dal-gate.test.ts` (new integration test)

**Analogs:**
- Guard pattern: `tests/integration/phase34-rls.test.ts` lines 19-25 (strict localhost guard)
- Seeding pattern: `tests/integration/phase15-wear-detail-gating.test.ts` lines 40-80 (fixed UUIDs, beforeAll/afterAll cleanup, direct Drizzle insert)
- `seedTwoUsers` fixture: `tests/fixtures/users.ts` lines 13-46 (admin.auth.admin.createUser path — use only if auth-layer seeding is needed; Phase 54 can seed via `db.insert(users)` directly per the phase15 pattern)

**Localhost guard pattern** (`tests/integration/phase34-rls.test.ts` lines 19-25):
```typescript
const dbUrlIsLocal =
  typeof process.env.DATABASE_URL === 'string' &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))

const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && dbUrlIsLocal
  ? describe : describe.skip
```
Phase 54 extends this with `SUPABASE_SERVICE_ROLE_KEY` if `seedTwoUsers` is used for user creation. If seeding via `db.insert(users)` directly (phase15 pattern), the ANON_KEY is not required either — use the minimal guard appropriate for the chosen seeding path.

**Fixed-UUID + cleanup seeding pattern** (`tests/integration/phase15-wear-detail-gating.test.ts` lines 40-61):
```typescript
const ids = {
  A:  '00000000-0000-0000-0000-0000000015a0',
  F:  '00000000-0000-0000-0000-0000000015a2',
  S:  '00000000-0000-0000-0000-0000000015a3',
} as const
const allIds = Object.values(ids) as string[]

async function cleanup() {
  await db.delete(wearEvents).where(inArray(wearEvents.userId, allIds))
  await db.delete(watches).where(inArray(watches.userId, allIds))
  await db.delete(follows).where(inArray(follows.followerId, allIds))
  await db.delete(follows).where(inArray(follows.followingId, allIds))
  await db.delete(profileSettings).where(inArray(profileSettings.userId, allIds))
  await db.delete(profiles).where(inArray(profiles.id, allIds))
  await db.delete(users).where(inArray(users.id, allIds))
}

beforeAll(async () => {
  await cleanup()
  await db.insert(users).values(
    Object.entries(ids).map(([k, id]) => ({
      id,
      email: `${k.toLowerCase()}-p15-${Date.now()}@horlo.test`,
    })),
  )
  // ...update profiles, insert follows, watches
}, 30_000)

afterAll(async () => {
  await cleanup()
}, 30_000)
```
Phase 54 needs four fixed UUIDs: `owner`, `mutual`, `oneWay`, `stranger`. Use the `00000000-0000-0000-0000-0000000054XX` namespace. The cleanup must delete in FK dependency order: `watch_likes` / `wear_likes` / `comments` → `watches` → `follows` → `profileSettings` → `profiles` → `users`.

**Negative-cells-first ordering convention** (`tests/integration/phase15-wear-detail-gating.test.ts` line 182 comment):
```typescript
// NEGATIVE CELLS FIRST — catches inverted gate / missing gate early
```
Place SEC-02 rejection tests before GATE-04 / GATE-05 positive tests. This matches the phase15 convention.

**Import block for integration test** (derived from phase34-rls.test.ts + phase15):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { inArray, eq } from 'drizzle-orm'
import { db } from '@/db'
import { users, profiles, profileSettings, follows, watches, comments } from '@/db/schema'
import { createComment } from '@/data/comments'
import { isMutualFollow } from '@/data/follows'
import { CommentGateError } from '@/data/comments'
```

---

### `src/data/__tests__/reactions-comments-gate.test.ts` (new unit test)

**Analog:** `src/data/__tests__/watches-leftjoin.test.ts` (full file, 100 lines)

**vi.mock('@/db') scaffold** (`src/data/__tests__/watches-leftjoin.test.ts` lines 6-22):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockRows: Array<...> = []

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(mockRows),
        })),
      })),
    })),
  },
}))

// Import AFTER mocking
import { getWatchesByUser } from '@/data/watches'

beforeEach(() => {
  mockRows = []
  vi.clearAllMocks()
})
```
Copy this scaffold for Phase 54 unit tests. The `db` mock chain must be shaped to match what `canViewerCommentOnTarget` and `isMutualFollow` actually call (`.select().from().where().limit(1)` for both). Use `vi.fn().mockResolvedValue(...)` at the terminal chain method.

**What to cover in unit tests:**
- `isMutualFollow`: returns false when only A→B row is in mockRows (bToA FILTER count = 0); returns true when both directions present
- `canViewerCommentOnTarget`: all gate branches — wear target short-circuit (returns true), owner bypass (viewerId === watch.userId), non-wishlist open (status ≠ 'wishlist'), wishlist + mutual (returns true), wishlist + non-mutual (returns false)
- `getLikesForTarget`: viewerHasLiked defaults to false when mockRows is empty (Pitfall 1 null handling)

**server-only shim note:** `vitest.config.ts` already aliases `'server-only'` to a no-op shim — no action required. The import in the DAL files will not throw in vitest's environment (Pitfall 7 in RESEARCH.md).

---

## Shared Patterns

### server-only guard
**Source:** `src/data/follows.ts` line 1
**Apply to:** `src/data/reactions.ts` and `src/data/comments.ts` (both new DAL files)
```typescript
import 'server-only'
```
First line of every new DAL file. Build-time enforcement prevents client bundle inclusion.

### Drizzle db (RLS-bypassing path)
**Source:** `src/db/index.ts` (referenced; follows.ts line 6)
**Apply to:** All three DAL files
```typescript
import { db } from '@/db'
```
Never use supabase-js inside `src/data/` functions. The `db` client connects via `DATABASE_URL` + postgres-js and bypasses RLS entirely — this is why the DAL gate is load-bearing (D-01).

### Explicit param convention (no session reads in DAL)
**Source:** `src/data/follows.ts` lines 22-68 — all public functions take explicit `followerId`/`followingId` string params
**Apply to:** All new DAL functions (`getLikesForTarget`, `createLike`, `deleteLike`, `getCommentsForTarget`, `createComment`, `canViewerCommentOnTarget`, `isMutualFollow`)
All IDs are passed as params; `getCurrentUser()` is called only in Server Actions (Phase 55).

### ActionResult / DAL-throws convention
**Source:** `src/app/actions/follows.ts` lines 1-90 (the consumer pattern); `src/lib/auth.ts` line 78 (the throw pattern)
**Apply to:** `src/data/comments.ts` — `createComment` throws `CommentGateError`; Phase 55 Server Action catches it
```typescript
// DAL side (comments.ts):
if (!allowed) throw new CommentGateError()

// Action side (Phase 55 — reference only):
// try { await createComment(...) }
// catch (err) {
//   if (err instanceof CommentGateError) return { success: false, error: 'Follow ... to comment' }
//   throw err
// }
```

### onConflictDoNothing idempotency
**Source:** `src/data/follows.ts` lines 26-29
**Apply to:** `src/data/reactions.ts` — `createLike`
```typescript
.onConflictDoNothing()
```
Relies on `watch_likes_unique_pair` / `wear_likes_unique_pair` UNIQUE constraints (Phase 53). No throw on duplicate.

### IDOR-safe delete (caller-id in WHERE)
**Source:** `src/data/follows.ts` lines 40-48
**Apply to:** `src/data/reactions.ts` — `deleteLike`; `src/data/comments.ts` — `deleteComment` (authorship check instead of userId)

---

## No Analog Found

No files in this phase are without a codebase analog. All five target files map cleanly to existing patterns.

---

## Metadata

**Analog search scope:** `src/data/`, `src/lib/`, `src/app/actions/`, `tests/integration/`, `tests/fixtures/`, `src/data/__tests__/`
**Files scanned:** 8 (follows.ts, auth.ts, phase34-rls.test.ts, phase15-wear-detail-gating.test.ts, users.ts, watches-leftjoin.test.ts, catalog-facets.test.ts, follows actions.ts)
**Pattern extraction date:** 2026-05-22

### Verified Line Numbers
All line numbers in this document were verified against the live files at extraction time:
- `src/data/follows.ts`: import block lines 1-12; `followUser` lines 22-30; `unfollowUser` lines 36-48; `isFollowing` lines 54-68; FILTER aggregate lines 146-153
- `src/lib/auth.ts`: `UnauthorizedError` lines 6-11; `assertOwner` doc-comment lines 61-69; full `assertOwner` lines 70-80
- `tests/integration/phase34-rls.test.ts`: localhost guard lines 19-25; `maybe` guard line 24-25
- `tests/integration/phase15-wear-detail-gating.test.ts`: suite structure lines 38-61; seeding pattern lines 63-176
- `tests/fixtures/users.ts`: `seedTwoUsers` lines 13-46
- `src/data/__tests__/watches-leftjoin.test.ts`: vi.mock scaffold lines 6-22; beforeEach lines 27-31
