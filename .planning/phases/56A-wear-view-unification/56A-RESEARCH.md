# Phase 56A: Wear View Unification - Research

**Researched:** 2026-05-23
**Domain:** Next.js 16 App Router routing, Embla Carousel, React bottom-sheet patterns, DAL shape
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Route transition**
- D-01: Each story slide in `/wears/[username]` exposes a share/overflow ("...") control that copies/opens that wear's `/wear/[id]` permalink.
- D-02: When `/wear/[id]` is opened from inside the app, it uses plain full-page navigation — NOT Next.js intercepting/parallel routes.
- D-03: `/wear/[id]` offers entry into the swipe lane only via the avatar/username link (→ `/u/[username]` profile). No dedicated "View in stories" control.

**Stories lane scope (`/wears/[username]`)**
- D-04: Active-window rule = keep ~48h, matching `getWearRailForViewer` (48h cutoff). One definition of "active" shared between rail and stories.
- D-05: Slides play oldest-first (chronological); open at the oldest UNVIEWED wear using `useViewedWears` state.
- D-06: Swiping user→user traverses the home rail's user order, with the viewer's own lane included if present.
- D-07: When `/wears/[username]` has no active wears, redirect to `/u/[username]`.

**Add-to-wishlist fate**
- D-08: Relocate `addToWishlistFromWearEvent` into the overflow ("...") menu alongside share/copy-link on both routes via the shared card.
- D-09: Hide Add-to-wishlist on the viewer's own wears, on already-owned watches, and on already-wishlisted watches.

**Comment slot scope (Phase 57 hand-off)**
- D-10: 56A builds the full comment HOST chrome + trigger with an empty placeholder body ("No comments yet"). Stories host = bottom-sheet (open/close, swipe-pause, over-photo, keyboard). Detail host = inline section container. Phase 57 drops the shared comment component into the body.
- D-11: Stories engagement layout = bottom action row over the photo holding like + comment trigger; share/add-to-wishlist "..." overflow in the top-right corner.

**Shared component contract**
- D-12: Exactly one wear-content card, one `LikeButton` (already shared), one comment host — both routes render these. Shared card seeds from `WearPhotoOverlays` (EN-2/3/4 fold in). Container chrome is the only allowed divergence.

**Pre-locked (from D-A..E)**
- D-A: Two routes, not a collapse.
- D-B: Reels inline engagement (never route away to act).
- D-C: Comments = bottom sheet (stories) / inline list (detail).
- D-D: Intentional layout divergence.
- D-E: Consistency enforced by shared content/engagement components only.

### Claude's Discretion

- Component extraction/naming for the shared wear card (e.g., `WearCard` factored from `WearPhotoOverlays` + `WearPhotoClient`).
- New DAL shape for per-user active wears feeding `/wears/[username]`.
- Photo signed-URL minting strategy for the swipe lane (per-request, never cached — Pitfall F-2 carry-forward).
- Add-to-wishlist success/error feedback style when moved into a menu (toast vs inline).

### Deferred Ideas (OUT OF SCOPE)

- Desktop layout for `/wears/[username]` — mobile full-screen/no-nav is locked; desktop centered-column vs full-viewport deferred to `gsd-ui-phase`.
- Stories per-wear progress segments / ring-progress UI — classic stories progress bars. Deferred to `gsd-ui-phase`.
</user_constraints>

---

## Summary

Phase 56A restructures the WYWT wear-viewing experience from a client-only URL-frozen modal (`WywtOverlay` + `WywtSlide`) into two purpose-built routes sharing a single wear-content card, `LikeButton`, and comment host. The `/wears/[username]` route is a stories-style, full-screen, viewport-fit lane with horizontal swipe and inline engagement (comments in a bottom sheet). The `/wear/[id]` route retains the existing nav-retaining, vertically-scrollable detail page extended with the shared components.

The project already has `embla-carousel-react@8.6.0`, `@base-ui/react` (which powers the existing `sheet.tsx` with a `side="bottom"` variant), `sonner` for toasts, and the full authentication/DAL/Server Action stack needed. No new heavy dependencies are required. The main work is: (1) a new `/wears/[username]` route with a full-screen embla carousel and bottom-sheet comment host; (2) extraction of a shared `WearCard` from existing components; (3) a new DAL function for all-of-one-user's-active-wears; (4) wiring `WywtRail` to navigate instead of opening the old overlay; and (5) deletion of `WywtOverlay` + `WywtSlide` once the lane is live.

