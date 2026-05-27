# Phase 63: Inline Grid Engagement - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 8 new/modified files (1 new, 7 modified)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/data/reactions.ts` | service/DAL | CRUD + batch | itself (existing `getBatchedWatchCounts` + `Q4/Q5` pattern) | exact (self-extension) |
| `src/app/actions/reactions.ts` | server-action | request-response | itself (existing `revalidateTag` + `updateTag` calls at lines 102-111) | exact (self-extension) |
| `src/app/actions/comments.ts` | server-action | request-response | itself (existing `revalidateTag` calls at lines 162-164) | exact (self-extension) |
| `src/components/profile/ProfileWatchCard.tsx` | component | event-driven | `src/components/shared/LikeButton.tsx` (optimistic toggle) + itself (overlay badge at lines 87-98) | role-match (same component, new overlay region) |
| `src/components/watch/WatchCommentSheet.tsx` (NEW) | component | event-driven | `src/components/wear/WearCommentHost.tsx` (bottom-sheet variant) + `src/components/comment/CommentList.tsx` (composeKey re-mount) | role-match (compose-only subset) |
| `src/components/profile/CollectionTabContent.tsx` | component | request-response | itself (existing `counts` prop threading at lines 30-31, 190-193) | exact (self-extension) |
| `src/components/profile/WishlistTabContent.tsx` | component | request-response | itself (existing `counts` prop threading at lines 41-42, 95-105, 271-275) + `SortableProfileWatchCard` passthrough | exact (self-extension) |
| `src/app/u/[username]/[tab]/page.tsx` | route/RSC | request-response | itself (existing `getBatchedWatchCountsCached` call at lines 374-379) | exact (self-extension) |
| `tests/data/getBatchedWatchCounts.test.ts` | test | — | itself (existing `mockResultQueue` pattern at lines 14-57) | exact (new test cases in existing describe block) |
| `tests/actions/reactions.test.ts` | test | — | itself (existing `revalidateTag` assertion pattern at lines 172-194) | exact (new assertion in existing describe block) |
| `tests/actions/comments.test.ts` | test | — | itself (existing `revalidateTag` assertion pattern at lines 153-181) | exact (new assertion in existing describe block) |

---

## Pattern Assignments

### `src/data/reactions.ts` — extend `WatchCounts` type + `getBatchedWatchCounts` (service, CRUD)

**Analog:** itself — the existing Q1–Q5 query pattern + result Map build at lines 191-295.

**Current type to extend** (lines 158-161):
```typescript
// src/data/reactions.ts:158-161
export interface WatchCounts {
  likeCount: number
  commentCount: number
}
```

**Extended type (add two fields):**
```typescript
export interface WatchCounts {
  likeCount: number
  commentCount: number
  liked: boolean       // NEW — viewer has liked this watch (seeded by Q6)
  canComment: boolean  // NEW — viewer is allowed to comment (= allowedSet membership)
}
```

**Q6 query to insert after Q5** (after line 281, before the result Map build at line 286):
```typescript
// Q6: viewer's liked set — which watchIds has the viewer already liked?
// Single inArray query — NOT a per-watch loop (Anti-Pattern: N+1 for liked, RESEARCH Pitfall 6)
const viewerLikedRows = await db
  .select({ watchId: watchLikes.watchId })
  .from(watchLikes)
  .where(and(eq(watchLikes.userId, viewerId), inArray(watchLikes.watchId, watchIds)))
const viewerLikedSet = new Set(viewerLikedRows.map((r) => r.watchId))
```

**Result Map build update** (replace lines 287-291):
```typescript
// Before (lines 287-291):
result.set(id, {
  likeCount: likeCountMap.get(id) ?? 0,
  commentCount: commentCountMap.get(id) ?? 0,
})

// After:
result.set(id, {
  likeCount: likeCountMap.get(id) ?? 0,
  commentCount: commentCountMap.get(id) ?? 0,
  liked: viewerLikedSet.has(id),      // NEW — from Q6
  canComment: allowedSet.has(id),     // NEW — allowedSet already computed at line 250
})
```

**Query budget note:** Q1+Q2+Q3+Q4+Q5 = 5 existing; +Q6 = 6 total. `getBatchedWatchCountsCached` wrapper (lines 316-324) requires no changes — it delegates to `getBatchedWatchCounts` and the return type widens automatically.

**Imports pattern** (lines 1-7 — `watchLikes` and `inArray` are already imported; no new imports needed):
```typescript
import { and, eq, inArray, sql } from 'drizzle-orm'   // inArray already present
import { comments, follows, watchLikes, watches, wearLikes } from '@/db/schema'  // watchLikes already present
```

---

### `src/app/actions/reactions.ts` — add `viewer:counts` revalidation (server-action, request-response)

