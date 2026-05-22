# Phase 55: Server Actions + Notification Dedup - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 9 (7 source + 2 new test files)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/actions/reactions.ts` | server action | request-response | `src/app/actions/follows.ts` | exact |
| `src/app/actions/comments.ts` | server action | request-response | `src/app/actions/follows.ts` | exact |
| `src/lib/notifications/logger.ts` | utility (edit) | event-driven | itself (existing file) | self-extension |
| `src/lib/notifications/types.ts` | type definition (edit) | — | itself (existing file) | self-extension |
| `src/lib/actionTypes.ts` | type definition (edit) | — | itself (existing file) | self-extension |
| `supabase/migrations/20260522000002_phase55_notif_like_dedup.sql` | migration | batch | `supabase/migrations/20260423000002_phase11_notifications.sql` | exact |
| `src/db/schema.ts` | config/model (no-op likely) | — | itself (existing file) | self-extension |
| `tests/actions/reactions.test.ts` | test | request-response | `tests/actions/follows.test.ts` | exact |
| `tests/actions/comments.test.ts` | test | request-response | `tests/actions/follows.test.ts` | exact |
| `tests/lib/notifications/logger.test.ts` | test (edit) | event-driven | `tests/unit/notifications/logger.test.ts` | exact (file exists) |

---

## Pattern Assignments

### `src/app/actions/reactions.ts` (server action, request-response)

**Analog:** `src/app/actions/follows.ts`

**Imports pattern** (follows.ts lines 1-10):
```typescript
'use server'

import { revalidateTag, updateTag } from 'next/cache'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import { logNotification } from '@/lib/notifications/logger'
import { getProfileById } from '@/data/profiles'
import type { ActionResult } from '@/lib/actionTypes'
// Add: import { getLikesForTarget, createLike, deleteLike } from '@/data/reactions'
// Add: import type { LikeTarget } from '@/data/reactions'
// Add: import { db } from '@/db'
// Add: import { watches, wearEvents } from '@/db/schema'
// Add: import { eq } from 'drizzle-orm'
```

Note: `revalidatePath` is present in follows.ts imports but NOT needed for reactions.ts — the Phase 55 contract uses `revalidateTag` only (D-07). Do not copy `revalidatePath` into reactions.ts.

**Zod schema pattern** (follows.ts line 17):
```typescript
// .strict() is mandatory — rejects extra keys (mass-assignment guard, SEC-03)
const toggleLikeSchema = z.object({
  type: z.enum(['watch', 'wear']),   // DAL discriminator — 'wear' not 'wear_event'
  id: z.string().uuid(),
}).strict()
```

**Auth-first skeleton** (follows.ts lines 19-30):
```typescript
export async function toggleLikeAction(
  data: unknown,
): Promise<ActionResult<{ liked: boolean; count: number }>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = toggleLikeSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    // ... DAL + notification + cache invalidation ...
    return { success: true, data: { liked, count } }
  } catch (err) {
    console.error('[toggleLikeAction] unexpected error:', err)
    return { success: false, error: "Couldn't update like. Try again." }
  }
}
```

**Awaited logNotification + dual-tag invalidation** (follows.ts lines 55-91 — core pattern):
```typescript
// AWAITED — workAsyncStorage torn-down invariant (follows.ts:55-70 rationale)
// Bell refetch races insert if fire-and-forget; logger's internal try/catch prevents throw.
await logNotification({
  type: target.type === 'watch' ? 'watch_like' : 'wear_like',
  recipientUserId: ownerId,
  actorUserId: user.id,
  payload: { /* pre-resolved from actorProfile + watchRow/wearRow */ },
})

// Bell cache on RECIPIENT (follows.ts:77 precedent)
revalidateTag(`viewer:${ownerId}`, 'max')

// Cross-user fan-out — count visible to all viewers (D-07)
revalidateTag(`reactions:${target.type}:${target.id}`, 'max')

// Owner's profile grid count badge (D-07)
revalidateTag(`profile:${ownerProfile.username}`, 'max')

// RYO — actor sees own liked state immediately; updateTag is Server-Action-only (D-07)
updateTag(`viewer:${user.id}:reactions`)
```

