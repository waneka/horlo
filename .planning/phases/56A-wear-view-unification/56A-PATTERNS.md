# Phase 56A: Wear View Unification - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/wears/[username]/page.tsx` | route (server page) | request-response | `src/app/wear/[wearEventId]/page.tsx` | exact |
| `src/components/wears/WearsLane.tsx` | component (client) | event-driven | `src/components/home/WywtOverlay.tsx` | exact |
| `src/components/wear/WearCard.tsx` | component (shared) | request-response | `src/components/wear/WearPhotoClient.tsx` + `WearDetailHero.tsx` | exact (extraction) |
| `src/components/wear/WearCommentHost.tsx` | component (client) | event-driven | `src/components/ui/sheet.tsx` | role-match |
| `src/components/wear/WearOverflowMenu.tsx` | component (client) | event-driven | `src/components/ui/dropdown-menu.tsx` | role-match |
| `src/data/wearEvents.ts` (add `getActiveWearsForUser`) | DAL function | CRUD | `getWearRailForViewer` at `:317` + `getWearEventsForViewer` at `:161` | exact |
| `src/app/wear/[wearEventId]/page.tsx` (modify) | route (server page) | request-response | itself (refactor) | self-analog |
| `src/components/home/WywtRail.tsx` (modify) | component (client) | event-driven | itself (modify `openAt`) | self-analog |
| `src/components/layout/BottomNav.tsx` (modify) | component (client) | request-response | itself (add `/wears` check) | self-analog |
| `src/components/layout/SlimTopNav.tsx` (modify) | component (client) | request-response | itself (add `/wears` check) | self-analog |
| DELETE: `WywtOverlay.tsx` + `WywtSlide.tsx` | — | — | — | — |

**Note on `resolveUserByUsername`:** `getProfileByUsername(username)` already exists in `src/data/profiles.ts` (line 34). It does a case-insensitive lookup via `lower(${profiles.username}) = lower(${username})` and returns the full profiles row including `id`. No new function needed — call `getProfileByUsername(username)` and use `.id` as `actorId`.

---

## Pattern Assignments

### `src/app/wears/[username]/page.tsx` (route, request-response)

**Analog:** `src/app/wear/[wearEventId]/page.tsx`

**Imports pattern** (analog lines 1–12):
```typescript
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'

import { getCurrentUser } from '@/lib/auth'
import { getProfileByUsername } from '@/data/profiles'
import { getActiveWearsForUser } from '@/data/wearEvents'
import { getWearRailForViewer } from '@/data/wearEvents'
import { getLikesForTargetCached } from '@/data/reactions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { WearsLane } from '@/components/wears/WearsLane'
import { PhotoSkeleton } from '@/components/wear/PhotoSkeleton'
```

**Async params pattern** (analog lines 38–44):
```typescript
export default async function WearsPage({
  params,
  searchParams,
}: {
  // Next.js 16 App Router: params is a Promise, must be awaited.
  params: Promise<{ username: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { username } = await params
  const { from: fromWearEventId } = await searchParams
```

**Auth pattern — auth-only, no anon sentinel** (this route is auth-only; contrast with analog lines 46–54 which allow anon):
```typescript
// This route is auth-only. Proxy redirects unauthenticated users to /login.
// EN-6: no __anon__ sentinel here — getCurrentUser() throws UnauthorizedError
// which is NOT caught, so the proxy's /login redirect is the safety net.
const user = await getCurrentUser()
const viewerId = user.id
```

**User resolution → actorId** (pattern from `getProfileByUsername` in `src/data/profiles.ts:34`):
```typescript
// resolveUserByUsername: getProfileByUsername already exists in profiles.ts.
// Case-insensitive: lower(username) = lower(input).
const actor = await getProfileByUsername(username)
if (!actor) notFound()
```

**D-07 redirect — outside try/catch** (RESEARCH Pattern 2, verified in Next.js 16 docs):
```typescript
// Must be OUTSIDE any try/catch — redirect() throws NEXT_REDIRECT.
const wears = await getActiveWearsForUser(viewerId, actor.id)
if (wears.length === 0) {
  redirect(`/u/${username}`)
}
```

**Rail order for user→user swipe** (RESEARCH Pitfall 3 — fetch fresh, not from URL param):
```typescript
// Re-fetch rail to get current user order (Pitfall 3: don't pass order via URL).
const railData = await getWearRailForViewer(viewerId)
const railUsernames = railData.tiles.map((t) => t.username)
```

