# Phase 57: Comment Thread UI + Feed Extension + Grid Counts — Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 15 new/modified files
**Analogs found:** 15 / 15

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/comment/CommentThread.tsx` | component (Server) | request-response | `src/app/watch/[id]/page.tsx` RSC sibling pattern | role-match |
| `src/components/comment/CommentList.tsx` | component (Client island) | event-driven | `src/components/shared/LikeButton.tsx` | exact |
| `src/components/comment/CommentItem.tsx` | component (Client) | event-driven | `src/components/shared/LikeButton.tsx` + `FollowButton` | role-match |
| `src/components/comment/CommentCompose.tsx` | component (Client) | event-driven | `src/components/shared/LikeButton.tsx` | role-match |
| `src/components/comment/CommentGateLocked.tsx` | component | request-response | `src/components/profile/FollowButton.tsx` | role-match |
| `src/data/comments.ts` | DAL | CRUD | self (modify) | — |
| `src/app/actions/comments.ts` | Server Action | request-response | self (modify) | — |
| `src/data/activities.ts` | DAL | CRUD + event-driven | self (modify) | — |
| `src/lib/feedTypes.ts` | utility (types) | — | self (modify) | — |
| `src/components/home/ActivityRow.tsx` | component | request-response | self (modify) | — |
| `src/lib/feedAggregate.ts` | utility | transform | self (modify) | — |
| `src/components/profile/ProfileWatchCard.tsx` | component | CRUD | self (modify) | — |
| `src/components/profile/SortableProfileWatchCard.tsx` | component | CRUD | self (modify, props mirror) | — |
| `src/components/wear/WearCommentHost.tsx` | component | event-driven | self (modify — fill seam) | — |
| `src/app/watch/[id]/page.tsx` | page (RSC) | request-response | self (modify) + `src/app/wear/[wearEventId]/page.tsx` | exact |
| `src/app/wear/[wearEventId]/page.tsx` | page (RSC) | request-response | self (modify) | — |
| `src/data/reactions.ts` | DAL | CRUD | self (extend with batch DAL) | — |

---

## Pattern Assignments

### `src/components/comment/CommentThread.tsx` (Server Component, NOT 'use cache')

**Analog:** `src/app/watch/[id]/page.tsx` (RSC sibling pattern, lines 1–139) and `src/app/wear/[wearEventId]/page.tsx` WearPhotoStreamed (lines 121–186)

**Critical rule:** NO `'use cache'` directive. Comments are uncached by design (Phase 55 D-06). The absence of caching is the privacy guarantee (see PRIVACY LAYER NOTE in `src/data/comments.ts` lines 1–17).

**Imports pattern** — mirror the page RSC imports structure:
```typescript
// src/data/comments.ts exports to consume:
import { getCommentsForTarget, canViewerCommentOnTarget } from '@/data/comments'
import type { CommentTarget } from '@/data/comments'
import { isFollowing } from '@/data/follows'
// Pass initialComments to the CommentList client island:
import { CommentList } from '@/components/comment/CommentList'
```

**RSC sibling composition pattern** (`src/app/watch/[id]/page.tsx` lines 110–118):
```typescript
// B1 invariant: RSC siblings of a 'use client' component are composed at the
// server tree level, NOT imported inside the client island.
// SameFamilyRail and LineageRail are the existing RSC sibling precedents:
<SameFamilyRail rows={sameFamily} />
<LineageRail rows={lineage} />
// CommentThread follows the same pattern — rendered as a sibling BELOW WatchDetail:
// <CommentThread viewerId={userId} target={{ type: 'watch', id }} ... />
```

**Props to accept** (from UI-SPEC §CommentThread):
```typescript
interface CommentThreadProps {
  viewerId: string | null
  target: { type: 'watch' | 'wear'; id: string }
  canComment: boolean          // from canViewerCommentOnTarget()
  ownerFollowsViewer: boolean  // from isFollowing(ownerId, viewerId); false for wear targets
  ownerUserId: string          // for FollowButton in GATE-03
  ownerUsername: string        // for GATE-03 copy
}
```

**Server data resolution pattern** (mirror `src/app/watch/[id]/page.tsx` lines 40–45):
```typescript
// Page resolves both gate signals server-side before hydrating the client island:
const likeState = await getLikesForTargetCached(user.id, { type: 'watch', id })
// CommentThread resolves analogously — no 'use cache':
const canComment = await canViewerCommentOnTarget(viewerId, target)
// ownerFollowsViewer: only needed for wishlist-watch gating (owner→viewer direction)
const ownerFollowsViewer = target.type === 'watch' && !canComment
  ? await isFollowing(ownerId, viewerId)  // DIRECTION: ownerId→viewerId, NOT viewer→owner
  : false
```

**Suspense wrapping in host** (`src/app/wear/[wearEventId]/page.tsx` lines 83–102):
```typescript
// The host page wraps the streamed child in Suspense:
<Suspense fallback={<PhotoSkeleton />}>
  <WearPhotoStreamed ... />
</Suspense>
// CommentThread similarly needs a Suspense boundary in its host:
// <Suspense fallback={<CommentThreadSkeleton />}>
//   <CommentThread ... />
// </Suspense>
```

---

### `src/components/comment/CommentList.tsx` ('use client' — optimistic island)

**Analog:** `src/components/shared/LikeButton.tsx` (lines 1–126) — exact house pattern for `useState` + `useTransition` + rollback

**Imports pattern** (`src/components/shared/LikeButton.tsx` lines 1–9):
```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
// CommentList analog:
import { useState, useTransition } from 'react'
import { addCommentAction } from '@/app/actions/comments'
import { cn } from '@/lib/utils'
import type { Comment, CommentTarget } from '@/data/comments'
import { CommentCompose } from './CommentCompose'
import { CommentItem } from './CommentItem'
import { CommentGateLocked } from './CommentGateLocked'
```

**Core optimistic pattern** (`src/components/shared/LikeButton.tsx` lines 51–91):
```typescript
// The FULL house pattern — copy this exactly, adapt for comment list:
const [liked, setLiked] = useState(initialLiked)
const [count, setCount] = useState(initialCount)
const [pending, startTransition] = useTransition()