**Notification guard** (fire only on `liked === true`, not on unlike):
```typescript
if (liked && ownerId !== user.id) {
  await logNotification({ ... })
  revalidateTag(`viewer:${ownerId}`, 'max')
}
// NOTE: the logger's self-guard at logger.ts:51 catches ownerId === user.id as
// belt-and-suspenders; the explicit check here keeps it readable.
```

---

### `src/app/actions/comments.ts` (server action, request-response)

**Analog:** `src/app/actions/follows.ts`

**Imports pattern** (follows.ts lines 1-10 + additions):
```typescript
'use server'

import { revalidateTag } from 'next/cache'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import { logNotification } from '@/lib/notifications/logger'
import { getProfileById } from '@/data/profiles'
import type { ActionResult } from '@/lib/actionTypes'
import {
  createComment,
  editComment,
  deleteComment,
  CommentGateError,
} from '@/data/comments'
import type { Comment, CommentTarget } from '@/data/comments'
import { db } from '@/db'
import { watches, wearEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'
```

Note: `updateTag` is NOT imported in comments.ts — comment actions only use `revalidateTag('profile:*', 'max')`, not the RYO `updateTag` (D-07, D-06).

**Zod schema pattern** (follows.ts line 17 + CONTEXT.md D-09):
```typescript
const addCommentSchema = z.object({
  type: z.enum(['watch', 'wear']),
  id: z.string().uuid(),
  body: z.string().trim().min(1).max(500), // .trim() BEFORE .min(1) — PITFALLS.md #14
}).strict()

const editCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
}).strict()
// authorId is NOT accepted — derived from getCurrentUser().id server-side (SEC-03)

const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
}).strict()
// authorId is NOT accepted — derived from getCurrentUser().id server-side (SEC-03)
```

**Gate error catch — D-09 discriminated code** (RESEARCH.md architecture pattern):
```typescript
// addCommentAction inner try/catch — catches CommentGateError BEFORE generic catch
try {
  const comment = await createComment({ authorId: user.id, target, body: parsed.data.body })
  // notification + cache invalidation ...
  return { success: true, data: comment }
} catch (err) {
  if (err instanceof CommentGateError) {
    // D-09: structural discriminant — Phase 57 branches without string-matching
    return { success: false, error: err.message, code: 'gate' as const }
  }
  console.error('[addCommentAction] unexpected error:', err)
  return { success: false, error: "Couldn't post comment. Try again." }
}
```

**Comment cache invalidation** (D-06 + D-07 — profile only, NO comments-thread tag):
```typescript
// No comments-thread tag invalidation — D-06: threads are uncached Server Components
// Only the profile grid count badge needs refreshing (D-07)
revalidateTag(`profile:${ownerProfile.username}`, 'max')
```

**Notification fire rule for comments** (INSERT-only per NOTIF-12):
```typescript
// addCommentAction: fire on every non-self insert
if (ownerId !== user.id) {
  await logNotification({
    type: target.type === 'watch' ? 'watch_comment' : 'wear_comment',
    recipientUserId: ownerId,
    actorUserId: user.id,
    payload: { /* pre-resolved; comment_preview = body.slice(0, 120) */ },
  })
  revalidateTag(`viewer:${ownerId}`, 'max')
}
// editCommentAction: NO logNotification call (NOTIF-12 INSERT-only)
// deleteCommentAction: NO logNotification call
```

---

### `src/lib/notifications/logger.ts` (utility, edit)

**Analog:** itself — extend the existing file at `/Users/tylerwaneka/Documents/horlo/src/lib/notifications/logger.ts`

**Union widening** (current lines 34-46 → extend with 4 branches):
```typescript
// Current union (lines 34-46):
export type LogNotificationInput =
  | { type: 'follow'; recipientUserId: string; actorUserId: string; payload: FollowPayload }
  | { type: 'watch_overlap'; recipientUserId: string; actorUserId: string; payload: WatchOverlapPayload }

// Add 4 branches (import the new payload types from './types'):
  | { type: 'watch_like'; recipientUserId: string; actorUserId: string; payload: WatchLikePayload }
  | { type: 'wear_like'; recipientUserId: string; actorUserId: string; payload: WearLikePayload }
  | { type: 'watch_comment'; recipientUserId: string; actorUserId: string; payload: WatchCommentPayload }
  | { type: 'wear_comment'; recipientUserId: string; actorUserId: string; payload: WearCommentPayload }
```