**Analog:** itself — the existing cache-invalidation block at lines 100-111.

**Current revalidation block** (lines 100-111 — the D-12 gap is real):
```typescript
// src/app/actions/reactions.ts:100-111
// These tags ARE busted today:
revalidateTag(`reactions:${target.type}:${target.id}`, 'max')   // line 102
revalidateTag(`profile:${ownerProfile.username}`, 'max')         // line 107 (inside if block)
updateTag(`viewer:${user.id}:reactions`)                          // line 111

// MISSING — add immediately after line 107 revalidateTag:
// revalidateTag(`viewer:${user.id}:counts`, 'max')
```

**Insertion point** — add as a fourth call in the block, after `revalidateTag('profile:...', 'max')` and before `updateTag(...)`:
```typescript
if (ownerProfile?.username) {
  revalidateTag(`profile:${ownerProfile.username}`, 'max')
  // D-12: bust viewer's own batched counts cache (liked + canComment fields).
  // viewer:reactions tag (updateTag below) covers LikeButton on detail page;
  // viewer:counts tag covers getBatchedWatchCountsCached on profile grid.
  revalidateTag(`viewer:${user.id}:counts`, 'max')   // ADD THIS LINE
}
updateTag(`viewer:${user.id}:reactions`)
```

**No new imports needed** — `revalidateTag` is already imported at line 3.

---

### `src/app/actions/comments.ts` — add `viewer:counts` revalidation (server-action, request-response)

**Analog:** itself — the existing cache-invalidation block at lines 161-164.

**Current revalidation block** (lines 161-164):
```typescript
// src/app/actions/comments.ts:161-164
const ownerProfile = await getProfileById(ownerId)
if (ownerProfile?.username) {
  revalidateTag(`profile:${ownerProfile.username}`, 'max')
}
```

**Insertion — add one line inside the if block:**
```typescript
if (ownerProfile?.username) {
  revalidateTag(`profile:${ownerProfile.username}`, 'max')
  // D-12: bust viewer's own batched counts cache so commentCount is fresh
  // on navigate-away/back (profile:username covers all viewers broadly;
  // viewer:counts covers this viewer's per-card liked+canComment fields).
  revalidateTag(`viewer:${user.id}:counts`, 'max')   // ADD THIS LINE
}
```

**No new imports needed** — `revalidateTag` is already imported at line 3.

---

### `src/components/profile/ProfileWatchCard.tsx` — add overlay chips (component, event-driven)

**Analog 1:** itself — existing overlay badge at lines 87-98 (the wear badge is `absolute top-2 left-2` inside `relative aspect-square bg-muted`).
**Analog 2:** `src/components/shared/LikeButton.tsx` — the full optimistic like pattern (lines 44-126).

**New props to add to `ProfileWatchCardProps`** (after existing `commentCount?` at line 18):
```typescript
// Add to interface ProfileWatchCardProps:
isOwner?: boolean        // D-03: when true, show static count line; no overlay chips
viewerId?: string | null // D-04: seeded liked state; anon-bounce on chip click
liked?: boolean          // D-11: initial liked state from getBatchedWatchCounts
canComment?: boolean     // D-09/D-11: gate flag; false hides 💬 chip
```

**Imports pattern** — `Heart` and `MessageCircle` already imported at line 5. Add `useState`, `useTransition` (new — from 'react'), `toggleLikeAction` (new), `addCommentAction` (new), `toast` (new from 'sonner'):
```typescript
// Add to existing imports:
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { toggleLikeAction } from '@/app/actions/reactions'
import { addCommentAction } from '@/app/actions/comments'
// WatchCommentSheet import (after new file is created):
import { WatchCommentSheet } from '@/components/watch/WatchCommentSheet'
```

**Existing overlay badge pattern to mirror** (lines 87-98 — positioning model for new chips):
```typescript
// src/components/profile/ProfileWatchCard.tsx:87-98
// Existing wear badge at top-2 left-2 — new chips go bottom-2 left-2
{!isWishlistLike && (isWornToday || isStale) && (
  <span
    className={cn(
      'absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-normal',
      isWornToday
        ? 'bg-accent text-accent-foreground'
        : 'bg-background text-foreground shadow ring-1 ring-border',
    )}
  >
    {isWornToday ? 'Worn today' : 'Not worn recently'}
  </span>
)}
```

