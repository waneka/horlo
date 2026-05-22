# Architecture Research

**Domain:** v6.0 Social Interaction — likes + comments on watches and wear events
**Researched:** 2026-05-22
**Confidence:** HIGH — decisions derived directly from reading the existing codebase (schema.ts, DAL files, notifications logger, follows action)

---

## 1. DATA MODEL DECISION

### Recommendation: Two Polymorphic Tables (reactions + comments)

Use a single `reactions` table and a single `comments` table, each with `(target_type, target_id)` polymorphism. Do NOT use per-target tables.

**Rationale:**

Horlo already uses this pattern implicitly: `activities.type` is a text discriminator and `activities.metadata` is polymorphic jsonb. `notifications.type` is a pgEnum discriminator with polymorphic jsonb payload. The DAL is comfortable with discriminated-type queries; adding a `target_type` column is no more complex.

Per-target tables (e.g. `watch_likes` + `wear_event_likes`) would require:
- Separate RLS policies for each table (doubles the policy surface)
- Separate DAL functions for count queries
- Two nearly-identical Server Actions

The FK-integrity tradeoff is the honest cost of polymorphism. Postgres does not support a true polymorphic FK. The mitigation is a CHECK constraint on `target_type` to lock valid values, and application-layer enforcement in the DAL. Both target tables (`watches`, `wear_events`) are well-established; a comment or reaction pointing at a deleted watch row should cascade-delete. Use soft-orphan filtering at read time with an INNER JOIN on the target table. At MVP scale (<500 watches/user) this is fine.

### Drizzle / SQL Sketch

```typescript
// src/db/schema.ts additions

export const reactionTargetTypeEnum = pgEnum('reaction_target_type', [
  'watch',
  'wear_event',
] as const)

export const commentTargetTypeEnum = pgEnum('comment_target_type', [
  'watch',
  'wear_event',
] as const)

export const reactions = pgTable(
  'reactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    targetType: reactionTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(), // watches.id or wear_events.id
    // 'like' is the only reaction type now; column exists for forward-compat
    reactionType: text('reaction_type', { enum: ['like'] }).notNull().default('like'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Dedup: one reaction per (actor, target_type, target_id, reaction_type)
    unique('reactions_unique').on(
      table.actorId,
      table.targetType,
      table.targetId,
      table.reactionType,
    ),
    index('reactions_target_idx').on(table.targetType, table.targetId),
    index('reactions_actor_idx').on(table.actorId),
  ],
)

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    targetType: commentTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(), // watches.id or wear_events.id
    body: text('body').notNull(),
    // editedAt is NULL until the author edits; surfaces "edited" badge in UI
    editedAt: timestamp('edited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('comments_target_idx').on(table.targetType, table.targetId),
    index('comments_author_idx').on(table.authorId),
  ],
)
```

**Raw SQL migration additions (live in supabase/migrations — not expressible in Drizzle 0.45.2):**

```sql
-- CHECK constraint locks valid target_type values (defense in depth)
ALTER TABLE reactions ADD CONSTRAINT reactions_target_type_check
  CHECK (target_type IN ('watch', 'wear_event'));

ALTER TABLE comments ADD CONSTRAINT comments_target_type_check
  CHECK (target_type IN ('watch', 'wear_event'));

-- CHECK: body must be non-empty, max 2000 chars
ALTER TABLE comments ADD CONSTRAINT comments_body_length_check
  CHECK (length(body) BETWEEN 1 AND 2000);
```

---

## 2. RLS DESIGN

### The Asymmetry Problem

Likes: open (any authed user, any watch status, any wear).
Comments on owned/sold/grail watches + all wears: open (any authed user).
Comments on **wishlist watches**: mutual-follow only.

The hard part: detecting a watch's status inside the RLS policy. The `watches.status` column lives on the `watches` table. The `comments` table policy must subquery `watches` to discover status. Since the DAL uses a service-role client (bypasses RLS), the RLS on `comments` is the first-layer defense, the DAL WHERE clause is the load-bearing second layer — consistent with the established two-layer pattern.

### RLS Policies