// ...inside handler:
const nextLiked = !liked
const nextCount = nextLiked ? count + 1 : count - 1
setLiked(nextLiked)    // optimistic flip
setCount(nextCount)

startTransition(async () => {
  const result = await toggleLikeAction({ type: target.type, id: target.id })
  if (!result.success) {
    setLiked(liked)    // rollback
    setCount(count)
    console.error('[LikeButton] action failed:', result.error)
    return
  }
  // Reconcile to server-confirmed values (NOT the local optimistic value):
  setLiked(result.data.liked)
  setCount(result.data.count)
})
```

**CommentList adaptation** (newest-first, insert at TOP per D-14/ROADMAP SC4):
```typescript
// CommentList state:
const [comments, setComments] = useState<Comment[]>(initialComments)
const [pending, startTransition] = useTransition()

function handleSubmit(body: string) {
  const optimistic: Comment = {
    id: crypto.randomUUID(),  // temp id, replaced on reconcile
    authorId: viewerId!,
    body,
    createdAt: new Date(),
    editedAt: null,
    watchId: target.type === 'watch' ? target.id : null,
    wearEventId: target.type === 'wear' ? target.id : null,
    updatedAt: new Date(),
  }
  setComments([optimistic, ...comments])   // INSERT AT TOP — newest-first (ROADMAP SC4)
  startTransition(async () => {
    const result = await addCommentAction({ type: target.type, id: target.id, body })
    if (!result.success) {
      setComments(comments)                // rollback
      if (result.code === 'gate') { /* transition to locked state */ }
      console.error('[CommentList] action failed:', result.error)
      return
    }
    // Reconcile: replace temp id with server-confirmed row (id + createdAt):
    setComments(prev => prev.map(c => c.id === optimistic.id ? result.data : c))
  })
}
```

**disabled={pending} pattern** (`src/components/shared/LikeButton.tsx` lines 99–103):
```typescript
// The button receives disabled={pending} — blocks double-fire:
<button
  disabled={pending}
  className={cn(
    '...',
    pending && 'opacity-50',
  )}
>
```

**Layout** (from UI-SPEC §CommentList):
```typescript
// Compose or locked state ABOVE; list BELOW:
<div className="flex flex-col gap-4">
  {canComment
    ? <CommentCompose viewerId={viewerId} onSubmit={handleSubmit} pending={pending} />
    : <CommentGateLocked ownerUsername={ownerUsername} ownerUserId={ownerUserId}
                         ownerFollowsViewer={ownerFollowsViewer} viewerId={viewerId} />
  }
  {comments.map(c => (
    <CommentItem key={c.id} comment={c} viewerId={viewerId} target={target} onUpdate={handleUpdate} onDelete={handleDelete} />
  ))}
</div>
```

---

### `src/components/comment/CommentItem.tsx` ('use client')

**Analog:** `src/components/shared/LikeButton.tsx` (optimistic pattern) + `src/components/profile/FollowButton.tsx` (anon bounce, `viewerId: string | null`)

**Edit-in-place optimistic pattern** (mirror LikeButton rollback, lines 76–90):
```typescript
// Edit: optimistic body update; rollback on failure
const prevBody = comment.body
setComment({ ...comment, body: newBody, editedAt: new Date() })  // optimistic

startTransition(async () => {
  const result = await editCommentAction({ commentId: comment.id, body: newBody })
  if (!result.success) {
    setComment({ ...comment, body: prevBody, editedAt: comment.editedAt })  // rollback
    return
  }
  setComment(result.data)  // reconcile with server-confirmed editedAt
})
```

**Delete optimistic pattern** (mirror LikeButton rollback):
```typescript
// Delete: optimistic removal; parent list rolls back on failure
startTransition(async () => {
  const result = await deleteCommentAction({ commentId: comment.id })
  if (!result.success) {
    onRollbackDelete(comment)  // parent re-inserts at original position
    return
  }
  // already removed from list optimistically
})
```

**Author-scoped controls** (UI-SPEC §CommentItem — always-visible pencil + trash):
```typescript
// Pencil + trash visible ONLY when comment.authorId === viewerId:
{viewerId === comment.authorId && !isEditing && !isDeleting && (
  <div className="flex items-center gap-2 mt-1">
    <button
      aria-label="Edit comment"
      disabled={pending}
      onClick={() => setIsEditing(true)}
      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
    >
      <Pencil className="size-4 text-muted-foreground hover:text-foreground" aria-hidden />
    </button>
    <button
      aria-label="Delete comment"
      disabled={pending}
      onClick={() => setIsDeleting(true)}
      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
    >
      <Trash2 className="size-4 text-muted-foreground hover:text-destructive" aria-hidden />
    </button>
  </div>
)}
```

**Inline delete confirm** (UI-SPEC §CommentItem — no AlertDialog, D-06):
```typescript
// Delete confirm row replaces pencil/trash:
{isDeleting && (
  <div className="flex items-center gap-1 mt-1">
    <button className="text-sm text-destructive hover:underline" onClick={handleDeleteConfirm}>
      Delete?
    </button>
    <span className="text-muted-foreground mx-1">·</span>
    <button className="text-sm text-muted-foreground hover:underline" onClick={() => setIsDeleting(false)}>
      Cancel
    </button>
  </div>
)}
```

**`[edited]` indicator** (UI-SPEC §CommentItem — on meta line, D-07):
```typescript
// Meta line: {username} · {timeAgo} [· edited]
<p className="text-xs text-muted-foreground">
  {timeAgo(comment.createdAt.toISOString())}
  {comment.editedAt && <> · <span>edited</span></>}
