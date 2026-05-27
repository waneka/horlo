---
phase: 62-public-wear-pics-on-watch-detail
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/components/watch/WatchPhotoSection.tsx
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 62 (Gap Closure 62-05): Code Review Report

**Reviewed:** 2026-05-27
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Gap-closure commit `5e6f136` relocates the wear-pic like/comment controls from a single
standalone below-carousel row (gated on the active slide via `isWearPicSlide && activeWearPic`)
into a per-slide absolute overlay rendered inside the `visibleWearPics.map(...)` loop. The diff
is JSX-position-only by intent — no props, server actions, imports, or data flow changed.

The relocation is visually sound (scrim token chain matches the Worn badge and arrows; bottom-RIGHT
anchor avoids the bottom-LEFT date badge). However, the move from a *single* control bound to
`activeWearPic` to *N controls* rendered per slide introduces a target-binding regression: the
per-slide comment button still opens the comment sheet for `activeWearPic`, NOT for its own `wp`.
Because every slide's button is now permanently in the DOM and focus order, a comment button can be
activated for a slide that is not the active carousel slide (keyboard/AT focus traversal, or a
partial embla drag), opening the sheet for the wrong wear event. The like buttons are correctly
per-`wp` bound, so this is isolated to the comment control.

Two warnings cover the now-multiplied focusable controls leaking off-screen slides into the tab/AT
order, and the resulting `aria-label`/`onClick` mismatch. One info item notes a missed extraction
opportunity given the controls are now duplicated per slide.

---

## Critical Issues

### CR-01: Per-slide comment button opens the sheet for `activeWearPic`, not its own slide

**File:** `src/components/watch/WatchPhotoSection.tsx:523-539` (also `596-617`)

**Issue:** Before this commit there was exactly one comment button, gated by
`isWearPicSlide && activeWearPic`, so "open the sheet" unambiguously meant "open it for the active
wear pic." After relocation, the comment button is rendered once per wear pic inside
`visibleWearPics.map((wp, idx) => ...)`. Each button's handler is still
`onClick={() => setCommentSheetOpen(true)}`, and the `WearCommentHost` sheet (lines 596-617) is
bound to `activeWearPic` — which is derived from `selectedIndex`, the *carousel* position, not the
button that was clicked.

In an embla snap carousel the inactive slides are not removed from the DOM and are not given
`pointer-events: none`; they are merely clipped by the viewport's `overflow-hidden`. Two concrete
ways a non-active slide's button gets activated:

1. **Keyboard / assistive tech:** all N comment buttons are focusable and in tab order (see WR-01).
   Tabbing to the comment button of wear pic #2 while wear pic #1 is the active slide and pressing
   Enter opens the sheet for wear pic #1's `wearEventId`, with #1's `initialComments` and #1's
   `onCountChange` target — i.e. comments for the wrong watch-wear event.
2. **Partial drag / mid-transition tap on touch:** during a swipe the adjacent slide is partially
   visible and tappable before `selectedIndex` settles.

The result is data-correctness wrong: the user reads/posts comments against a different wear event
than the one whose photo and count they were looking at. The `wp.wearEventId` is already in scope in
the loop — the button must drive the sheet from `wp`, not from `activeWearPic`.

**Fix:** Make the per-slide button set the sheet's target explicitly, and bind the sheet to that
target instead of (or in addition to) `selectedIndex`. Add a piece of state for the active sheet
target and set it from the clicked slide:

```tsx
// near the other sheet state (line ~221)
const [sheetWearEventId, setSheetWearEventId] = useState<string | null>(null)

// in the per-slide overlay button (line ~530)
onClick={() => {
  setSheetWearEventId(wp.wearEventId)
  setCommentSheetOpen(true)
}}

// derive the sheet's wear pic from the explicitly-set target, not selectedIndex
const sheetWearPic =
  visibleWearPics.find((p) => p.wearEventId === sheetWearEventId) ?? activeWearPic

// render the host against sheetWearPic (line ~596)
{sheetWearPic && (
  <WearCommentHost
    variant="bottom-sheet"
    wearEventId={sheetWearPic.wearEventId}
    open={commentSheetOpen}
    onOpenChange={setCommentSheetOpen}
    initialComments={sheetWearPic.initialComments}
    /* ...remaining props keyed off sheetWearPic... */
    onCountChange={(delta) => {
      setWearPicCommentCounts((prev) => ({
        ...prev,
        [sheetWearPic.wearEventId]:
          (prev[sheetWearPic.wearEventId] ?? sheetWearPic.commentCount) + delta,
      }))
    }}
  />
)}
```