```sql
-- ENABLE ROW LEVEL SECURITY
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- reactions: SELECT — open (any authed user can see likes)
-- ============================================================
CREATE POLICY reactions_select
  ON reactions FOR SELECT
  TO authenticated
  USING (true);

-- reactions: INSERT — authed only; actor_id must equal auth.uid()
CREATE POLICY reactions_insert
  ON reactions FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- reactions: DELETE — actor (liker) deletes own row only
CREATE POLICY reactions_delete
  ON reactions FOR DELETE
  TO authenticated
  USING (actor_id = auth.uid());

-- No UPDATE on reactions — toggle is delete+insert.

-- ============================================================
-- comments: SELECT
-- Open for owned/sold/grail watches and wear_event targets.
-- Mutual-follow gate for wishlist watch targets.
-- ============================================================
CREATE POLICY comments_select
  ON comments FOR SELECT
  TO authenticated
  USING (
    target_type = 'wear_event'
    OR
    (
      target_type = 'watch'
      AND EXISTS (
        SELECT 1 FROM watches w
        WHERE w.id = comments.target_id
          AND (
            w.status IN ('owned', 'sold', 'grail')
            OR
            (
              w.status = 'wishlist'
              AND (
                -- viewer is the watch owner
                w.user_id = auth.uid()
                OR
                -- mutual follow: viewer follows owner AND owner follows viewer
                (
                  EXISTS (
                    SELECT 1 FROM follows
                    WHERE follower_id = auth.uid()
                      AND following_id = w.user_id
                  )
                  AND
                  EXISTS (
                    SELECT 1 FROM follows
                    WHERE follower_id = w.user_id
                      AND following_id = auth.uid()
                  )
                )
              )
            )
          )
      )
    )
  );

-- comments: INSERT — same asymmetric gate as SELECT
CREATE POLICY comments_insert
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()  -- mass-assignment guard
    AND (
      target_type = 'wear_event'
      OR
      (
        target_type = 'watch'
        AND EXISTS (
          SELECT 1 FROM watches w
          WHERE w.id = comments.target_id
            AND (
              w.status IN ('owned', 'sold', 'grail')
              OR
              (
                w.status = 'wishlist'
                AND (
                  w.user_id = auth.uid()
                  OR
                  (
                    EXISTS (
                      SELECT 1 FROM follows
                      WHERE follower_id = auth.uid()
                        AND following_id = w.user_id
                    )
                    AND
                    EXISTS (
                      SELECT 1 FROM follows
                      WHERE follower_id = w.user_id
                        AND following_id = auth.uid()
                    )
                  )
                )
              )
            )
        )
      )
    )
  );

-- comments: UPDATE — author edits own comment body + sets edited_at
CREATE POLICY comments_update
  ON comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- comments: DELETE — author deletes own comment
CREATE POLICY comments_delete
  ON comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());
```

**Important implementation note on `follows` reads inside the policy:** The `follows` table's RLS posture must allow authenticated reads for the mutual-follow subquery to work. Verify in the existing migration files (Phase 7–9) that `follows` has a SELECT policy for authenticated. If not, add one or replace the inline subquery with a `SECURITY DEFINER` helper function — but be sure to `REVOKE EXECUTE ON FUNCTION ... FROM anon` explicitly (per the project memory note: `REVOKE FROM PUBLIC` alone does not block anon in Supabase).

### DAL Second Layer (src/data/comments.ts, new file)

