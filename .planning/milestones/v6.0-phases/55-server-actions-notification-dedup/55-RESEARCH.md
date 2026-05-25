# Phase 55: Server Actions + Notification Dedup — Research

**Researched:** 2026-05-22
**Domain:** Next.js 16 Server Actions, PostgreSQL partial UNIQUE indexes, notification deduplication
**Confidence:** HIGH — verified from live codebase, installed Next.js 16 docs, and actual source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: Two per-type partial UNIQUE indexes on `notifications`:
  - `notifications_watch_like_dedup` on `(user_id, actor_id, (payload->>'watch_id')) WHERE type = 'watch_like'`
  - `notifications_wear_like_dedup` on `(user_id, actor_id, (payload->>'wear_event_id')) WHERE type = 'wear_like'`
- **D-02**: Fold WR-03 into this phase's migration. Change the `enum_count <> 6` assertion in Phase 53 migration to assert presence of the 4 Phase 53 values.
- **D-03**: Push to prod in Phase 55 via `supabase db push --linked` (blocking human-action checkpoint).
- **D-04**: One deduped notification row per (actor, target). N likers → N rows.
- **D-05**: Phase 55 owns the groupable data contract (rows stored correctly so Phase 58 can render "X and N others"). NOTIF-13 data shape verified in 55; visible render line in 58.
- **D-06**: Comment threads are uncached (Option A — plain uncached Server Component inside Suspense). Comment actions need NO comments-tag invalidation.
- **D-07**: Full cache-invalidation contract wired in Phase 55:
  - `toggleLikeAction` → `revalidateTag('reactions:{type}:{id}', 'max')` + `updateTag('viewer:{userId}:reactions')` + `revalidateTag('profile:{username}', 'max')`
  - `addCommentAction`/`editCommentAction`/`deleteCommentAction` → `revalidateTag('profile:{username}', 'max')` only
- **D-08**: Actions return server-confirmed rows:
  - `toggleLikeAction` → `ActionResult<{ liked: boolean; count: number }>`
  - `addCommentAction` → `ActionResult<Comment>`
  - `editCommentAction` → `ActionResult<Comment>`
  - `deleteCommentAction` → `ActionResult<{ id: string }>`
- **D-09**: Gate rejection as discriminated error code: `{ success: false, error, code: 'gate' }`. Requires extending `ActionResult` with optional `code` field.

### Carried-forward mechanics (binding, not re-decided)
- Action house pattern mirrors `src/app/actions/follows.ts`: `getCurrentUser()` first → Zod `.strict()` → DAL → **awaited** `logNotification` → `revalidateTag`/`updateTag`
- Notifications are AWAITED (workAsyncStorage torn down on return — see follows.ts:55-70)
- Like notifications fire only on `liked === true` (create direction of toggle)
- Comment notifications fire on INSERT only, never on edit
- Caller pre-resolves notification payload (logger CALLER CONTRACT)
- Bell cache invalidation on recipient: `revalidateTag('viewer:{recipientId}', 'max')`

### Claude's Discretion

- Whether `toggleLikeAction` reads `viewerHasLiked` from `getLikesForTarget` then branches to `createLike`/`deleteLike`, vs a `toggleLike` DAL helper
- Exact `ActionResult` extension shape for `code: 'gate'` discriminant
- Whether WR-03 fix is in-place edit of Phase 53 migration file vs corrective migration
- Zod schema phrasing for each action
- `CREATE INDEX` vs `CREATE INDEX CONCURRENTLY` for dedup indexes
- Migration filename/sequencing

### Deferred Ideas (OUT OF SCOPE)

- "X and N others liked…" render + grouping (Phase 58)
- Settings opt-out toggles UI (Phase 58)
- Comment-thread caching Option B (viewer-scoped)
- Future social work (liker-avatar strip, reply fan-out, email digest, @mentions, threaded replies)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-03 | Like/comment create/edit/delete Server Actions re-verify auth + ownership/authorship server-side (no IDOR, no client-trusted author/target, Zod `.strict()`) | §Action House Pattern — follows.ts structural template verified; `getCurrentUser()` + Zod `.strict()` pattern confirmed in codebase |
| SEC-05 | Viewer-specific like state and gated comment threads do not leak across viewers via the cache | §Cache API Exactness — `updateTag` for RYO + `revalidateTag(..., 'max')` for cross-user fan-out; D-06 no-shared-cache for comments makes it safe by structural absence |
| NOTIF-11 | Owner notified when another user likes their watch/wear (never self-notified) | §Notification Fan-out — `liked===true` guard + self-guard at logger.ts:51 confirmed; like direction check in action |
| NOTIF-12 | Owner notified when another user comments (never self-notified) | §Comment Notification Mechanics — INSERT-only fire; self-guard at logger.ts:51 handles both |
| NOTIF-13 | Like notifications for same target are groupable ("X and N others liked …") | §Data Contract — D-04 one row per (actor, target) with correct `actor_id` + target payload keys; Phase 58 renders |
| NOTIF-14 | Rapid like/unlike churn does not produce duplicate/spam notifications | §Dedup Index Mechanics — partial UNIQUE index + `ON CONFLICT DO NOTHING` raw SQL; `liked===true`-only fire |
</phase_requirements>

---

## Summary

Phase 55 is a pure-backend phase that sits between the Phase 54 DAL and the Phase 56/57 UI. It adds four Zod-validated Server Actions that wrap the already-built DAL, re-verify auth and ownership server-side (anti-IDOR), invalidate the correct cache tags, and fire like/comment notifications with deduplication. The only schema change is one SQL migration adding two partial UNIQUE dedup indexes on `notifications` and fixing the WR-03 enum assertion.