</p>
```

---

### `src/components/comment/CommentCompose.tsx` ('use client')

**Analog:** `src/components/shared/LikeButton.tsx` (disabled={pending}, opacity-50 pattern)

**Textarea pattern** (UI-SPEC §CommentCompose — raw `<textarea>`, not shadcn Textarea):
```typescript
// maxLength enforced at the input level (CMNT-04 first layer):
<textarea
  maxLength={500}
  rows={3}
  placeholder="Add a comment…"
  disabled={pending}
  value={body}
  onChange={e => setBody(e.target.value)}
  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
             text-foreground placeholder:text-muted-foreground focus-visible:outline-none
             focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed
             disabled:opacity-50 resize-none"
/>
```

**Char counter pattern** (UI-SPEC §CommentCompose — visible at 450/500):
```typescript
// Counter only at 90% of max (CMNT-05):
{body.length >= 450 && (
  <span className={cn(
    'text-xs tabular-nums self-end',
    body.length >= 480 ? 'text-destructive' : 'text-muted-foreground'
  )}>
    {body.length}/500
  </span>
)}
```

**Submit button pattern** (mirror `LikeButton` `disabled={pending}`, line 99):
```typescript
// disabled when pending OR body empty OR body too long:
<button
  type="button"
  disabled={pending || body.trim().length === 0 || body.length > 500}
  className="self-end h-8 px-4 bg-primary text-primary-foreground text-sm font-semibold
             rounded-md hover:opacity-90 focus-visible:outline-none focus-visible:ring-2
             focus-visible:ring-ring disabled:cursor-wait disabled:opacity-50"
  onClick={() => { onSubmit(body); setBody('') }}
>
  Post
</button>
```

---

### `src/components/comment/CommentGateLocked.tsx` (GATE-03 two-state)

**Analog:** `src/components/profile/FollowButton.tsx` (lines 1–155) — reuse directly for the inline Follow CTA

**FollowButton reuse** (`src/components/profile/FollowButton.tsx` lines 9–20 — props to pass):
```typescript
// FollowButton already has: viewerId: string | null, variant='inline',
// anon /login?next= bounce, optimistic toggle, disabled={pending}
import { FollowButton } from '@/components/profile/FollowButton'

// In CommentGateLocked, State 1 (pre-follow):
<div className="rounded-md bg-muted px-4 py-4 flex flex-col gap-2 border border-border">
  <p className="text-sm font-semibold text-foreground">
    Follow {ownerUsername} to comment
  </p>
  <FollowButton
    variant="inline"
    viewerId={viewerId}
    targetUserId={ownerUserId}
    targetDisplayName={ownerUsername}
    initialIsFollowing={false}
  />
</div>
```

**`variant="inline"` class** (`src/components/profile/FollowButton.tsx` lines 111–115):
```typescript
// The 'inline' variant styling (already exists — do NOT rewrite):
variant === 'inline'
  ? cn(
      'h-8 px-3 border border-border',
      isFollowing
        ? 'bg-muted text-muted-foreground group hover:text-destructive focus:text-destructive'
        : 'text-foreground hover:bg-muted',
    )
```

**State 2 (followed, not yet mutual)** — no button:
```typescript
// State 2: owner must follow back; no Follow button (the viewer's half is done):
<div className="rounded-md bg-muted px-4 py-4 flex flex-col gap-2 border border-border">
  <p className="text-sm font-semibold text-foreground">
    {ownerUsername} needs to follow you back before you can comment
  </p>
</div>
```

**State selection logic** (D-02/D-03):
```typescript
// Props from CommentThread (server-resolved):
// canComment=false always when this component renders
// viewerIsFollowing: the viewer's half (viewer→owner)
// ownerFollowsViewer: the owner's half (owner→viewer)
// State 1: viewerIsFollowing === false
// State 2: viewerIsFollowing === true AND ownerFollowsViewer === false
// State 3 (compose shows): canComment === true (this component not rendered)
```

**`isFollowing` direction note** (`src/data/follows.ts` lines 54–68):
```typescript
// DIRECTION MATTERS: isFollowing(followerId, followingId)
// To check owner→viewer: isFollowing(ownerId, viewerId)
// NOT isFollowing(viewerId, ownerId) — that checks viewer→owner
export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1)
  return rows.length > 0
}
```

---

### `src/data/comments.ts` — modifications

**Current `getCommentsForTarget`** (lines 138–158) — THE STALE FUNCTION to reconcile:
```typescript
// CURRENT (lines 138–158) — STALE: "(oldest first, CMNT-03)" comment + asc order:
export async function getCommentsForTarget(
  viewerId: string,
  target: CommentTarget,
): Promise<Comment[]> {
  const allowed = await canViewerCommentOnTarget(viewerId, target)
  if (!allowed) return []

  if (target.type === 'watch') {
    return db
      .select()
      .from(comments)
      .where(eq(comments.watchId, target.id))
      .orderBy(asc(comments.createdAt))     // <-- CHANGE TO desc()
  } else {
    return db
      .select()
      .from(comments)
      .where(eq(comments.wearEventId, target.id))
      .orderBy(asc(comments.createdAt))     // <-- CHANGE TO desc()
  }
}
```

**Required change:** swap `asc` → `desc`, update the import at line 18 (`import { and, asc, eq }` → `import { and, desc, eq }`), update the inline comment from `(oldest first, CMNT-03)` to `(newest first — CMNT-03 superseded by operator decision 2026-05-22, ROADMAP SC1)`.

**`canViewerCommentOnTarget`** (lines 60–86) — read-only reference for GATE-03 and grid batching:
```typescript
// Single source of truth for ALL gating (D-04). Gate logic:
//   - wear target → always true (short-circuit, no DB call)
//   - watch target, viewer === owner → true
//   - watch status !== 'wishlist' → true
//   - watch status === 'wishlist' → isMutualFollow(viewerId, ownerId)
export async function canViewerCommentOnTarget(
  viewerId: string,
  target: CommentTarget,
): Promise<boolean> {
  if (target.type === 'wear') return true
  const watchRows = await db
    .select({ userId: watches.userId, status: watches.status })
    .from(watches)
    .where(eq(watches.id, target.id))
    .limit(1)
  const watch = watchRows[0]
  if (!watch) return false
  if (viewerId === watch.userId) return true
  if (watch.status !== 'wishlist') return true
  return isMutualFollow(viewerId, watch.userId)
}
```

---

### `src/app/actions/comments.ts` — modifications

**`addCommentAction`** (lines 51–184) — gains `logActivity` call (D-13):

The action already resolves `ownerId`, `watchBrand`, `watchModel` (lines 67–104). The SELECT for watch targets (lines 73–83) must be extended to also fetch `imageUrl` and `status`:

```typescript
// CURRENT SELECT (lines 73–83) — missing imageUrl and status:
const [watchRow] = await db
  .select({ userId: watches.userId, brand: watches.brand, model: watches.model })
  .from(watches)
  .where(eq(watches.id, target.id))
  .limit(1)