```typescript
import 'server-only'
import { db } from '@/db'
import { comments, follows, watches } from '@/db/schema'
import { and, eq, sql, desc } from 'drizzle-orm'

// Mutual-follow check — two EXISTS in one round trip
async function areMutualFollows(userA: string, userB: string): Promise<boolean> {
  const rows = await db.execute(sql`
    SELECT
      EXISTS(SELECT 1 FROM follows WHERE follower_id = ${userA}::uuid AND following_id = ${userB}::uuid) AS a_follows_b,
      EXISTS(SELECT 1 FROM follows WHERE follower_id = ${userB}::uuid AND following_id = ${userA}::uuid) AS b_follows_a
  `)
  const r = (rows as Array<{ a_follows_b: boolean; b_follows_a: boolean }>)[0]
  return Boolean(r?.a_follows_b && r?.b_follows_a)
}

// getCommentsForTarget — viewer-aware, two-layer
export async function getCommentsForTarget(
  viewerId: string,
  targetType: 'watch' | 'wear_event',
  targetId: string,
): Promise<CommentRow[]> {
  if (targetType === 'wear_event') {
    // wear comments: open — return all
    return db.select(/* ... */).from(comments)
      .where(and(eq(comments.targetType, 'wear_event'), eq(comments.targetId, targetId)))
      .orderBy(desc(comments.createdAt))
  }

  // watch target: check status + mutual-follow gate
  const [watchRow] = await db
    .select({ userId: watches.userId, status: watches.status })
    .from(watches).where(eq(watches.id, targetId)).limit(1)

  if (!watchRow) return []
  const isOwner = watchRow.userId === viewerId

  if (watchRow.status !== 'wishlist' || isOwner) {
    // owned/sold/grail or owner: open
    return db.select(/* ... */).from(comments)
      .where(and(eq(comments.targetType, 'watch'), eq(comments.targetId, targetId)))
      .orderBy(desc(comments.createdAt))
  }

  // wishlist watch: mutual-follow gate
  const mutual = await areMutualFollows(viewerId, watchRow.userId)
  if (!mutual) return []

  return db.select(/* ... */).from(comments)
    .where(and(eq(comments.targetType, 'watch'), eq(comments.targetId, targetId)))
    .orderBy(desc(comments.createdAt))
}

// createComment — DAL re-derives access before insert (redundant with RLS; load-bearing second layer)
export async function createComment(
  authorId: string,
  targetType: 'watch' | 'wear_event',
  targetId: string,
  body: string,
): Promise<CommentRow> {
  if (targetType === 'watch') {
    const [watchRow] = await db
      .select({ userId: watches.userId, status: watches.status })
      .from(watches).where(eq(watches.id, targetId)).limit(1)
    if (!watchRow) throw new Error('Watch not found')
    const isOwner = watchRow.userId === authorId
    if (watchRow.status === 'wishlist' && !isOwner) {
      const mutual = await areMutualFollows(authorId, watchRow.userId)
      if (!mutual) throw new Error('Access denied: mutual follow required')
    }
  }
  const [row] = await db.insert(comments)
    .values({ authorId, targetType, targetId, body })
    .returning()
  return row
}

// editComment: WHERE author_id = authorId AND id = commentId (IDOR guard)
// deleteComment: WHERE author_id = authorId AND id = commentId (IDOR guard)
```

---

## 3. NOTIFICATIONS EXTENSION

### Enum Migration Strategy

**Use `ALTER TYPE ... ADD VALUE`, not recreate.** Phase 24 used a destructive rename+recreate (the `T-24-PARTIDX` footgun) because it was removing values, not adding them. Adding values with `ALTER TYPE ... ADD VALUE IF NOT EXISTS` is safe in Postgres 14+ and does not require dropping indexes bound to the enum.

**Critical:** `ALTER TYPE ... ADD VALUE` cannot run inside a Postgres transaction block. Each ADD VALUE must be its own migration file, or the migration must be written to execute those statements outside a transaction. Test on local first. In Supabase migrations, wrap the block appropriately or use separate files.

```sql
-- One migration per ADD VALUE, or verify supabase migration runner handles non-transactional DDL
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_like';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_like';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_comment';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_comment';
```

**Update schema.ts:**
```typescript
export const notificationTypeEnum = pgEnum('notification_type', [
  'follow',
  'watch_overlap',
  'watch_like',
  'wear_like',
  'watch_comment',
  'wear_comment',
])
```

**Add opt-out columns to profileSettings:**
```typescript
notifyOnLike: boolean('notify_on_like').notNull().default(true),
notifyOnComment: boolean('notify_on_comment').notNull().default(true),
```

### Notification Payload Types (src/lib/notifications/types.ts additions)

```typescript
export interface WatchLikePayload {
  actor_username: string
  actor_display_name: string | null
  watch_id: string
  watch_brand: string
  watch_model: string
}

export interface WearLikePayload {
  actor_username: string
  actor_display_name: string | null
  wear_event_id: string
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
  comment_preview: string // first 120 chars
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
```