**New scrim + chip overlay block to add inside `<div className="relative aspect-square bg-muted">`** (after line 98, before the closing `</div>` at line 99):
```typescript
// Non-owner engagement chips — D-03: isOwner guard; D-01: bottom-2 left-2 clear of wear badge
{!isOwner && (
  <>
    {/* Scrim: full-width bottom strip behind chips; pointer-events-none so image tap-to-navigate works */}
    <div className="absolute inset-x-0 bottom-0 h-12 bg-black/55 pointer-events-none" />
    {/* Chip row — z-10 so chips are above scrim and receive pointer events */}
    <div className="absolute bottom-2 left-2 z-10 flex gap-2">
      {/* ♥ Like chip — always visible for non-owner (D-04); optimistic flip (LikeButton pattern) */}
      <button
        type="button"
        aria-pressed={likedState}
        aria-busy={likePending}
        aria-label={likedState ? 'Unlike' : 'Like'}
        disabled={likePending}
        onClick={handleLikeClick}
        className={cn(
          'rounded-full bg-black/30 px-2 py-1 flex items-center gap-1',
          'text-white text-xs tabular-nums min-h-[44px] min-w-[44px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          likePending && 'opacity-50 cursor-wait',
        )}
      >
        <Heart
          className={cn('size-4', likedState ? 'text-red-400' : 'text-white/90')}
          fill={likedState ? 'currentColor' : 'none'}
        />
        {(likedState || likeCount > 0) && (
          <span>{likeCount}</span>
        )}
      </button>
      {/* 💬 Comment chip — only when canComment (D-09 gate) */}
      {canComment && (
        <button
          type="button"
          aria-label="Add a comment"
          onClick={handleCommentClick}
          className="rounded-full bg-black/30 px-2 py-1 flex items-center gap-1 text-white text-xs tabular-nums min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MessageCircle className="size-4 text-white/90" />
          {commentCountState > 0 && <span>{commentCountState}</span>}
        </button>
      )}
    </div>
    {/* Compose-only bottom sheet (D-06/GRID-04) */}
    <WatchCommentSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      watch={watch}
      viewerId={viewerId ?? null}
      onSuccess={handleCommentSuccess}
    />
  </>
)}
```

**Optimistic state for like chip** (mirrors `LikeButton` lines 51-53 + 59-91):
```typescript
// Inside ProfileWatchCard function body, before return:
const [likedState, setLikedState] = useState(liked ?? false)
const [likeCountState, setLikeCountState] = useState(likeCount ?? 0)
const [likePending, startLikeTransition] = useTransition()
const [commentCountState, setCommentCountState] = useState(commentCount ?? 0)
const [sheetOpen, setSheetOpen] = useState(false)

function handleLikeClick(e: React.MouseEvent) {
  e.preventDefault()    // D-02: stop <Link> navigation
  e.stopPropagation()
  const nextLiked = !likedState
  const nextCount = nextLiked ? likeCountState + 1 : likeCountState - 1
  setLikedState(nextLiked)
  setLikeCountState(nextCount)
  startLikeTransition(async () => {
    const result = await toggleLikeAction({ type: 'watch', id: watch.id })
    if (!result.success) {
      setLikedState(likedState)     // silent rollback (D-05)
      setLikeCountState(likeCountState)
      console.error('[ProfileWatchCard] like failed:', result.error)
      return
    }
    setLikedState(result.data.liked)    // reconcile (D-05)
    setLikeCountState(result.data.count)
  })
}

function handleCommentClick(e: React.MouseEvent) {
  e.preventDefault()    // D-02
  e.stopPropagation()
  setSheetOpen(true)
}

function handleCommentSuccess() {
  setCommentCountState((n) => n + 1)   // optimistic bump (D-07)
  setSheetOpen(false)
  toast('Comment posted')              // D-07
}
```

**Owner count line** (lines 117-136 — keep unchanged; only shown when `isOwner` or chips not applicable):
```typescript
// src/components/profile/ProfileWatchCard.tsx:117-136 — KEEP AS-IS for owner cards
// The chip block above is gated on !isOwner so there is no conflict.
// For isOwner cards, this static line remains the sole count display.
{((likeCount ?? 0) > 0 || (commentCount ?? 0) > 0) && (
  <p className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
    {(likeCount ?? 0) > 0 && (<><Heart className="size-3" aria-hidden />{likeCount}</>)}
    {(likeCount ?? 0) > 0 && (commentCount ?? 0) > 0 && <span className="mx-1">·</span>}
    {(commentCount ?? 0) > 0 && (<><MessageCircle className="size-3" aria-hidden />{commentCount}</>)}
  </p>
)}
```

---

### `src/components/watch/WatchCommentSheet.tsx` (NEW — compose-only sheet, component, event-driven)

**Analog:** `src/components/wear/WearCommentHost.tsx` (bottom-sheet variant, lines 88-115) — provides the `Sheet`/`SheetContent` skeleton and `CommentList`'s `composeKey` re-mount pattern. This new file uses the same shell but renders `CommentCompose` directly (no `CommentList`) to satisfy GRID-04 (compose-only).