**SELECT extension — opt-out columns** (current lines 55-61 → extend):
```typescript
// Current SELECT (lines 55-61):
const [settings] = await db
  .select({
    notifyOnFollow: profileSettings.notifyOnFollow,
    notifyOnWatchOverlap: profileSettings.notifyOnWatchOverlap,
  })
  .from(profileSettings)
  .where(eq(profileSettings.userId, input.recipientUserId))
  .limit(1)

// Extended SELECT — add notifyOnLike + notifyOnComment
// (columns verified in src/db/schema.ts lines 273-274):
const [settings] = await db
  .select({
    notifyOnFollow: profileSettings.notifyOnFollow,
    notifyOnWatchOverlap: profileSettings.notifyOnWatchOverlap,
    notifyOnLike: profileSettings.notifyOnLike,
    notifyOnComment: profileSettings.notifyOnComment,
  })
  .from(profileSettings)
  .where(eq(profileSettings.userId, input.recipientUserId))
  .limit(1)
```

**Opt-out branch additions** (after current lines 64-68):
```typescript
// Add after existing opt-out checks:
const notifyOnLike    = settings?.notifyOnLike    ?? true
const notifyOnComment = settings?.notifyOnComment ?? true

if ((input.type === 'watch_like' || input.type === 'wear_like') && !notifyOnLike) return
if ((input.type === 'watch_comment' || input.type === 'wear_comment') && !notifyOnComment) return
```

**Raw SQL dedup branches for like types** (model: current lines 70-84 — `watch_overlap` path):
```typescript
// Current watch_overlap raw SQL path (lines 70-84) — the template:
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

// New watch_like path — targets notifications_watch_like_dedup partial UNIQUE:
if (input.type === 'watch_like') {
  await db.execute(sql`
    INSERT INTO notifications (user_id, actor_id, type, payload)
    VALUES (${input.recipientUserId}::uuid, ${input.actorUserId}::uuid, 'watch_like', ${input.payload}::jsonb)
    ON CONFLICT DO NOTHING
  `)
  return
}

// New wear_like path — targets notifications_wear_like_dedup partial UNIQUE:
if (input.type === 'wear_like') {
  await db.execute(sql`
    INSERT INTO notifications (user_id, actor_id, type, payload)
    VALUES (${input.recipientUserId}::uuid, ${input.actorUserId}::uuid, 'wear_like', ${input.payload}::jsonb)
    ON CONFLICT DO NOTHING
  `)
  return
}

// comment types — standard Drizzle insert (no dedup index; each comment is a distinct event):
// watch_comment and wear_comment fall through to the existing Drizzle insert path at lines 86-93
// IF the follow path is generalized, or add explicit branches per comment type using db.insert().
```

---

### `src/lib/notifications/types.ts` (type definition, edit)

**Analog:** itself — extend the existing file at `/Users/tylerwaneka/Documents/horlo/src/lib/notifications/types.ts`

**Current file** (lines 1-24 — full file, 24 lines):
```typescript
export interface FollowPayload { ... }
export interface WatchOverlapPayload { ... }
export type NotificationPayload = FollowPayload | WatchOverlapPayload
```

**4 new interfaces to add** (payload key alignment is load-bearing — must match dedup index expressions exactly):
```typescript
export interface WatchLikePayload {
  actor_username: string
  actor_display_name: string | null
  watch_id: string           // key MUST match: payload->>'watch_id' in notifications_watch_like_dedup
  watch_brand: string
  watch_model: string
}

export interface WearLikePayload {
  actor_username: string
  actor_display_name: string | null
  wear_event_id: string      // key MUST match: payload->>'wear_event_id' in notifications_wear_like_dedup
  watch_brand: string        // the watch worn at this event
  watch_model: string
}

export interface WatchCommentPayload {
  actor_username: string
  actor_display_name: string | null
  watch_id: string
  watch_brand: string
  watch_model: string
  comment_id: string
  comment_preview: string    // body.slice(0, 120)
}

export interface WearCommentPayload {
  actor_username: string
  actor_display_name: string | null
  wear_event_id: string      // column-style name, consistent with WearLikePayload
  watch_brand: string
  watch_model: string
  comment_id: string
  comment_preview: string
}

// Update union type:
export type NotificationPayload =
  | FollowPayload
  | WatchOverlapPayload
  | WatchLikePayload
  | WearLikePayload
  | WatchCommentPayload
  | WearCommentPayload
```