**Per-wear signed-URL minting inside Suspense** (analog lines 113–142 `WearPhotoStreamed`):
```typescript
// Signed URLs minted per-request, NEVER cached. Pitfall F-2.
// Mint in a Suspense-wrapped server child (same pattern as WearPhotoStreamed).
async function WearPhotoStreamedForLane({ photoUrl, ... }: {...}) {
  let signedUrl: string | null = null
  if (photoUrl) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.storage
      .from('wear-photos')
      .createSignedUrl(photoUrl, 60 * 60) // 60-min TTL, Pitfall F-2
    signedUrl = data?.signedUrl ?? null
  }
  // ...return WearCard props with signedUrl
}
```

**Per-wear like state** (analog lines 63–64):
```typescript
// Call getLikesForTargetCached per wear via Promise.all — bounded by 48h window (0-5 typical).
const likeStates = await Promise.all(
  wears.map((w) => getLikesForTargetCached(viewerId, { type: 'wear', id: w.id }))
)
```

---

### `src/components/wears/WearsLane.tsx` (component, event-driven)

**Analog:** `src/components/home/WywtOverlay.tsx`

**Imports + directive pattern** (analog lines 1–14):
```typescript
'use client'

import { useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { X, MoreHorizontal, MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { WearCard } from '@/components/wear/WearCard'
import { WearCommentHost } from '@/components/wear/WearCommentHost'
import type { WearSlide } from '@/lib/wywtTypes'  // new type for lane slide data
```

**`getEmblaDuration()` helper — copy verbatim** (analog lines 35–44):
```typescript
// Respects `prefers-reduced-motion` — copy verbatim from WywtOverlay.tsx lines 35-44.
function getEmblaDuration(): number {
  if (typeof window === 'undefined') return 25
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 25
  } catch {
    return 25
  }
}
```

**Embla init with startIndex** (analog lines 62–67):
```typescript
const [emblaRef, emblaApi] = useEmblaCarousel({
  startIndex: Math.max(0, Math.min(initialSlideIndex, slides.length - 1)),
  align: 'start',
  containScroll: false,
  duration: getEmblaDuration(),
})
```

**Pause swipe when comment sheet is open** (RESEARCH Pattern 3, verified against `node_modules/embla-carousel/components/Options.d.ts`):
```typescript
// reInit is the correct API to change watchDrag at runtime. A2 assumption verified LOW risk.
useEffect(() => {
  if (!emblaApi) return
  emblaApi.reInit({ watchDrag: !commentOpen })
}, [emblaApi, commentOpen])
```

**onSelect → markViewed** (analog lines 69–83):
```typescript
useEffect(() => {
  if (!emblaApi) return
  const handleSelect = () => {
    const i = emblaApi.selectedScrollSnap()
    const slide = slides[i]
    if (slide) markViewed(slide.wearEventId)
  }
  emblaApi.on('select', handleSelect)
  handleSelect() // fire once for initial slide
  return () => { emblaApi.off('select', handleSelect) }
}, [emblaApi, slides, markViewed])
```

**Embla DOM structure** (analog lines 120–132):
```typescript
// Container class: h-dvh overflow-hidden (stories route).
// Analog was: overflow-hidden h-full ref={emblaRef}
<div className="fixed inset-0 h-dvh overflow-hidden md:static md:inset-auto md:h-auto md:overflow-visible bg-background" ref={emblaRef}>
  <div className="flex h-full">
    {slides.map((slide) => (
      <div
        key={slide.wearEventId}
        className="flex-[0_0_100%] min-w-0"  // analog: flex-[0_0_100%] min-w-0 h-full
      >
        <WearCard {...slide} commentHostVariant="bottom-sheet" />
      </div>
    ))}
  </div>
</div>
```

**Close affordance** (analog lines 93–100, adapted per UI-SPEC §4):
```typescript
// X close: top-LEFT on stories lane (top-right is "…"). Analog had top-right.
<button
  type="button"
  aria-label="Close"
  onClick={() => router.back()}
  className="absolute top-3 left-3 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center text-white"
>
  <X className="size-5" aria-hidden />
</button>
```

---

### `src/components/wear/WearCard.tsx` (component, request-response)

**Analog:** `src/components/wear/WearPhotoClient.tsx` + `src/components/wear/WearDetailHero.tsx`