**Imports pattern** (mirrors `WearCommentHost` + adds `addCommentAction` + `toast`):
```typescript
'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CommentCompose } from '@/components/comment/CommentCompose'
import { addCommentAction } from '@/app/actions/comments'
import { getSafeImageUrl } from '@/lib/images'
import type { Watch } from '@/lib/types'
```

**Props interface:**
```typescript
interface WatchCommentSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  watch: Watch                   // for identity header (thumbnail + brand + model)
  viewerId: string | null        // passed to CommentCompose (anon bounce)
  onSuccess: () => void          // parent bumps commentCount + closes sheet + fires toast
}
```

**Core pattern** — mirrors `WearCommentHost` bottom-sheet variant + `CommentList` `composeKey` re-mount (CommentList.tsx:78,131-132):
```typescript
export function WatchCommentSheet({ open, onOpenChange, watch, viewerId, onSuccess }: WatchCommentSheetProps) {
  const [composeKey, setComposeKey] = useState(0)   // mirrors CommentList:78
  const [pending, startTransition] = useTransition()
  const safeUrl = getSafeImageUrl(watch.imageUrl)

  function handleSubmit(body: string) {
    startTransition(async () => {
      const result = await addCommentAction({ type: 'watch', id: watch.id, body })
      if (!result.success) {
        // D-08: keep typed text — do NOT increment composeKey; fire failure toast
        toast.error('Failed to post comment. Please try again.')
        console.error('[WatchCommentSheet] action failed:', result.error)
        return
      }
      // D-07: success — clear textarea (re-mount) then call parent success handler
      setComposeKey((k) => k + 1)   // mirrors CommentList:132 — clears textarea
      onSuccess()                    // parent closes sheet, bumps count, fires 'Comment posted' toast
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-background z-50">
        <div className="mx-auto w-full max-w-[640px] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle className="sr-only">Add a comment</SheetTitle>
            {/* Watch identity header — thumbnail + brand + model (UI-SPEC) */}
            <div className="flex items-center gap-3 pb-2">
              <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                {safeUrl ? (
                  <Image src={safeUrl} alt={`${watch.brand} ${watch.model}`} fill className="object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">{watch.brand}</p>
                <p className="text-base font-semibold leading-tight truncate">{watch.model}</p>
              </div>
            </div>
          </SheetHeader>
          {/* GRID-04: CommentCompose only — NO CommentList, NO CommentThread */}
          <CommentCompose
            key={composeKey}    // re-mount on success to clear textarea (Pitfall 7 mitigation)
            viewerId={viewerId}
            pending={pending}
            onSubmit={handleSubmit}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

**Sheet bottom-side CSS chain** — reuse exact `WearCommentHost` class pattern (lines 91,95):
```typescript
// WearCommentHost.tsx:91,95 — the proven pattern:
<SheetContent side="bottom" className="bg-background max-h-[60vh] overflow-y-auto z-50">
  <div className="mx-auto w-full max-w-[640px] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
```
For `WatchCommentSheet` omit `max-h-[60vh] overflow-y-auto` — compose-only is short enough that scrolling is not needed.

---

### `src/components/profile/CollectionTabContent.tsx` — thread `viewerId` + `liked`/`canComment` (component, request-response)

**Analog:** itself — the existing `counts` prop threading at lines 30-31, 185-193.

**Props interface extension** (lines 20-31):
```typescript
// src/components/profile/CollectionTabContent.tsx:20-31 — current shape:
interface CollectionTabContentProps {
  watches: Watch[]
  wearDates: Record<string, string>
  isOwner: boolean
  hasUrlExtract: boolean
  counts?: Record<string, { likeCount: number; commentCount: number }>
}

// Extended shape — add viewerId:
interface CollectionTabContentProps {
  // ... (all existing props unchanged)
  counts?: Record<string, { likeCount: number; commentCount: number; liked: boolean; canComment: boolean }>
  viewerId?: string | null  // NEW — D-03: non-owner chip gate; D-04: seeded to each card
}
```

**Card render pattern extension** (lines 186-193 — add new props to `ProfileWatchCard`):
```typescript
// src/components/profile/CollectionTabContent.tsx:186-193 — current card render:
<ProfileWatchCard
  key={watch.id}
  watch={watch}
  lastWornDate={wearDates[watch.id] ?? null}
  likeCount={counts?.[watch.id]?.likeCount}
  commentCount={counts?.[watch.id]?.commentCount}
/>