---

### `src/lib/actionTypes.ts` (type definition, edit)

**Analog:** itself — minimal extension at `/Users/tylerwaneka/Documents/horlo/src/lib/actionTypes.ts`

**Current file** (lines 1-7 — full file):
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

**Minimal extension for D-09 `code: 'gate'`** (least-disruptive; preserves existing union identity for all callers that don't check `code`):
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }
```

The `code?: string` option is least-disruptive. A tighter discriminated union (e.g. `code: 'gate' | 'auth' | undefined`) is valid but forces type narrowing at all existing failure-branch callsites. The planner chooses; `code?: string` is the safe default.

---

### `supabase/migrations/20260522000002_phase55_notif_like_dedup.sql` (migration)

**Analog:** `supabase/migrations/20260423000002_phase11_notifications.sql` (lines 80-92 for the partial UNIQUE index pattern) and `supabase/migrations/20260522000001_phase53_notification_enum.sql` (lines 20-41 for non-transactional file + DO $$ assertion).

**Phase 11 dedup index pattern** (lines 80-92 — the template):
```sql
CREATE UNIQUE INDEX IF NOT EXISTS notifications_watch_overlap_dedup
  ON notifications (
    user_id,
    (payload->>'watch_brand_normalized'),
    (payload->>'watch_model_normalized'),
    ((created_at AT TIME ZONE 'UTC')::date)
  )
  WHERE type = 'watch_overlap';
```

**New Phase 55 dedup indexes** — simpler key (actor_id + one payload field, no date bucket):
```sql
-- notifications_watch_like_dedup: one like-notification per (recipient, actor, watch)
-- ON CONFLICT DO NOTHING in logNotification targets this index on re-like after unlike.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_watch_like_dedup
  ON notifications (user_id, actor_id, (payload->>'watch_id'))
  WHERE type = 'watch_like';

-- notifications_wear_like_dedup: one like-notification per (recipient, actor, wear event)
-- payload key is wear_event_id (column-style), NOT 'wear_id' or 'wear_event'.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_wear_like_dedup
  ON notifications (user_id, actor_id, (payload->>'wear_event_id'))
  WHERE type = 'wear_like';
```

**WR-03 fix target** (Phase 53 migration lines 29-41 — the broken assertion to replace):
```sql
-- CURRENT (broken — will fail supabase db reset replay after 7th enum value lands):
DO $$
DECLARE
  enum_count int;
BEGIN
  SELECT count(*) INTO enum_count FROM pg_enum JOIN pg_type ON ...
  WHERE pg_type.typname = 'notification_type';
  IF enum_count <> 6 THEN       -- ← this line is the WR-03 bug
    RAISE EXCEPTION '...';
  END IF;
END $$;

-- CORRECT presence-based replacement:
DO $$
DECLARE
  missing_count int;
BEGIN
  SELECT count(*) INTO missing_count
    FROM (VALUES
      ('watch_like'::text), ('wear_like'::text),
      ('watch_comment'::text), ('wear_comment'::text)
    ) AS expected(val)
    WHERE expected.val NOT IN (
      SELECT pe.enumlabel FROM pg_enum pe
      JOIN pg_type pt ON pe.enumtypid = pt.oid
      WHERE pt.typname = 'notification_type'
    );
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Phase 53 enum migration failed -- % of 4 expected values missing', missing_count;
  END IF;