This is an extraction — `WearCard` wraps `WearPhotoClient` / `WearDetailHero` + `WearPhotoOverlays` and adds the engagement row and overflow menu.

**Directive + imports** (photo layer from WearPhotoClient lines 1–6, WearDetailHero lines 1–6):
```typescript
'use client'

import type { JSX } from 'react'
import { Suspense } from 'react'

import { WearPhotoClient } from '@/components/wear/WearPhotoClient'
import { WearDetailHero } from '@/components/wear/WearDetailHero'
import { LikeButton } from '@/components/shared/LikeButton'
import { WearCommentHost } from '@/components/wear/WearCommentHost'
import { WearOverflowMenu } from '@/components/wear/WearOverflowMenu'
import { PhotoSkeleton } from '@/components/wear/PhotoSkeleton'
```

**Props interface** (from RESEARCH.md §Shared Component Extraction, adapted to be concrete):
```typescript
interface WearCardProps {
  // Photo layer — matches WearPhotoClient/WearDetailHero split
  signedUrl: string | null      // null → hero fallback path
  watchImageUrl: string | null
  altText: string
  // Overlay content — matches WearPhotoOverlays props
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  brand: string
  model: string
  watchId: string               // for brand/model → /watch/[id] link
  // Engagement state (passed from server render, never fetched client-side)
  viewerId: string | null
  wearEventId: string
  initialLiked: boolean
  initialCount: number
  // Comment host variant
  commentHostVariant: 'bottom-sheet' | 'inline'
  // Overflow menu (D-08/D-09)
  showAddToWishlist: boolean    // false on own wear / already owned / wishlisted
  permalinkUrl: string          // /wear/[wearEventId]
}
```

**Photo container class** — copy the exact class string from both existing paths (WearDetailHero line 135, WearPhotoClient line 83/105/125):
```typescript
// All three photo containers use the same container class:
"relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto"
// No-photo fallback adds: flex items-center justify-center
```

**Native `<img>` not `next/image`** (WearPhotoClient line 132, WearDetailHero line 137):
```typescript
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
  src={src}
  alt={altText}
  className="w-full h-full object-cover"
  loading="eager"
/>
```

**Overlay suppression during 'pending'** (WearPhotoClient lines 126–163):
```typescript
// Overlays are suppressed during 'pending' state — do NOT paint text over PhotoSkeleton.
// WearPhotoClient lines 153-163: {status !== 'pending' && <WearPhotoOverlays .../>}
// WearCard inherits this: only render WearPhotoOverlays when WearPhotoClient is not pending.
// Since WearCard wraps WearPhotoClient, the existing internal suppression carries through.
```

**Engagement row — stories lane variant** (from UI-SPEC §2, bottom engagement row):
```typescript
// Stories lane: below the card (not overlaid), safe-area bottom padding.
// No border-t on stories (detail page has border-t border-border).
<div className="flex items-center px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
  {/* Comment trigger — left slot */}
  <button
    type="button"
    aria-label="Open comments"
    onClick={openComments}
    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-white"
  >
    <MessageCircle className="size-5" aria-hidden />
  </button>
  <div className="flex-1" />
  {/* LikeButton — right slot. Unchanged, already shared. */}
  <LikeButton
    viewerId={viewerId}
    target={{ type: 'wear', id: wearEventId }}
    initialLiked={initialLiked}
    initialCount={initialCount}
  />
</div>
```

**Engagement row — detail page variant** (analog: `/wear/[wearEventId]/page.tsx` lines 89–98):
```typescript
// Detail page: border-t, text-muted-foreground for comment trigger icon.
// Replaces existing <div className="flex-1 min-h-[44px]" aria-hidden /> placeholder.
<div className="flex items-center px-4 py-3 border-t border-border md:max-w-[600px] md:mx-auto">
  <button
    type="button"
    aria-label="View comments"
    onClick={scrollToComments}
    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
  >
    <MessageCircle className="size-5 text-muted-foreground" aria-hidden />
  </button>
  <div className="flex-1" />
  <LikeButton
    viewerId={viewerId}
    target={{ type: 'wear', id: wearEventId }}
    initialLiked={initialLiked}
    initialCount={initialCount}
  />
</div>
```

---

### `src/components/wear/WearCommentHost.tsx` (component, event-driven)

**Analog:** `src/components/ui/sheet.tsx` (the bottom-sheet primitive)