// Extended — add isOwner, viewerId, liked, canComment:
<ProfileWatchCard
  key={watch.id}
  watch={watch}
  lastWornDate={wearDates[watch.id] ?? null}
  isOwner={isOwner}                                   // D-03 chip gate
  viewerId={viewerId}                                 // D-04 anon bounce
  likeCount={counts?.[watch.id]?.likeCount}
  commentCount={counts?.[watch.id]?.commentCount}
  liked={counts?.[watch.id]?.liked}                  // NEW D-11
  canComment={counts?.[watch.id]?.canComment}        // NEW D-09
/>
```

---

### `src/components/profile/WishlistTabContent.tsx` — thread `viewerId` + `liked`/`canComment` (component, request-response)

**Analog:** itself — the existing counts prop pattern at lines 41-42, 95-105 (non-owner grid) and `OwnerWishlistGrid` at lines 148-156, 270-275.

**Props interface extension** (lines 34-42):
```typescript
// Extend counts type + add viewerId:
interface WishlistTabContentProps {
  // ... (all existing props unchanged)
  counts?: Record<string, { likeCount: number; commentCount: number; liked: boolean; canComment: boolean }>
  viewerId?: string | null   // NEW
}
```

**Non-owner card render** (lines 95-105 — add new props):
```typescript
// src/components/profile/WishlistTabContent.tsx:96-104 — non-owner branch:
<ProfileWatchCard
  key={watch.id}
  watch={watch}
  lastWornDate={wearDates[watch.id] ?? null}
  showWishlistMeta
  isOwner={false}                                     // non-owner branch
  viewerId={viewerId}
  likeCount={counts?.[watch.id]?.likeCount}
  commentCount={counts?.[watch.id]?.commentCount}
  liked={counts?.[watch.id]?.liked}                  // NEW
  canComment={counts?.[watch.id]?.canComment}        // NEW
/>
```

**`OwnerWishlistGrid` sub-component** (lines 148-156 — extend props type + passthrough):
```typescript
// Extend sub-component props to accept viewerId (chips are non-owner-only so
// SortableProfileWatchCard never renders chips — safe even if passed through):
function OwnerWishlistGrid({
  watches,
  wearDates,
  counts,
}: {
  watches: Watch[]
  wearDates: Record<string, string>
  counts?: Record<string, { likeCount: number; commentCount: number; liked: boolean; canComment: boolean }>
})
```

**`SortableProfileWatchCard` call inside `OwnerWishlistGrid`** (lines 268-275 — add liked/canComment):
```typescript
// src/components/profile/WishlistTabContent.tsx:268-275 — owner drag path:
<SortableProfileWatchCard
  key={id}
  id={id}
  watch={watchesById[id]}
  lastWornDate={wearDates[id] ?? null}
  showWishlistMeta
  likeCount={counts?.[id]?.likeCount}
  commentCount={counts?.[id]?.commentCount}
  // liked and canComment intentionally NOT passed here — chips only appear for non-owner (D-03)
/>
```

---

### `src/components/profile/SortableProfileWatchCard.tsx` — pass-through `liked`/`canComment` if needed (component, event-driven)

**Analog:** itself — the existing `likeCount`/`commentCount` pass-through pattern at lines 8-14, 98-104.

**Note:** Per D-03, the owner is the only user who ever sees `SortableProfileWatchCard`, so chips never render on it. The planner may choose NOT to extend `SortableProfileWatchCard` props at all (the `liked`/`canComment` fields simply won't be passed). If the planner does pass them through for future-proofing, the pattern is:
```typescript
// Mirror existing likeCount/commentCount at lines 12-14:
liked?: boolean         // pass-through to ProfileWatchCard (chips gated by isOwner anyway)
canComment?: boolean    // pass-through to ProfileWatchCard
```

---

### `src/app/u/[username]/[tab]/page.tsx` — thread `viewerId` + enriched counts (RSC, request-response)

**Analog:** itself — the existing `getBatchedWatchCountsCached` + `counts` threading at lines 374-405.

**Current counts resolution + threading** (lines 374-405):
```typescript
// src/app/u/[username]/[tab]/page.tsx:374-405
const countsMap = viewerId !== null
  ? await getBatchedWatchCountsCached(viewerId, watchIds, profile.username)
  : new Map<string, { likeCount: number; commentCount: number }>()
const counts: Record<string, { likeCount: number; commentCount: number }> =
  Object.fromEntries(countsMap)
// ...
<CollectionTabContent
  watches={ownedWatches}
  wearDates={Object.fromEntries(wearDates)}
  isOwner={isOwner}
  hasUrlExtract={hasUrlExtract}
  counts={counts}
/>
// ...
<WishlistTabContent
  watches={watches.filter(...)}
  wearDates={Object.fromEntries(wearDates)}
  isOwner={isOwner}
  username={profile.username}
  counts={counts}