**Primary recommendation:** Build the `/wears/[username]` route as a standard Next.js 16 App Router page with `params: Promise<{ username: string }>` (async params is the Next.js 16 convention — verified in `node_modules/next/dist/docs/`). Use the existing `embla-carousel-react` for swipe with `watchDrag: false` as the pause-swipe mechanism when the bottom sheet is open. Use the existing `Sheet` + `SheetContent side="bottom"` primitive (`src/components/ui/sheet.tsx`) as the comment host shell. Extract `WearCard` as the new shared component containing `WearPhotoClient`/`WearDetailHero` + `WearPhotoOverlays` + engagement row.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `/wears/[username]` route render | Server (page.tsx) | Client (carousel component) | Auth + DAL reads are server-side; swipe/state is client-side |
| `/wear/[id]` route render | Server (page.tsx) | — | Already server-rendered; unchanged pattern |
| Signed-URL minting | Server (page.tsx Suspense child) | — | Pitfall F-2: never cached, per-request. Same as existing `/wear/[id]` pattern |
| Swipe carousel | Browser / Client | — | embla-carousel-react, existing pattern from `WywtOverlay` |
| Bottom-sheet comment host | Browser / Client | — | `Sheet` + `SheetContent side="bottom"` from `@base-ui/react/dialog` |
| Like engagement | Browser / Client | API (Server Action) | `LikeButton` already shared; toggleLikeAction is the Server Action |
| Per-user active wears DAL read | API / Backend | — | New `getActiveWearsForUser(viewerId, username)` in `src/data/wearEvents.ts` |
| Per-wear like state for carousel | API / Backend | — | `getLikesForTargetCached` called per slide in the server render |
| Wishlist applicability gate | API / Backend | — | Checked server-side per wear in the stories page render |
| Rail tile navigation change | Browser / Client | — | `WywtRail` / `WywtTile` `onOpen` switches from overlay to `router.push` |
| Legacy overlay removal | — | — | Delete `WywtOverlay.tsx` + `WywtSlide.tsx` after lane ships |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 | App Router routing, Server Components, `redirect()` | Locked project stack |
| `embla-carousel-react` | 8.6.0 | Horizontal swipe carousel for stories lane | Already installed; used by `WywtOverlay` with identical use-case |
| `@base-ui/react` (Sheet) | ^1.3.0 | Bottom-sheet comment host (`side="bottom"`) | Already installed; `src/components/ui/sheet.tsx` is ready-to-use |
| `sonner` | ^2.0.7 | Toast for add-to-wishlist success/error feedback when moved to overflow menu | Already installed; project-standard toaster via `ThemedToaster` |
| `lucide-react` | ^1.8.0 | Icons (share, ellipsis-more, MessageCircle, X, etc.) | Already installed; project-standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zustand` + `useViewedWears` | — | D-05 "open at oldest unviewed" state from localStorage | Stories lane uses existing hook to determine initial slide index |
| `useRouter` from `next/navigation` | — | Rail tile tap navigates to `/wears/[username]` (replaces `openAt()`) | Client Component only; rail is already client |
| `createSupabaseServerClient` | — | Signed-URL minting inside Suspense boundary | Existing pattern from `/wear/[id]` page — use identically |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing `sheet.tsx` (`side="bottom"`) | Custom bottom-sheet from scratch | `sheet.tsx` already wraps `@base-ui/react/dialog` with the correct animation classes; hand-rolling adds risk and maintenance |
| `embla-carousel-react` for swipe | CSS scroll-snap (as used by the rail itself) | Rail uses native snap correctly; but the stories lane needs programmatic `scrollTo` for "open at index N" (D-05) and `watchDrag: false` for sheet-pause — embla provides both; native snap does not |
| `router.push('/wears/[username]')` from rail | Keep `WywtOverlay` | D-02 and SC#5 lock the route-based approach |

**Installation:** No new packages needed. All dependencies already in `package.json`.

---

## Architecture Patterns

### System Architecture Diagram

```
Home page (page.tsx, Server)
  └─ WywtRail (Client) — user taps a tile
       └─ router.push('/wears/{username}')         [replaces openAt() → WywtOverlay]

/wears/[username]/page.tsx (Server)
  ├─ getCurrentUser() → viewerId
  ├─ resolveUserByUsername(username) → actorId
  ├─ getActiveWearsForUser(viewerId, actorId) → wears[]     [NEW DAL]
  │    └─ if wears.length === 0: redirect('/u/{username}')   [D-07]
  ├─ for each wear: getLikesForTargetCached(viewerId, {type:'wear', id})
  ├─ for each wear with photoUrl: supabase.storage.createSignedUrl()   [Pitfall F-2]
  └─ <WearsLane>                                              [Client Component]
       ├─ emblaRef (horizontal carousel, watchDrag based on sheet state)
       │    └─ per slide: <WearCard> (shared component, D-12)
       │         ├─ WearPhotoClient / WearDetailHero + WearPhotoOverlays (top overlay)
       │         ├─ bottom action row: [comment trigger] [LikeButton]      (D-11)
       │         └─ top-right corner: [close / X] [...overflow menu]       (D-11)
       └─ <Sheet side="bottom"> (comment host shell, D-10)
            └─ <p>No comments yet.</p>              [placeholder body for Phase 57]

/wear/[id]/page.tsx (Server — existing, extended)
  ├─ (existing signed-URL + DAL pattern)
  └─ <WearCard> (shared component, replaces inline WearDetailHero+WearPhotoClient)
       ├─ photo layer
       ├─ WearPhotoOverlays
       ├─ footer action row: [comment host (inline section)] [LikeButton]
       └─ [...overflow menu: share permalink + add-to-wishlist (D-08)]
       └─ inline comment section: <p>No comments yet.</p>    [D-10 placeholder]