### logNotification Extension

The `LogNotificationInput` discriminated union gains four new branches. The logger's internal structure does not change — only the type union widens and the opt-out check gains two new branches:

```typescript
// New union branches:
| { type: 'watch_like'; recipientUserId: string; actorUserId: string; payload: WatchLikePayload }
| { type: 'wear_like'; recipientUserId: string; actorUserId: string; payload: WearLikePayload }
| { type: 'watch_comment'; recipientUserId: string; actorUserId: string; payload: WatchCommentPayload }
| { type: 'wear_comment'; recipientUserId: string; actorUserId: string; payload: WearCommentPayload }

// New opt-out branches in logNotification body:
const notifyOnLike = settings?.notifyOnLike ?? true
const notifyOnComment = settings?.notifyOnComment ?? true
if ((input.type === 'watch_like' || input.type === 'wear_like') && !notifyOnLike) return
if ((input.type === 'watch_comment' || input.type === 'wear_comment') && !notifyOnComment) return
```

### Dedup Strategy for Likes

Create partial UNIQUE indexes on `notifications` for like types — same pattern as `notifications_watch_overlap_dedup`:

```sql
-- Dedup: one like-notification per (recipient, actor, target)
-- Actor can unlike+re-like; notification fires only on the first like.
CREATE UNIQUE INDEX notifications_watch_like_dedup
  ON notifications (user_id, actor_id, (payload->>'watch_id'))
  WHERE type = 'watch_like';

CREATE UNIQUE INDEX notifications_wear_like_dedup
  ON notifications (user_id, actor_id, (payload->>'wear_event_id'))
  WHERE type = 'wear_like';
```

The `toggleReaction` DAL returns `{ liked: boolean }`. The Server Action calls `logNotification` **only when `liked === true`** (first like). On `liked === false` (unlike/retraction), no notification is sent. If the same actor likes again after unliking, the dedup index produces an ON CONFLICT DO NOTHING — no duplicate notification.

**Comments:** No dedup needed — each new comment is a distinct event. Only fire `logNotification` on INSERT, never on UPDATE (edit).

**Self-guard:** Unchanged — the existing logger `if (recipientUserId === actorUserId) return` covers this. Owners commenting/liking their own content produce no notification.

### Notification Bell Cache Invalidation

Same pattern as `followUser`:
```typescript
// After like/comment write where liked === true (or after new comment INSERT):
revalidateTag(`viewer:${watchOwnerId}`, 'max')
```

---

## 4. COUNT STRATEGY (Anti-N+1)

### Decision: Aggregated On-Read, Batched Per Target List

Do NOT add denormalized `like_count` / `comment_count` columns to `watches` or `wear_events`. The existing `watches_catalog.ownersCount` / `wishlistCount` are refreshed by pg_cron — that model works for a daily batch but is wrong for real-time social counts (a like fires a notification in seconds; a stale count showing 0 for 24 hours is broken UX).

On-read aggregation with batching eliminates the drift problem and is simple at MVP scale (<500 watches/user, expected comment/like counts per watch in the low dozens).

```typescript
// src/data/reactions.ts

// Batch count query — one round trip for all watches on a page
export async function getLikeCountsForTargets(
  targets: Array<{ targetType: 'watch' | 'wear_event'; targetId: string }>
): Promise<Map<string, number>> {
  if (targets.length === 0) return new Map()
  const rows = await db.execute(sql`
    SELECT target_type, target_id::text, COUNT(*)::int AS like_count
    FROM reactions
    WHERE reaction_type = 'like'
      AND (target_type::text, target_id::text) IN (
        ${sql.join(
          targets.map(t => sql`(${t.targetType}, ${t.targetId})`),
          sql`, `
        )}
      )
    GROUP BY target_type, target_id
  `)
  const map = new Map<string, number>()
  for (const r of rows as Array<{ target_type: string; target_id: string; like_count: number }>) {
    map.set(`${r.target_type}:${r.target_id}`, r.like_count)
  }
  return map
}

// Viewer's own liked state — which of the current targets has the viewer liked?
export async function getViewerLikedTargets(
  viewerId: string,
  targets: Array<{ targetType: 'watch' | 'wear_event'; targetId: string }>
): Promise<Set<string>> {
  if (targets.length === 0 || !viewerId) return new Set()
  const rows = await db
    .select({ targetType: reactions.targetType, targetId: reactions.targetId })
    .from(reactions)
    .where(
      and(
        eq(reactions.actorId, viewerId),
        eq(reactions.reactionType, 'like'),
        // inArray on composite is not directly supported by Drizzle DSL;
        // use raw SQL tuple IN — same pattern as getOverlapRecipients
        sql`(target_type::text, target_id::text) IN (${sql.join(
          targets.map(t => sql`(${t.targetType}, ${t.targetId})`),
          sql`, `
        )})`,
      )
    )
  return new Set(rows.map(r => `${r.targetType}:${r.targetId}`))
}
```

