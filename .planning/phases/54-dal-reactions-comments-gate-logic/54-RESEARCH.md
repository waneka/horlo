# Phase 54: DAL — Reactions, Comments + Gate Logic - Research

**Researched:** 2026-05-22
**Domain:** TypeScript DAL — Drizzle ORM, wishlist comment gate, mutual-follow check, integration test harness
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** DAL-only gate (CR-01 Option a). Wishlist mutual-follow gate lives entirely in the DAL. Layer 1 = RLS anon-block (shipped Phase 53). Layer 2 = DAL gate (this phase). DAL is the load-bearing layer.
- **D-02:** Do NOT touch the Phase 53 `comments` RLS. It fails closed for non-owners on the RLS-respecting path — harmless because all comment reads/writes go through the Drizzle DAL. Phase 54 is pure TypeScript, no SQL migration, no prod RLS change.
- **D-03:** Document the invariant loudly in `src/data/comments.ts` — mirroring `src/lib/auth.ts:64-69` assertOwner CR-01 doc-comment style.
- **D-04:** One shared gate predicate: `canViewerCommentOnTarget(viewerId, target): Promise<boolean>`. Returns true when: owner OR target is non-wishlist (owned/sold/grail, or any wear) OR mutual-follow.
- **D-05:** `createComment` throws `CommentGateError` (typed, sibling to `UnauthorizedError`) when gate is false.
- **D-06:** `getCommentsForTarget` returns plain `Comment[]`; returns `[]` for non-mutual viewer on wishlist watch (no content or count leaked).
- **D-07:** `getLikesForTarget(viewerId, target)` returns `{ count: number, viewerHasLiked: boolean }` from a single query.
- **D-08:** Target-discriminated API via `{ type: 'watch' | 'wear', id: string }`. New files: `src/data/reactions.ts`, `src/data/comments.ts`. Edit: `src/data/follows.ts` (add `isMutualFollow`).

### Claude's Discretion

- Comment edit/delete DAL (`editComment`/`deleteComment`) placement — planner may co-locate in `comments.ts` or leave to Phase 55.
- `deleteLike` / toggle semantics — whether to expose `toggleLike` DAL helper or leave toggle to Phase 55 action.
- `CommentGateError` location — co-locate in `comments.ts` (recommended) or shared errors module.
- Exact Drizzle query construction for `isMutualFollow` single-round-trip bidirectional check.
- Index usage and count/`bool_or` aggregate phrasing for D-07.

### Deferred Ideas (OUT OF SCOPE)

- WR-03: `supabase/migrations/20260522000001_phase53_notification_enum.sql` hard-coded enum count assertion — deferred to next migration-touching phase.
- Future social work: liker-avatar strip, reply fan-out, email digest, @mentions, threaded replies (SOC-F1..F5).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GATE-01 | Comments on `wishlist` watches restricted to mutual followers; owned/sold/grail watches and wears are open to any authenticated user | `canViewerCommentOnTarget` predicate reads `watches.status` + `watches.userId`; gate applies only when `status = 'wishlist'` |
| GATE-04 | Collection owner can always comment on their own watches regardless of the gate | Short-circuit in `canViewerCommentOnTarget`: `if (viewerId === watch.userId) return true` |
| GATE-05 | Mutual-follow computed bidirectionally via dedicated `isMutualFollow` (not reused from one-directional `isFollowing`) | New function in `src/data/follows.ts`; verified single-query two-direction check pattern below |
| SEC-02 | Wishlist-comment gate enforced in BOTH layers, verified by integration test where non-mutual-follower calling DAL directly is rejected | Integration test in `tests/integration/` using Drizzle `db` (RLS-bypassing path) directly calls `createComment` and asserts `CommentGateError` |
</phase_requirements>

---

## Summary

Phase 54 is a pure TypeScript backend phase: no SQL migration, no RLS changes, no UI. It builds three DAL modules (`src/data/reactions.ts`, `src/data/comments.ts`, and an extension to `src/data/follows.ts`) on top of tables shipped in Phase 53. All decisions are locked in CONTEXT.md.

The central correctness guarantee is that `createComment` on a wishlist watch cannot be called by a non-mutual-follower via the DAL path — because the Drizzle `db` client connects directly via `DATABASE_URL` and bypasses RLS entirely, the DAL gate is the only enforced layer for authenticated users. This is the same pattern as `assertOwner()` in `src/lib/auth.ts:61-80`, which explicitly documents its Drizzle-bypasses-RLS characteristic.