// REQUIRED (extend to also fetch imageUrl + status for logActivity metadata):
const [watchRow] = await db
  .select({
    userId: watches.userId,
    brand: watches.brand,
    model: watches.model,
    imageUrl: watches.imageUrl,   // for feed thumbnail
    status: watches.status,       // for D-12 gate in feed
  })
  .from(watches)
  .where(eq(watches.id, target.id))
  .limit(1)
```

**`logActivity` call to add** (after `createComment` + before `revalidateTag`, mirroring `logNotification` guard at lines 143–177):
```typescript
// Mirror the same ownerId !== user.id guard as logNotification:
if (ownerId !== user.id) {
  await logActivity(user.id, 'commented',
    target.type === 'watch' ? target.id : null,  // watchId null for wear (no wearEventId col)
    {
      brand: watchBrand,
      model: watchModel,
      imageUrl: imageUrl ?? null,
      targetType: target.type,           // 'watch' or 'wear' — NOT 'wear_event'
      targetOwnerId: ownerId,
      watchStatus: target.type === 'watch' ? watch.status : undefined,
      wearEventId: target.type === 'wear' ? target.id : undefined,
    }
  )
}
```

**`revalidateTag` pattern** (line 133 — two-arg form, copy exactly):
```typescript
// VERIFIED: two-arg form is required (not deprecated single-arg):
revalidateTag(`profile:${ownerProfile.username}`, 'max')
```

**`deleteCommentAction`** (lines 243–269) — MISSING `revalidateTag` (Pitfall 6 from RESEARCH):
```typescript
// CURRENT deleteCommentAction (lines 258–264) — no revalidateTag, no owner lookup:
await deleteComment(user.id, parsed.data.commentId)
return { success: true, data: { id: parsed.data.commentId } }

// REQUIRED: read-then-delete (mirror editCommentAction lines 208–234 pattern):
// 1. Read comment to get watchId/wearEventId (editCommentAction does this)
// 2. Delete the comment
// 3. Resolve owner and revalidateTag (mirror editCommentAction lines 208–234)
// editCommentAction's owner-lookup pattern (lines 208–234):
if (comment.watchId) {
  const [watchRow] = await db
    .select({ userId: watches.userId })
    .from(watches)
    .where(eq(watches.id, comment.watchId))
    .limit(1)
  if (watchRow) {
    const ownerProfile = await getProfileById(watchRow.userId)
    if (ownerProfile?.username) {
      revalidateTag(`profile:${ownerProfile.username}`, 'max')
    }
  }
} else if (comment.wearEventId) {
  // ... same pattern for wearEventId
}
```

---

### `src/data/activities.ts` — modifications

**`ActivityType` union** (line 21) — add `'commented'`:
```typescript
// CURRENT (line 21):
export type ActivityType = 'watch_added' | 'wishlist_added' | 'watch_worn'

// REQUIRED — add 'commented':
export type ActivityType = 'watch_added' | 'wishlist_added' | 'watch_worn' | 'commented'
// NOTE: src/lib/feedTypes.ts line 12 defines an identical type — must be kept in sync
// (or deduplicated so one imports from the other).
```

**`logActivity` overload pattern** (lines 53–83) — add `'commented'` overload:
```typescript
// EXISTING overload pattern (lines 53–70) — copy exactly for 'commented':
export async function logActivity(
  userId: string,
  type: 'watch_added',
  watchId: string | null,
  metadata: WatchAddedMetadata,
): Promise<void>
// ... (two more overloads)

// NEW overload to add (mirror the pattern):
export type CommentedMetadata = {
  brand: string
  model: string
  imageUrl: string | null
  targetType: 'watch' | 'wear'       // 'wear' NOT 'wear_event'
  targetOwnerId: string
  watchStatus?: string               // only for watch targets (for D-12 gate)
  wearEventId?: string               // only for wear targets (for navigation link)
}

export async function logActivity(
  userId: string,
  type: 'commented',
  watchId: string | null,
  metadata: CommentedMetadata,
): Promise<void>
```

**Implementation body** (lines 71–83) — unchanged; the `ActivityMetadata` union type must be widened:
```typescript
// CURRENT implementation (lines 71–83):
export async function logActivity(
  userId: string,
  type: ActivityType,
  watchId: string | null,
  metadata: ActivityMetadata,
): Promise<void> {
  await db.insert(activities).values({ userId, type, watchId, metadata })
}
// Widen ActivityMetadata union:
export type ActivityMetadata =
  | WatchAddedMetadata
  | WishlistAddedMetadata
  | WatchWornMetadata
  | CommentedMetadata  // NEW
```

**`getFeedForUser` WHERE clause** (lines 161–165) — add `'commented'` branch (D-12):
```typescript
// CURRENT inner gate (lines 161–165):
sql`(
  (${activities.type} = 'watch_added'     AND ${profileSettings.collectionPublic} = true)
  OR (${activities.type} = 'wishlist_added' AND ${profileSettings.wishlistPublic} = true)
  OR (${activities.type} = 'watch_worn'     AND ${activities.metadata}->>'visibility' IN ('public','followers'))
)`,