/>
```

**Extended pattern — type annotation widens automatically after `WatchCounts` extends; add `viewerId` prop to both tab contents:**
```typescript
// Type annotation update — WatchCounts now includes liked+canComment so
// Record<string, WatchCounts> carries the new fields; Object.fromEntries
// preserves the shape. No cast needed if typing is via WatchCounts.
const counts: Record<string, { likeCount: number; commentCount: number; liked: boolean; canComment: boolean }> =
  Object.fromEntries(countsMap)

// Thread viewerId into both tab contents (new prop):
<CollectionTabContent
  watches={ownedWatches}
  wearDates={Object.fromEntries(wearDates)}
  isOwner={isOwner}
  hasUrlExtract={hasUrlExtract}
  counts={counts}
  viewerId={viewerId}    // NEW — D-03/D-04
/>
// ...
<WishlistTabContent
  watches={watches.filter(...)}
  wearDates={Object.fromEntries(wearDates)}
  isOwner={isOwner}
  username={profile.username}
  counts={counts}
  viewerId={viewerId}    // NEW — D-03/D-04
/>
```

**Critical constraint (D-12 / Phase 52 lock):** Do NOT add `'use cache'` to `ProfileTabContent`. Do NOT add `getCurrentUser()` inside `getBatchedWatchCountsCached`. The `viewerId` is always resolved in the uncached scope and passed as an argument.

---

### Test files — new cases in existing files

#### `tests/data/getBatchedWatchCounts.test.ts` — add Q6 slot + `liked`/`canComment` assertions

**Analog:** itself — the existing `mockResultQueue` queue pattern at lines 121-145. Every existing test sets up 5 queue slots (Q1–Q5). Phase 63 adds Q6, so every test needs a 6th slot added to its `mockResultQueue.push(...)` sequence.

**Mock queue pattern for existing tests** (all tests need Q6 added — e.g., lines 126-135):
```typescript
// BEFORE (5 slots):
mockResultQueue.push([{ id: wishlistWatchId, userId: ownerId, status: 'wishlist' }]) // Q1
mockResultQueue.push([])                                                               // Q2
mockResultQueue.push([])                                                               // Q3
mockResultQueue.push([{ watchId: wishlistWatchId, count: 3 }])                        // Q4
mockResultQueue.push([{ watchId: wishlistWatchId, count: 5 }])                        // Q5

// AFTER (6 slots — Q6: viewer's watch_likes):
mockResultQueue.push([{ id: wishlistWatchId, userId: ownerId, status: 'wishlist' }]) // Q1
mockResultQueue.push([])                                                               // Q2
mockResultQueue.push([])                                                               // Q3
mockResultQueue.push([{ watchId: wishlistWatchId, count: 3 }])                        // Q4
mockResultQueue.push([{ watchId: wishlistWatchId, count: 5 }])                        // Q5
mockResultQueue.push([])                                                               // Q6 NEW — viewer liked set (empty = not liked)
```

**N+1 budget test** (lines 192-211 — update `≤5` assertion to `≤6`):
```typescript
// BEFORE: expect(selectCalls.length).toBeLessThanOrEqual(5)
// AFTER:  expect(selectCalls.length).toBeLessThanOrEqual(6)
```

**New test cases to add (new `it` blocks after line 268):**
```typescript
// New case: liked: true for a watch the viewer has liked (Q6 returns a row)
it('D-11: returns liked:true when Q6 returns viewer liked row', async () => {
  mockResultQueue.push([{ id: watchId1, userId: ownerId, status: 'owned' }]) // Q1
  mockResultQueue.push([])   // Q2
  mockResultQueue.push([])   // Q3
  mockResultQueue.push([{ watchId: watchId1, count: 2 }])   // Q4
  mockResultQueue.push([{ watchId: watchId1, count: 0 }])   // Q5
  mockResultQueue.push([{ watchId: watchId1 }])              // Q6 — viewer liked this watch

  const result = await getBatchedWatchCounts(viewerId, [watchId1])
  expect(result.get(watchId1)?.liked).toBe(true)
  expect(result.get(watchId1)?.canComment).toBe(true)  // non-wishlist = allowed
})

// New case: liked: false when Q6 returns no rows
it('D-11: returns liked:false when viewer has not liked the watch', async () => {
  mockResultQueue.push([{ id: watchId1, userId: ownerId, status: 'owned' }]) // Q1
  mockResultQueue.push([])   // Q2
  mockResultQueue.push([])   // Q3
  mockResultQueue.push([])   // Q4 no likes
  mockResultQueue.push([])   // Q5 no comments
  mockResultQueue.push([])   // Q6 viewer not liked

  const result = await getBatchedWatchCounts(viewerId, [watchId1])
  expect(result.get(watchId1)?.liked).toBe(false)
})