The codebase already provides every structural template needed: `isFollowing` in `follows.ts` (row existence check idiom), `followUser` (onConflictDoNothing pattern), `count(*)::int` aggregate in `profiles.ts` and `follows.ts`, `FILTER (WHERE ...)` conditional counts in `follows.ts:148-149`, `UnauthorizedError` shape in `auth.ts`, and the `describe.skip` / `maybe` integration test harness in `tests/integration/`. The `bool_or` aggregate for D-07's single-query liked-state is new to the codebase but is standard Drizzle `sql<boolean>` template syntax — pattern confirmed compatible.

**Primary recommendation:** Follow the locked decisions exactly. The structural work is template work against well-established codebase patterns. The main research finding the planner must act on is the precise Drizzle query idiom for `isMutualFollow` (GATE-05 bidirectional single query) and `getLikesForTarget` (D-07 count + bool_or aggregate), both confirmed possible via the `sql<T>` template literal path already used in the codebase.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wishlist comment gate logic | API / Backend (DAL) | — | DAL is sole load-bearing layer (D-01); RLS blocks anon only |
| Mutual-follow bidirectional check | API / Backend (DAL) | — | Must run server-side; single Drizzle query against `follows` table |
| Like read/write (reactions) | API / Backend (DAL) | — | Drizzle `db` RLS-bypass path; consumed by Phase 55 Server Actions |
| Comment read/write | API / Backend (DAL) | — | Same; gate enforced here, not at RLS layer |
| Integration test gate verification | Test harness | — | Direct DAL call bypassing RLS; localhost-gated vitest suite |
| Unit test (isMutualFollow / canViewerCommentOnTarget) | Test harness | — | Mocked `db` in `src/data/__tests__/` |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 [VERIFIED: package.json] | ORM for all DAL queries | Established project standard; `db` in `src/db/index.ts` is the RLS-bypassing Drizzle client |
| postgres (postgres-js) | (transitive) | `DATABASE_URL` connection pooling | `{ prepare: false }` required for Supabase transaction mode pooler |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (project-wide) | Unit + integration test runner | `npm run test` executes `vitest run`; integration tests use `describe.skip` guard |
| @supabase/supabase-js | (project-wide) | Supabase admin client for test seeding | Integration tests only — creates test users via `auth.admin.createUser` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single-query `bool_or` aggregate (D-07) | Two separate queries (`getLikeCount` + `hasViewerLiked`) | Two queries doubles DAL surface; CONTEXT.md D-07 rejected this explicitly |
| Per-target function pairs | Target-discriminated `{ type, id }` API (chosen) | Per-pair doubles surface and diverges from cache taxonomy |

---

## Architecture Patterns

### System Architecture Diagram

```
[Phase 55 Server Action]
    │ calls getCurrentUser()
    │ passes viewerId down
    ▼
[src/data/reactions.ts]          [src/data/comments.ts]
  getLikesForTarget()              getCommentsForTarget()
  createLike()                     createComment()
  deleteLike()                       │ calls canViewerCommentOnTarget()
                                     │   │ reads watches.status + watches.userId
                                     │   │ calls isMutualFollow()
                                     │   ▼
                                     │ [src/data/follows.ts]
                                     │   isMutualFollow(a, b)
                                     │   single-query: both directions
                                     │
                                     │ throws CommentGateError if gate=false
                                     ▼
[Drizzle db] ──── DATABASE_URL (postgres-js, { prepare: false })
    │   bypasses RLS entirely
    ▼
[Postgres / Supabase Local Docker]
  watch_likes, wear_likes, comments tables (Phase 53)
  follows table (pre-existing)
  watches table (status + userId columns for gate)
```

### Recommended Project Structure

```
src/data/
├── reactions.ts       # NEW: getLikesForTarget, createLike, deleteLike
├── comments.ts        # NEW: getCommentsForTarget, createComment, canViewerCommentOnTarget, class CommentGateError
├── follows.ts         # EDIT: add isMutualFollow(a, b) beside isFollowing
└── __tests__/
    └── reactions-comments-gate.test.ts   # NEW: mocked-db unit tests for isMutualFollow + canViewerCommentOnTarget

tests/integration/
└── phase54-dal-gate.test.ts   # NEW: SEC-02 direct-DAL integration test (localhost-gated)
```

### Pattern 1: Drizzle `db` is the RLS-bypassing path

**What:** `src/db/index.ts` instantiates `drizzle(postgres(DATABASE_URL, { prepare: false }), { schema })`. This client has no Postgres session `role`, so RLS policies are ignored — the query runs as the database owner (or service account). This is why the DAL gate is load-bearing.

**When to use:** All DAL functions in `src/data/` use this `db`. Never use the supabase-js client inside DAL functions; that path is only for test seeding and admin operations.

```typescript
// Source: src/db/index.ts (verified)
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle(client, { schema })
```

### Pattern 2: Row-existence check (isFollowing idiom — template for isMutualFollow)