**Comment counts** follow the same pattern:
```typescript
export async function getCommentCountsForTargets(
  targets: Array<{ targetType: 'watch' | 'wear_event'; targetId: string }>
): Promise<Map<string, number>> {
  // same GROUP BY pattern as getLikeCountsForTargets, querying comments table
}
```

**Usage in a collection-page Server Component:**
```typescript
const userWatches = await getWatchesByUser(ownerId)
const targets = userWatches.map(w => ({ targetType: 'watch' as const, targetId: w.id }))

const [likeCounts, commentCounts, viewerLikedSet] = await Promise.all([
  getLikeCountsForTargets(targets),
  getCommentCountsForTargets(targets),
  viewerId ? getViewerLikedTargets(viewerId, targets) : Promise.resolve(new Set<string>()),
])
// 3 queries total regardless of collection size
```

---

## 5. CACHING STRATEGY

### Cache Tags

```
reactions:{targetType}:{targetId}   — like count for a specific watch/wear
comments:{targetType}:{targetId}    — comment thread for a specific watch/wear
viewer:{userId}:reactions           — viewer's own liked state (RYO)
```

**Collection page (ProfileWatchCard grid):** The profile page is already tagged `profile:{username}` with `cacheLife({revalidate: 300})`. Wire reaction/comment counts into that same cache envelope — adding `revalidateTag('profile:{username}', 'max')` to `toggleLikeAction` and `addCommentAction` is sufficient. This slightly over-invalidates (any like anywhere on the profile refreshes the whole grid) but is simple and correct at MVP scale.

**Per-watch detail page `/watch/[id]`:** High-engagement surface; give counts their own tag so a like on this watch doesn't invalidate all other watches. Use `cacheTag(`reactions:watch:${watchId}`)` on the WatchSocialBar component.

**Wear detail page `/wear/[wearEventId]`:** Same as per-watch. Tag with `reactions:wear_event:${wearEventId}`.

**Comment thread caching: skip caching or scope by viewerId.** The mutual-follow gate makes the comment list viewer-dependent for wishlist watches. A shared cache without viewerId scoping would leak denied comments to viewers who gained mutual-follow status since the last cache fill. Either:
- Option A: Render CommentThread as a plain uncached Server Component inside Suspense. Simple and safe.
- Option B: Cache with `cacheTag(`comments:watch:${watchId}`, `viewer:${viewerId}`)`. Doubles the cache entries but is correct.

**Recommendation: Option A.** Comment threads are short (flat, no threads), low-traffic, and not on a hot cache path. Avoid the viewer-scoped cache complexity until scale demands it.

### Optimistic UI for Likes

```typescript
// src/components/social/LikeButton.tsx — Client Component
'use client'
import { useOptimistic, useTransition } from 'react'
import { toggleLikeAction } from '@/app/actions/reactions'

export function LikeButton({
  initialCount,
  initialLiked,
  targetType,
  targetId,
}: {
  initialCount: number
  initialLiked: boolean
  targetType: 'watch' | 'wear_event'
  targetId: string
}) {
  const [optimistic, addOptimistic] = useOptimistic(
    { count: initialCount, liked: initialLiked },
    (state) => ({
      count: state.liked ? state.count - 1 : state.count + 1,
      liked: !state.liked,
    }),
  )
  const [, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      addOptimistic(undefined)
      await toggleLikeAction({ targetType, targetId })
    })
  }

  return (
    <button onClick={handleClick} aria-pressed={optimistic.liked}>
      {optimistic.liked ? 'Unlike' : 'Like'} {optimistic.count}
    </button>
  )
}
```