// New case: canComment:false for gated wishlist (D-09/D-11 — allowedSet gate)
it('D-11/GRID-05: returns canComment:false for gated wishlist watch (non-mutual viewer)', async () => {
  mockResultQueue.push([{ id: wishlistWatchId, userId: otherOwnerId, status: 'wishlist' }]) // Q1
  mockResultQueue.push([])   // Q2 viewer does not follow owner
  mockResultQueue.push([])   // Q3 owner does not follow viewer
  mockResultQueue.push([])   // Q4
  mockResultQueue.push([])   // Q5
  mockResultQueue.push([])   // Q6

  const result = await getBatchedWatchCounts(viewerId, [wishlistWatchId])
  expect(result.get(wishlistWatchId)?.canComment).toBe(false)
})
```

#### `tests/actions/reactions.test.ts` — assert `viewer:{userId}:counts` revalidation

**Analog:** itself — the existing `revalidateTag` / `updateTag` assertion at lines 172-194. Add a new `it` block to the `describe('toggleLikeAction Server Action')` block:

```typescript
// New test case (add after line 194):
// D-12: on successful like, revalidateTag('viewer:{userId}:counts', 'max') is called
it('D-12: on successful like calls revalidateTag(viewer:{userId}:counts, max)', async () => {
  ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'viewer@example.com' })
  ;(getProfileById as Mock).mockResolvedValueOnce({ username: 'viewer', displayName: 'Viewer User' })
  ;(reactionsDAL.getLikesForTarget as Mock).mockResolvedValueOnce({ count: 0, viewerHasLiked: false })
  ;(reactionsDAL.createLike as Mock).mockResolvedValueOnce(undefined)
  setupDbSelectChain([{ userId: watchOwnerId, brand: 'Rolex', model: 'Sub' }])
  ;(getProfileById as Mock).mockResolvedValueOnce({ username: 'owner', displayName: 'Owner' }) // owner profile for revalidateTag

  await toggleLikeAction({ type: 'watch', id: watchId })

  // D-12: viewer's batched counts tag must be busted
  expect(revalidateTag).toHaveBeenCalledWith(`viewer:${viewerUserId}:counts`, 'max')
})
```

**Note:** `setupDbSelectChain` returns a single-call chain; since `toggleLikeAction` calls `db.select` twice (watch row + owner profile for getProfileById), the test may need `(db.select as Mock).mockReturnValueOnce(...)` chaining or `setupDbSelectChain` called twice. Mirror the multi-select pattern from the existing tests (e.g., lines 283-298 in `comments.test.ts`).

#### `tests/actions/comments.test.ts` — assert `viewer:{userId}:counts` revalidation

**Analog:** itself — the existing `revalidateTag` assertion at lines 153-181. Add a new `it` block to the `describe('addCommentAction Server Action')` block:

```typescript
// New test case (add after the SEC-05 test at line 181):
// D-12: on successful addComment, revalidateTag('viewer:{userId}:counts', 'max') is called
it('D-12: on successful addComment calls revalidateTag(viewer:{userId}:counts, max)', async () => {
  ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'viewer@example.com' })
  setupDbSelectChain([{ userId: watchOwnerId, brand: 'Rolex', model: 'Sub', imageUrl: null, status: 'owned' }])
  ;(getProfileById as Mock)
    .mockResolvedValueOnce({ username: 'viewer', displayName: 'Viewer' })   // actor
    .mockResolvedValueOnce({ username: 'owner', displayName: 'Owner' })     // owner
  ;(commentsDAL.createComment as Mock).mockResolvedValueOnce(mockComment)

  await addCommentAction({ type: 'watch', id: watchId, body: 'Nice!' })

  // D-12: viewer's batched counts tag must be busted so liked+canComment re-hydrates correctly
  expect(revalidateTag).toHaveBeenCalledWith(`viewer:${viewerUserId}:counts`, 'max')
})
```

---

## Shared Patterns

### Optimistic Mutation Pattern (applies to ♥ chip and 💬 count bump)

**Source:** `src/components/shared/LikeButton.tsx` (lines 51-91)

The canonical pattern for all optimistic state in this phase:

```typescript
// 1. Seed from props (not re-synced on prop changes — cache-tag bust handles re-hydration)
const [state, setState] = useState(initialState)
const [pending, startTransition] = useTransition()

// 2. Optimistic flip before action
setState(nextState)