**What:** One-directional check returning boolean from a `.select({ id }).from().where().limit(1)` query. `isMutualFollow` is a bidirectional sibling — same idiom, but must check both `(a→b)` and `(b→a)` in a single round-trip.

```typescript
// Source: src/data/follows.ts:54-68 (verified)
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

**isMutualFollow single-round-trip idiom (new, for GATE-05):**

The `follows` table is self-referential (both columns reference `users.id`). The column names are `followerId` (Drizzle) / `follower_id` (DB) and `followingId` / `following_id`. A single-query bidirectional check uses a COUNT with two FILTER clauses — same `sql<number>` template pattern established in `follows.ts:148-149`:

```typescript
// Derived pattern — [ASSUMED] query shape; verified against Drizzle sql<T> idiom used in codebase
export async function isMutualFollow(userA: string, userB: string): Promise<boolean> {
  const rows = await db
    .select({
      aToB: sql<number>`count(*) FILTER (WHERE ${follows.followerId} = ${userA} AND ${follows.followingId} = ${userB})::int`,
      bToA: sql<number>`count(*) FILTER (WHERE ${follows.followerId} = ${userB} AND ${follows.followingId} = ${userA})::int`,
    })
    .from(follows)
    .where(
      or(
        and(eq(follows.followerId, userA), eq(follows.followingId, userB)),
        and(eq(follows.followerId, userB), eq(follows.followingId, userA)),
      ),
    )
  const row = rows[0]
  return (row?.aToB ?? 0) >= 1 && (row?.bToA ?? 0) >= 1
}
```

This uses the `or` import already imported in `watches.ts:6` (`import { eq, and, or, ... } from 'drizzle-orm'`). The `follows.ts` file currently imports `{ and, desc, eq, inArray, sql }` — it will need `or` added.

### Pattern 3: onConflictDoNothing for idempotent likes (LIKE-05)

**What:** `createLike` uses the `watch_likes_unique_pair` / `wear_likes_unique_pair` UNIQUE constraints as the backstop; the DAL does not throw on duplicate — it is silently idempotent.

```typescript
// Source: src/data/follows.ts:22-30 (verified template)
await db
  .insert(follows)
  .values({ followerId, followingId })
  .onConflictDoNothing()
```

### Pattern 4: count(*) + bool_or single-query aggregate (D-07)

**What:** `getLikesForTarget` returns `{ count, viewerHasLiked }` in one query. `bool_or` is a Postgres aggregate that returns true if any row matches the condition — not yet used in this codebase, but the `sql<T>` template path is fully established.

```typescript
// Derived pattern — [ASSUMED] exact syntax; Drizzle sql<T> template verified in codebase
const rows = await db
  .select({
    count: sql<number>`count(*)::int`,
    viewerHasLiked: sql<boolean>`bool_or(${watchLikes.userId} = ${viewerId})`,
  })
  .from(watchLikes)
  .where(eq(watchLikes.watchId, targetId))