Mirror the existing `NotificationRow` pattern (useOptimistic + useTransition). On Server Action error, the optimistic state reverts automatically.

**Server Action cache invalidation pattern:**
```typescript
// src/app/actions/reactions.ts
export async function toggleLikeAction(data: unknown): Promise<ActionResult<{ liked: boolean }>> {
  const user = await getCurrentUser()
  const parsed = toggleLikeSchema.safeParse(data) // Zod .strict()
  // ... validation

  const result = await toggleReactionDAL(user.id, parsed.data.targetType, parsed.data.targetId)

  // RYO: viewer's own liked state
  updateTag(`viewer:${user.id}:reactions`)
  // SWR: count visible to all viewers of this target
  revalidateTag(`reactions:${parsed.data.targetType}:${parsed.data.targetId}`, 'max')
  // Profile page cache (covers count badge on collection grid)
  if (ownerUsername) revalidateTag(`profile:${ownerUsername}`, 'max')

  // Notification: only on first like
  if (result.liked && targetOwnerId !== user.id) {
    await logNotification({
      type: parsed.data.targetType === 'watch' ? 'watch_like' : 'wear_like',
      recipientUserId: targetOwnerId,
      actorUserId: user.id,
      payload: { /* pre-resolved actor profile fields */ },
    })
    revalidateTag(`viewer:${targetOwnerId}`, 'max') // bell unread dot
  }

  return { success: true, data: result }
}
```

---

## 6. RENDERING SURFACES AND BUILD ORDER

### New Components

| Component | Type | Location | Responsibility |
|-----------|------|----------|----------------|
| `LikeButton` | Client | `src/components/social/LikeButton.tsx` | Optimistic like toggle + count |
| `CommentThread` | Server | `src/components/social/CommentThread.tsx` | Flat list of CommentRow items |
| `CommentForm` | Client | `src/components/social/CommentForm.tsx` | Add new comment; useTransition |
| `EditCommentForm` | Client | `src/components/social/EditCommentForm.tsx` | Inline edit for author |
| `WatchSocialBar` | Server | `src/components/social/WatchSocialBar.tsx` | Batch-fetches counts + viewer state; renders LikeButton + comment count |
| `WearSocialBar` | Server | `src/components/social/WearSocialBar.tsx` | Same for wear targets |

### Modified Components/Pages

| File | Change |
|------|--------|
| `src/components/watch/ProfileWatchCard.tsx` | Add `<WatchSocialBar>` below card footer |
| `src/app/watch/[id]/page.tsx` | Add `<WatchSocialBar>` + `<CommentThread>` + `<CommentForm>` below detail |
| `src/app/wear/[wearEventId]/page.tsx` | Add `<WearSocialBar>` + `<CommentThread>` + `<CommentForm>` below wear photo |
| `src/components/layout/NotificationRow.tsx` | Render 4 new notification types (copy + icon) |
| `src/app/settings/page.tsx` (Notifications section) | Add `notifyOnLike` + `notifyOnComment` toggles |

### Dependency-Ordered Build Sequence

**Phase 53 — Schema + RLS + Enum (no UI yet)**
- `src/db/schema.ts`: add `reactions`, `comments`, `reactionTargetTypeEnum`, `commentTargetTypeEnum`
- `src/db/schema.ts`: extend `notificationTypeEnum` with 4 new values
- `src/db/schema.ts`: add `notifyOnLike`, `notifyOnComment` to `profileSettings`
- Supabase migration: CREATE TABLE reactions + comments, CHECK constraints, indexes, 7 RLS policies
- Supabase migration: `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS` x4 (outside transaction)
- Supabase migration: ADD COLUMN notify_on_like + notify_on_comment to profile_settings
- Integration test stubs: verify reactions_select allows any authed, comments_select blocks non-mutual on wishlist watch