This guarantees the sheet always targets the wear pic whose button was activated, independent of
which slide embla currently considers selected.

---

## Warnings

### WR-01: All per-slide like/comment controls are now permanently in the DOM and focus order

**File:** `src/components/watch/WatchPhotoSection.tsx:512-540`

**Issue:** The previous single social row meant exactly one `LikeButton` and one comment button
existed at any time. The relocation renders both controls for *every* wear pic, all the time
(`visibleWearPics.map`). Inactive slides are only visually clipped by the embla viewport's
`overflow-hidden`; their buttons remain focusable. A keyboard or screen-reader user now traverses
like/comment controls for wear pics that are not visible, with no indication of which slide each one
belongs to. For a watch with several public wear pics this is a confusing, repetitive AT experience
and is the mechanism that enables CR-01. (This is an interaction/a11y correctness concern, not a
performance one — N is capped low.)

**Fix:** Gate the off-screen controls out of the tab order. Either render the overlay only for the
active slide (`{idx === selectedIndex - ownerSlideCount && (<div className="absolute ...">...)}`),
or keep them per-slide but apply `tabIndex={-1}` / `aria-hidden` and `pointer-events-none` to the
overlays of non-active slides:

```tsx
const isActiveWearSlide = selectedIndex - ownerSlideCount === idx
<div
  className={cn(
    'absolute bottom-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-1',
    !isActiveWearSlide && 'pointer-events-none',
  )}
  {...(!isActiveWearSlide ? { 'aria-hidden': true } : {})}
  role="group"
  aria-label="Wear photo interactions"
>
```

(Combining this with CR-01's explicit `wp` target is the most robust fix.)

### WR-02: Comment button `aria-label` describes `wp`'s count but the action targets `activeWearPic`

**File:** `src/components/watch/WatchPhotoSection.tsx:525-529`

**Issue:** The button's `aria-label` is computed from `wearPicCommentCounts[wp.wearEventId] ?? wp.commentCount`
— i.e. the count for *this* slide's wear pic — announcing e.g. "View 3 comments." But the `onClick`
opens the sheet for `activeWearPic` (CR-01), which may be a different wear event with a different
count. When the two diverge, the screen-reader announcement is a false promise: the user is told
they will view N comments for this photo, then the sheet shows a different photo's thread. Even once
CR-01 is fixed by binding the sheet to `wp`, keep the label and the target derived from the *same*
source so they cannot drift.

**Fix:** Resolved automatically by CR-01's fix (drive both the label and the sheet from `wp` /
`sheetWearEventId`). Until then, do not ship the relocated overlay with the label keyed off `wp`
while the action is keyed off `activeWearPic`.

---

## Info

### IN-01: Duplicated social-overlay markup per slide — extract a small sub-component

**File:** `src/components/watch/WatchPhotoSection.tsx:512-540`

**Issue:** Now that the like/comment overlay is rendered inside the per-slide loop, the same
~28-line block (scrim container + `LikeButton` + comment button with its label/count logic) is
instantiated once per wear pic. The count-fallback expression
`wearPicCommentCounts[wp.wearEventId] ?? wp.commentCount` is repeated four times within the single
button. Extracting a `WearPicSocialOverlay` component (props: `wearPic`, `viewerId`, `commentCount`,
`onOpenComments`) would remove the duplication, make the `wp`-vs-`activeWearPic` binding explicit at
the call site (directly supporting the CR-01 fix), and shrink this already-large component.

**Fix:** Extract the overlay into `src/components/watch/WearPicSocialOverlay.tsx` and call it from
the slide map with the slide's own `wp` and an `onOpenComments={() => openSheetFor(wp.wearEventId)}`
callback.

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