**Imports pattern**:
```typescript
'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
```

**Bottom-sheet variant** (RESEARCH Pattern 4, verified against `src/components/ui/sheet.tsx` lines 39–81):
```typescript
// SheetContent side="bottom" with the animation classes in sheet.tsx already:
// data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto
// data-[side=bottom]:border-t  data-[side=bottom]:data-starting-style:translate-y-[2.5rem]
// The showCloseButton default is true — do NOT pass showCloseButton={false}.
<Sheet open={commentOpen} onOpenChange={setCommentOpen}>
  <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Comments</SheetTitle>
    </SheetHeader>
    {/* Phase 57 drops the real comment component here */}
    <p className="text-sm text-muted-foreground px-4 py-6 text-center">
      No comments yet.
    </p>
  </SheetContent>
</Sheet>
```

**Inline variant** (UI-SPEC §6):
```typescript
// Inline section for the detail page. Separator above + scroll-to target.
<section ref={sectionRef} className="border-t border-border px-4 pt-4 pb-6 md:max-w-[600px] md:mx-auto">
  <h2 className="text-sm font-semibold text-foreground mb-3">Comments</h2>
  {/* Phase 57 drops the real comment component here */}
  <p className="text-sm text-muted-foreground text-center py-4">
    No comments yet.
  </p>
</section>
```

**Props interface**:
```typescript
interface WearCommentHostProps {
  variant: 'bottom-sheet' | 'inline'
  // bottom-sheet variant: controlled open state lifted to WearCard
  open?: boolean
  onOpenChange?: (v: boolean) => void
}
```

---

### `src/components/wear/WearOverflowMenu.tsx` (component, event-driven)

**Analog:** `src/components/ui/dropdown-menu.tsx`

**Imports pattern** (dropdown-menu.tsx lines 1–8):
```typescript
'use client'

import { useState, useTransition } from 'react'
import { MoreHorizontal, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { addToWishlistFromWearEvent } from '@/app/actions/wishlist'
```

**Trigger button — top-right corner** (UI-SPEC §3, matches LikeButton touch-target pattern from LikeButton.tsx line 101):
```typescript
// Position injected by WearCard parent via absolute positioning.
// Touch target: min-h-[44px] min-w-[44px] (matches LikeButton.tsx lines 101-106).
<DropdownMenuTrigger
  aria-label="More options"
  className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-white"
>
  <MoreHorizontal className="size-5" aria-hidden />
</DropdownMenuTrigger>
```

**Menu items — copy-link + add-to-wishlist** (wishlist action from `src/app/actions/wishlist.ts` lines 50–52; double-submit guard from `WywtSlide.tsx` lines 37–38):
```typescript
// "Copy link" — always visible (D-01).
<DropdownMenuItem onClick={() => {
  navigator.clipboard.writeText(permalinkUrl)
  // No toast needed — clipboard write is instant and silent feedback is fine.
}}>
  <LinkIcon className="size-4" />
  Copy link
</DropdownMenuItem>

// "Add to wishlist" — conditionally visible per D-09.
{showAddToWishlist && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      disabled={pending || status === 'added'}
      onClick={handleAddToWishlist}
    >
      Add to wishlist
    </DropdownMenuItem>
  </>
)}
```

**Double-submit guard + action call** (from `WywtSlide.tsx` lines 30–44):
```typescript
// Same WR-03 double-submit guard pattern from WywtSlide.tsx:
const [pending, startTransition] = useTransition()
const [status, setStatus] = useState<'idle' | 'added' | 'error'>('idle')

const handleAddToWishlist = () => {
  if (pending || status === 'added') return
  startTransition(async () => {
    const result = await addToWishlistFromWearEvent({ wearEventId })
    if (result.success) {
      setStatus('added')
      toast('Added to wishlist')           // UI-SPEC §3 copywriting contract
    } else {
      setStatus('error')
      toast('Could not add to wishlist. Try again.')
    }
  })
}
```

---

### `src/data/wearEvents.ts` — add `getActiveWearsForUser` (DAL, CRUD)

**Analog:** `getWearRailForViewer` at lines 317–407 + `getWearEventsForViewer` at lines 161–221