return {
  count: rows[0]?.count ?? 0,
  viewerHasLiked: rows[0]?.viewerHasLiked ?? false,
}
```

### Pattern 5: Typed error class (UnauthorizedError template for CommentGateError)

**What:** `CommentGateError` is a sibling to `UnauthorizedError`. Same shape: extends Error, sets `this.name`, single-arg message constructor.

```typescript
// Source: src/lib/auth.ts:6-11 (verified)
export class UnauthorizedError extends Error {
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

// CommentGateError — same shape, distinct class for catch discrimination
export class CommentGateError extends Error {
  constructor(message = 'Mutual follow required to comment on wishlist watches') {
    super(message)
    this.name = 'CommentGateError'
  }
}
```

### Pattern 6: DAL invariant doc-comment (D-03)

The doc comment in `comments.ts` must mirror the `assertOwner` CR-01 note at `src/lib/auth.ts:61-69`:

```typescript
// src/data/comments.ts (load-bearing invariant — do not remove)
//
// PRIVACY LAYER NOTE: The comments DAL runs through the Drizzle `db` client,
// which connects directly to Postgres via DATABASE_URL and BYPASSES RLS.
// `canViewerCommentOnTarget()` / `createComment()` is the SOLE enforced gate
// for the wishlist mutual-follow rule — the RLS `comments` policies are
// intentionally left non-functional (fail-closed for non-owners) and act
// only as an anon-block backstop.
//
// KNOWN LANDMINE: Anyone who routes comment reads/writes through an
// RLS-respecting supabase-js client will see ALL non-owner comment operations
// fail closed — not just wishlist — because the Phase 53 RLS SELECT USING
// subquery is purposely non-functional. All comment access MUST go through
// this DAL. See Phase 53 D-07 and Phase 54 D-02 for full rationale.
```

### Pattern 7: ActionResult / DAL-throws convention

**What:** DAL functions throw typed errors (`CommentGateError`, `UnauthorizedError`). Server Actions (Phase 55) return `ActionResult<T>` and catch the throws. The DAL never returns `{ ok: false }` result objects.

```typescript
// Source: src/lib/actionTypes.ts (verified)
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

### Pattern 8: Integration test harness

**What:** Integration tests gate on env var availability, use fixed UUIDs for deterministic cleanup, seed via Drizzle `db.insert` (bypasses RLS), optionally sign in via supabase-js for RLS-respecting path assertions.

Two gating styles coexist in the codebase:

1. **Strict (phase34-rls.test.ts):** `dbUrlIsLocal` — also checks that `DATABASE_URL` contains `localhost` or `127.0.0.1`. Prevents accidental prod runs.
2. **Env-var-only (phase15-wear-detail-gating.test.ts, home-privacy.test.ts):** `process.env.DATABASE_URL ? describe : describe.skip`.

The Phase 54 SEC-02 integration test should use the **strict localhost guard** (same as phase34-rls.test.ts) because it calls the DAL directly and inserts test data — accidental prod execution would be harmful.

```typescript
// Source: tests/integration/phase34-rls.test.ts:19-26 (verified)
const dbUrlIsLocal =
  typeof process.env.DATABASE_URL === 'string' &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))

const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && dbUrlIsLocal
  ? describe : describe.skip
```

For the SEC-02 test specifically, the test will also need `SUPABASE_SERVICE_ROLE_KEY` (for seeding users via `seedTwoUsers`) — so the gate should require that too.

User seeding for integration tests uses `tests/fixtures/users.ts::seedTwoUsers()` which calls `admin.auth.admin.createUser()`. For this phase the fixture needs to seed follows rows (bidirectional and one-directional) and watch rows with status `wishlist`. The test uses Drizzle `db.insert` directly — no supabase-js is needed for seeding.

```typescript
// Source: tests/integration/phase15-wear-detail-gating.test.ts:67-94 (verified pattern)
await db.insert(users).values([{ id: fixedUUID, email: `...@horlo.test` }])
// then update profiles, profileSettings, insert follows, watches
```

### Anti-Patterns to Avoid

- **Calling `isFollowing` twice for isMutualFollow:** Two round-trips when one suffices. The `or` + `FILTER` single-query approach is the correct pattern per GATE-05.
- **Returning `{ comments, gated }` from `getCommentsForTarget`:** Rejected by D-06. Return `Comment[]` only; UI derives gate state from `canViewerCommentOnTarget`.
- **Reusing `UnauthorizedError` for gate rejection:** Rejected by D-05. Distinct `CommentGateError` class is required so Phase 55 action can catch and map to the GATE-03 message without string-matching.
- **Reading session inside DAL functions:** DAL functions take explicit `viewerId`/`authorId` params. Session is resolved by the Server Action calling `getCurrentUser()` and passing the id down.
- **Routing comment writes through supabase-js:** The RLS gate is intentionally fail-closed for non-owners. Always use Drizzle `db` for all comment operations.

---

## Schema Shapes (Verified)

All column identifiers verified against `src/db/schema.ts:314-380`.

### `watchLikes` table (`watch_likes`)

| Drizzle column | DB column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid PK | `defaultRandom()` |
| `userId` | `user_id` | uuid NOT NULL | FK → `users.id` CASCADE |
| `watchId` | `watch_id` | uuid NOT NULL | FK → `watches.id` CASCADE |
| `createdAt` | `created_at` | timestamptz | `defaultNow()` |

Indexes: `watch_likes_unique_pair` UNIQUE on `(userId, watchId)`, `watch_likes_watch_id_idx`, `watch_likes_user_id_idx`.

### `wearLikes` table (`wear_likes`)

| Drizzle column | DB column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid PK | `defaultRandom()` |
| `userId` | `user_id` | uuid NOT NULL | FK → `users.id` CASCADE |
| `wearEventId` | `wear_event_id` | uuid NOT NULL | FK → `wearEvents.id` CASCADE |
| `createdAt` | `created_at` | timestamptz | `defaultNow()` |

Indexes: `wear_likes_unique_pair` UNIQUE on `(userId, wearEventId)`, `wear_likes_wear_event_id_idx`, `wear_likes_user_id_idx`.

### `comments` table

| Drizzle column | DB column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid PK | `defaultRandom()` |
| `authorId` | `author_id` | uuid NOT NULL | FK → `users.id` CASCADE |
| `watchId` | `watch_id` | uuid NULL | FK → `watches.id` CASCADE — exactly one of watchId/wearEventId is non-null (DB CHECK) |
| `wearEventId` | `wear_event_id` | uuid NULL | FK → `wearEvents.id` CASCADE |
| `body` | `body` | text NOT NULL | CHECK: `char_length <= 500 AND non-blank` (in migration) |
| `editedAt` | `edited_at` | timestamptz NULL | Set by `editComment` (Phase 55); null = never edited |
| `createdAt` | `created_at` | timestamptz | `defaultNow()` |
| `updatedAt` | `updated_at` | timestamptz | `defaultNow()` |

Indexes: `comments_watch_id_created_at_idx` on `(watchId, createdAt)`, `comments_wear_event_id_created_at_idx` on `(wearEventId, createdAt)`, `comments_author_id_idx`.

No UNIQUE constraint on comments — intentional (CONTEXT.md D-02 Pitfall 5 note in schema.ts:379).

### `follows` table (existing)

| Drizzle column | DB column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid PK | |
| `followerId` | `follower_id` | uuid NOT NULL | FK → `users.id` CASCADE |
| `followingId` | `following_id` | uuid NOT NULL | FK → `users.id` CASCADE |
| `createdAt` | `created_at` | timestamptz | |

UNIQUE: `follows_unique_pair` on `(followerId, followingId)`. Indexes: `follows_follower_idx`, `follows_following_idx`.

### `watches` table (relevant columns for gate)

| Drizzle column | DB column | Type | Notes |
|---|---|---|---|
| `userId` | `user_id` | uuid NOT NULL | Ownership check for GATE-04 |
| `status` | `status` | text enum | Values: `'owned' | 'wishlist' | 'sold' | 'grail'` — gate applies only when `status = 'wishlist'` |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent likes | Custom duplicate check | `onConflictDoNothing()` + UNIQUE constraint | DB-atomic, race-free |
| RLS bypass | supabase-js + service role | Drizzle `db` (postgres-js + DATABASE_URL) | Established project pattern; service-role client is for admin auth operations only |
| `isMutualFollow` | Two calls to `isFollowing` | Single-query `FILTER (WHERE ...)` count aggregate | Two round-trips wasted; GATE-05 explicitly requires single query |

---

## Common Pitfalls

### Pitfall 1: `bool_or` returns null when group is empty

**What goes wrong:** `SELECT bool_or(...) FROM watch_likes WHERE watch_id = $id` returns a single row with `null` (not `false`) when there are zero likes.
**Why it happens:** SQL aggregates over an empty set return null unless `COALESCE` or a fallback is applied.
**How to avoid:** Use `rows[0]?.viewerHasLiked ?? false` in the mapper. The `count` also needs `?? 0`.
**Warning signs:** `viewerHasLiked` comes back as `null` instead of `false` for watches with no likes.

### Pitfall 2: `canViewerCommentOnTarget` for wear targets

**What goes wrong:** Applying the wishlist gate to wear-event targets. Wear events do not have a `wishlist` status — they are always open (GATE-01).
**Why it happens:** The shared `target: { type: 'watch' | 'wear', id: string }` discriminator routes through one function. The gate only applies when `target.type === 'watch'`.
**How to avoid:** Short-circuit at the top of `canViewerCommentOnTarget`: `if (target.type === 'wear') return true`.

### Pitfall 3: Fetching watch row inside `createComment` separately from `canViewerCommentOnTarget`

**What goes wrong:** `createComment` calls `canViewerCommentOnTarget` (which fetches the watch row), then redundantly fetches the same watch row for the insert — two DB round-trips.
**Why it happens:** Naive separation of concerns.
**How to avoid:** `canViewerCommentOnTarget` can take the watch row directly (optional param), or the gate check and the insert happen in one transaction. At a minimum, do not re-fetch the watch row inside both.

### Pitfall 4: `or` not imported in `follows.ts`

**What goes wrong:** `isMutualFollow` uses `or(...)` which is not currently imported in `follows.ts` (current imports: `{ and, desc, eq, inArray, sql }`).
**Why it happens:** The existing functions only use `and`.
**How to avoid:** Add `or` to the `drizzle-orm` import when adding `isMutualFollow`.

### Pitfall 5: Integration test running against prod DATABASE_URL

**What goes wrong:** CI or a developer with a prod `DATABASE_URL` in env accidentally runs the Phase 54 integration test and inserts test data into prod.
**Why it happens:** The simpler `process.env.DATABASE_URL ? describe : describe.skip` guard does not check the host.
**How to avoid:** Use the `dbUrlIsLocal` guard from `phase34-rls.test.ts` — check that `DATABASE_URL` includes `localhost` or `127.0.0.1`.

### Pitfall 6: Missing `'server-only'` import

**What goes wrong:** `src/data/reactions.ts` or `src/data/comments.ts` omits `import 'server-only'` and the module gets imported by a client component, causing a build error in Next.js.
**Why it happens:** Every file in `src/data/` uses Drizzle `db` which is server-side only. The `'server-only'` guard is the build-time enforcement.
**How to avoid:** First line of every new DAL file must be `import 'server-only'` — matches every other file in `src/data/`.

### Pitfall 7: vitest `jsdom` environment conflicts with server-only code in unit tests

**What goes wrong:** `src/data/__tests__/` tests import DAL files that have `import 'server-only'` — this throws in vitest's jsdom env because `server-only` resolves to a throwing module.
**Why it happens:** `vitest.config.ts` aliases `'server-only'` to `tests/shims/server-only.ts` (empty/no-op shim) — this is already configured and working. No action required.
**Warning signs:** Would see "This module cannot be imported from a Client Component module" error if the alias were missing.

---

## Code Examples

### getLikesForTarget (D-07 — single-query count + viewerHasLiked)

```typescript
// Source: derived from codebase patterns — sql<T> at src/data/follows.ts:148-149 (verified)
// bool_or aggregate: [ASSUMED] exact syntax, pattern compatible with Drizzle sql<T>
import { eq, sql } from 'drizzle-orm'
import { watchLikes, wearLikes } from '@/db/schema'

export interface LikesResult {
  count: number
  viewerHasLiked: boolean
}

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
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
        viewerHasLiked: sql<boolean>`coalesce(bool_or(${wearLikes.userId} = ${viewerId}), false)`,
      })
      .from(wearLikes)
      .where(eq(wearLikes.wearEventId, target.id))
    return { count: rows[0]?.count ?? 0, viewerHasLiked: rows[0]?.viewerHasLiked ?? false }
  }
}
```

Note: `coalesce(bool_or(...), false)` handles the empty-group null case (Pitfall 1).

### isMutualFollow (GATE-05 — single query, both directions)

```typescript
// Source: derived from src/data/follows.ts:148-149 (FILTER pattern verified)
// [ASSUMED] exact or() + FILTER combination — idiom is consistent with codebase
import { and, eq, or, sql } from 'drizzle-orm'
import { follows } from '@/db/schema'

export async function isMutualFollow(
  userA: string,
  userB: string,
): Promise<boolean> {
  const rows = await db
    .select({
      aToB: sql<number>`count(*) FILTER (WHERE ${follows.followerId} = ${userA} AND ${follows.followingId} = ${userB})::int`,
      bToA: sql<number>`count(*) FILTER (WHERE ${follows.followerId} = ${userB} AND ${follows.followingId} = ${userA})::int`,
    })
    .from(follows)
    .where(
      or(
        and(eq(follows.followerId, userA), eq(follows.followingId, userB)),
        and(eq(follows.followerId, userB), eq(follows.followingId, userA)),
      ),
    )
  const row = rows[0]
  return (row?.aToB ?? 0) >= 1 && (row?.bToA ?? 0) >= 1
}
```

### canViewerCommentOnTarget (D-04 — gate predicate)

```typescript
// Source: derived from CONTEXT.md D-04 + D-11 (grandfather: keys off current watch status)
export async function canViewerCommentOnTarget(
  viewerId: string,
  target: { type: 'watch' | 'wear'; id: string },
): Promise<boolean> {
  // Wear targets are always open (GATE-01 — no wishlist concept on wears)
  if (target.type === 'wear') return true

  // Fetch the watch to check status and owner
  const watchRows = await db
    .select({ userId: watches.userId, status: watches.status })
    .from(watches)
    .where(eq(watches.id, target.id))
    .limit(1)

  const watch = watchRows[0]
  if (!watch) return false // watch not found — fail closed

  // Owner always allowed (GATE-04)
  if (viewerId === watch.userId) return true

  // Non-wishlist watches are open to all authenticated users (GATE-01)
  if (watch.status !== 'wishlist') return true

  // Wishlist: requires mutual follow (D-11 grandfather — keys off current status)
  return isMutualFollow(viewerId, watch.userId)
}
```

### SEC-02 integration test structure

```typescript
// Source: tests/integration/phase34-rls.test.ts:19-26 (guard pattern verified)
// Source: tests/integration/phase15-wear-detail-gating.test.ts:63-94 (seeding pattern verified)
const dbUrlIsLocal =
  typeof process.env.DATABASE_URL === 'string' &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))

const maybe =
  process.env.DATABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  dbUrlIsLocal
    ? describe
    : describe.skip

maybe('Phase 54 DAL gate — SEC-02 + GATE-04', () => {
  // Fixed UUIDs for deterministic cleanup
  const ids = {
    owner:     '00000000-0000-0000-0000-0000000054a0',
    mutual:    '00000000-0000-0000-0000-0000000054a1', // follows owner AND owner follows back
    oneWay:    '00000000-0000-0000-0000-0000000054a2', // follows owner, owner does NOT follow back
    stranger:  '00000000-0000-0000-0000-0000000054a3', // no follow relationship
  } as const

  let wishlistWatchId: string

  beforeAll(async () => {
    // 1. Insert users, profiles, profileSettings
    // 2. Insert follows: mutual ↔ owner, oneWay → owner (not owner → oneWay)
    // 3. Insert wishlist watch owned by owner
    // 4. Insert owned watch owned by owner (for non-gated control test)
  })

  afterAll(async () => { /* cleanup all inserted rows */ })

  it('SEC-02: non-mutual-follower calling createComment on wishlist watch throws CommentGateError', async () => {
    await expect(createComment({ authorId: ids.oneWay, target: { type: 'watch', id: wishlistWatchId }, body: 'test' }))
      .rejects.toBeInstanceOf(CommentGateError)
  })

  it('SEC-02: stranger calling createComment on wishlist watch throws CommentGateError', async () => {
    await expect(createComment({ authorId: ids.stranger, target: { type: 'watch', id: wishlistWatchId }, body: 'test' }))
      .rejects.toBeInstanceOf(CommentGateError)
  })

  it('GATE-04: owner can always createComment on own wishlist watch', async () => {
    await expect(createComment({ authorId: ids.owner, target: { type: 'watch', id: wishlistWatchId }, body: 'owner comment' }))
      .resolves.not.toThrow()
  })

  it('GATE-05 / mutual: mutual follower can createComment on wishlist watch', async () => {
    await expect(createComment({ authorId: ids.mutual, target: { type: 'watch', id: wishlistWatchId }, body: 'mutual comment' }))
      .resolves.not.toThrow()
  })

  it('isMutualFollow: returns false when only A→B exists (not B→A)', async () => {
    // oneWay → owner exists; owner → oneWay does not
    await expect(isMutualFollow(ids.oneWay, ids.owner)).resolves.toBe(false)
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dual `isFollowing(a,b)` + `isFollowing(b,a)` calls | Single `isMutualFollow` query (GATE-05) | Phase 54 new | Halves DB round-trips for gate check |
| No comment gating (all authenticated users) | `canViewerCommentOnTarget` DAL gate for wishlist | Phase 54 new | Wishlist privacy guarantee |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `coalesce(bool_or(${watchLikes.userId} = ${viewerId}), false)` is valid Drizzle `sql<boolean>` syntax that executes correctly in Postgres 15 | Code Examples — getLikesForTarget | If wrong: need alternate phrasing (e.g., `CASE WHEN count(*) FILTER (WHERE ...) > 0 THEN true ELSE false END`); same semantic result |
| A2 | `sql<number>\`count(*) FILTER (WHERE ${follows.followerId} = ${userA} ...)\`` with string UUIDs interpolated into Drizzle sql template produces valid parameterized SQL (not raw string injection) | Code Examples — isMutualFollow | If wrong: use `.limit(2)` + two `.where` queries instead; Drizzle docs confirm interpolated values are parameterized — HIGH confidence this is correct |
| A3 | `or` is exported from `drizzle-orm` 0.45.2 and works with the existing import style | Pitfall 4 / Pattern 2 | If wrong: use `sql\`... OR ...\`` raw SQL instead; very low risk — `or` is in drizzle-orm API surface |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

(Three low-risk assumptions logged above; all relate to exact SQL syntax that is verifiable at test time.)

---

## Open Questions

1. **`editComment` / `deleteComment` co-location**
   - What we know: CONTEXT.md marks this as Claude's Discretion — planner decides whether to build full CRUD in `comments.ts` during Phase 54 or leave `editComment`/`deleteComment` to Phase 55.
   - What's unclear: Whether the Phase 55 Server Actions will need the DAL stubs to be present at Phase 54 time for typing purposes.
   - Recommendation: Co-locate `editComment` and `deleteComment` in `comments.ts` since this is the DAL phase and both functions are simpler than `createComment` (no gate check needed — authorship check only).

2. **`toggleLike` DAL helper**
   - What we know: CONTEXT.md marks this as Claude's Discretion.
   - What's unclear: Phase 56 UI shape is not yet designed — the toggle might be better as two separate actions (like / unlike) at the Server Action level.
   - Recommendation: Expose separate `createLike` and `deleteLike` in the DAL; leave toggle composition to Phase 55 action.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 54 is pure TypeScript code/DAL changes with no new external dependencies. Runtime dependencies (Postgres, Supabase local Docker) are pre-existing and were verified operational in Phase 53.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (project-wide) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test -- --reporter=verbose tests/integration/phase54-dal-gate.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GATE-01 | `getCommentsForTarget` returns `[]` for non-mutual on wishlist; returns comments for owned/sold/grail | integration | `npm run test -- tests/integration/phase54-dal-gate.test.ts` | ❌ Wave 0 |
| GATE-04 | Owner can always `createComment` on own wishlist watch | integration | same | ❌ Wave 0 |
| GATE-05 | `isMutualFollow(a,b)` returns false when only A→B exists | integration + unit | `npm run test -- tests/integration/phase54-dal-gate.test.ts src/data/__tests__/reactions-comments-gate.test.ts` | ❌ Wave 0 |
| SEC-02 | `createComment` on wishlist watch throws `CommentGateError` for non-mutual caller (DAL-direct, bypassing RLS) | integration | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- src/data/__tests__/reactions-comments-gate.test.ts` (unit, mocked db — fast)
- **Per wave merge:** `npm run test -- tests/integration/phase54-dal-gate.test.ts` (requires local Supabase Docker)
- **Phase gate:** Full `npm run test` suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/phase54-dal-gate.test.ts` — SEC-02, GATE-04, GATE-05 integration suite
- [ ] `src/data/__tests__/reactions-comments-gate.test.ts` — mocked-db unit tests for `isMutualFollow` (returns false for one-way follow) and `canViewerCommentOnTarget` (all gate branches)

*(Both are new files — no existing infrastructure covers Phase 54 requirements)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirect) | `viewerId` / `authorId` must come from `getCurrentUser()` in the calling Server Action — DAL never reads session |
| V3 Session Management | no | DAL is stateless; session management is in Server Actions (Phase 55) |
| V4 Access Control | yes | `canViewerCommentOnTarget` is the V4 control; `isMutualFollow` is the gate computation |
| V5 Input Validation | partial | Body length validated by DB CHECK (Phase 53); Zod `.strict()` validation is Phase 55 (SEC-03) |
| V6 Cryptography | no | No cryptographic operations in this DAL phase |

