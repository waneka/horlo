---
phase: 56A-wear-view-unification-gaps
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/app/wears/[username]/page.tsx
  - src/components/wears/WearsLane.tsx
  - src/components/wear/WearCard.tsx
  - src/components/wear/WearDetailHero.tsx
  - src/components/wear/WearPhotoClient.tsx
  - tests/e2e/wears-lane.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 56A (Gap Closure): Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The gap-closure plans (56A-06 through 56A-09) implement cross-user swipe (railIndex threading + embla boundary detection), desktop arrows, the brand/model watch link, and the w-full mobile photo fix. The core logic is sound but there is one correctness bug (stale closure in `onSettle` calling a stale `goToNeighbor`), and two usability/reliability concerns around pointer tracking and the close button z-index on desktop. The e2e SC-4 test has a selector fragility.

---

## Critical Issues

### CR-01: `onSettle` calls a stale `goToNeighbor` closure when `commentOpen` flips inside a drag

**File:** `src/components/wears/WearsLane.tsx:183-207`

**Issue:** `onSettle` is captured inside the pointer-tracking `useEffect`. That effect lists `commentOpen` in its deps array, so it re-registers listeners every time `commentOpen` changes. However, the `onSettle` closure captures `goToNeighbor` from the render at the time the effect last ran — not the render at the time `onSettle` fires.

The problem: if the user opens the comment sheet (commentOpen → true), then closes it (commentOpen → false), a re-render fires and the effect re-registers `onSettle`. If the user then swipes at the boundary, `onSettle` fires with the freshly captured `goToNeighbor`. So far so good.

But there is a distinct race: if the effect clean-up and re-registration happen _between_ `pointerdown` and `settle`, `dragDeltaX.current` is reset to `null` by the new `onPointerDown` registered on the same `root`, even though the original drag was already in flight (because `pointerdown` fires on the root node and the new listener is immediately active). In that case `dragDeltaX.current` will be `null` when the new `onSettle` fires, and the guard at line 195 returns early — swallowing the navigation silently.

More concretely: `commentOpen` can flip false→true→false during a single drag gesture if the sheet is closed programmatically (e.g., the user taps the sheet overlay while dragging). The guard `if (commentOpen) return` inside `goToNeighbor` is supposed to block this, but because the effect re-registers `onPointerDown` mid-drag, `dragDeltaX.current` is wiped and the guard never even needs to fire — cross-user navigation simply fails silently until the next clean drag gesture.

This is a correctness issue rather than a security issue: the user experiences a failed cross-user swipe after toggling the comment sheet during a drag. No double-navigation risk (the navigator.current single-flight guard still works after re-registration).

**Fix:** Move pointer-down/up tracking into refs that are never reset by the effect, or prevent the effect from re-registering while a drag is in flight by not including `commentOpen` in the effect that attaches `onPointerDown`/`onPointerUp`. The `commentOpen` guard can stay entirely in `onSettle` (where it already is redundantly), independent of the pointer-tracking sub-effect:

```typescript
// Split into two effects:
// Effect 1: pointer tracking — only re-registers when embla or railIndex changes.
useEffect(() => {
  if (!emblaApi) return
  if (railIndex === -1) return
  const root = emblaApi.rootNode()
  const onPointerDown = (e: PointerEvent) => {
    pointerDownX.current = e.clientX
    dragDeltaX.current = null
  }
  const onPointerUp = (e: PointerEvent) => {
    if (pointerDownX.current !== null) {
      dragDeltaX.current = e.clientX - pointerDownX.current
      pointerDownX.current = null
    }
  }
  root.addEventListener('pointerdown', onPointerDown)
  root.addEventListener('pointerup', onPointerUp)
  return () => {
    root.removeEventListener('pointerdown', onPointerDown)
    root.removeEventListener('pointerup', onPointerUp)
  }
}, [emblaApi, railIndex])

// Effect 2: settle handler — re-registers when commentOpen/router/etc. change.
useEffect(() => {
  if (!emblaApi) return
  if (railIndex === -1) return
  const onSettle = () => {
    if (commentOpen) return
    if (navigated.current) return
    // ... same logic, reads dragDeltaX.current which is now stable
  }
  emblaApi.on('settle', onSettle)
  return () => { emblaApi.off('settle', onSettle) }
}, [emblaApi, railUsernames, railIndex, commentOpen, router])
```

---

## Warnings

### WR-01: `pointerup` on `root` misses drags that end outside the embla container

**File:** `src/components/wears/WearsLane.tsx:176-181`

**Issue:** `pointerup` is added to `emblaApi.rootNode()` (the embla viewport div). If the user starts a drag inside the viewport and releases outside it — common on desktop when dragging quickly — the `pointerup` event fires on `document`, not on `root`. In that case `dragDeltaX.current` remains `null`, the guard at line 195 returns early, and cross-user boundary swipe never triggers.

This is not a safety bug but a usability gap: fast desktop drags that escape the container will never trigger cross-user navigation. Desktop users are expected to use the arrow buttons (56A-07), but this is still a discrepancy from the intended UX.

**Fix:** Attach `pointerup` to `window` (or `document`) so it fires regardless of where the drag terminates. Guard with the existing `pointerDownX.current !== null` check:

```typescript
window.addEventListener('pointerup', onPointerUp)
// cleanup:
window.removeEventListener('pointerup', onPointerUp)
```