**Phase 54 — DAL**
- `src/data/reactions.ts` (new): `toggleReaction`, `getLikeCountsForTargets`, `getViewerLikedTargets`
- `src/data/comments.ts` (new): `getCommentsForTarget`, `getCommentCountsForTargets`, `createComment`, `editComment`, `deleteComment`; `areMutualFollows` helper
- `src/lib/notifications/types.ts`: add 4 new payload interfaces
- `src/lib/notifications/logger.ts`: extend union + opt-out check branches
- DAL integration tests: wishlist mutual-follow gate, open gate (owned), self-action guard

**Phase 55 — Server Actions**
- `src/app/actions/reactions.ts` (new): `toggleLikeAction` (Zod .strict, double-auth, revalidateTag, logNotification)
- `src/app/actions/comments.ts` (new): `addCommentAction`, `editCommentAction`, `deleteCommentAction`
- Extend profileSettings action for 2 new notify toggles
- Notification dedup partial UNIQUE indexes for `watch_like` + `wear_like`

**Phase 56 — Like UI**
- `LikeButton` Client Component (optimistic)
- `WatchSocialBar` + `WearSocialBar` Server Components (3 parallel queries each)
- Wire `WatchSocialBar` into `ProfileWatchCard` (collection + wishlist tabs)
- Wire `WatchSocialBar` into `/watch/[id]` page
- Wire `WearSocialBar` into `/wear/[wearEventId]` page
- Add cache tags to tagged components; verify revalidation e2e

**Phase 57 — Comment Thread UI**
- `CommentThread` Server Component (flat list; edit/delete affordances for author)
- `CommentForm` Client Component (add new comment; Sonner toast on error)
- `EditCommentForm` Client Component (inline body edit)
- Wire into `/watch/[id]` + `/wear/[wearEventId]`
- Verify wishlist gate: non-mutual viewer sees CommentThread rendered as empty/hidden, not an error

**Phase 58 — Notification UI + Settings**
- Extend `NotificationRow` for 4 new types (icon + copy per type; mirror existing row shape)
- Add `notifyOnLike` + `notifyOnComment` toggles to Settings Notifications section
- UAT: like fires bell dot on recipient, no self-notification, dedup holds on unlike+re-like

---

## System Overview