END $$;
```

**File header note:** Phase 55 migration is a `CREATE UNIQUE INDEX` only (no `ALTER TYPE ADD VALUE`), so it CAN run inside a `BEGIN; ... COMMIT;` transaction (unlike Phase 53 which was non-transactional by necessity). The WR-03 fix is an in-place edit of the Phase 53 migration file — that file does not get a `BEGIN/COMMIT` wrapper added; it keeps its non-transactional shape.

---

### `src/db/schema.ts` (config/model, likely no-op for Phase 55)

The two new dedup indexes are in the raw migration only. Schema.ts represents column shapes for the Drizzle query builder; indexes from raw migrations are not represented in schema.ts (per project convention: "Raw SQL is authoritative for indexes/CHECK/RLS; Drizzle = column shapes only"). No schema.ts change is required for Phase 55.

The `notifyOnLike` and `notifyOnComment` columns are already present in schema.ts at lines 273-274 (verified). No edit needed.

---

### `tests/actions/reactions.test.ts` (test, new file)

**Analog:** `tests/actions/follows.test.ts`

**Mock setup pattern** (follows.test.ts lines 1-39 — copy verbatim, swap module paths):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error { ... },
  getCurrentUser: vi.fn(),
}))

vi.mock('@/data/reactions', () => ({
  getLikesForTarget: vi.fn(),
  createLike: vi.fn(),
  deleteLike: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  // NOTE: revalidatePath is NOT mocked — reactions.ts does not call it
}))

vi.mock('@/lib/notifications/logger', () => ({
  logNotification: vi.fn(() => Promise.resolve()),  // explicit Promise — follows.test.ts:37 pattern
}))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn() }))
vi.mock('@/db', () => ({ db: { select: vi.fn() } }))
vi.mock('@/db/schema', () => ({ watches: {}, wearEvents: {} }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))

import { toggleLikeAction } from '@/app/actions/reactions'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as reactionsDAL from '@/data/reactions'
import { revalidateTag, updateTag } from 'next/cache'
import { logNotification } from '@/lib/notifications/logger'
```

**UUID constants pattern** (follows.test.ts lines 49-50):
```typescript
// Valid v4 UUID literals (M=4, N∈{8,9,a,b}) so z.string().uuid() accepts them.
const viewerUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const watchOwnerId = '11111111-2222-4333-8444-555555555555'
const watchId = '22222222-3333-4444-8555-666666666666'
```

**Key test cases to cover** (from RESEARCH.md validation table):
- SEC-03: unauthenticated → `{ success: false, error: 'Not authenticated' }`, DAL not called
- SEC-03: extra keys rejected via `.strict()` → `{ success: false, error: 'Invalid request' }`
- NOTIF-11: `logNotification` called ONLY when `liked === true` (not on unlike path)
- NOTIF-11: `logNotification` NOT called when actor === owner (self-guard)
- SEC-05: `revalidateTag('reactions:watch:{id}', 'max')` AND `updateTag('viewer:{userId}:reactions')` both called on success
- DAL failure → `{ success: false, error: ... }`, no cache tags fired

---

### `tests/actions/comments.test.ts` (test, new file)

**Analog:** `tests/actions/follows.test.ts`

**Mock setup** (follows.test.ts lines 1-39 — swap module paths):
```typescript
vi.mock('@/data/comments', () => ({
  createComment: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
  CommentGateError: class extends Error {
    constructor(m = 'Mutual follow required') { super(m); this.name = 'CommentGateError' }
  },
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  // NOTE: updateTag is NOT mocked — comments.ts does not call it (D-06/D-07)
}))
```

**Key test cases to cover** (from RESEARCH.md validation table):
- SEC-03: unauthenticated → `{ success: false, error: 'Not authenticated' }`
- SEC-03: `editCommentAction` uses `getCurrentUser().id` as authorId (not from client input)
- NOTIF-12: `addCommentAction` calls `logNotification` on successful insert
- NOTIF-12: `editCommentAction` does NOT call `logNotification`
- D-09: `addCommentAction` returns `{ success: false, error: ..., code: 'gate' }` on `CommentGateError`
- SEC-05: `addCommentAction` calls `revalidateTag('profile:{username}', 'max')` and NOT a comments-thread tag
- `deleteCommentAction` does NOT call `logNotification`

---

### `tests/lib/notifications/logger.test.ts` (test, extend existing file)

**Analog:** itself — the file already exists at `/Users/tylerwaneka/Documents/horlo/tests/unit/notifications/logger.test.ts`