// REQUIRED — add commented branch. The outer JOIN already gates by
// viewerId following the ACTOR (commenter). This inner gate adds the
// target-owner visibility check for wishlist-watch comment rows (D-12):
sql`(
  (${activities.type} = 'watch_added'     AND ${profileSettings.collectionPublic} = true)
  OR (${activities.type} = 'wishlist_added' AND ${profileSettings.wishlistPublic} = true)
  OR (${activities.type} = 'watch_worn'     AND ${activities.metadata}->>'visibility' IN ('public','followers'))
  OR (${activities.type} = 'commented' AND (
    ${activities.metadata}->>'targetType' = 'wear'
    OR (${activities.metadata}->>'targetType' = 'watch' AND ${activities.metadata}->>'watchStatus' != 'wishlist')
    OR (${activities.metadata}->>'targetType' = 'watch' AND ${activities.metadata}->>'watchStatus' = 'wishlist'
        AND EXISTS (
          SELECT 1 FROM follows f1
          JOIN follows f2
            ON f2.follower_id = f1.following_id AND f2.following_id = f1.follower_id
          WHERE f1.follower_id = ${viewerId}
            AND f1.following_id = (${activities.metadata}->>'targetOwnerId')::uuid
        ))
  ))
)`,
```

**`normalizeMetadata`** (lines 197–211) — extend to pass through `wearEventId`:
```typescript
// CURRENT (lines 197–211) — strips non-standard fields:
function normalizeMetadata(raw: unknown): RawFeedRow['metadata'] {
  if (raw && typeof raw === 'object') {
    const m = raw as Record<string, unknown>
    const v = m.visibility
    const visibility: WearVisibility | undefined = ...
    return {
      brand: typeof m.brand === 'string' ? m.brand : '',
      model: typeof m.model === 'string' ? m.model : '',
      imageUrl: typeof m.imageUrl === 'string' ? m.imageUrl : null,
      ...(visibility ? { visibility } : {}),
    }
  }
  return { brand: '', model: '', imageUrl: null }
}
// REQUIRED: also pass through wearEventId for wear-comment feed navigation:
return {
  brand: typeof m.brand === 'string' ? m.brand : '',
  model: typeof m.model === 'string' ? m.model : '',
  imageUrl: typeof m.imageUrl === 'string' ? m.imageUrl : null,
  ...(visibility ? { visibility } : {}),
  ...(typeof m.wearEventId === 'string' ? { wearEventId: m.wearEventId } : {}),
}
```

---

### `src/lib/feedTypes.ts` — modifications

**`ActivityType` union** (line 12) — must stay in sync with `activities.ts`:
```typescript
// CURRENT (line 12):
export type ActivityType = 'watch_added' | 'wishlist_added' | 'watch_worn'

// REQUIRED:
export type ActivityType = 'watch_added' | 'wishlist_added' | 'watch_worn' | 'commented'
```

**`RawFeedRow.metadata`** (lines 47–52) — extend to carry `wearEventId`:
```typescript
// CURRENT (lines 47–52):
metadata: {
  brand: string
  model: string
  imageUrl: string | null
  visibility?: WearVisibility
}

// REQUIRED — add wearEventId for wear-comment navigation:
metadata: {
  brand: string
  model: string
  imageUrl: string | null
  visibility?: WearVisibility
  wearEventId?: string        // only for 'commented' rows on wear targets
}
```

---

### `src/components/home/ActivityRow.tsx` — modifications

**`VERBS` map** (lines 11–15) — add `commented`:
```typescript
// CURRENT (lines 11–15):
const VERBS: Record<RawFeedRow['type'], string> = {
  watch_added: 'added',
  wishlist_added: 'wishlisted',
  watch_worn: 'wore',
}

// REQUIRED — the Record type is exhaustive over ActivityType; adding 'commented'
// to the ActivityType union surfaces a TypeScript error here until the VERBS map
// is also updated:
const VERBS: Record<RawFeedRow['type'], string> = {
  watch_added: 'added',
  wishlist_added: 'wishlisted',
  watch_worn: 'wore',
  commented: 'commented on',   // "tyler commented on Submariner Hulk" (D-11)
}
```

**Watch link branch** (lines 49–58) — add wear branch for `watchId === null`:
```typescript
// CURRENT (lines 49–58):
{row.watchId ? (
  <Link href={`/watch/${row.watchId}`} ...>
    {watchName}
  </Link>
) : (
  <span>{watchName}</span>
)}

// REQUIRED — add wear branch:
{row.watchId ? (
  <Link href={`/watch/${row.watchId}`} aria-label={`${watchName} detail`}
        className="relative z-10 hover:underline focus-visible:underline focus-visible:outline-none">
    {watchName}
  </Link>
) : row.metadata.wearEventId ? (
  <Link href={`/wear/${row.metadata.wearEventId}`} aria-label={`${watchName} wear detail`}
        className="relative z-10 hover:underline focus-visible:underline focus-visible:outline-none">
    {watchName}
  </Link>
) : (
  <span>{watchName}</span>   // defensive fallback
)}
```

---

### `src/lib/feedAggregate.ts` — NO CHANGE REQUIRED

**Verified:** `aggregateFeed` (lines 20–51) is an allowlist check. Adding `'commented'` to `ActivityType` does NOT require a change here — `'commented'` is simply not in the `aggregatable` allowlist and passes through as an individual `RawFeedRow`. The code at lines 25–26:

```typescript
// CURRENT (lines 25–26) — no change needed:
const aggregatable =
  head.type === 'watch_added' || head.type === 'wishlist_added'
// 'watch_worn' is already exempt (D-14 precedent). 'commented' is also exempt by omission.
// This is a positive allowlist — no exhaustive switch — so adding to ActivityType union
// does NOT cause a TypeScript error here.
```

---

### `src/components/profile/ProfileWatchCard.tsx` — modifications

**Current `CardContent` block** (lines 97–113) — the count line lands at the bottom:
```typescript
// CURRENT CardContent (lines 97–113):
<CardContent className="px-3 py-2 flex flex-col gap-1 flex-1">
  {tag && (
    <Badge variant="secondary" className="rounded-full text-xs font-normal self-start">
      {tag}
    </Badge>
  )}
  {!isWishlistLike && (
    <p className="text-xs text-muted-foreground">{lastWornLabel}</p>
  )}
  {priceLine && (
    <p className="text-xs font-normal text-foreground">{priceLine}</p>
  )}
  {showWishlistMeta && watch.notes && (
    <p className="line-clamp-2 text-xs text-muted-foreground">Notes: {watch.notes}</p>
  )}