// 3. Transition wrapping the action
startTransition(async () => {
  const result = await theAction(...)
  if (!result.success) {
    setState(state)             // rollback on failure
    console.error('[...] failed:', result.error)
    return
  }
  setState(result.data.field)   // reconcile to server-confirmed value
})
```

Key rules from `LikeButton`:
- Use `useState` + `useTransition` (NOT `useOptimistic` — we own paired state and roll both back atomically)
- `disabled={pending}` blocks double-tap (LikeButton line 99)
- Count only shown when `count > 0 || liked` (LikeButton line 114)
- Silent rollback — no user-facing error toast on like failure (LikeButton lines 79-84)

### Cache Tag Revalidation Pattern (applies to both server actions)

**Source:** `src/app/actions/reactions.ts` (lines 100-111) and `src/app/actions/comments.ts` (lines 161-164)

All mutations that affect the batched counts grid must revalidate:
1. `revalidateTag('reactions:{type}:{id}', 'max')` — per-target cross-user count (reactions.ts only)
2. `revalidateTag('profile:{ownerUsername}', 'max')` — profile grid for all viewers
3. `revalidateTag('viewer:{userId}:counts', 'max')` — **NEW D-12** — this viewer's per-card liked+canComment
4. `updateTag('viewer:{userId}:reactions')` — viewer's LikeButton liked state (reactions.ts only)

### CommentCompose Re-Mount for Clear-on-Success (applies to WatchCommentSheet)

**Source:** `src/components/comment/CommentList.tsx` (lines 78, 131-132)

```typescript
const [composeKey, setComposeKey] = useState(0)
// On success only — NOT on failure (D-08: keep typed text for retry):
setComposeKey((k) => k + 1)
// In JSX:
<CommentCompose key={composeKey} viewerId={viewerId} pending={pending} onSubmit={handleSubmit} />
```

### Chip e.preventDefault() + e.stopPropagation() (applies to all overlay buttons)

**Source:** `LikeButton.tsx` (implicit via `onClick` not `onPointerDown`) + D-02 requirement

Every chip button inside the `<Link>` wrapper MUST stop the event:
```typescript
function handleClick(e: React.MouseEvent) {
  e.preventDefault()    // stops Link navigation
  e.stopPropagation()   // stops bubble to parent Link
  // ... action
}
```

### Defense-in-Depth Gate (applies to 💬 chip + WatchCommentSheet)

**Source:** D-09/D-10 + `src/data/comments.ts` `createComment` (throws `CommentGateError`)

Three layers:
1. UI layer: `{canComment && <CommentChip />}` — chip hidden for gated viewers
2. Server Action layer: `addCommentAction` → `createComment` re-checks `canViewerCommentOnTarget` and throws `CommentGateError`
3. The Server Action is the real gate; the UI hide is UX only (MEMORY `project_rls_subquery_caller_rls`)

### sonner Toast Pattern (applies to comment success and failure)

**Source:** `src/components/profile/WishlistTabContent.tsx` line 215 (`toast.error(...)`) and Phase 61/62 patterns

```typescript
import { toast } from 'sonner'
// Success: short past-tense, no exclamation
toast('Comment posted')
// Failure: problem + action
toast.error('Failed to post comment. Please try again.')
```

---

## No Analog Found

All files have close analogs. No new external patterns are required.

---

## Metadata

**Analog search scope:** `src/components/profile/`, `src/components/shared/`, `src/components/wear/`, `src/components/comment/`, `src/components/ui/`, `src/data/`, `src/app/actions/`, `src/app/u/[username]/[tab]/`, `tests/data/`, `tests/actions/`
**Files scanned:** 16 source files read in full or targeted sections
**Pattern extraction date:** 2026-05-27

### Critical Anti-Patterns (from RESEARCH.md — include in every plan action)

| Anti-Pattern | Where It Would Hurt | Prevention |
|---|---|---|
| N+1 liked query (one `watch_likes` query per watchId) | `getBatchedWatchCounts` | One `inArray(watchLikes.watchId, watchIds)` query; build a `Set` |
| Chip tap navigates to detail page | `ProfileWatchCard` | `e.preventDefault(); e.stopPropagation()` in every chip handler |
| Chips rendering for owner | `ProfileWatchCard` | Gate entire chip block on `!isOwner` |
| Stale `liked` after navigate-away/back | `toggleLikeAction` | `revalidateTag('viewer:{userId}:counts', 'max')` — D-12 fix |
| `'use cache'` on `ProfileTabContent` | `page.tsx` | Never mark it cached; `getCurrentUser()` is request-time only |
| `getCurrentUser()` inside `getBatchedWatchCountsCached` | `reactions.ts` | Auth resolved outside; `viewerId` passed as argument |
| Using `WearCommentHost` directly for a watch target | `ProfileWatchCard` | Create `WatchCommentSheet` — `WearCommentHost` hardcodes `type: 'wear'` |
| `CommentCompose` not clearing on success | `WatchCommentSheet` | Increment `composeKey` on success to re-mount (NOT on failure) |
| Re-enabling `unstable_instant` on `/u/[username]/[tab]` | `page.tsx` | Leave `export const unstable_instant = false` permanently untouched |