The highest-risk knowledge areas are the Next.js 16 cache API (three separate functions with distinct semantics — confirmed from installed docs), the `ON CONFLICT DO NOTHING` partial-index targeting mechanics (Drizzle's default `.onConflictDoNothing()` hits the PK, not the named partial index — raw SQL required), and the three vocabulary layers that must stay distinct: DAL discriminator (`'watch'|'wear'`), notification enum type (`watch_like`/`wear_like`), and dedup-index payload key (`watch_id`/`wear_event_id`).

All major decisions are locked by CONTEXT.md D-01..D-09. Research focus is implementation-grade detail: exact Next.js 16 API signatures, precise raw-SQL conflict clause mechanics, WR-03 migration fix shape, and the Nyquist test set.

**Primary recommendation:** The four actions are structurally thin — each is an auth-guard + Zod parse + DAL call + notification fire + cache invalidation, cloned from `follows.ts`. The dedup logic entirely lives in the migration (two `CREATE UNIQUE INDEX` statements) and the raw-SQL `ON CONFLICT DO NOTHING` in `logNotification`. Keep the action bodies readable and the migration idempotent.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth re-verification (SEC-03) | API / Server Actions | — | Server Actions are HTTP-callable; client-side trust is IDOR risk |
| Cache invalidation (SEC-05, D-07) | API / Server Actions | — | Must happen after mutation confirms; actions own the full invalidation contract per D-07 |
| Like/unlike toggle logic | API / Server Actions | DAL (reactions.ts) | Action reads `getLikesForTarget` for current state, branches to `createLike`/`deleteLike`; no DAL-level toggle |
| Comment gate enforcement | DAL (comments.ts) | Server Actions (catches CommentGateError) | DAL throws `CommentGateError`; action maps to `code:'gate'` per D-09 |
| Notification dedup | Database (partial UNIQUE index) | logger.ts (ON CONFLICT DO NOTHING) | DB-level enforcement is load-bearing; logger implements the conflict clause |
| Notification fan-out routing | API / Server Actions (caller pre-resolves) | logger.ts (opt-out read + self-guard) | Caller contract: actions fetch actor profile + target owner before calling logger |
| Bell cache invalidation (recipient) | API / Server Actions | — | Must happen after notification insert; follows.ts precedent |
| Dedup index migration | Database migration | — | `CREATE UNIQUE INDEX` + WR-03 fix; pushed to prod this phase (D-03) |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next/cache` (`revalidateTag`, `updateTag`, `cacheTag`) | 16.2.3 (installed) | Cache invalidation from Server Actions | Two-tag discipline established Phase 39c; follows.ts is the template |
| `zod` | `^3` | Input validation + mass-assignment protection | Already used in all existing actions; `.strict()` pattern is project convention |
| `@/lib/notifications/logger` | internal | Notification write path | Extend — union widens 4 branches, two opt-out checks, two like-type `ON CONFLICT` raw SQL paths |
| `@/lib/auth` (`getCurrentUser`) | internal | Server-side auth verification | Throws `UnauthorizedError`; every action catches → returns `{ success: false, error: 'Not authenticated' }` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` `sql` tag | `^0.45` | Raw SQL for `ON CONFLICT DO NOTHING` targeting named partial index | Required for like-type notification inserts; `.onConflictDoNothing()` targets PK, not named index |
| `@/data/profiles` (`getProfileById`) | internal | Resolve actor profile for notification payload | Called pre-DAL in `toggleLikeAction` + comment actions to pre-resolve payload fields |
| `@/data/reactions` (`getLikesForTarget`, `createLike`, `deleteLike`) | internal (Phase 54) | Like state read + toggle write | `getLikesForTarget` for current `viewerHasLiked`; branch to `createLike`/`deleteLike` |
| `@/data/comments` (`createComment`, `editComment`, `deleteComment`) | internal (Phase 54) | Comment writes | Wrapped by comment actions; `createComment` throws `CommentGateError` |

---

## Next.js 16 Cache API — Verified Signatures

**Source:** `/Users/tylerwaneka/Documents/horlo/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md` + `updateTag.md` + `cacheTag.md` [VERIFIED: installed Next.js 16.2.3 docs]

### `revalidateTag(tag, profile)`

```typescript
revalidateTag(tag: string, profile: string | { expire?: number }): void
```

- **`revalidateTag(tag, 'max')`**: Marks entry as stale, serves stale-while-revalidate (SWR). The next visit to a page using that tag fetches fresh data in the background. **This is the correct call for cross-user fan-out** (count visible to all viewers, profile counts).
- **`revalidateTag(tag)`** (single-arg form): **DEPRECATED in Next.js 16**. Currently works if TypeScript errors suppressed, but may be removed. Do NOT use bare single-arg form.
- Can be called from Server Actions AND Route Handlers.
- Does NOT immediately trigger revalidation — invalidation only happens when a page using that tag is next visited.

**Bell-cache invalidation note:** `revalidateTag('viewer:{recipientId}', 'max')` is SWR (stale-while-revalidate). The follows.ts precedent uses this pattern (line 77) for the recipient's bell cache. The notification insert must be AWAITED before this call so the bell refetch sees the insert (workAsyncStorage torn-down invariant from follows.ts:55-70).

### `updateTag(tag)`

```typescript
updateTag(tag: string): void
```

- **Server Actions ONLY** — throws if called in a Route Handler.
- Immediately expires cached data (blocking revalidate, no stale content served).
- **This is the correct call for read-your-own-writes (RYO)** — the actor sees their own like state immediately.
- Used for `viewer:{userId}:reactions` (the actor's own liked state) in D-07.
- Single-argument only (no `profile` parameter).

### `cacheTag(tag)`

```typescript
cacheTag(...tags: string[]): void
```

- Called INSIDE a `'use cache'` function or Server Component to associate tags with the cached entry.
- **Requires `cacheComponents: true`** in `next.config.ts` — confirmed present in this project's `experimental.cacheComponents: true` [VERIFIED: next.config.ts:13].
- Tags created here are what `revalidateTag`/`updateTag` target.
- Phase 56/57 will call `cacheTag('reactions:{type}:{id}')` and `cacheTag('viewer:{userId}:reactions')` inside their cached components; Phase 55 actions write the matching `revalidateTag`/`updateTag` calls. The action contract is complete regardless of whether the cache component exists yet — the invalidation is a no-op until a tagged component is rendered.

### Two-Tag Discipline (Phase 39c D-39c-04, confirmed in follows.ts)

The project uses a documented two-tag discipline (confirmed in `follows.ts:77-91`):

```typescript
// Cross-user fan-out: stale-while-revalidate — data OTHER viewers see
revalidateTag(`reactions:${type}:${id}`, 'max')
revalidateTag(`profile:${ownerUsername}`, 'max')

// Read-your-own-writes: immediate expiry — the ACTOR sees their own state immediately
updateTag(`viewer:${user.id}:reactions`)
```

`revalidateTag` without a profile arg is the deprecated form — always pass `'max'` for cross-user fan-out in Server Actions.

---

## Dedup Index Mechanics — ON CONFLICT DO NOTHING Targeting

**Source:** `src/lib/notifications/logger.ts:70-84` + `supabase/migrations/20260423000002_phase11_notifications.sql:80-92` [VERIFIED: live codebase]

### Why Drizzle's `.onConflictDoNothing()` Is Wrong for This Use Case

Drizzle ORM's default `.onConflictDoNothing()` generates SQL that targets the **primary key constraint** (or the first UNIQUE constraint if specified with `.onConflictDoNothing({ target: col })`). The dedup partial UNIQUE indexes (`notifications_watch_like_dedup`, `notifications_wear_like_dedup`) are **partial indexes** — they only apply when `WHERE type = 'watch_like'` / `'wear_like'`. PostgreSQL requires that `ON CONFLICT` clauses name the exact constraint or index that may be violated. A plain `ON CONFLICT DO NOTHING` without a constraint target will NOT trigger on a partial index conflict in standard PostgreSQL behavior.

**The existing `watch_overlap` pattern is the authoritative precedent** (logger.ts:70-84):

```typescript
// Raw SQL — hits partial UNIQUE `notifications_watch_overlap_dedup`.
// Drizzle's default .onConflictDoNothing() targets the PK, which is wrong here.
await db.execute(sql`
  INSERT INTO notifications (user_id, actor_id, type, payload)
  VALUES (
    ${input.recipientUserId}::uuid,
    ${input.actorUserId}::uuid,
    'watch_overlap',
    ${input.payload}::jsonb
  )
  ON CONFLICT DO NOTHING
`)
```

**Important correction from the codebase:** `ON CONFLICT DO NOTHING` (without `ON CONFLICT ON CONSTRAINT <name>`) actually DOES work with partial UNIQUE indexes in PostgreSQL — PostgreSQL checks ALL unique constraints and indexes for conflicts when `DO NOTHING` is specified without a target. The watch_overlap pattern in logger.ts confirms this: it uses bare `ON CONFLICT DO NOTHING` and the test confirms it hits the named partial index.

The two new like-type inserts must use this same raw SQL pattern (not Drizzle `.insert().onConflictDoNothing()`), because:
1. The existing pattern works and has integration test coverage
2. Drizzle's ORM `.onConflictDoNothing()` generates `ON CONFLICT (column) DO NOTHING` targeting a specific column, not all partial indexes

### New Like Dedup Raw SQL Patterns

```typescript
// watch_like — targets notifications_watch_like_dedup partial UNIQUE
await db.execute(sql`
  INSERT INTO notifications (user_id, actor_id, type, payload)
  VALUES (
    ${input.recipientUserId}::uuid,
    ${input.actorUserId}::uuid,
    'watch_like',
    ${input.payload}::jsonb
  )
  ON CONFLICT DO NOTHING
`)

// wear_like — targets notifications_wear_like_dedup partial UNIQUE
await db.execute(sql`
  INSERT INTO notifications (user_id, actor_id, type, payload)
  VALUES (
    ${input.recipientUserId}::uuid,
    ${input.actorUserId}::uuid,
    'wear_like',
    ${input.payload}::jsonb
  )
  ON CONFLICT DO NOTHING
`)
```

### Migration: Two New Dedup Indexes

Mirror the Phase 11 `notifications_watch_overlap_dedup` pattern exactly [VERIFIED: migration file]:

```sql
-- notifications_watch_like_dedup: one like-notification per (recipient, actor, watch)
-- Semantics: actor can unlike+re-like; only the FIRST like fires a notification.
-- The ON CONFLICT DO NOTHING in logNotification hits this index on re-like.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_watch_like_dedup
  ON notifications (user_id, actor_id, (payload->>'watch_id'))
  WHERE type = 'watch_like';

-- notifications_wear_like_dedup: one like-notification per (recipient, actor, wear event)
CREATE UNIQUE INDEX IF NOT EXISTS notifications_wear_like_dedup
  ON notifications (user_id, actor_id, (payload->>'wear_event_id'))
  WHERE type = 'wear_like';
```

**Why `payload->>'watch_id'` not `payload->>'watch_event_id'`:** The dedup index key must match the exact `payload` key set by the caller. For `watch_like`, the ARCHITECTURE.md payload type is `WatchLikePayload.watch_id`. For `wear_like`, the payload type is `WearLikePayload.wear_event_id` (column-style name, not the DAL discriminator). These are the keys that `payload->>'key'` will extract. If the payload key mismatches, the partial index is never triggered and dedup silently fails. [VERIFIED: ARCHITECTURE.md §3 payload type definitions]

---

## WR-03 Migration Fix — Presence-Based Assertion

**Source:** `supabase/migrations/20260522000001_phase53_notification_enum.sql` [VERIFIED: live codebase]

### Current Broken Assertion (the WR-03 bug)

```sql
-- CURRENT (WRONG): fails supabase db reset replay once a 7th enum value lands
IF enum_count <> 6 THEN
  RAISE EXCEPTION '...expected 6', enum_count;
END IF;
```

### Correct Presence-Based Assertion

```sql
-- CORRECT: asserts the 4 Phase 53 values are present; future 7th/8th values don't break replay
DO $$
DECLARE
  missing_count int;
BEGIN
  SELECT count(*) INTO missing_count
    FROM (VALUES
      ('watch_like'::text),
      ('wear_like'::text),
      ('watch_comment'::text),
      ('wear_comment'::text)
    ) AS expected(val)
    WHERE expected.val NOT IN (
      SELECT pe.enumlabel
      FROM pg_enum pe
      JOIN pg_type pt ON pe.enumtypid = pt.oid
      WHERE pt.typname = 'notification_type'
    );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Phase 53 enum migration failed -- % of 4 expected values missing from notification_type', missing_count;
  END IF;
END $$;
```

### WR-03 Fix Mechanism: In-Place Edit vs Corrective Migration

**`supabase db reset` replay semantics:** `supabase db reset` replays ALL migration files from scratch in filename-sorted order. If Phase 55 adds a new migration file that corrects the Phase 53 assertion, both files run during reset: the Phase 53 file runs its broken assertion (which may pass in reset context since no 7th value exists yet, but will fail eventually), then the Phase 55 file runs a correction. This approach doubles the assertion work and still leaves the brittle assertion in the Phase 53 file.

**In-place edit is correct** for WR-03 because:
1. The Phase 53 migration file is already pushed to prod and applied. Editing it changes the local replay behavior only — it does NOT send new DDL to prod.
2. The assertion is a `DO $$` guard-block, not data-changing DDL. Editing the assertion in place makes `supabase db reset` replay correct immediately.
3. The planner must decide: in-place edit of Phase 53 migration file is the cleaner solution; a corrective migration in Phase 55 is the safer production-safe option. Either works because the assertion block has no prod side-effect (it is a `DO $$` validation block, not a migration statement).

**Recommendation for planner (Claude's Discretion D-02):** Edit the Phase 53 migration file in place. The corrective-migration path adds noise for no benefit — no prod DDL needs running (the assertion block never runs in prod after initial migration apply).

---

## Toggle Logic for `toggleLikeAction`

**Source:** `src/data/reactions.ts` [VERIFIED: live codebase]

The Phase 54 DAL has separate `createLike` and `deleteLike` functions (no combined `toggleLike`). A note in reactions.ts:89 says: "Do NOT add a `toggleLike` helper here — toggle composition is the Phase 55 Server Action's responsibility."

**The action must:**
1. Call `getLikesForTarget(user.id, target)` → `{ count, viewerHasLiked }`
2. Branch: if `viewerHasLiked` → call `deleteLike` → new `liked = false`; else → call `createLike` → new `liked = true`
3. Read `count` after the mutation by calling `getLikesForTarget` again (one extra round-trip) OR compute optimistically (`liked ? count - 1 : count + 1`)
4. Return `{ liked, count }` per D-08

**Simplest correct implementation:**
```typescript
const before = await getLikesForTarget(user.id, target)
if (before.viewerHasLiked) {
  await deleteLike(user.id, target)
  return { liked: false, count: before.count - 1 }
} else {
  await createLike(user.id, target)
  return { liked: true, count: before.count + 1 }
}
```

The optimistic count arithmetic is correct because: `createLike` is idempotent (UNIQUE constraint + `onConflictDoNothing`), and the action serializes (one action at a time per client). A second round-trip to `getLikesForTarget` is also acceptable if the planner prefers server-confirmed counts.

**Notification condition:** `logNotification` is called ONLY when the new `liked === true` (create direction). The `deleteLike` path must NOT call `logNotification`.

---

## Architecture Patterns

### Action House Pattern (Canonical Template)

**Source:** `src/app/actions/follows.ts` [VERIFIED: live codebase]

All four Phase 55 actions mirror this skeleton:

```typescript
'use server'

import { revalidateTag, updateTag } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { logNotification } from '@/lib/notifications/logger'
import { getProfileById } from '@/data/profiles'
import type { ActionResult } from '@/lib/actionTypes'

const toggleLikeSchema = z.object({
  type: z.enum(['watch', 'wear']),
  id: z.string().uuid(),
}).strict()

export async function toggleLikeAction(data: unknown): Promise<ActionResult<{ liked: boolean; count: number }>> {
  // 1. Auth first — never trust client identity
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  // 2. Zod .strict() — rejects any keys beyond declared schema (mass-assignment guard)
  const parsed = toggleLikeSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const target: LikeTarget = { type: parsed.data.type, id: parsed.data.id }

    // 3. Resolve target owner server-side (never trust client-supplied owner id)
    // [fetch watch row or wear_event row to get owner userId, brand, model]

    // 4. Pre-resolve actor profile for notification payload (CALLER CONTRACT)
    const actorProfile = await getProfileById(user.id)

    // 5. Read current state, execute toggle
    const before = await getLikesForTarget(user.id, target)
    if (before.viewerHasLiked) {
      await deleteLike(user.id, target)
    } else {
      await createLike(user.id, target)
    }
    const liked = !before.viewerHasLiked
    const count = liked ? before.count + 1 : before.count - 1

    // 6. Cache invalidation (D-07) — cross-user fan-out first, then RYO
    revalidateTag(`reactions:${target.type}:${target.id}`, 'max')
    revalidateTag(`profile:${ownerUsername}`, 'max')
    updateTag(`viewer:${user.id}:reactions`)

    // 7. Notification — AWAITED (workAsyncStorage torn-down invariant)
    // Fire only on create direction; never self-notify (logger self-guard at :51 handles it)
    if (liked && ownerId !== user.id) {
      await logNotification({
        type: target.type === 'watch' ? 'watch_like' : 'wear_like',
        recipientUserId: ownerId,
        actorUserId: user.id,
        payload: { /* pre-resolved fields */ },
      })
      // Bell cache on RECIPIENT (not viewer) — follows.ts:77 precedent
      revalidateTag(`viewer:${ownerId}`, 'max')
    }

    return { success: true, data: { liked, count } }
  } catch (err) {
    console.error('[toggleLikeAction] unexpected error:', err)
    return { success: false, error: "Couldn't update like. Try again." }
  }
}
```

### Comment Action Gate Error Handling (D-09)

The `addCommentAction` must catch `CommentGateError` specifically before the generic catch, because a gate rejection is a business logic failure (not an unexpected error):

```typescript
try {
  const comment = await createComment({ authorId: user.id, target, body: parsed.data.body })
  // ... notification + cache invalidation ...
  return { success: true, data: comment }
} catch (err) {
  if (err instanceof CommentGateError) {
    // D-09: discriminated code so Phase 57 can branch to GATE-03 CTA without string-matching
    return { success: false, error: err.message, code: 'gate' as const }
  }
  console.error('[addCommentAction] unexpected error:', err)
  return { success: false, error: "Couldn't post comment. Try again." }
}
```

### `ActionResult` Extension for `code: 'gate'`

Current shape in `src/lib/actionTypes.ts`:
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

Minimal extension adding optional `code` (least-disruptive, preserves existing union shape):
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }
```

The planner may prefer a tighter discriminated union. Either works; the `code?: string` option avoids changing the failure-branch type identity for all existing callers that don't check `code`.

### Recommended Project Structure

```
src/
├── app/actions/
│   ├── reactions.ts        # NEW — toggleLikeAction
│   ├── comments.ts         # NEW — addCommentAction, editCommentAction, deleteCommentAction
│   └── follows.ts          # EXISTING template (read-only reference)
├── lib/
│   ├── actionTypes.ts      # EDIT — add optional `code` field to failure branch
│   └── notifications/
│       ├── logger.ts       # EDIT — 4 new union branches + opt-out checks + 2 raw SQL paths
│       └── types.ts        # EDIT — 4 new payload interfaces
└── ...
supabase/migrations/
└── 20260522000002_phase55_notif_like_dedup.sql   # NEW — dedup indexes + WR-03 fix
```

---

## Notification Fan-out — Target Resolution Pattern

**Source:** `src/data/reactions.ts`, `src/data/comments.ts`, `src/db/schema.ts` [VERIFIED: live codebase]

### Owner Resolution for Notifications

The action must resolve the target's owner server-side. Neither `watch_likes` nor `wear_likes` stores the owner — the owner lives on the parent `watches.user_id` or `wear_events.user_id`.

**For `toggleLikeAction`:**
```typescript
import { db } from '@/db'
import { watches, wearEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'

// watch target:
const [watchRow] = await db
  .select({ userId: watches.userId, brand: watches.brand, model: watches.model })
  .from(watches)
  .where(eq(watches.id, target.id))
  .limit(1)
// owner = watchRow.userId
// notification payload: watch_id: target.id, watch_brand: watchRow.brand, watch_model: watchRow.model

// wear target:
const [wearRow] = await db
  .select({ userId: wearEvents.userId, watchId: wearEvents.watchId })
  .from(wearEvents)
  .where(eq(wearEvents.id, target.id))
  .limit(1)
// Then join watches for brand/model using wearRow.watchId
```

For `addCommentAction`, `createComment` already fetches the watch row internally (for gate check). But the action still needs `ownerId` and `brand`/`model` for the notification payload — the action must fetch it independently (or the planner can extend the DAL to return it; simpler to fetch in action).

### `getProfileByUsername` vs. `getProfileById` for Profile Tag

D-07 requires `revalidateTag('profile:{username}', 'max')`. The action has the target's `userId` but needs their `username`. Use `getProfileById(ownerId)` (already imported in follows.ts) and guard on null:

```typescript
const ownerProfile = await getProfileById(ownerId)
if (ownerProfile?.username) {
  revalidateTag(`profile:${ownerProfile.username}`, 'max')
}
```

---

## logger.ts — Extension Points

**Source:** `src/lib/notifications/logger.ts` [VERIFIED: live codebase]

### Union Extension (4 new branches)

The `LogNotificationInput` discriminated union gains 4 branches after importing the new payload types from `./types`:

```typescript
export type LogNotificationInput =
  | { type: 'follow'; recipientUserId: string; actorUserId: string; payload: FollowPayload }
  | { type: 'watch_overlap'; recipientUserId: string; actorUserId: string; payload: WatchOverlapPayload }
  | { type: 'watch_like'; recipientUserId: string; actorUserId: string; payload: WatchLikePayload }
  | { type: 'wear_like'; recipientUserId: string; actorUserId: string; payload: WearLikePayload }
  | { type: 'watch_comment'; recipientUserId: string; actorUserId: string; payload: WatchCommentPayload }
  | { type: 'wear_comment'; recipientUserId: string; actorUserId: string; payload: WearCommentPayload }
```

### Opt-out Branch Extension

The logger currently reads `notifyOnFollow` and `notifyOnWatchOverlap` from `profileSettings`. The `SELECT` must be extended to also read `notifyOnLike` and `notifyOnComment` (added in Phase 53 schema). Then add two new branches after the existing opt-out checks:

```typescript
const notifyOnLike    = settings?.notifyOnLike    ?? true
const notifyOnComment = settings?.notifyOnComment ?? true

if ((input.type === 'watch_like' || input.type === 'wear_like') && !notifyOnLike) return
if ((input.type === 'watch_comment' || input.type === 'wear_comment') && !notifyOnComment) return
```

**Important:** Verify that `notifyOnLike` and `notifyOnComment` columns exist on `profileSettings` in schema.ts before writing this code. CONTEXT.md §canonical_refs cites "Phase 53 D-10 `notify_on_like`/`notify_on_comment` opt-out columns" as added in Phase 53.

### Raw SQL Paths for Like Types

Each like type gets its own raw SQL branch, following the `watch_overlap` shape at logger.ts:70-84:

```typescript
if (input.type === 'watch_like') {
  await db.execute(sql`
    INSERT INTO notifications (user_id, actor_id, type, payload)
    VALUES (${input.recipientUserId}::uuid, ${input.actorUserId}::uuid, 'watch_like', ${input.payload}::jsonb)
    ON CONFLICT DO NOTHING
  `)
  return
}

if (input.type === 'wear_like') {
  await db.execute(sql`
    INSERT INTO notifications (user_id, actor_id, type, payload)
    VALUES (${input.recipientUserId}::uuid, ${input.actorUserId}::uuid, 'wear_like', ${input.payload}::jsonb)
    ON CONFLICT DO NOTHING
  `)
  return
}
```

Comment types (`watch_comment`, `wear_comment`) use the standard Drizzle `.insert()` (no dedup index, each comment is a distinct event):

```typescript
await db.insert(notifications).values({
  userId: input.recipientUserId,
  actorId: input.actorUserId,
  type: input.type, // 'watch_comment' or 'wear_comment'
  payload: input.payload,
})
```

---

## Notification Payload Types — New Interfaces

**Source:** `src/lib/notifications/types.ts` (current) + ARCHITECTURE.md §3 [VERIFIED: live codebase]

Add to `src/lib/notifications/types.ts`:

```typescript
export interface WatchLikePayload {
  actor_username: string
  actor_display_name: string | null
  watch_id: string           // ← must match dedup index key (payload->>'watch_id')
  watch_brand: string
  watch_model: string
}

export interface WearLikePayload {
  actor_username: string
  actor_display_name: string | null
  wear_event_id: string      // ← must match dedup index key (payload->>'wear_event_id')
  watch_brand: string
  watch_model: string
}

export interface WatchCommentPayload {
  actor_username: string
  actor_display_name: string | null
  watch_id: string
  watch_brand: string
  watch_model: string
  comment_id: string
  comment_preview: string    // first 120 chars of comment body
}

export interface WearCommentPayload {
  actor_username: string
  actor_display_name: string | null
  wear_event_id: string
  watch_brand: string
  watch_model: string
  comment_id: string
  comment_preview: string
}

// Update the union type
export type NotificationPayload =
  | FollowPayload
  | WatchOverlapPayload
  | WatchLikePayload
  | WearLikePayload
  | WatchCommentPayload
  | WearCommentPayload
```

**Critical payload key alignment:** `wear_event_id` (not `wear_id`, not `wear_event_uuid`) must exactly match the dedup index expression `payload->>'wear_event_id'`. One of the easiest places to introduce the `'wear'` vs `'wear_event'` vocabulary confusion.

---

## Naming Reconciliation (LANDMINE — Three Vocabularies)

**Source:** CONTEXT.md §"Naming reconciliation" + reactions.ts + schema.ts [VERIFIED: live codebase]

| Context | Value | Where Used |
|---------|-------|-----------|
| DAL discriminator (`LikeTarget.type`, `CommentTarget.type`) | `'watch'` or `'wear'` | `reactions.ts`, `comments.ts` — the function parameter |
| Cache tag | `reactions:watch:{id}` or `reactions:wear:{id}` | `revalidateTag`/`cacheTag` calls — uses DAL discriminator |
| Notification enum type | `'watch_like'` or `'wear_like'` or `'watch_comment'` or `'wear_comment'` | `logNotification` input type, DB `notification_type` enum |
| Dedup index payload key | `watch_id` (for watch_like) or `wear_event_id` (for wear_like) | `payload->>'watch_id'` / `payload->>'wear_event_id'` in SQL |

**The trap:** ARCHITECTURE.md §3 (written before Phase 53/54) uses `'wear_event'` as the DAL discriminator and `reactions:wear_event:{id}` as the cache tag. Both are WRONG for this codebase. The Phase 54 DAL uses `'wear'` (not `'wear_event'`). The ARCHITECTURE.md is research for *concepts*, not literal names.

---

## Zod Schema Design

**Source:** follows.ts Zod patterns + CONTEXT.md D-09 [VERIFIED: live codebase]

```typescript
// toggleLikeAction
const toggleLikeSchema = z.object({
  type: z.enum(['watch', 'wear']),
  id: z.string().uuid(),
}).strict()

// addCommentAction
const addCommentSchema = z.object({
  type: z.enum(['watch', 'wear']),
  id: z.string().uuid(),
  body: z.string().trim().min(1).max(500), // .trim() before .min(1) — Pitfall 14 in PITFALLS.md
}).strict()

// editCommentAction
const editCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
}).strict()
// NOTE: authorId is NOT accepted from client — derived from getCurrentUser().id server-side

// deleteCommentAction
const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
}).strict()
// NOTE: authorId is NOT accepted from client — derived from getCurrentUser().id server-side
```

**Body max of 500** matches the DB CHECK constraint from Phase 53 D-04 and REQUIREMENTS.md CMNT-04.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Notification dedup | Application-layer duplicate check (pre-insert SELECT) | `ON CONFLICT DO NOTHING` + partial UNIQUE index | DB-atomic; no TOCTOU race; one round-trip |
| Like idempotency | Application-layer "is liked?" guard before insert | DAL `createLike` already uses `.onConflictDoNothing()` on the UNIQUE pair | Already correct — just call createLike |
| Auth in Server Actions | Manual session token parsing | `getCurrentUser()` from `@/lib/auth` | Memoized via React `cache()`, one round-trip per request; throws `UnauthorizedError` |
| Enum string-matching for gate errors | `if (err.message.includes('mutual follow'))` | `instanceof CommentGateError` | Structural check — brittle strings break on message copy changes |
| Toggle DAL helper | `toggleLike` wrapper in reactions.ts | `getLikesForTarget` + conditional `createLike`/`deleteLike` in the action | DAL note at reactions.ts:89 explicitly says not to build toggle in DAL; toggle composition is the action's job |

---

## Common Pitfalls

### Pitfall 1: Wrong payload key in dedup index vs. payload object
**What goes wrong:** Dedup index uses `payload->>'wear_event_id'` but payload object was built with key `wear_id` (because the DAL discriminator is `'wear'`). The partial index never fires; every re-like after unlike creates a duplicate notification.
**How to avoid:** The payload interface defines the key; the index expression must exactly match. `WearLikePayload.wear_event_id` → `payload->>'wear_event_id'`. Run the dedup test (rapid like/unlike → 1 notification) immediately after migration.
**Warning signs:** Rapid-churn test produces > 1 notification row.

### Pitfall 2: Single-arg `revalidateTag` (deprecated form)
**What goes wrong:** `revalidateTag('reactions:watch:123')` (no second arg) is deprecated in Next.js 16. TypeScript suppresses the error; behavior may change in a future version.
**How to avoid:** Always `revalidateTag(tag, 'max')` for cross-user fan-out. The installed docs confirm this explicitly. [VERIFIED: revalidateTag.md]
**Warning signs:** TypeScript error (if strict); existing follows.ts uses the two-arg form correctly.

### Pitfall 3: Calling `updateTag` outside Server Actions
**What goes wrong:** `updateTag` called in a Route Handler throws at runtime.
**How to avoid:** `updateTag` is Server-Action-only. Phase 55 actions are all `'use server'` — this is correct context. Do not move cache invalidation to Route Handlers.

### Pitfall 4: Notification insert not awaited before revalidateTag
**What goes wrong:** `void logNotification(...)` (fire-and-forget) → `revalidateTag('viewer:{recipientId}', 'max')` → bell refetch races the insert; recipient may see stale "0 unread" for up to the SWR TTL.
**How to avoid:** `await logNotification(...)` before `revalidateTag`. The logger's internal try/catch guarantees it never throws to the caller. This is the follows.ts:55-70 rationale, documented verbatim.

### Pitfall 5: Calling `logNotification` on the `deleteLike` path
**What goes wrong:** `toggleLikeAction` fires notification on BOTH like and unlike; watch owner gets "X liked your watch" when X actually unliked.
**How to avoid:** `if (liked && ownerId !== user.id) { await logNotification(...) }`. The `liked` flag from the toggle result determines direction. Logger's self-guard covers the `ownerId === user.id` case.

### Pitfall 6: Calling `logNotification` on `editComment`
**What goes wrong:** `editCommentAction` fires a `watch_comment` notification; watch owner gets "X commented" for every edit, even if they've already seen the original comment.
**How to avoid:** `addCommentAction` calls `logNotification`; `editCommentAction` and `deleteCommentAction` do NOT.

### Pitfall 7: Client-supplied `authorId` in comment edit/delete
**What goes wrong:** `editCommentAction` accepts `authorId` from client input. Client can forge any `authorId` and edit any comment.
**How to avoid:** `authorId` is always `getCurrentUser().id` server-side. The Zod schemas for edit/delete accept only `commentId` (and `body` for edit). The DAL `editComment(authorId, commentId, body)` and `deleteComment(authorId, commentId)` already include the authorship `WHERE` clause for the second layer.

### Pitfall 8: `notify_on_like`/`notify_on_comment` column not yet in logger's SELECT
**What goes wrong:** The logger reads `notifyOnFollow` and `notifyOnWatchOverlap` from `profileSettings`. The Phase 53 D-10 columns `notifyOnLike`/`notifyOnComment` are in schema.ts but the logger's `SELECT` only fetches the old columns. Extension fails at TypeScript level or silently defaults to `null ?? true` (always notifies).
**How to avoid:** The logger's `db.select({...}).from(profileSettings)` must be extended to include `notifyOnLike: profileSettings.notifyOnLike, notifyOnComment: profileSettings.notifyOnComment`. Verify these columns exist in schema.ts before writing the extension.

---

## Code Examples

### Phase 11 Dedup Index Pattern (Migration Precedent)

```sql
-- Source: supabase/migrations/20260423000002_phase11_notifications.sql:80-92
CREATE UNIQUE INDEX IF NOT EXISTS notifications_watch_overlap_dedup
  ON notifications (
    user_id,
    (payload->>'watch_brand_normalized'),
    (payload->>'watch_model_normalized'),
    ((created_at AT TIME ZONE 'UTC')::date)
  )
  WHERE type = 'watch_overlap';