```
RENDERING SURFACES
  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
  │ ProfileWatchCard│  │  /watch/[id]      │  │ /wear/[wearEventId]  │
  │ (grid, owner +  │  │  detail page      │  │ detail page          │
  │  non-owner)     │  │                  │  │                      │
  └────────┬────────┘  └────────┬─────────┘  └──────────┬───────────┘
           │                   │                        │
  ┌────────▼───────────────────▼────────────────────────▼────────────┐
  │    WatchSocialBar / WearSocialBar (Server Component)              │
  │    getLikeCountsForTargets + getViewerLikedTargets (batch)        │
  │    LikeButton (Client, useOptimistic) | comment count link        │
  │    CommentThread (Server, uncached) | CommentForm (Client)        │
  └───────────────────────────────┬───────────────────────────────────┘
                                  │
SERVER ACTIONS (Zod .strict + double-auth + revalidateTag)
  ┌──────────────────┐  ┌─────────────────────────────────────────────┐
  │ toggleLikeAction │  │ addCommentAction / editCommentAction /       │
  │ updateTag(RYO)   │  │ deleteCommentAction                          │
  │ revalidateTag    │  │ revalidateTag(`comments:*`)                  │
  │ logNotification  │  │ logNotification (on INSERT only)             │
  └────────┬─────────┘  └────────────────────────┬────────────────────┘
           │                                     │
DAL (server-only, service-role Drizzle client)
  ┌──────────────────┐  ┌─────────────────────────────────────────────┐
  │ reactions.ts     │  │ comments.ts                                  │
  │ toggleReaction   │  │ getCommentsForTarget (wishlist gate here)    │
  │ count batchers   │  │ createComment (gate re-derived pre-insert)   │
  └────────┬─────────┘  └────────────────────────┬────────────────────┘
           │                                     │
POSTGRES / SUPABASE
  ┌────────────────────────────────────────────────────────────────────┐
  │ reactions table ─── RLS (open select, actor_id=auth.uid() write)   │
  │ comments table  ─── RLS (open / mutual-follow gate for wishlist)   │
  │ notification_type enum + 4 new ADD VALUE entries                   │
  │ profile_settings + notifyOnLike + notifyOnComment                  │
  │ Partial UNIQUE indexes: notifications_watch_like_dedup etc.        │
  └────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `reactions` table | Stores likes across watch + wear targets | `users` (actor FK), DAL |
| `comments` table | Stores flat comment threads | `users` (author FK), `watches` (status for gate), DAL |
| `src/data/reactions.ts` | Like toggle, count batch, viewer-liked batch | Drizzle db, `reactions` table |
| `src/data/comments.ts` | Comment CRUD + wishlist access gate | Drizzle db, `comments`, `watches`, `follows` |
| `src/lib/notifications/logger.ts` | Fire-and-forget notification write | `profileSettings` (opt-out), `notifications` |
| `LikeButton` | Optimistic like UI | toggleLikeAction (Server Action) |
| `CommentThread` | Render flat list with author affordances | Server Component; getCommentsForTarget |
| `WatchSocialBar` | Batch counts + viewer state; renders children | getLikeCountsForTargets, getViewerLikedTargets, getCommentCountsForTargets |
| Server Actions (reactions/comments) | Mutation + cache tag invalidation | DAL, logNotification, revalidateTag/updateTag |

## Anti-Patterns

### Anti-Pattern 1: Denormalized Like/Comment Counts on Watch Rows

**What people do:** Add `like_count` / `comment_count` columns to `watches`, increment/decrement in a trigger or Server Action.

**Why it's wrong:** Counts drift on partial failures (insert succeeds, decrement fails); triggers add schema-layer complexity; at 500 watches/user the batch-aggregate approach is one query, not 500.

**Do this instead:** Batch GROUP BY aggregate at read time via `getLikeCountsForTargets`, 3 queries total per page.

### Anti-Pattern 2: Caching Comment Threads Without Viewer Scoping

**What people do:** Cache the comment thread Server Component with a tag keyed only on `(targetType, targetId)`, shared across all viewers.

**Why it's wrong:** The wishlist mutual-follow gate is per-viewer. A cached thread filled for viewer A (who has mutual follows with the owner) would serve to viewer B (who doesn't) if the same cache key is used.

**Do this instead:** Either render CommentThread uncached inside Suspense, or scope the cache key with viewerId.

### Anti-Pattern 3: Sending Like Notification on Every Toggle

**What people do:** Fire `logNotification` in the Server Action without checking the toggle direction.

**Why it's wrong:** Unlike (retraction) generates a "you got a like" notification, which is confusing and noisy.

**Do this instead:** Check `result.liked === true` before calling logNotification. The dedup index handles the edge case of rapid unlike+re-like.

### Anti-Pattern 4: ALTER TYPE ... ADD VALUE Inside a Transaction

**What people do:** Write the enum ADD VALUE statements inside the default Supabase migration transaction block.

**Why it's wrong:** Postgres does not allow `ALTER TYPE ... ADD VALUE` inside a transaction block. The migration will fail.

**Do this instead:** Each ADD VALUE needs its own standalone statement outside a transaction, or use a separate migration file that supabase runs non-transactionally. Test on local before pushing to prod.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Postgres | Drizzle service-role client (bypasses RLS); RLS is first-layer | Same pattern as all existing tables |
| Supabase Auth | `auth.uid()` used in RLS policy USING/WITH CHECK clauses | Same as `notifications`, `divestments`, `follows` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `comments` DAL → `follows` table | Direct Drizzle query for mutual-follow check | Verify follows has authenticated SELECT policy |
| `comments` DAL → `watches` table | Direct Drizzle query for status check | Service-role bypasses watches RLS; correct here |
| Server Actions → `logNotification` | Awaited (per the followUser pattern) | Must complete before revalidateTag so bell cache is accurate |
| `LikeButton` → toggleLikeAction | Server Action call inside startTransition | useOptimistic reverts on error automatically |
| `profileSettings` → opt-out columns | Extended in schema, read in logger | Same read pattern as existing notifyOnFollow |

---

*Architecture research for: Horlo v6.0 Social Interaction (likes + comments)*
*Researched: 2026-05-22*