</CardContent>
```

**Required addition** (from UI-SPEC §ProfileWatchCard + D-09):
```typescript
// Add likeCount and commentCount to ProfileWatchCardProps:
interface ProfileWatchCardProps {
  watch: Watch
  lastWornDate: string | null
  showWishlistMeta?: boolean
  likeCount?: number          // NEW — from batched query (DISP-01)
  commentCount?: number       // NEW — 0 for gated viewers (D-10 enforcement is in the query)
}

// Add at the bottom of CardContent (after the existing lines, before closing tag):
{((likeCount ?? 0) > 0 || (commentCount ?? 0) > 0) && (
  <p className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
    {(likeCount ?? 0) > 0 && (
      <>
        <Heart className="size-3" aria-hidden />
        {likeCount}
      </>
    )}
    {(likeCount ?? 0) > 0 && (commentCount ?? 0) > 0 && (
      <span className="mx-1">·</span>
    )}
    {(commentCount ?? 0) > 0 && (
      <>
        <MessageCircle className="size-3" aria-hidden />
        {commentCount}
      </>
    )}
  </p>
)}
// Imports to add: Heart, MessageCircle from 'lucide-react'
```

**`SortableProfileWatchCard.tsx`** (lines 8–13, 94–98) — props mirror:
```typescript
// CURRENT SortableProfileWatchCard props (lines 8–13):
interface SortableProfileWatchCardProps {
  id: string
  watch: Watch
  lastWornDate: string | null
  showWishlistMeta: boolean
}
// REQUIRED — add counts (thread through to ProfileWatchCard):
interface SortableProfileWatchCardProps {
  id: string
  watch: Watch
  lastWornDate: string | null
  showWishlistMeta: boolean
  likeCount?: number    // NEW
  commentCount?: number // NEW
}

// ProfileWatchCard usage (lines 94–98):
<ProfileWatchCard
  watch={watch}
  lastWornDate={lastWornDate}
  showWishlistMeta={showWishlistMeta}
  likeCount={likeCount}       // NEW
  commentCount={commentCount} // NEW
/>
```

---

### `src/components/wear/WearCommentHost.tsx` — seam fill

**Current seam markers** (lines 44, 60–61):
```typescript
// bottom-sheet seam (line 44):
{/* Phase 57: shared comment component renders here */}
<p className="text-sm text-muted-foreground px-4 py-6 text-center">
  No comments yet.
</p>

// inline seam (lines 60–61):
{/* Phase 57: shared comment component renders here */}
<p className="text-sm text-muted-foreground text-center py-4">
  No comments yet.
</p>
```

**Seam fill approach** (RESEARCH §7 — WearCommentHost is a client component; cannot await):

The server parent (`WearPhotoStreamed` in `wear/[wearEventId]/page.tsx`) must resolve `initialComments`, `canComment`, `ownerFollowsViewer` and pass them as props. The `WearCommentHost` props interface must be extended:

```typescript
// Extend the discriminated union (lines 15–17):
type WearCommentHostProps =
  | {
      variant: 'bottom-sheet'
      wearEventId: string
      open: boolean
      onOpenChange: (v: boolean) => void
      // NEW — server-resolved gate state:
      initialComments: Comment[]
      canComment: boolean
      ownerFollowsViewer: boolean
      ownerUserId: string
      ownerUsername: string
      viewerId: string | null
    }
  | {
      variant: 'inline'
      wearEventId: string
      open?: never
      onOpenChange?: never
      // NEW — same server-resolved gate state:
      initialComments: Comment[]
      canComment: boolean
      ownerFollowsViewer: boolean
      ownerUserId: string
      ownerUsername: string
      viewerId: string | null
    }

// Seam replaced with:
<CommentList
  initialComments={initialComments}
  target={{ type: 'wear', id: wearEventId }}
  canComment={canComment}
  ownerFollowsViewer={ownerFollowsViewer}
  ownerUserId={ownerUserId}
  ownerUsername={ownerUsername}
  viewerId={viewerId}
/>
```

---

### `src/app/watch/[id]/page.tsx` — modifications

**Current structure** (lines 23–139) — add comment reads alongside `getLikesForTargetCached`:
```typescript
// CURRENT (line 40):
const likeState = await getLikesForTargetCached(user.id, { type: 'watch', id })

// REQUIRED — add after getLikesForTargetCached:
// (These are uncached — no 'use cache' wrapper)
const target = { type: 'watch' as const, id }
const [canComment, likeState] = await Promise.all([
  canViewerCommentOnTarget(user.id, target),
  getLikesForTargetCached(user.id, target),
])
// ownerFollowsViewer: only needed when gate is closed on a wishlist watch
const ownerFollowsViewer = !canComment && watch.status === 'wishlist'
  ? await isFollowing(watch.userId, user.id)  // owner→viewer direction
  : false
```

**RSC sibling pattern** (lines 117–118) — `CommentThread` follows the same composition:
```typescript
// EXISTING RSC sibling pattern (lines 117–118):
<SameFamilyRail rows={sameFamily} />
<LineageRail rows={lineage} />

// NEW RSC sibling below these:
<Suspense fallback={<CommentThreadSkeleton />}>
  <CommentThread
    viewerId={user.id}
    target={{ type: 'watch', id }}
    canComment={canComment}
    ownerFollowsViewer={ownerFollowsViewer}
    ownerUserId={watch.userId}
    ownerUsername={ownerProfile.username}  // resolve alongside other data
  />
</Suspense>
```

**Comment count in footer row** (lines 153–163 of `WatchDetail.tsx`):
```typescript
// CURRENT footer row (lines 153–163 of WatchDetail.tsx):
{viewerId !== undefined && initialLikeState !== undefined && (
  <div className="flex items-center gap-2 mt-3">
    <LikeButton ... />
  </div>
)}