**Existing mock schema** (lines 29-32) — MUST extend to add new columns:
```typescript
// Current mock (line 31):
profileSettings: { userId: 'user_id', notifyOnFollow: 'notify_on_follow', notifyOnWatchOverlap: 'notify_on_watch_overlap' },

// Extended mock — add notifyOnLike + notifyOnComment:
profileSettings: {
  userId: 'user_id',
  notifyOnFollow: 'notify_on_follow',
  notifyOnWatchOverlap: 'notify_on_watch_overlap',
  notifyOnLike: 'notify_on_like',
  notifyOnComment: 'notify_on_comment',
},
```

**Dedup SQL assertion pattern** (RESEARCH.md lines 849-861):
```typescript
it('watch_like: uses db.execute with ON CONFLICT DO NOTHING (NOTIF-14 dedup)', async () => {
  setupSelectChain([{ notifyOnFollow: true, notifyOnWatchOverlap: true, notifyOnLike: true, notifyOnComment: true }])
  ;(db.execute as Mock).mockResolvedValue(undefined)

  await logNotification({
    type: 'watch_like',
    recipientUserId,
    actorUserId,
    payload: { actor_username: 'x', actor_display_name: null, watch_id: watchId, watch_brand: 'Rolex', watch_model: 'Sub' },
  })

  expect(db.execute).toHaveBeenCalledTimes(1)
  expect(db.insert).not.toHaveBeenCalled()
  // Assert the SQL string contains ON CONFLICT DO NOTHING
  const callArg = (db.execute as Mock).mock.calls[0][0]
  expect(String(callArg)).toContain('ON CONFLICT DO NOTHING')
})
```

**Key test cases to add:**
- NOTIF-13: `watch_like` payload includes `watch_id` (not `wear_event_id`)
- NOTIF-13: `wear_like` payload includes `wear_event_id` (not `watch_id`)
- NOTIF-14: `watch_like` uses `db.execute` (raw SQL), not `db.insert` — dedup index path
- NOTIF-14: `wear_like` uses `db.execute` (raw SQL), not `db.insert`
- Opt-out: skips insert when `notifyOnLike === false`
- Opt-out: skips insert when `notifyOnComment === false`
- comment types fall through to `db.insert` (no dedup)

---

## Shared Patterns

### Authentication (applies to all action files)

**Source:** `src/app/actions/follows.ts` lines 19-25
**Apply to:** `reactions.ts`, `comments.ts`
```typescript
let user
try {
  user = await getCurrentUser()
} catch {
  return { success: false, error: 'Not authenticated' }
}
```
`getCurrentUser()` throws `UnauthorizedError`; catch-all without type narrowing is intentional (any auth failure is "not authenticated").

### Zod `.strict()` Mass-Assignment Guard (applies to all action files)

**Source:** `src/app/actions/follows.ts` lines 12-17
**Apply to:** All four action schemas in `reactions.ts` and `comments.ts`
```typescript
// Comment (lines 12-16) documents why .strict() is mandatory:
// The actor-side (followerId / userId / authorId) is NEVER accepted from client
// input — always derived from getCurrentUser().id. .strict() ensures extra keys
// fail fast rather than being silently ignored.
const schema = z.object({ ... }).strict()
const parsed = schema.safeParse(data)
if (!parsed.success) {
  return { success: false, error: 'Invalid request' }
}
```

### Awaited logNotification Before revalidateTag (applies to all actions that notify)

**Source:** `src/app/actions/follows.ts` lines 55-70 (comment block) + line 62 (`await`)
**Apply to:** `reactions.ts` (toggleLikeAction like direction), `comments.ts` (addCommentAction)
```typescript
// Awaited (not fire-and-forget): Next 16 workAsyncStorage is torn down when the
// Server Action returns, so we need the notification insert to complete BEFORE we
// invalidate the recipient's bell cache — otherwise the bell refetch could race
// the insert and re-cache a stale "no unread" state.
// The logger's internal try/catch guarantees it never throws.
await logNotification({ ... })
revalidateTag(`viewer:${recipientId}`, 'max')
```

### Pre-Resolve Actor Profile (caller contract)

