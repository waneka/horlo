---
phase: 56A-wear-view-unification
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/app/wears/[username]/page.tsx
  - src/app/wear/[wearEventId]/page.tsx
  - src/components/wears/WearsLane.tsx
  - src/components/wear/WearCard.tsx
  - src/components/wear/WearCommentHost.tsx
  - src/components/wear/WearOverflowMenu.tsx
  - src/components/home/WywtRail.tsx
  - src/components/layout/BottomNav.tsx
  - src/components/layout/SlimTopNav.tsx
  - src/data/wearEvents.ts
  - tests/data/getActiveWearsForUser.test.ts
  - tests/components/wear/WearCard.test.tsx
  - tests/integration/phase56a-wears-lane.test.ts
  - tests/e2e/wears-lane.test.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 56A: Code Review Report

**Reviewed:** 2026-05-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 56A delivers the wear-view unification: a shared `WearCard` component used by both the stories lane (`/wears/[username]`) and the detail page (`/wear/[id]`), a new routed `WearsLane` carousel replacing the old overlay, and a Phase-57 placeholder `WearCommentHost`. Auth gating (EN-6), three-tier visibility (getActiveWearsForUser), signed-URL handling (Pitfall F-2), and the redirect D-07 contract are all structurally sound. One critical D-09 authorization gap was found: the "own wear" exclusion for "Add to wishlist" is enforced only at the UI layer; the server action admits self-calls. Four warnings cover a clipboard URL correctness bug, an embla viewport layout hazard, a `WearCommentHost` missing-invariant gap, and a dead prop that will cause a breakage seam in Phase 57.

---

## Critical Issues

### CR-01: D-09 "Own wear" gate not enforced server-side in `addToWishlistFromWearEvent`

**File:** `src/app/actions/wishlist.ts:109-117`
**Issue:** The D-09 requirement states `showAddToWishlist` must be false when the wear belongs to the viewer (own wear). The stories lane page and detail page both enforce this client-side by setting `showAddToWishlist = w.userId !== viewerId`. However, `addToWishlistFromWearEvent` has no server-side guard for this case. The `canSee` predicate at line 109 evaluates `isSelf` (line 90) as `true` when `row.actorId === user.id`, which causes the action to proceed and create a `status='wishlist'` watch entry under the viewer's own account from their own wear event. An authenticated user can POST to this server action directly (bypassing the hidden UI button) and add their own watch to their wishlist, creating a duplicate owned-to-wishlist entry. The comment in the action (line 38-39) documents G-5 as a visibility bypass but does not document the D-09 own-wear prohibition — the gap went unnoticed because the UI button is hidden.

**Fix:**
```typescript
// After line 90 (const isSelf = row.actorId === user.id)
// D-09: own-wear guard — viewer cannot wishlist their own wear event.
if (isSelf) {
  return { success: false, error: 'Wear event not found' }
}
```

Remove the `isSelf ||` branch from `canSee` — for this action, self visibility is irrelevant since own wears are categorically blocked. The remaining predicate covers all valid non-self cases:
```typescript
const canSee =
  row.profilePublic &&
  (row.visibility === 'public' ||
    (row.visibility === 'followers' && isFollower))

if (!canSee) {
  return { success: false, error: 'Wear event not found' }
}
```

---

## Warnings

### WR-01: "Copy link" copies a relative path, not a usable URL

**File:** `src/components/wear/WearOverflowMenu.tsx:72`
**Issue:** `navigator.clipboard.writeText(permalinkUrl)` writes the value `/wear/${wearEventId}`, which is the relative path passed from both page components (e.g., `src/app/wears/[username]/page.tsx:141`, `src/app/wear/[wearEventId]/page.tsx:100`). When a user pastes this into a chat, email, or browser address bar, they get a non-functional relative path instead of a full URL like `https://horlo.app/wear/abc`. This is the only `clipboard.writeText` call in the codebase; no other feature exhibits this pattern to compare against.

**Fix:**
```typescript
// In WearOverflowMenu.tsx, line 71-73:
onClick={() => {
  const absolute = `${window.location.origin}${permalinkUrl}`
  navigator.clipboard.writeText(absolute)
}}
```