```

### Recommended Project Structure

```
src/
├─ app/
│   ├─ wears/
│   │   └─ [username]/
│   │       └─ page.tsx              # NEW: stories lane server page
│   └─ wear/
│       └─ [wearEventId]/
│           └─ page.tsx              # EXISTING: extended to use WearCard
├─ components/
│   ├─ wear/
│   │   ├─ WearCard.tsx              # NEW: shared content card (extracted from WearDetailHero + WearPhotoClient)
│   │   ├─ WearDetailHero.tsx        # KEEP (WearDetailHero + WearPhotoOverlays) — WearCard wraps it
│   │   ├─ WearPhotoClient.tsx       # KEEP — WearCard wraps it
│   │   ├─ WearDetailMetadata.tsx    # unchanged
│   │   ├─ PhotoSkeleton.tsx         # unchanged
│   │   └─ WearCommentHost.tsx       # NEW: comment host shell (bottom-sheet variant + inline variant)
│   ├─ wears/
│   │   └─ WearsLane.tsx             # NEW: client carousel for /wears/[username]
│   ├─ home/
│   │   ├─ WywtRail.tsx              # MODIFIED: openAt() → router.push
│   │   ├─ WywtTile.tsx              # possibly MODIFIED: onOpen callback signature unchanged
│   │   ├─ WywtOverlay.tsx           # DELETE after lane ships (SC#5)
│   │   └─ WywtSlide.tsx             # DELETE after lane ships (SC#5)
│   └─ shared/
│       └─ LikeButton.tsx            # unchanged (already shared)
└─ data/
    └─ wearEvents.ts                 # ADD: getActiveWearsForUser()
```

### Pattern 1: Next.js 16 Dynamic Route — Async Params

Next.js 16 App Router requires `params` to be awaited as a Promise. This is verified in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` and already applied in the existing `/wear/[wearEventId]/page.tsx`.

**What:** `params` is typed as `Promise<{ username: string }>` and must be `await`ed before use.

**Example:**
```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
// and: src/app/wear/[wearEventId]/page.tsx (existing precedent)
export default async function WearsPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  // ...
}
```

### Pattern 2: redirect() from Server Component

`redirect()` from `next/navigation` throws a `NEXT_REDIRECT` error (never returns). Call it outside `try/catch`. [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md]

```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md
import { redirect } from 'next/navigation'

// D-07: no active wears → redirect to durable profile
if (wears.length === 0) {
  redirect(`/u/${username}`)
}
```

### Pattern 3: Embla Carousel — Pause Swipe When Sheet Is Open

`embla-carousel-react@8.6.0` supports `watchDrag: DragHandlerOptionType` where `false` disables drag entirely. [VERIFIED: node_modules/embla-carousel/components/Options.d.ts, DragHandler.d.ts]

Pass `watchDrag` as a reactive option OR use `emblaApi.reInit({ watchDrag: false })` when the sheet opens and `emblaApi.reInit({ watchDrag: true })` when it closes. The carousel reInit pattern is the recommended approach for dynamic option changes.

```typescript
// Source: node_modules/embla-carousel/components/Options.d.ts
// watchDrag: boolean | DragHandlerCallbackType
// false = disable drag entirely

useEffect(() => {
  if (!emblaApi) return
  emblaApi.reInit({ watchDrag: !sheetOpen })
}, [emblaApi, sheetOpen])
```

### Pattern 4: Existing Sheet Component — Bottom Variant

`src/components/ui/sheet.tsx` already provides `<SheetContent side="bottom">` using `@base-ui/react/dialog`. The bottom variant has `data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t` with slide-up/down animations built in. [VERIFIED: src/components/ui/sheet.tsx]

The comment host shell for stories:
```typescript
// Source: src/components/ui/sheet.tsx (existing component)
<Sheet open={commentOpen} onOpenChange={setCommentOpen}>
  <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Comments</SheetTitle>
    </SheetHeader>
    {/* Phase 57 drops the real component here */}
    <p className="text-sm text-muted-foreground px-4 py-6 text-center">No comments yet.</p>
  </SheetContent>
</Sheet>
```

### Pattern 5: Full-Screen No-Nav Route Layout