### Known Threat Patterns for DAL Gate Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Direct DAL call by non-mutual follower (SEC-02 threat) | Tampering | `canViewerCommentOnTarget` gate in `createComment` — throws `CommentGateError` |
| Routing comment writes through supabase-js (future dev landmine) | Tampering | Doc comment invariant in `comments.ts` (D-03) + RLS fails closed for non-owners |
| IDOR on `deleteLike` / `deleteComment` | Tampering | `deleteLike` WHERE includes `userId = viewerId`; `deleteComment` WHERE includes `authorId = authorId` |
| Self-commenting a wishlist watch owned by viewer (gate bypass attempt) | Elevation of Privilege | GATE-04 owner short-circuit is correct behavior; viewer IS the owner |

---

## Sources

### Primary (HIGH confidence)

- `src/db/schema.ts:314-380` — exact column/table identifiers for `watchLikes`, `wearLikes`, `comments` (verified against live codebase)
- `src/data/follows.ts:1-69` — `isFollowing` idiom, `followUser` onConflictDoNothing, FILTER aggregate pattern (verified)
- `src/lib/auth.ts:6-11, 61-80` — `UnauthorizedError` shape and `assertOwner` doc-comment style (verified)
- `src/db/index.ts` — Drizzle `db` construction confirms RLS-bypass via postgres-js + DATABASE_URL (verified)
- `tests/integration/phase34-rls.test.ts` — localhost guard pattern, Drizzle + supabase-js mix (verified)
- `tests/integration/phase15-wear-detail-gating.test.ts` — fixed-UUID seeding, cleanup pattern, direct DAL call testing (verified)
- `tests/fixtures/users.ts` — `seedTwoUsers` helper shape (verified)
- `vitest.config.ts` — test runner config, `server-only` shim alias, include/exclude patterns (verified)
- `src/lib/actionTypes.ts` — `ActionResult<T>` type (verified)

### Secondary (MEDIUM confidence)

- `src/data/follows.ts:148-149` — `FILTER (WHERE ...)` count aggregate idiom — used as template for `isMutualFollow` single-query design

### Tertiary (LOW confidence / ASSUMED)

- `coalesce(bool_or(...), false)` syntax in Drizzle `sql<boolean>` — inferred from Drizzle sql template idiom; verified pattern is sound but exact output not run in this session (see Assumptions Log A1)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are pre-existing; no new dependencies
- Architecture: HIGH — all decisions locked in CONTEXT.md; verified against live codebase
- Pitfalls: HIGH — derived from verified code patterns and schema inspection
- Exact sql<T> aggregate syntax: MEDIUM — pattern is sound; `bool_or` not yet used in codebase

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable DAL domain; schema is locked post-Phase 53)