// REQUIRED — add commentCount as prop; render MessageCircle sibling:
<div className="flex items-center gap-2 mt-3">
  <LikeButton ... />
  {(initialCommentCount ?? 0) > 0 && (
    <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground px-2 min-h-[44px]">
      <MessageCircle className="size-5 text-muted-foreground" aria-hidden />
      {initialCommentCount}
    </span>
  )}
</div>
```

---

### `src/app/wear/[wearEventId]/page.tsx` — modifications

**`WearPhotoStreamed`** (lines 121–186) — add comment reads before passing props to `WearCard`:
```typescript
// CURRENT WearPhotoStreamed resolves (lines 155–164):
let signedUrl: string | null = null
if (photoUrl) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.storage.from('wear-photos').createSignedUrl(photoUrl, 60 * 60)
  signedUrl = data?.signedUrl ?? null
}

// REQUIRED — add comment gate reads (uncached):
const target = { type: 'wear' as const, id: wearEventId }
const [canComment, initialComments] = await Promise.all([
  canViewerCommentOnTarget(viewerId, target),
  getCommentsForTarget(viewerId, target),
])
// Wear targets: ownerFollowsViewer is always false (no wishlist concept on wears, GATE-01)
const ownerFollowsViewer = false
```

**`WearCard` props** (lines 166–184) — add comment-thread props to pass to `WearCommentHost`:
```typescript
<WearCard
  ...
  commentHostVariant="inline"
  // NEW — thread through to WearCommentHost:
  initialComments={initialComments}
  canComment={canComment}
  ownerFollowsViewer={ownerFollowsViewer}
  ownerUserId={wear.userId}
  ownerUsername={wear.username ?? ''}
/>
```

---

### `src/data/reactions.ts` (or new `src/data/counts.ts`) — new batched query (DISP-01)

**Analog:** `src/data/reactions.ts` `getLikesForTarget` (lines 29–52) + `getLikesForTargetCached` (lines 145–152)

**`getLikesForTarget` single-query aggregate pattern** (lines 29–52):
```typescript
// EXISTING single-target pattern to extend into a batch:
export async function getLikesForTarget(viewerId: string, target: LikeTarget): Promise<LikesResult> {
  if (target.type === 'watch') {
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
        viewerHasLiked: sql<boolean>`coalesce(bool_or(${watchLikes.userId} = ${viewerId}), false)`,
      })
      .from(watchLikes)
      .where(eq(watchLikes.watchId, target.id))
    return { count: rows[0]?.count ?? 0, viewerHasLiked: rows[0]?.viewerHasLiked ?? false }
  }
  // ...
}
```

**`getLikesForTargetCached` `'use cache'` + `cacheTag` pattern** (lines 145–152):
```typescript
// COPY EXACTLY for the batched counts cache wrapper:
export async function getLikesForTargetCached(viewerId: string, target: LikeTarget): Promise<LikesResult> {
  'use cache'
  cacheTag(`reactions:${target.type}:${target.id}`, `viewer:${viewerId}:reactions`)
  return getLikesForTarget(viewerId, target)
}

// Batched cached version analog:
export async function getBatchedWatchCountsCached(
  viewerId: string,
  watchIds: string[],
  profileUsername: string,
): Promise<Map<string, WatchCounts>> {
  'use cache'
  // Include viewerId in tag: comment counts are viewer-scoped (gated for wishlist watches)
  cacheTag(`profile:${profileUsername}`, `viewer:${viewerId}:counts`)
  return getBatchedWatchCounts(viewerId, watchIds)
}
```

**`inArray` batch pattern** (from `src/data/follows.ts` lines 133–134, 165–179):
```typescript
// inArray already used throughout codebase for batch reads:
const ids = followerRows.map((r) => r.userId)
// ...
db.select().from(profiles).where(inArray(profiles.id, ids))
db.select().from(profileSettings).where(inArray(profileSettings.userId, ids))
```

**`FILTER` aggregate pattern** (from `src/data/follows.ts` `isMutualFollow` lines 77–95 and `mergeListEntries` lines 173–179):
```typescript
// isMutualFollow single-round-trip bidirectional check (DO NOT use in a loop — N+1):
const rows = await db
  .select({
    aToB: sql<number>`count(*) FILTER (WHERE ${follows.followerId} = ${userA} AND ${follows.followingId} = ${userB})::int`,
    bToA: sql<number>`count(*) FILTER (WHERE ${follows.followerId} = ${userB} AND ${follows.followingId} = ${userA})::int`,
  })
  .from(follows)
  .where(or(
    and(eq(follows.followerId, userA), eq(follows.followingId, userB)),
    and(eq(follows.followerId, userB), eq(follows.followingId, userA)),
  ))

// For the batch: use two inArray queries (viewer→owners + owners→viewer) then
// compute mutual-follow set in JS (merge pattern from mergeListEntries lines 165–184):
const viewerFollowsOwners = await db
  .select({ followingId: follows.followingId })
  .from(follows)
  .where(and(eq(follows.followerId, viewerId), inArray(follows.followingId, wishlistOwnerIds)))
const ownersFollowViewer = await db
  .select({ followerId: follows.followerId })
  .from(follows)
  .where(and(eq(follows.followingId, viewerId), inArray(follows.followerId, wishlistOwnerIds)))

const viewerFollowsSet = new Set(viewerFollowsOwners.map(r => r.followingId))
const ownersFollowSet = new Set(ownersFollowViewer.map(r => r.followerId))
const mutualSet = new Set([...viewerFollowsSet].filter(id => ownersFollowSet.has(id)))
```

**`count(*) GROUP BY` pattern** (from `mergeListEntries` lines 173–179):
```typescript
// Batch aggregate already used in follows.ts:
db.select({
  userId: watches.userId,
  watchCount: sql<number>`count(*) FILTER (WHERE ${watches.status} = 'owned')::int`,
  wishlistCount: sql<number>`count(*) FILTER (WHERE ${watches.status} IN ('wishlist','grail'))::int`,
}).from(watches).where(inArray(watches.userId, ids)).groupBy(watches.userId)