The `/wears/[username]` route must be full-screen with no nav chrome on mobile (SC#2). The existing layout renders `<Header>`, `<main>`, and `<BottomNavServer>` for every route. There is no existing route that hides nav for a specific segment.

**Approach:** Create a layout.tsx at `src/app/wears/[username]/layout.tsx` (route group layout) that overrides — but the root layout always renders nav. The canonical Next.js approach to hide nav for a specific segment is a **route group** with a separate layout. However the root layout (`src/app/layout.tsx`) unconditionally renders `<Header>` and `<BottomNavServer>`.

**Practical pattern used in the codebase:** `BottomNav` checks `isPublicPath(pathname)` — it does NOT currently check for `/wears/*`. For the stories lane to be full-screen and nav-free, one of two approaches applies:

- **Option A (route group override):** Move `/wears/[username]` into a route group like `(stories)/wears/[username]` with its own `layout.tsx` that renders only `{children}` (no Header, no BottomNav). This requires the root layout to NOT apply to route-group members that define their own root-level layout — this is the Next.js route group pattern. [ASSUMED — verify that Next.js 16 supports a route-group layout that fully replaces the root layout for that segment]

- **Option B (CSS full-bleed with nav hidden):** The layout keeps rendering but nav is conditionally hidden. `BottomNav` already hides for `isPublicPath` — adding `/wears` to the public paths list would hide it, but would also incorrectly trigger the proxy auth redirect. Instead, add a `pathname.startsWith('/wears/')` check in `BottomNav` client component (client-side only, no proxy impact). The `Header` similarly has a `SlimTopNav`/`DesktopTopNav` that could be hidden the same way. The page itself uses `fixed inset-0` or `h-dvh overflow-hidden` to fill the viewport above nav.

[ASSUMED — which Option (A vs B) is the right approach for this codebase. Option B is lower-risk because it doesn't restructure the route tree.]

### Pattern 6: useRouter for Rail → Stories Navigation

`WywtRail` is a Client Component. `useRouter` from `next/navigation` provides `router.push()`. [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md]

```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md
// src/components/home/WywtRail.tsx — replace openAt() with:
const router = useRouter()

const openAt = (tile: WywtTileData) => {
  markViewed(tile.wearEventId)
  router.push(`/wears/${tile.username}`)
}
```

The `initialIndex` / "open at oldest unviewed" (D-05) must be communicated to the lane. Options:
- Pass as a URL search param: `/wears/${username}?from=${wearEventId}` — then the lane's page reads `searchParams` to find the initial slide index.
- Use sessionStorage keyed by username (no URL clutter).

The URL search param approach is cleaner and stateless. [ASSUMED — planner chooses; URL param recommended]

### Anti-Patterns to Avoid

- **Parallel / intercepting routes for `/wear/[id]`:** D-02 explicitly forbids `@modal` + `(.)wear/[id]`. Do not use them.
- **Caching signed URLs in the DAL or a `'use cache'` scope:** Pitfall F-2 — signed URLs are per-request, per-user. Never cache. The pattern from `src/app/wear/[wearEventId]/page.tsx` is the canonical model.
- **Calling `redirect()` inside a try/catch:** `redirect()` throws; it must live outside `try/catch` blocks.
- **Fetching wear like-state inside `WearsLane` (Client Component):** Like state for all slides must be fetched server-side and passed as initial props (same as the existing `LikeButton` pattern on `/wear/[id]`).
- **`next/image` for signed wear-photo URLs:** `WearPhotoClient` already uses native `<img>` for this reason (Pitfall F-2, `// eslint-disable-next-line @next/next/no-img-element`). Do not switch to `<Image>` for the shared card.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Horizontal swipe carousel | Custom touch-event tracker | `embla-carousel-react@8.6.0` (already installed) | Handles momentum, snap, edge-scroll, keyboard, prefers-reduced-motion |
| Bottom sheet overlay | Custom portal + animation | `Sheet` + `SheetContent side="bottom"` (`src/components/ui/sheet.tsx`) | Already wraps `@base-ui/react/dialog`, has correct `data-starting-style`/`data-ending-style` transitions built in |
| Toast feedback | Custom inline state machine | `sonner` via `ThemedToaster` (already installed) | Existing project pattern for action feedback |
| Overflow menu | Custom positioned dropdown | `@base-ui/react` dropdown (or Radix via shadcn) | Accessible, keyboard-navigable, focus-trap handled |
| Auth guard | Manual cookie check in Server Component | `getCurrentUser()` from `@/lib/auth` + proxy redirect | Same pattern as every other protected route |
| Wishlist applicability check | Client-side guess | Server-side per-wear check in the stories page render (pass as prop) | Prevents IDOR-adjacent issues; data is available at render time |

**Key insight:** The project already has every library needed. The work is composition and extraction, not new dependency installation.

---

## New DAL Function: `getActiveWearsForUser`

The existing `getWearRailForViewer` is **most-recent-per-actor** across followings. The stories lane needs **ALL active wears for one specific user**, ordered oldest→newest (D-05).

### Required query shape

```typescript
// To add to src/data/wearEvents.ts

/**
 * Returns ALL wear events for `actorId` within the 48h window (D-04),
 * visible to `viewerId`, ordered oldest→newest (D-05).
 *
 * Three-tier visibility gate mirrors getWearEventsForViewer. The 48h
 * cutoff uses wornDate (matches getWearRailForViewer's cutoffDate).
 *
 * Returns raw photoUrl (Storage path) — caller (page.tsx) mints signed
 * URLs per-request. Pitfall F-2: never cache signed URLs.
 *
 * Also returns brand/model/watchImageUrl/username/displayName/avatarUrl
 * (JOINed) so the caller has everything for WearCard without extra reads.
 */
export async function getActiveWearsForUser(
  viewerId: string,
  actorId: string,
): Promise<ActiveWear[]>
```

The return type `ActiveWear` includes: `id`, `userId`, `watchId`, `wornDate`, `note`, `photoUrl` (raw), `visibility`, `createdAt`, plus JOINed `username`, `displayName`, `avatarUrl`, `brand`, `model`, `watchImageUrl`.

### Visibility gate

Mirrors `getWearEventsForViewer` (lines 161-221 of `src/data/wearEvents.ts`):
- G-5 self-bypass: if `viewerId === actorId`, return all wears regardless of visibility/profile_public.
- G-4 outer gate: `profile_settings.profilePublic = true` for non-owner viewers.
- Three-tier predicate: `public` always visible; `followers` only if viewer follows actor; `private` only for self.

### Per-wear like state

Each slide in the carousel needs `{ viewerHasLiked, count }`. The existing `getLikesForTargetCached(viewerId, { type: 'wear', id: wearEventId })` (src/data/reactions.ts) works per-wear. Call it for each wear in the page.tsx via `Promise.all` — bounded by 48h window which is typically 0-5 wears per user.

### Wishlist applicability per wear

For D-09 (hide add-to-wishlist on own wears / already-owned / already-wishlisted), the stories page needs per-wear applicability flags. The watch's ID is available from the JOINed data. A single `getWatchesByUser(viewerId)` call provides the full set — filter client-side in the component prop by `watchId` against `status === 'owned' || status === 'wishlist'`. Since PROJECT.md caps at <500 watches, this is acceptable.

---

## Shared Component Extraction: WearCard

The `WearCard` component is extracted as the single shared card rendering both routes.

### Extraction boundary

`WearDetailHero.tsx` already exports:
1. `WearPhotoOverlays` — the overlay sub-component (top: avatar/username/timestamp, bottom: brand/model, gradient scrims)
2. `WearDetailHero` — the no-signed-URL branch (watchImageUrl or muted placeholder)

`WearPhotoClient.tsx` exports:
1. `WearPhotoClient` — the signed-URL branch with 3-retry CDN state machine

The existing `/wear/[id]/page.tsx` uses a `WearPhotoStreamed` server child that picks one of the two based on whether a signed URL exists. This pattern is the right extraction boundary.

**WearCard props shape:**
```typescript
interface WearCardProps {
  // Photo layer (identical to current WearPhotoClient/WearDetailHero split)
  signedUrl: string | null
  watchImageUrl: string | null
  altText: string
  // Overlay content
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  brand: string
  model: string
  // Engagement state (passed from server render)
  viewerId: string | null
  wearEventId: string
  initialLiked: boolean
  initialCount: number
  // Comment host variant
  commentHostVariant: 'bottom-sheet' | 'inline'
  // Overflow menu state (D-08/D-09)
  showAddToWishlist: boolean  // false on own wear / already owned / already wishlisted
  permalinkUrl: string        // /wear/{wearEventId} — for share/copy-link (D-01)
}
```

`WearCard` is a Client Component (it contains `LikeButton` and `WearCommentHost` which need client state).

---

## Common Pitfalls

### Pitfall 1: Signed URL Caching (Pitfall F-2 carry-forward)

**What goes wrong:** Minting signed URLs inside a `'use cache'` scope or DAL function causes (a) security leak — different users see each other's signed URLs, (b) staleness — URL tokens expire mid-session.
**Why it happens:** The `getLikesForTargetCached` pattern shows `'use cache'` is common in DAL. A developer unfamiliar with F-2 might apply the same pattern to photo URLs.
**How to avoid:** Signed URLs are minted in the Server Component page (`page.tsx`) inside a `Suspense` boundary, NEVER in a DAL function or `'use cache'` scope. The existing pattern in `/wear/[wearEventId]/page.tsx` (WearPhotoStreamed) is the canonical model.
**Warning signs:** `supabase.storage.createSignedUrl` appearing inside a function tagged `'use cache'`.

### Pitfall 2: `redirect()` Inside try/catch

**What goes wrong:** `redirect()` from `next/navigation` throws a `NEXT_REDIRECT` error. If called inside a try/catch, the error is swallowed and the redirect never fires. [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md]
**How to avoid:** Always call `redirect()` outside any try/catch. Perform DAL reads inside try/catch if needed, then call `redirect()` after the catch block.

### Pitfall 3: Rail User Order for User→User Swipe (D-06)

**What goes wrong:** D-06 says user→user traversal follows the home rail's user order. The rail's `tiles` array (from `getWearRailForViewer`) is ordered `wornDate DESC, createdAt DESC` and deduplicated to most-recent-per-actor. The order is NOT stable — it changes as users post new wears. A stale order passed via URL param can cause the "next user" swipe to point to a stale or wrong user.
**How to avoid:** The user order for cross-user swipe must be derived from a fresh server-side call, NOT stored client-side from the tile tap. On the `/wears/[username]` page.tsx, re-fetch `getWearRailForViewer(viewerId)` to get the current rail order. Locate `username` in that array; next/prev users are adjacent entries.
**Warning signs:** Passing `userOrder` as a URL search param or in sessionStorage from the rail.

### Pitfall 4: Embla `startIndex` After Rehydration

**What goes wrong:** `useEmblaCarousel({ startIndex: N })` is set once at mount. If the component remounts (navigation) with a different index, the carousel does not re-seek.
**How to avoid:** `emblaApi.scrollTo(index, true)` (no animation) after the API is ready. This is the approach used in `WywtOverlay.tsx` (which sets `startIndex` in the initial options). For the stories lane, calculate `initialIndex` from `useViewedWears` state + the sorted wears array, then either pass as `startIndex` (correct for initial mount) or call `scrollTo` once `emblaApi` is available.

### Pitfall 5: WywtTile `onOpen` callback change breaks self-placeholder

**What goes wrong:** `WywtRail`'s `openAt()` currently drives `WywtOverlay` which requires `data.tiles` (the full tile array). Changing `openAt()` to `router.push('/wears/{username}')` removes the need for the overlay state but the self-placeholder tile calls `onOpenPicker` (not `onOpen`), so that flow is unaffected. However, `WywtRail` currently imports `WywtOverlay` lazily — that import can be removed once the lane is live.
**How to avoid:** Only change `openAt()` to navigate; leave `onOpenPicker` → `WywtPostDialog` untouched (out of scope per CONTEXT.md). Delete the `WywtOverlay` lazy import and `overlayOpen` state.

### Pitfall 6: BottomNav / Header Visible on `/wears/[username]`

**What goes wrong:** The root layout unconditionally renders `<Header>` and `<BottomNavServer>`. The stories lane is supposed to be full-screen / no nav chrome. If nav renders on top of the full-screen photo, the immersive feel is broken.
**How to avoid:** Two options explored above (route group vs CSS). The CSS approach (add `/wears` prefix to the `BottomNav` client-side hide predicate) is lower-risk and already follows the `isPublicPath` pattern. Confirm the right approach before implementing — this is a structural decision that affects the layout tree.
**Warning signs:** Header/BottomNav rendering on `/wears/` routes in dev.

### Pitfall 7: `__anon__` sentinel on the stories route

**What goes wrong:** `/wear/[id]` currently allows anonymous viewers (`__anon__` sentinel passed to `getLikesForTargetCached`). The CONTEXT.md notes EN-6 that both wear routes are **auth-only** (the `__anon__` sentinel branches are dead code). However, the proxy already redirects unauthenticated users to `/login` for all non-public paths — so the sentinel path should never be hit for `/wears/[username]`.
**How to avoid:** `/wears/[username]` page.tsx should call `getCurrentUser()` (throws on anon), no try/catch for `UnauthorizedError`, no anon sentinel. Remove the `__anon__` pattern from `/wear/[id]` as part of the EN-6 cleanup. The proxy handles the unauthenticated redirect.

---

## Code Examples

### New DAL: getActiveWearsForUser (shape only)

```typescript
// Source: adapted from getWearEventsForViewer (src/data/wearEvents.ts:161)
// + 48h cutoff from getWearRailForViewer (src/data/wearEvents.ts:317)

export async function getActiveWearsForUser(
  viewerId: string,
  actorId: string,
) {
  const cutoffMs = Date.now() - 48 * 60 * 60 * 1000
  const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10)

  // G-5 self-bypass: owner sees all their own active wears
  if (viewerId === actorId) {
    return db
      .select({ /* id, userId, watchId, wornDate, note, photoUrl, visibility, createdAt,
                   username, displayName, avatarUrl, brand, model, watchImageUrl */ })
      .from(wearEvents)
      .innerJoin(profiles, eq(profiles.id, wearEvents.userId))
      .innerJoin(watches, eq(watches.id, wearEvents.watchId))
      .where(
        and(
          eq(wearEvents.userId, actorId),
          gte(wearEvents.wornDate, cutoffDate),
        ),
      )
      .orderBy(asc(wearEvents.wornDate), asc(wearEvents.createdAt)) // oldest-first (D-05)
  }

  // Non-self: apply three-tier gate + profile_public outer gate
  let viewerFollowsActor = false
  // ... (follow check as in getWearEventsForViewer)

  const visibilityPredicate = viewerFollowsActor
    ? or(eq(wearEvents.visibility, 'public'), eq(wearEvents.visibility, 'followers'))
    : eq(wearEvents.visibility, 'public')

  return db
    .select({ /* ... */ })
    .from(wearEvents)
    .innerJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
    .innerJoin(profiles, eq(profiles.id, wearEvents.userId))
    .innerJoin(watches, eq(watches.id, wearEvents.watchId))
    .where(
      and(
        eq(wearEvents.userId, actorId),
        gte(wearEvents.wornDate, cutoffDate),
        eq(profileSettings.profilePublic, true), // G-4 outer gate
        visibilityPredicate,
      ),
    )
    .orderBy(asc(wearEvents.wornDate), asc(wearEvents.createdAt)) // oldest-first (D-05)
}
```

[VERIFIED: pattern from src/data/wearEvents.ts, getWearEventsForViewer + getWearRailForViewer]

### Embla Carousel with Pause-on-Sheet

```typescript
// Source: src/components/home/WywtOverlay.tsx (existing embla usage)
// + node_modules/embla-carousel/components/Options.d.ts (watchDrag option)
'use client'

const [emblaRef, emblaApi] = useEmblaCarousel({
  startIndex: initialSlideIndex,
  align: 'start',
  containScroll: false,
  duration: getEmblaDuration(), // prefers-reduced-motion aware (same as WywtOverlay)
})

// Pause swipe when comment sheet is open (D-10)
useEffect(() => {
  if (!emblaApi) return
  emblaApi.reInit({ watchDrag: !commentOpen })
}, [emblaApi, commentOpen])
```

### WywtRail — Replace openAt() with router.push

```typescript
// Source: src/components/home/WywtRail.tsx
// useRouter from next/navigation (node_modules/next/dist/docs/...)
import { useRouter } from 'next/navigation'

const router = useRouter()

const openAt = (tile: WywtTileData) => {
  markViewed(tile.wearEventId)
  // D-05: pass wearEventId so the lane can find the initial slide index
  router.push(`/wears/${tile.username}?from=${tile.wearEventId}`)
}
```

### D-07 Redirect in Server Component

```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md
import { redirect } from 'next/navigation'

// Outside any try/catch
const wears = await getActiveWearsForUser(viewerId, actor.id)
if (wears.length === 0) {
  redirect(`/u/${username}`)  // D-07
}
```

---

## Runtime State Inventory

This phase is NOT a rename/refactor/migration phase — it is a new-feature build. No runtime state inventory required. The existing `useViewedWears` localStorage key (`horlo:wywt:viewed:v1`) is reused, not renamed. No database schema changes.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `WywtOverlay` client modal (URL frozen on `/`) | `/wears/[username]` full-page route | Phase 56A | Real URL, shareable, back-button works |
| `params` as synchronous prop | `params` as `Promise<{ ... }>`, must be awaited | Next.js 15+ → 16 | Every new dynamic page must `await params` |
| `router` from `next/router` | `useRouter` from `next/navigation` | App Router | Import path changed |
| `WywtSlide` add-to-wishlist button (ungated) | Overflow menu item, gated by D-09 | Phase 56A | No wishlist clutter for own wears |

**Deprecated/outdated:**
- `WywtOverlay.tsx` and `WywtSlide.tsx`: replaced by `/wears/[username]` route — delete after lane ships (SC#5).
- `__anon__` sentinel in `WearDetailPage`: EN-6 dead-code removal — both routes are auth-only; proxy handles anon redirect.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `emblaApi.reInit({ watchDrag: false })` is the correct API to pause drag at runtime (not a plugin or external state) | Patterns §Pattern 3, Code Examples | Low — `watchDrag: boolean` is confirmed in type defs; `reInit` is standard embla API. Alternative: pass `watchDrag` as a reactive option in the initial options object updated via state. |
| A2 | Route group layout override (Option A) is supported in Next.js 16 App Router to fully replace the root layout for a specific segment | Patterns §Pattern 5 | Medium — if route groups cannot override the root layout in Next.js 16, the CSS approach (Option B) must be used. Planner should verify. |
| A3 | URL search param (`?from={wearEventId}`) is the right mechanism for communicating initial slide index from rail to lane | Patterns §Pattern 6 | Low — sessionStorage is a valid fallback if URL param is messy. |
| A4 | `getActiveWearsForUser` returning 0 rows for a valid username is the correct trigger for D-07 redirect (vs. user-not-found) | DAL section | Low — if user-not-found (resolveUserByUsername returns null), `notFound()` fires first; 0-wears case flows to `redirect()` correctly. |

---

## Open Questions

1. **How to hide nav on `/wears/[username]`?**
   - What we know: root layout renders `<Header>` and `<BottomNavServer>` for all routes. `BottomNav` hides for `isPublicPath`. Neither currently has a `/wears` exemption.
   - What's unclear: whether to use route-group layout override (Option A) or CSS-level hiding via pathname check (Option B). Option A is cleaner architecturally; Option B is lower-risk given the cache-components complexity already present in this codebase.
   - Recommendation: Planner should choose and document. Option B (add `/wears` prefix check to `BottomNav` and `SlimTopNav` client components, use `h-dvh overflow-hidden fixed inset-0` for the lane itself) avoids structural layout changes and mirrors the `isPublicPath` pattern already present.

2. **resolveUserByUsername — does a DAL function exist?**
   - What we know: `/wear/[id]` uses `wearEventId` directly (UUID lookup). The stories route needs to resolve a `username` string to a `userId` to call `getActiveWearsForUser`.
   - What's unclear: whether `getProfileByUsername` or equivalent exists in `src/data/profiles.ts`.
   - Recommendation: Check `src/data/profiles.ts` during planning — if missing, add a simple username→userId lookup.

3. **`useSearchParams` on `/wears/[username]` page**
   - What we know: the rail passes `?from={wearEventId}` so the lane can open at the tapped slide (D-05 "open at oldest unviewed"). If the server page reads `searchParams` to pass initial index down, it becomes a dynamic (not static) render — which is fine for an auth-only route.
   - What's unclear: whether the `WearsLane` client component should read `useSearchParams()` directly (requires a `<Suspense>` boundary per Next.js docs) or receive the initial index as a prop from the server page.
   - Recommendation: Server page reads `searchParams` (typed as `Promise<{ from?: string }>` in Next.js 16), resolves the index, and passes it as a prop to `WearsLane`. Simpler than client-side `useSearchParams`.

---

## Environment Availability

Step 2.6: SKIPPED — This phase is purely code/config changes. All dependencies (`embla-carousel-react`, `@base-ui/react`, `sonner`) are already installed and verified in `package.json`. No external services, CLIs, or runtimes beyond the project's own code are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 (unit/integration) + Playwright 1.60.0 (e2e) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test && npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | Tapping wear tile navigates to `/wears/[username]` (real route, not modal) | e2e | `npm run test:e2e -- --grep "wears-lane"` | ❌ Wave 0 |
| SC-2 | `/wears/[username]` full-screen, no nav chrome on mobile | e2e (visual assertion) | manual / e2e screenshot | ❌ Wave 0 |
| SC-3 | `/wear/[id]` retains nav, vertically scrollable, same card | e2e | `npm run test:e2e -- --grep "wear-detail"` | ❌ Wave 0 |
| SC-4 | WearCard, LikeButton, comment component shared (single source) | unit (import check) | `npm run test` | ❌ Wave 0 |
| SC-5 | Legacy WywtOverlay replaced (no URL-frozen behavior) | e2e | `npm run test:e2e -- --grep "wears-lane"` | ❌ Wave 0 |
| D-07 | `/wears/[username]` with 0 active wears redirects to `/u/[username]` | integration | `npm run test -- getActiveWearsForUser` | ❌ Wave 0 |
| D-09 | Add-to-wishlist hidden for own wears / owned / wishlisted | unit | `npm run test -- WearCard` | ❌ Wave 0 |
| F-2 | Signed URLs not cached; minted per-request | unit (mock assertion) | `npm run test -- getActiveWearsForUser` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test && npm run build`
- **Phase gate:** Full suite green (`npm run test && npm run test:e2e`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/phase56a-wears-lane.test.ts` — covers SC-1, D-07, SC-5
- [ ] `tests/components/wear/WearCard.test.tsx` — covers SC-4, D-09
- [ ] `tests/e2e/wears-lane.test.ts` — covers SC-1, SC-2, SC-3 via Playwright

*(No new framework install needed — vitest + playwright already configured)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` — proxy redirect for anon; no `__anon__` sentinel on new route |
| V3 Session Management | no | No new session state |
| V4 Access Control | yes | Three-tier visibility gate in `getActiveWearsForUser` (mirrors existing DAL pattern) |
| V5 Input Validation | yes | `username` param from URL validated against DB lookup (empty/nonexistent → `notFound()`); Zod already used in `addToWishlistFromWearEvent` |
| V6 Cryptography | no | No new crypto; existing Supabase signed-URL minting unchanged |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR via `?from=wearEventId` | Spoofing | Server resolves actor from `username` param, not client-supplied userId; `wearEventId` is only used for index lookup within the actor's own wears (already visibility-gated) |
| Visibility leak via cached DAL | Info Disclosure | Pitfall F-2 — never cache signed URLs; `getLikesForTargetCached` already viewer-scoped via `viewerId` arg (SEC-05) |
| Add-to-wishlist on unauthorized wear | Elevation of privilege | `addToWishlistFromWearEvent` already enforces three-tier gate server-side; D-09 UI hiding is a UX improvement, not a security gate |
| Cross-user like state in carousel | Info Disclosure | `getLikesForTargetCached` serializes `viewerId` into cache key (SEC-05 — existing mitigation) |

---

## Sources

### Primary (HIGH confidence)

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` — async params pattern in Next.js 16
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` — redirect() behavior, must be outside try/catch
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md` — useRouter from next/navigation
- `node_modules/embla-carousel/components/Options.d.ts` + `DragHandler.d.ts` — `watchDrag: boolean` type
- `src/components/ui/sheet.tsx` — existing `Sheet` + `SheetContent side="bottom"` primitive
- `src/components/home/WywtOverlay.tsx` — existing embla-carousel-react usage with `startIndex`, `prefers-reduced-motion`, `onSelect` pattern
- `src/data/wearEvents.ts` — existing DAL patterns: three-tier gate, 48h cutoff, visibility predicate
- `src/data/reactions.ts` — `getLikesForTargetCached` signature and SEC-05 cache-key design
- `src/app/wear/[wearEventId]/page.tsx` — Pitfall F-2 signed-URL minting pattern
- `src/components/wear/WearDetailHero.tsx` + `WearPhotoClient.tsx` — existing shared overlay and photo client
- `src/components/home/WywtRail.tsx` + `WywtTile.tsx` — existing rail + tile + openAt() pattern
- `src/app/actions/wishlist.ts` — `addToWishlistFromWearEvent` three-tier gate + double-submit guard
- `src/lib/constants/public-paths.ts` + `src/proxy.ts` — auth gate pattern
- `src/app/layout.tsx` — root layout structure (Header, BottomNavServer)
- `package.json` — verified `embla-carousel-react@8.6.0`, `@base-ui/react@^1.3.0`, `sonner@^2.0.7`

### Secondary (MEDIUM confidence)

- `src/hooks/useViewedWears.ts` — localStorage viewed-state hook; D-05 "open at oldest unviewed" strategy
- `src/app/u/[username]/layout.tsx` — route layout structural reference (async ProfileChrome in Suspense)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in node_modules and existing source
- Architecture: HIGH — patterns verified against Next.js 16 docs and existing codebase
- DAL shape: HIGH — directly derived from existing `getWearEventsForViewer` + `getWearRailForViewer`
- Nav hiding approach: MEDIUM — two valid options, planner must choose (A2 assumption)
- Pitfalls: HIGH — all grounded in existing codebase comments and bugs (Pitfall F-2 well-documented)

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (Next.js 16 stable; embla 8.x stable)