Or normalize at the point of construction in page.tsx:
```typescript
// src/app/wears/[username]/page.tsx line 141
permalinkUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/wear/${w.id}`,
```
The client-side `window.location.origin` approach is simpler and requires no env var.

---

### WR-02: Embla viewport contains a sibling close button — pointer events conflict

**File:** `src/components/wears/WearsLane.tsx:112-139`
**Issue:** The close button (`<button aria-label="Close">`) and the slide container (`<div className="flex h-full">`) are rendered as siblings inside the element that holds `emblaRef` (line 113). Embla attaches `pointerdown` / `pointermove` / `pointerup` listeners to the viewport element (confirmed in `embla-carousel.esm.js:305-307`). Because the close button is inside the viewport, a pointer-down on the button starts embla's drag tracker in addition to the button's own click handler. On a fast tap this is typically harmless, but on a slower or slightly-moved touch event, embla may interpret the button press as the start of a swipe and either consume the event before `onClick` fires or trigger an unintended slide transition. The correct structure for embla is: viewport → slide container → slides, with all non-slide UI (close button, progress dots) outside the viewport element.

**Fix:**
Restructure so the close button is a sibling of the embla viewport, not a child:
```tsx
// WearsLane.tsx — move the X button outside the emblaRef div
return (
  <div className="fixed inset-0 h-dvh overflow-hidden md:static md:inset-auto md:h-auto md:overflow-visible">
    {/* Close affordance — outside embla viewport, z-20 absolute to the outer container */}
    <button
      type="button"
      aria-label="Close"
      onClick={() => router.back()}
      className="absolute top-3 left-3 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center text-white"
    >
      <X className="size-5" aria-hidden />
    </button>

    {/* Embla viewport */}
    <div
      ref={emblaRef}
      className="h-full overflow-hidden bg-background md:max-w-[600px] md:mx-auto"
    >
      <div className="flex h-full">
        {slides.map((slide) => (
          <div key={slide.wearEventId} className="flex-[0_0_100%] min-w-0">
            <WearCard {...slide} viewerId={viewerId} commentHostVariant="bottom-sheet" onCommentOpenChange={setCommentOpen} />
          </div>
        ))}
      </div>
    </div>
  </div>
)
```

---

### WR-03: `WearCommentHost` bottom-sheet variant is unguarded for missing `onOpenChange`

**File:** `src/components/wear/WearCommentHost.tsx:27-45`
**Issue:** The `WearCommentHostProps` interface marks both `open` and `onOpenChange` as optional (`?`). For the `bottom-sheet` variant, `onOpenChange` is passed directly to `<Sheet onOpenChange={onOpenChange}>`. If the `bottom-sheet` variant is rendered without `onOpenChange` (e.g., by a future caller or refactored site), the Sheet will open (controlled by the `open` prop defaulting to `undefined` → uncontrolled) and the user will have no way to close it — the sheet becomes stuck open. The current callsite in `WearCard` always provides these props (lines 185-190), but the TypeScript types do not enforce this invariant, making it a latent trap.

**Fix:** Use a discriminated union to make the invariant type-safe:
```typescript
type WearCommentHostProps =
  | { variant: 'bottom-sheet'; open: boolean; onOpenChange: (v: boolean) => void }
  | { variant: 'inline'; open?: never; onOpenChange?: never }
```
This removes the optional-on-required footgun and prevents future callers from accidentally omitting required props.

---

### WR-04: `WearCommentHost` missing `wearEventId` prop creates a Phase 57 breakage seam

**File:** `src/components/wear/WearCommentHost.tsx:10-15`
**Issue:** The `WearCommentHostProps` interface has no `wearEventId` field. When Phase 57 drops the real comment component into the two `/* Phase 57 */` insertion seams (lines 39 and 55), it will need `wearEventId` to fetch and post comments for the correct wear event. Neither the bottom-sheet variant nor the inline variant currently receives this identifier. Phase 57 will need to add `wearEventId` to the interface AND update both callsites in `WearCard` (lines 186-190 and 192) — a two-file mechanical change. If Phase 57 only updates `WearCommentHost` without updating `WearCard`'s callsite, TypeScript will catch it, but the seam comment does not document this dependency.

Note: `WearCard` itself has `wearEventId` in scope at both callsites, so the fix is straightforward; the warning is that the current placeholder interface omits a field that is already available and will definitely be required.

**Fix:** Add `wearEventId` to `WearCommentHostProps` now so Phase 57 is a drop-in rather than an interface change:
```typescript
interface WearCommentHostProps {
  variant: 'bottom-sheet' | 'inline'
  wearEventId: string   // Phase 57: required by both variants for comment fetching
  open?: boolean
  onOpenChange?: (v: boolean) => void
}
```
Update both callsites in `WearCard.tsx`:
```tsx
// line 186
<WearCommentHost variant="bottom-sheet" wearEventId={wearEventId} open={commentOpen} onOpenChange={handleCommentOpenChange} />
// line 192
<WearCommentHost variant="inline" wearEventId={wearEventId} />
```

---

## Info

### IN-01: `watchId` prop in `WearCard` is accepted but immediately discarded

**File:** `src/components/wear/WearCard.tsx:27,71`
**Issue:** `WearCardProps.watchId` is declared (line 27) with a JSDoc comment "brand/model → /watch/[watchId] link" suggesting it should drive a navigation link. In the destructuring at line 71 it is renamed `_watchId` (the TypeScript convention for an intentionally unused variable). No link to `/watch/[watchId]` is rendered anywhere in `WearCard` or any child component (`WearPhotoClient`, `WearDetailHero`). The prop adds serialization cost on each slide in the stories lane without providing any value. Either the link should be implemented (consistent with the JSDoc) or the prop should be removed from the interface until Phase 58/future work adds the link.

**Fix:** If the link is not planned for Phase 56A, remove the prop and its JSDoc until it is needed:
```typescript
// Remove from WearCardProps:
//   watchId: string
// Remove from WearSlide (WearsLane.tsx):
//   watchId: string
// Remove from destructuring in WearCard body (line 71)
// Remove from WearPhotoStreamed props (wear/[wearEventId]/page.tsx lines 94,128,149)
```

---

### IN-02: `WearCardProps.viewerId` typed as `string | null` despite auth-only routes

**File:** `src/components/wear/WearCard.tsx:28`
**Issue:** `viewerId: string | null` is declared in `WearCardProps`, but both routes that render `WearCard` (`/wears/[username]` and `/wear/[id]`) are auth-only (EN-6) and always provide a non-null string. `WearsLaneProps.viewerId` is correctly typed as `string` (non-nullable). The nullable type in `WearCard` suggests the component was designed for an anon use case that no longer exists after the EN-6 cleanup. It also allows `LikeButton` (which accepts `viewerId: string | null`) to receive null in theory, which it handles by showing a sign-in prompt — but this branch is now unreachable. The wider `string | null` type survives from the pre-EN-6 era and could mislead future readers.

**Fix:** Tighten the prop type to `string` since auth is always required for wear routes:
```typescript
viewerId: string  // auth-only (EN-6); no null path exists
```
`LikeButton` can remain nullable since it is used in other anon-capable contexts; only the `WearCard` interface needs the tightening.

---

_Reviewed: 2026-05-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