// Like counts batch analog (new, no existing batch):
const likeCountRows = await db
  .select({
    watchId: watchLikes.watchId,
    count: sql<number>`count(*)::int`,
  })
  .from(watchLikes)
  .where(inArray(watchLikes.watchId, watchIds))
  .groupBy(watchLikes.watchId)
```

---

## Shared Patterns

### Authentication / viewerId resolution
**Source:** `src/app/watch/[id]/page.tsx` lines 24–25 + `src/app/wear/[wearEventId]/page.tsx` lines 50–51
**Apply to:** All page-level RSCs that need auth

```typescript
// Watch page (auth-only route, getCurrentUser throws for anon):
const user = await getCurrentUser()
// ...
const viewerId = user.id  // always string on this route

// Wear page (auth-only post-56A EN-6):
const user = await getCurrentUser()
const viewerId = user.id
// Do NOT wrap in try/catch for UnauthorizedError
```

### Optimistic mutation — `useState` + `useTransition` + rollback
**Source:** `src/components/shared/LikeButton.tsx` lines 51–91
**Apply to:** `CommentList`, `CommentItem` (edit + delete)

```typescript
// Core pattern — copy verbatim, adapt state shape:
const [state, setState] = useState(initialState)
const [pending, startTransition] = useTransition()

startTransition(async () => {
  const result = await action(input)
  if (!result.success) {
    setState(previousState)   // rollback
    console.error('[Component] action failed:', result.error)
    return
  }
  setState(result.data)       // reconcile to server-confirmed value
})
```

### Anon bounce pattern
**Source:** `src/components/profile/FollowButton.tsx` lines 65–72 + `src/components/shared/LikeButton.tsx` lines 63–67
**Apply to:** `CommentCompose` (if anon reaches compose via `viewerId: null`), `CommentGateLocked` (FollowButton handles it)

```typescript
if (viewerId === null) {
  const next = encodeURIComponent(window.location.pathname)
  router.push(`/login?next=${next}`)
  return
}
```

### `revalidateTag` (two-arg form)
**Source:** `src/app/actions/comments.ts` line 133
**Apply to:** `addCommentAction` (new `logActivity` task), `deleteCommentAction` (gap fix), any new Server Actions

```typescript
// TWO-ARG FORM REQUIRED (verified against codebase — single-arg is deprecated):
revalidateTag(`profile:${ownerProfile.username}`, 'max')
revalidateTag(`viewer:${ownerId}`, 'max')
```

### Error handling in Server Actions
**Source:** `src/app/actions/comments.ts` lines 51–184 — discriminated `code:'gate'` pattern
**Apply to:** Any action that can hit the comment gate

```typescript
// gate rejection (Phase 55 D-09 contract — do NOT string-match):
if (err instanceof CommentGateError) {
  return { success: false, error: err.message, code: 'gate' as const }
}
// generic error:
console.error('[actionName] unexpected error:', err)
return { success: false, error: "Couldn't post comment. Try again." }
```

### `'use cache'` + `cacheTag` for DAL reads
**Source:** `src/data/reactions.ts` lines 145–152
**Apply to:** `getBatchedWatchCountsCached` (new batched grid count function)

```typescript
export async function getLikesForTargetCached(viewerId, target) {
  'use cache'
  cacheTag(`reactions:${target.type}:${target.id}`, `viewer:${viewerId}:reactions`)
  return getLikesForTarget(viewerId, target)
}
// Rule: resolve auth OUTSIDE this scope (request-time APIs forbidden inside 'use cache')
// Rule: viewerId MUST be passed as explicit argument to isolate per-viewer cache entries
```

---

## No Analog Found

All files have analogs in the codebase. No files required pure greenfield patterns.

---

## Critical Landmines (for Planner)

1. **`'wear'` vs `'wear_event'`** — The Zod enum in `addCommentAction` (line 30) and DAL `CommentTarget` (line 31 of `comments.ts`) both use `'wear'`. Every metadata field, activity branch, and feed link branch must use `'wear'` not `'wear_event'`.

2. **Stale comment order** — `getCommentsForTarget` at line 150/156 of `comments.ts` uses `asc(comments.createdAt)` with stale comment. Change to `desc`. Update import, update inline comment, update REQUIREMENTS.md CMNT-03/CMNT-08.

3. **`deleteCommentAction` missing `revalidateTag`** — Lines 258–264 of `comments.ts` have no revalidateTag call. This is a Phase 55 oversight. Pattern to fix: read-then-delete (mirror `editCommentAction` lines 208–234).

4. **Two `ActivityType` definitions** — `src/data/activities.ts` line 21 AND `src/lib/feedTypes.ts` line 12 both define the same type. Both must be updated to add `'commented'`. Consider deduplicating (have one import from the other) to prevent future drift.

5. **Feed actor-vs-owner gate** — The inner WHERE gate in `getFeedForUser` (lines 161–165) gates by ACTOR's `profileSettings`. For `commented` rows, the actor is the commenter, not the watch owner. A new branch is required that gates by the TARGET owner's wishlist visibility.

6. **`isFollowing` direction for `ownerFollowsViewer`** — `isFollowing(followerId, followingId)`. To check if owner follows viewer: `isFollowing(ownerId, viewerId)`, NOT `isFollowing(viewerId, ownerId)`.

7. **`activities.watchId` is null for wear comments** — The `activities` table has no `wearEventId` column (verified: `src/db/schema.ts` line 285). Wear comment activities carry `wearEventId` in `metadata` only. Pass `watchId: null` to `logActivity` for wear-target comments.

8. **NO `'use cache'` on comment thread** — Privacy guarantee. The seam fill in `WearCommentHost` and the new `CommentThread` component must never carry `'use cache'`.

---

## Metadata

**Analog search scope:** `src/components/`, `src/data/`, `src/lib/`, `src/app/`
**Files read:** 16 source files (all analogs and modified files read in full)
**Pattern extraction date:** 2026-05-23