**Source:** `src/app/actions/follows.ts` lines 41-44
**Apply to:** `reactions.ts`, `comments.ts`
```typescript
// Pre-resolve actor profile so logNotification has denormalized fields.
// Fetching before the primary commit keeps the logger non-blocking.
const actorProfile = await getProfileById(user.id)
// Then: actorProfile?.username ?? '', actorProfile?.displayName ?? null
```

### Error Handling Pattern (outer catch)

**Source:** `src/app/actions/follows.ts` lines 94-97
**Apply to:** All actions in `reactions.ts` and `comments.ts`
```typescript
} catch (err) {
  console.error('[actionName] unexpected error:', err)
  return { success: false, error: "Couldn't <verb>. Try again." }
}
```
The `console.error` label should be the action function name in brackets.

### ON CONFLICT DO NOTHING Raw SQL (applies to like notification inserts in logger.ts)

**Source:** `src/lib/notifications/logger.ts` lines 70-84
**Apply to:** `watch_like` and `wear_like` branches in extended `logger.ts`

This is the load-bearing dedup pattern. Drizzle's `.onConflictDoNothing()` targets the PK by default — it does NOT trigger partial UNIQUE index conflicts. Bare `ON CONFLICT DO NOTHING` (without a constraint target) checks ALL UNIQUE constraints and indexes in PostgreSQL, including partial ones.

```typescript
// Template from logger.ts:70-84 (watch_overlap branch):
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
```

### Two-Tag Cache Discipline

**Source:** `src/app/actions/follows.ts` lines 77-91
**Apply to:** `reactions.ts` (three tags per D-07), `comments.ts` (one tag per D-07)

| Tag | Function | Semantics | Note |
|-----|----------|-----------|------|
| `revalidateTag(tag, 'max')` | Cross-user fan-out | SWR — stale-while-revalidate | Two-arg form is mandatory (single-arg is deprecated in Next.js 16) |
| `updateTag(tag)` | Read-your-own-writes | Immediate expiry | Server-Action-only; NOT for route handlers |

---

## Naming Reconciliation (LANDMINE — Three Vocabularies)

This is the single most likely source of subtle bugs. Each vocabulary is correct in its context; mixing them produces cache tags that never fire or dedup indexes that are never triggered.

| Vocabulary | Value | Where Used | Source |
|------------|-------|-----------|--------|
| DAL discriminator | `'watch'` or `'wear'` | `LikeTarget.type`, `CommentTarget.type` in `reactions.ts`/`comments.ts` — function parameters | `src/data/reactions.ts` line 17 |
| Cache tag | `reactions:watch:{id}` or `reactions:wear:{id}` | `revalidateTag`/`cacheTag` calls in actions | D-07 (uses DAL discriminator) |
| Notification enum type | `'watch_like'` / `'wear_like'` / `'watch_comment'` / `'wear_comment'` | `logNotification` input type, DB `notification_type` enum | Phase 53 D-09 |
| Dedup index payload key | `watch_id` (for watch_like) | `payload->>'watch_id'` in `notifications_watch_like_dedup` | D-01; must match `WatchLikePayload.watch_id` |
| Dedup index payload key | `wear_event_id` (for wear_like) | `payload->>'wear_event_id'` in `notifications_wear_like_dedup` | D-01; must match `WearLikePayload.wear_event_id` |

**The trap:** ARCHITECTURE.md and prior research docs use `'wear_event'` as the DAL discriminator. This is wrong for this codebase. The Phase 54 DAL uses `'wear'` (verified in `src/data/reactions.ts` line 17 and `src/data/comments.ts` line 31). ARCHITECTURE.md is authoritative for concepts only, not literal discriminator names.

**Concrete test:** If `wear_event_id` is accidentally written as `wear_id` in the `WearLikePayload`, the dedup index `payload->>'wear_event_id'` never extracts a value, so the partial UNIQUE is never triggered, and every re-like after unlike creates a duplicate notification silently.

---

## No Analog Found

All files have strong analogs. No "no analog" entries.

---

## Metadata

**Analog search scope:** `src/app/actions/`, `src/lib/notifications/`, `src/lib/`, `supabase/migrations/`, `tests/actions/`, `tests/unit/notifications/`, `tests/integration/`
**Files scanned:** 15 source files + 4 test files
**Pattern extraction date:** 2026-05-22