**Function header + file header** (analog `getWearEventsForViewer` lines 161–168, `getWearRailForViewer` lines 317–319):
```typescript
/**
 * Returns ALL wear events for `actorId` within the 48h window (D-04),
 * visible to `viewerId`, ordered oldest→newest (D-05).
 *
 * Three-tier visibility gate mirrors getWearEventsForViewer. The 48h
 * cutoff uses wornDate (matches getWearRailForViewer's cutoffDate).
 *
 * Returns raw photoUrl (Storage path) — caller (page.tsx) mints signed
 * URLs per-request. Pitfall F-2: never cache signed URLs.
 */
export async function getActiveWearsForUser(
  viewerId: string,
  actorId: string,
) {
  // 48h cutoff — exact same calculation as getWearRailForViewer lines 318-320:
  const cutoffMs = Date.now() - 48 * 60 * 60 * 1000
  const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10)
```

**Self-bypass + SELECT shape** (analog `getWearRailForViewer` lines 329–346 for JOINs + select):
```typescript
  // G-5 self-bypass: owner sees all their own active wears regardless of visibility.
  if (viewerId === actorId) {
    return db
      .select({
        id: wearEvents.id,
        userId: wearEvents.userId,
        watchId: wearEvents.watchId,
        wornDate: wearEvents.wornDate,
        note: wearEvents.note,
        photoUrl: wearEvents.photoUrl,    // raw Storage path — Pitfall F-2
        visibility: wearEvents.visibility,
        createdAt: wearEvents.createdAt,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        brand: watches.brand,
        model: watches.model,
        watchImageUrl: watches.imageUrl,
      })
      .from(wearEvents)
      .innerJoin(profiles, eq(profiles.id, wearEvents.userId))
      .innerJoin(watches, eq(watches.id, wearEvents.watchId))
      .where(and(
        eq(wearEvents.userId, actorId),
        gte(wearEvents.wornDate, cutoffDate),
      ))
      .orderBy(asc(wearEvents.wornDate), asc(wearEvents.createdAt)) // oldest-first (D-05)
  }
```

**Follow check** (analog `getWearEventsForViewer` lines 173–186):
```typescript
  // Resolve follow relationship — one row lookup, not per-event JOIN.
  // Same pattern as getWearEventsForViewer lines 173-186.
  let viewerFollowsActor = false
  const followRows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(
      eq(follows.followerId, viewerId),
      eq(follows.followingId, actorId),
    ))
    .limit(1)
  viewerFollowsActor = followRows.length > 0
```

**Three-tier visibility predicate** (analog `getWearEventsForViewer` lines 191–196):
```typescript
  // Same predicate composition as getWearEventsForViewer lines 191-196.
  const visibilityPredicate = viewerFollowsActor
    ? or(
        eq(wearEvents.visibility, 'public'),
        eq(wearEvents.visibility, 'followers'),
      )
    : eq(wearEvents.visibility, 'public')
```