```

The Phase 55 indexes use a simpler key (actor_id + payload target ID), no date bucket.

### Existing ON CONFLICT DO NOTHING Pattern (logger.ts:70-84)

```typescript
// Source: src/lib/notifications/logger.ts:70-84
if (input.type === 'watch_overlap') {
  await db.execute(sql`
    INSERT INTO notifications (user_id, actor_id, type, payload)
    VALUES (
      ${input.recipientUserId}::uuid,
      ${input.actorUserId}::uuid,
      'watch_overlap',
      ${input.payload}::jsonb
    )
    ON CONFLICT DO NOTHING
  `)
  return
}
```

### follows.ts Awaited logNotification + Dual Invalidation Pattern

```typescript
// Source: src/app/actions/follows.ts:62-91
await logNotification({ type: 'follow', recipientUserId: ..., actorUserId: ..., payload: {...} })
revalidateTag(`viewer:${parsed.data.userId}`, 'max')
const targetProfile = await getProfileById(parsed.data.userId)
if (targetProfile?.username) {
  revalidateTag(`profile:${targetProfile.username}`, 'max')
}
updateTag(`viewer:${user.id}:profile:${parsed.data.userId}`)
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 55 is code/config changes only (Server Actions, logger extension, SQL migration). No new external tool dependencies beyond the existing project stack (`supabase` CLI for prod push, already established from Phase 53-03). The `supabase db push --linked` prod-push step is a blocking human checkpoint, not an automated environment dependency.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` (vitest run) |
| Full suite command | `npm test` |
| Integration tests | `tests/integration/` (separate; require live DB) |

### Critical Behaviors → Test Map

| Req ID | Behavior | Test Type | Test File | Automated Command | File Exists? |
|--------|----------|-----------|-----------|-------------------|-------------|
| SEC-03 | `toggleLikeAction` returns `{success:false, error:'Not authenticated'}` when `getCurrentUser` throws | unit | `tests/actions/reactions.test.ts` | `npm test -- reactions.test.ts` | Wave 0 |
| SEC-03 | `toggleLikeAction` rejects payload with extra keys (Zod `.strict()`) | unit | `tests/actions/reactions.test.ts` | `npm test -- reactions.test.ts` | Wave 0 |
| SEC-03 | `addCommentAction` rejects unauthenticated caller | unit | `tests/actions/comments.test.ts` | `npm test -- comments.test.ts` | Wave 0 |
| SEC-03 | `editCommentAction` uses `getCurrentUser().id` as authorId, NOT client-supplied authorId | unit | `tests/actions/comments.test.ts` | `npm test -- comments.test.ts` | Wave 0 |
| NOTIF-11 | `toggleLikeAction` calls `logNotification` ONLY when `liked===true` (not on unlike) | unit | `tests/actions/reactions.test.ts` | `npm test -- reactions.test.ts` | Wave 0 |
| NOTIF-11 | `toggleLikeAction` does NOT call `logNotification` when actor === target owner (self-guard) | unit | `tests/actions/reactions.test.ts` | `npm test -- reactions.test.ts` | Wave 0 |
| NOTIF-12 | `addCommentAction` calls `logNotification` on successful insert | unit | `tests/actions/comments.test.ts` | `npm test -- comments.test.ts` | Wave 0 |
| NOTIF-12 | `editCommentAction` does NOT call `logNotification` (comment notifications INSERT-only) | unit | `tests/actions/comments.test.ts` | `npm test -- comments.test.ts` | Wave 0 |
| NOTIF-13 | `logNotification` for `watch_like` includes `watch_id` in payload (not `wear_event_id`) | unit | `tests/lib/notifications/logger.test.ts` | `npm test -- logger.test.ts` | ❌ Wave 0 (new file) |
| NOTIF-13 | `logNotification` for `wear_like` includes `wear_event_id` in payload (not `watch_id`) | unit | `tests/lib/notifications/logger.test.ts` | `npm test -- logger.test.ts` | ❌ Wave 0 (new file) |
| NOTIF-14 | Rapid like→unlike→like produces at most 1 notification row (dedup index idempotency) | unit | `tests/lib/notifications/logger.test.ts` | `npm test -- logger.test.ts` | ❌ Wave 0 (new file) |
| SEC-05 | `toggleLikeAction` calls both `revalidateTag(..., 'max')` AND `updateTag(viewer:*:reactions)` | unit | `tests/actions/reactions.test.ts` | `npm test -- reactions.test.ts` | Wave 0 |
| SEC-05 | `addCommentAction` calls `revalidateTag('profile:*', 'max')` and NOT a comments-thread tag | unit | `tests/actions/comments.test.ts` | `npm test -- comments.test.ts` | Wave 0 |
| D-09 | `addCommentAction` returns `{success:false, error:..., code:'gate'}` on `CommentGateError` | unit | `tests/actions/comments.test.ts` | `npm test -- comments.test.ts` | Wave 0 |

### Dedup Test Pattern (logger.test.ts — Wave 0 Gap)

The dedup test for NOTIF-14 must verify the `ON CONFLICT DO NOTHING` behavior. Since the dedup is DB-enforced, the unit test must mock the `db.execute` call and assert the SQL contains `ON CONFLICT DO NOTHING`, OR use an integration test against a real DB. The preferred approach (matches existing pattern in `phase11-notifications-rls.test.ts`):

```typescript
// tests/lib/notifications/logger.test.ts (NEW)
it('watch_like: ON CONFLICT DO NOTHING is present in the SQL — dedup index idempotency', async () => {
  const executeSpy = vi.spyOn(db, 'execute').mockResolvedValue([])
  await logNotification({
    type: 'watch_like',
    recipientUserId: 'recipient-uuid',
    actorUserId: 'actor-uuid',
    payload: { actor_username: 'x', actor_display_name: null, watch_id: 'watch-uuid', watch_brand: 'Rolex', watch_model: 'Sub' },
  })
  // Assert the SQL string contains ON CONFLICT DO NOTHING
  const callArg = executeSpy.mock.calls[0][0]
  expect(String(callArg)).toContain('ON CONFLICT DO NOTHING')
})
```

### Sampling Rate

- **Per task commit:** `npm test -- reactions.test.ts comments.test.ts logger.test.ts` (targeted fast loop)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/actions/reactions.test.ts` — covers SEC-03, NOTIF-11, SEC-05 for `toggleLikeAction`
- [ ] `tests/actions/comments.test.ts` — covers SEC-03, NOTIF-12, SEC-05, D-09 for comment actions
- [ ] `tests/lib/notifications/logger.test.ts` — covers NOTIF-13, NOTIF-14 (new file; existing logger tests are embedded in integration tests or nonexistent)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` first in every action; catch → `{success:false, error:'Not authenticated'}` |
| V3 Session Management | no | Session managed by Supabase Auth; no action-level session state |
| V4 Access Control | yes | Server-side owner/authorship resolution; `authorId = getCurrentUser().id` never from client; `CommentGateError` as discriminated gate |
| V5 Input Validation | yes | Zod `.strict()` on every action; `.trim().min(1).max(500)` on body; `.string().uuid()` on all IDs |
| V6 Cryptography | no | No cryptographic operations in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on comment edit/delete (client forges commentId) | Tampering | `getCurrentUser().id` as authorId; DAL `WHERE authorId = caller` as second layer (already in Phase 54 `editComment`/`deleteComment`) |
| Mass-assignment (extra fields in action payload) | Tampering | Zod `.strict()` rejects extra keys |
| Notification spam via rapid like/unlike churn | Denial of Service (inbox) | `liked===true`-only fire + partial UNIQUE dedup index + `ON CONFLICT DO NOTHING` |
| Cross-viewer like-state leak via shared cache | Information Disclosure | `updateTag('viewer:{userId}:reactions')` scopes viewer state; `revalidateTag(..., 'max')` is cross-user for counts only |
| Comment gate bypass (non-mutual follower commenting on wishlist watch) | Tampering | DAL `createComment` throws `CommentGateError` (Phase 54 load-bearing gate); action catches and maps to `code:'gate'`; no second comment-gate check needed in action (DAL owns it) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `notify_on_like` and `notify_on_comment` columns exist on `profileSettings` in schema.ts (from Phase 53 D-10) | logger.ts Extension | If columns not present, logger SELECT will TypeScript-error; planner must verify schema.ts before writing the extension |
| A2 | `wearEvents.userId` column exists in schema and stores the wear event owner's user_id | Target Resolution | If the column is named differently, the owner-resolution fetch in `toggleLikeAction` for wear targets will fail |

**All other claims in this research were verified from the live codebase or installed Next.js 16 docs.**

---

## Open Questions

1. **WR-03: In-place edit vs. corrective migration**
   - What we know: D-02 says "fix the assertion"; both approaches are semantically equivalent at reset time; in-place edit is cleaner
   - What's unclear: Whether the planner has a strong preference for one over the other
   - Recommendation: In-place edit of the Phase 53 migration file. The assertion block has no prod side-effect; it runs only during `supabase db reset` replay.

2. **Comment preview truncation length**
   - What we know: ARCHITECTURE.md §3 says "first 120 chars" for `comment_preview`
   - What's unclear: Whether 120 chars is a locked decision or a suggestion
   - Recommendation: Use `body.slice(0, 120)` in the action before calling `logNotification`. The Phase 58 render will truncate at its own display width anyway.

---

## Sources

### Primary (HIGH confidence — verified from live codebase and installed docs)
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md` — exact `revalidateTag(tag, profile)` signature; deprecation of single-arg form confirmed
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` — Server-Action-only constraint; immediate expiry semantics; single-arg only
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md` — `cacheComponents: true` requirement confirmed
- `src/app/actions/follows.ts` — canonical action house pattern; `revalidateTag('viewer:X', 'max')` + `updateTag('viewer:X:profile:Y')` two-tag discipline; awaited `logNotification`
- `src/lib/notifications/logger.ts` — `ON CONFLICT DO NOTHING` pattern; union shape; opt-out read; self-guard
- `src/lib/actionTypes.ts` — current `ActionResult<T>` shape
- `src/data/reactions.ts` — `LikeTarget = {type:'watch'|'wear'; id}` confirmed; `getLikesForTarget`/`createLike`/`deleteLike` signatures; toggle-in-action note at line 89
- `src/data/comments.ts` — `CommentTarget = {type:'watch'|'wear'; id}`; `CommentGateError` class; `createComment` throws gate error
- `src/db/schema.ts` — `watchLikes.watchId`, `wearLikes.wearEventId`, `watches.userId`, `watches.brand/model` columns confirmed
- `src/lib/auth.ts` — `getCurrentUser()` returns `{id,email}`; `UnauthorizedError` class
- `supabase/migrations/20260423000002_phase11_notifications.sql` — dedup partial UNIQUE index pattern; `ON CONFLICT DO NOTHING` precedent
- `supabase/migrations/20260522000001_phase53_notification_enum.sql` — WR-03 target: `enum_count <> 6` assertion
- `next.config.ts` — `experimental.cacheComponents: true` confirmed
- `vitest.config.ts` — test framework config; `server-only` shim confirmed
- `tests/actions/follows.test.ts` — action test scaffold pattern (vi.mock for next/cache, getCurrentUser, DAL, logNotification)
- `tests/actions/notifications.test.ts` — `updateTag` vs `revalidateTag` distinction tested

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — notification payload type shapes (concepts valid; `'wear_event'` discriminator is obsolete)
- `.planning/research/PITFALLS.md` — pitfalls 5, 6, 13 relevant to Phase 55

---

## Metadata

**Confidence breakdown:**
- Cache API exactness: HIGH — verified from installed Next.js 16.2.3 docs and existing follows.ts usage
- Dedup index mechanics: HIGH — verified from Phase 11 migration + logger.ts existing pattern
- WR-03 fix: HIGH — source file read; fix shape derived from PostgreSQL `pg_enum` system catalog semantics
- Action structure: HIGH — follows.ts is the authoritative template; fully readable
- Pitfalls: HIGH — derived from live codebase incident history and existing test patterns

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable APIs; Next.js 16.2.3 pinned in package.json)