### WR-02: Close button (z-30) and WearOverflowMenu (z-20) physically overlap on desktop when the photo fills the viewport height

**File:** `src/components/wears/WearsLane.tsx:260-273`, `src/components/wear/WearCard.tsx:130-139`

**Issue:** The close button is `absolute top-3 right-3 z-30` on the outer container. The WearOverflowMenu is `absolute top-3 right-3 z-20` inside the WearCard's `relative w-full` photo wrapper. On mobile, the 4:5 aspect photo is vertically centered inside `flex flex-col justify-center`, creating an empty band at the top where the close button sits — no collision.

On desktop (`md:static md:inset-auto`), the outer container loses `fixed inset-0` positioning. The close button is now positioned relative to the document flow, and its `absolute top-3 right-3` may no longer sit above the photo (since the containing block is not full-screen). In that case the button can visually overlap the WearOverflowMenu trigger at the same `top-3 right-3` screen position.

More critically: even on mobile, if the WearCard's photo extends to the top of the viewport (e.g., very tall device or large photo), the WearCard's overflow menu and the outer close button share the same screen coordinates. Z-30 ensures the close button wins visually, but the overflow menu's 44×44px touch target at z-20 is still tappable in the region not covered by the close button's bounding box.

**Fix:** Give the close button a `pointer-events-auto` + visually distinct position, or explicitly offset the overflow menu in stories-lane mode. Alternatively, suppress the overflow menu's own `right-3 top-3` positioning when `commentHostVariant === 'bottom-sheet'` and move it to a position that does not conflict (e.g., `top-12 right-3` on the WearCard in stories-lane mode).

### WR-03: `Link` inside `WearPhotoOverlays` fires even when embla captures the swipe

**File:** `src/components/wear/WearDetailHero.tsx:105-112`

**Issue:** The brand/model bottom overlay uses a Next.js `<Link>` with `onClick={(e) => e.stopPropagation()`. `stopPropagation` stops the click from bubbling up through React's synthetic event tree, but embla's drag detection uses native `mousedown`/`touchstart` listeners, not React synthetic events. After a swipe gesture, embla fires its own `click` suppression (via `evt.preventDefault()` on the `dragstart` event and its own `preventClick` flag), but this is separate from the React `onClick` handler on the Link.

On touch devices, the browser fires a synthetic `click` event after `touchend` when the touch delta is small (under the browser's threshold). If the user taps lightly on the brand/model area, the `click` reaches the `<Link>` and navigates to `/watch/[watchId]`, which is correct. But if embla's own click-prevention fails (e.g., after a very short drag), both the carousel scroll AND the link navigation fire. The `stopPropagation` does not prevent this because it only stops React's event bubbling — embla listens at the native level.

The safer pattern is to use `e.preventDefault()` as well, but that would break keyboard navigation. The most reliable fix is to track whether a drag occurred and conditionally suppress the link click:

```typescript
// In the Link's onClick:
onClick={(e) => {
  e.stopPropagation()
  // If parent embla container has a data attribute set by onPointerDown, suppress navigation
  const isDragging = (e.currentTarget.closest('[data-embla-dragging]') !== null)
  if (isDragging) e.preventDefault()
}}
```

Alternatively, this is already partially mitigated by embla's `click` prevention hook (line 310 in the embla source: `.add(node, 'click', click, true)` where `click` calls `evt.stopPropagation()` when `preventClick` is true). If that native stopPropagation fires before React's handler, the React `onClick` on the Link would not fire. This is embla-version-dependent behavior and not safe to rely on as a guarantee.

---

## Info

### IN-01: Progress segments use index as React key

**File:** `src/components/wears/WearsLane.tsx:243-251`

**Issue:** `slides.map((_, i) => <div key={i} ...>)` uses array index as key. This is generally acceptable when the list order is stable and items are not removed/reordered, which is true here (slides are immutable for the lane's lifetime). No functional bug, but worth noting as a deviation from the project convention of using stable IDs as keys (e.g., `slide.wearEventId` is available on the outer `slides.map` one level up).

**Fix:** Use `slide.wearEventId` as key if the outer map is adjusted, or accept index keys given the stable/immutable nature of the slides array.

### IN-02: SC-4 e2e test selector is brittle against Tailwind class changes

**File:** `tests/e2e/wears-lane.test.ts:147`

**Issue:** The photo container is selected via `.aspect-\\[4\\/5\\]` — a raw Tailwind utility class name. If the aspect ratio changes or Tailwind's class naming changes (e.g., with a config-level alias), this selector silently fails to locate the element, `photoContainer.count()` returns 0 after the `await expect(photoContainer).toBeVisible()` timeout, and the test throws a timeout error rather than a meaningful assertion failure.

Additionally, the test shares navigation logic with SC-3 (navigates to `/u/${PROFILE}/worn`, finds `a[href^="/wear/"]`, clicks it) but does not assert the current URL before checking the photo container. If the click navigates to a different page structure (e.g., 56A-04 rewires the wear link), the `.aspect-[4/5]` selector might match a different container.

**Fix:** Add a `data-testid="wear-photo-container"` attribute to the photo container div in `WearPhotoClient.tsx` and `WearDetailHero.tsx`, then select by that instead:

```typescript
const photoContainer = page.locator('[data-testid="wear-photo-container"]').first()
```

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