**WHERE clause + ORDER** (analog `getWearEventsForViewer` lines 198–220 + rail's `asc` ordering):
```typescript
  return db
    .select({ /* same columns as self-bypass branch above */ })
    .from(wearEvents)
    .innerJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
    .innerJoin(profiles, eq(profiles.id, wearEvents.userId))
    .innerJoin(watches, eq(watches.id, wearEvents.watchId))
    .where(and(
      eq(wearEvents.userId, actorId),
      gte(wearEvents.wornDate, cutoffDate),
      eq(profileSettings.profilePublic, true), // G-4 outer gate
      visibilityPredicate,
    ))
    .orderBy(asc(wearEvents.wornDate), asc(wearEvents.createdAt)) // oldest-first (D-05)
}
```

**Required imports to add** (analog `getWearRailForViewer` uses, top of file already has `desc`, `inArray`, `gte`, `or`, `sql` — verify `asc` is imported):
```typescript
// Add `asc` to the existing drizzle-orm import at line 5:
import { eq, and, desc, inArray, gte, or, sql, asc } from 'drizzle-orm'
```

---

### `src/app/wear/[wearEventId]/page.tsx` (modify — refactor to use WearCard)

**Self-analog** — the existing file is the source of truth. Key changes:

1. Remove `__anon__` sentinel pattern (lines 59–64) — EN-6 cleanup. Both wear routes are auth-only; proxy handles anon.
2. Remove the `try/catch` anonymous-viewer block (lines 46–54) and replace with `const user = await getCurrentUser(); const viewerId = user.id`.
3. Replace the inline `<div className="flex items-center px-4 py-3 border-t border-border ...">` engagement row (lines 89–98) with the shared `<WearCard>`.
4. `WearPhotoStreamed` server child stays — it's the signed-URL Suspense pattern (Pitfall F-2). `WearCard` wraps it.

**Key lines to preserve verbatim:**
- Line 7: `import { createSupabaseServerClient } from '@/lib/supabase/server'` — signed-URL minting
- Lines 113–142: `WearPhotoStreamed` — the Suspense child pattern for per-request URL minting
- Lines 136–140: `supabase.storage.from('wear-photos').createSignedUrl(photoUrl, 60 * 60)` — 60-min TTL

---

### `src/components/home/WywtRail.tsx` (modify — `openAt` → `router.push`)

**Self-analog** — existing file lines 79–89.

**Changes from self-analog:**

Remove (lines 59, 14–17, 117–128):
```typescript
// DELETE: lazy WywtOverlay import (lines 14-17)
// DELETE: overlayOpen state (line 59)
// DELETE: activeTileIndex state (line 60)
// DELETE: WywtOverlay render (lines 117-128)
```

Add `useRouter`:
```typescript
import { useRouter } from 'next/navigation'
// ...
const router = useRouter()
```

Replace `openAt` (lines 79–89) with:
```typescript
const openAt = (tile: WywtTileData) => {
  // Mark as viewed immediately so the tile ring updates even if navigation fails.
  markViewed(tile.wearEventId)
  // Pass ?from= so the lane can open at the tapped slide index (D-05).
  // Server page reads searchParams (typed as Promise<{ from?: string }>) and
  // passes initialSlideIndex as a prop to WearsLane.
  router.push(`/wears/${tile.username}?from=${tile.wearEventId}`)
}
```

**Leave unchanged** (Pitfall 5):
- `onOpenPicker` → `setPickerOpen(true)` — self-placeholder flow is out of scope
- `WywtPostDialog` lazy import and render

---

### `src/components/layout/BottomNav.tsx` (modify — hide on `/wears/`)

**Self-analog** — existing file lines 102–105.

**Pattern to follow** — the existing `isPublicPath` early-return (lines 103–104):
```typescript
// Existing pattern:
const pathname = usePathname() ?? ''
if (isPublicPath(pathname)) return null
if (!username) return null
```

**Add one line after the `isPublicPath` check:**
```typescript
// Stories lane is full-screen / no nav chrome (SC#2, UI-SPEC §Route Layout).
// This check is client-side only — no impact on proxy auth redirect (isPublicPath controls that).
if (pathname.startsWith('/wears/')) return null
```

---

### `src/components/layout/SlimTopNav.tsx` (modify — hide on `/wears/`)

**Self-analog** — existing file lines 47–48.

**Same pattern as BottomNav:**
```typescript
// Existing:
const pathname = usePathname() ?? ''
if (isPublicPath(pathname)) return null

// Add:
// Hide SlimTopNav on stories lane (UI-SPEC §Route Layout — Option B).
if (pathname.startsWith('/wears/')) return null
```

---

## Shared Patterns

### Authentication — auth-only, no anon sentinel
**Source:** `src/lib/auth.ts` + proxy pattern documented in `src/app/wear/[wearEventId]/page.tsx` lines 46–54
**Apply to:** `src/app/wears/[username]/page.tsx` (new route), `src/app/wear/[wearEventId]/page.tsx` (EN-6 cleanup)
```typescript
// Both wear routes are auth-only (EN-6). The proxy redirects anon to /login.
// Do NOT use the __anon__ sentinel or try/catch for UnauthorizedError.
const user = await getCurrentUser()
const viewerId = user.id
```

### Signed-URL Minting — per-request, never cached (Pitfall F-2)
**Source:** `src/app/wear/[wearEventId]/page.tsx` lines 113–142 (`WearPhotoStreamed`)
**Apply to:** `src/app/wears/[username]/page.tsx` (per-slide signed URL minting)
```typescript
// INSIDE a Suspense-wrapped server child, NEVER in a DAL function or 'use cache' scope.
const supabase = await createSupabaseServerClient()
const { data } = await supabase.storage
  .from('wear-photos')
  .createSignedUrl(photoUrl, 60 * 60)
signedUrl = data?.signedUrl ?? null
```

### Native `<img>` not `next/image` for signed URLs
**Source:** `src/components/wear/WearPhotoClient.tsx` line 132; `src/components/wear/WearDetailHero.tsx` line 136
**Apply to:** `src/components/wear/WearCard.tsx` (photo layer)
```typescript
{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={src} alt={altText} className="w-full h-full object-cover" loading="eager" />
```

### Photo Container Class — consistent across all three photo paths
**Source:** `src/components/wear/WearPhotoClient.tsx` lines 83, 105, 125; `src/components/wear/WearDetailHero.tsx` lines 135, 157
**Apply to:** `src/components/wear/WearCard.tsx`
```typescript
// Signed-URL path + watchImageUrl fallback path:
"relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto"
// No-photo path adds: flex items-center justify-center
```

### LikeButton — unchanged, drop in
**Source:** `src/components/shared/LikeButton.tsx` lines 44–126
**Apply to:** `src/components/wear/WearCard.tsx` engagement row
```typescript
<LikeButton
  viewerId={viewerId}                          // string | null
  target={{ type: 'wear', id: wearEventId }}   // LikeTarget discriminated union
  initialLiked={initialLiked}
  initialCount={initialCount}
/>
// min-h-[44px] min-w-[44px] touch target is already inside LikeButton.tsx
```

### Touch Targets — 44px minimum
**Source:** `src/components/shared/LikeButton.tsx` lines 101–106
**Apply to:** all interactive controls in WearCard, WearCommentHost trigger, WearOverflowMenu trigger, close X button
```typescript
className="... min-h-[44px] min-w-[44px] ..."
```

### Safe-Area Bottom Padding (stories engagement row)
**Source:** `src/components/layout/BottomNav.tsx` lines 124–125 (`pb-[env(safe-area-inset-bottom)]`)
**Apply to:** `src/components/wears/WearsLane.tsx` engagement row (no `pb-safe` utility exists — inline calc is mandatory)
```typescript
// UI-SPEC §2 Spacing Scale exceptions:
className="... pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
```

### getProfileByUsername — resolveUserByUsername is ALREADY DONE
**Source:** `src/data/profiles.ts` lines 34–46
**Apply to:** `src/app/wears/[username]/page.tsx`
```typescript
// Case-insensitive lookup, returns null when username not found.
// Use .id as actorId; call notFound() when null.
import { getProfileByUsername } from '@/data/profiles'
const actor = await getProfileByUsername(username)
if (!actor) notFound()
```

### `redirect()` — must be outside try/catch
**Source:** verified in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`
**Apply to:** `src/app/wears/[username]/page.tsx` D-07 redirect
```typescript
// redirect() throws NEXT_REDIRECT — NEVER inside try/catch.
const wears = await getActiveWearsForUser(viewerId, actor.id)
if (wears.length === 0) {
  redirect(`/u/${username}`)
}
```

### Double-Submit Guard (add-to-wishlist in menu)
**Source:** `src/components/home/WywtSlide.tsx` lines 30–44
**Apply to:** `src/components/wear/WearOverflowMenu.tsx`
```typescript
// WR-03: block when in-flight (pending) OR already succeeded (status='added').
// Same useTransition + latched status pattern from WywtSlide.tsx.
if (pending || status === 'added') return
```

---

## No Analog Found

No files in this phase lack a codebase analog. All new files have direct counterparts.

---

## Metadata

**Analog search scope:** `src/app/`, `src/components/`, `src/data/`, `src/hooks/`, `src/components/ui/`
**Files read:** 16 source files
**Pattern extraction date:** 2026-05-23

**Key verification findings:**
- `getProfileByUsername` exists in `src/data/profiles.ts` line 34 — no new `resolveUserByUsername` function needed
- `src/components/ui/dropdown-menu.tsx` exists and wraps `@base-ui/react/menu` — use for overflow "…" menu
- `BottomNav` uses `isPublicPath` early-return pattern at line 104; `SlimTopNav` mirrors at line 48 — add `pathname.startsWith('/wears/')` checks to both (Option B from RESEARCH)
- `WywtOverlay.tsx` uses `getEmblaDuration()` helper at lines 35–44 — copy verbatim into `WearsLane.tsx`
- `asc` is NOT in the existing import at `src/data/wearEvents.ts` line 5 — must be added alongside existing `desc`, `gte`, `or`, etc.
- `SheetPortal` is exported from `src/components/ui/sheet.tsx` line 23 — available for overlay portal usage in WearsLane
