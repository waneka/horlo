---
status: resolved
trigger: "Phase 62 UAT Test 4 — like/comment icons on wear-pic slides not discoverable; user wants them overlaid bottom-right on the photo"
created: 2026-05-27T00:00:00Z
updated: 2026-05-27T16:54:10Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — the wear-pic social row (LikeButton + comment-count opener) is rendered as a standalone flex row BELOW the carousel viewport and BELOW the position indicator, with no visual tether to the photo it controls. The placement was a deliberate UI-SPEC decision (Surface 2) that UAT rejected.
test: Read WatchPhotoSection.tsx render tree, UI-SPEC Surface 2, and LikeButton to confirm placement and identify the overlay-anchor container.
expecting: The social row JSX sits outside the carousel's `relative` slide container; relocating it as an absolutely-positioned overlay inside the slide wrapper resolves discoverability.
next_action: Return ROOT CAUSE FOUND with the precise relocation hint for plan-phase --gaps.

## Symptoms

expected: Like + comment controls on a wear-pic slide are discoverable and visually associated with the wear pic being viewed.
actual (verbatim): "functional pass - i didn't notice the like/comment icons at first, i think they should be placed overlaid on the photo in the bottom right corner. it's not obvious they even apply to the wear pic you're seeing"
errors: None — functionality is correct (optimistic like + comment sheet both work). This is a UX/visual placement issue only.
reproduction: Test 4 in 62-UAT.md, on prod /w/[ref] for a watch with public wear pics, on a wear-pic carousel slide.
started: Discovered during UAT (Phase 62), severity cosmetic.

## Eliminated

- hypothesis: Props threading bug (social row not receiving the right wearEventId / viewer identity).
  evidence: WatchDetail.tsx:180-192 threads wearPics/viewerId/canCommentOnWears etc. into WatchPhotoSection correctly; the row renders and is interactive (functional pass). Not a data bug.
  timestamp: 2026-05-27

- hypothesis: The controls are gated by viewerCanEdit and hidden from non-owners.
  evidence: The social row block (WatchPhotoSection.tsx:563-594) is gated ONLY by `isWearPicSlide && activeWearPic`, NOT by viewerCanEdit. It renders for all viewers. UI-SPEC Surface 2 line 139 confirms viewerCanEdit does not gate it.
  timestamp: 2026-05-27

## Evidence

- timestamp: 2026-05-27
  checked: WatchPhotoSection.tsx render tree structure.
  found: Carousel viewport is a `relative aspect-square ... overflow-hidden rounded-lg` div at line 435. Each wear-pic slide is a `flex-none w-full h-full relative` wrapper (line 484) — already a positioned container hosting the absolutely-positioned "Worn · [date]" badge at `absolute bottom-2 left-2` (lines 499-505). This wrapper is the natural anchor for an overlay.
  implication: There IS already a `relative` per-slide container with `object-cover` images and an existing absolute badge. An overlay anchored bottom-right fits the existing structure with no new wrapper.

- timestamp: 2026-05-27
  checked: Location of the social row JSX.
  found: The social row lives at WatchPhotoSection.tsx:563-594 — a `flex items-center gap-2 w-full max-w-md` div, rendered AFTER the carousel container closes (line 542) AND after the position indicator (lines 547-556). It is a sibling element stacked vertically below the photo, not inside the slide. It is conditionally rendered on `isWearPicSlide && activeWearPic`, so it appears/disappears as the carousel scrolls (correct behavior, wrong place).
  implication: ROOT CAUSE — physical separation from the photo + appearance below the position indicator (two elements removed from the image) breaks the visual association. Users do not connect the row to the pic.

- timestamp: 2026-05-27
  checked: 62-UI-SPEC.md Surface 2 (lines 113-140).
  found: The spec EXPLICITLY chose "BENEATH the active slide, not overlaid ON the slide" (lines 117-119), rationale: "overlaying on the photo would compete visually with the Worn · [date] badge and obscure the photo content." This was a Claude's-discretion call that UAT overruled.
  implication: The fix reverses this discretion decision. The Worn badge collision concern is real and must be handled: badge is bottom-LEFT, so the new overlay goes bottom-RIGHT to avoid collision.

- timestamp: 2026-05-27
  checked: LikeButton.tsx contract.
  found: LikeButton is a self-contained `<button>` with `inline-flex items-center gap-1 min-h-[44px] min-w-[44px] px-2 rounded-md`, Heart icon `size-5`, count `text-sm`. Uses onClick (anon bounce + optimistic). It carries no background of its own — over a photo it needs a scrim/contrast treatment from its container.
  implication: Both LikeButton and the comment-count button render bare icons with no opaque background. Overlaid directly on arbitrary photos they would be illegible. The overlay container must supply the scrim (e.g. `bg-background/80 backdrop-blur-sm rounded-full px-1` — same token chain as the Worn badge and arrow buttons, per UI-SPEC Color §line 84).

- timestamp: 2026-05-27
  checked: onClick vs onPointerDown usage in the social controls.
  found: LikeButton uses onClick internally (handleClick). The comment-count button (WatchPhotoSection.tsx:583) uses onClick to setCommentSheetOpen(true). The onPointerDown pattern in this file (lines 727, 905) applies ONLY to the editMode toggle and the eye/hide toggle (state that must survive Router-Cache stale-instance revisits). The like/comment controls are NOT one-shot mount-guarded state — they are fresh-per-interaction, so onClick is correct and must NOT be changed to onPointerDown during the relocation.
  implication: The relocation is JSX-position-only. Do not alter the event handlers. The Phase 52 onPointerDown lesson does not apply to like/comment.

- timestamp: 2026-05-27
  checked: WatchDetail.tsx prop threading (lines 27-28, 55, 81-99, 130, 180-192).
  found: WatchDetail only imports SignedWearPic and threads wearPics + viewer/owner/comment props straight into WatchPhotoSection. All social-row markup is self-contained inside WatchPhotoSection.
  implication: The fix is entirely within WatchPhotoSection.tsx. No WatchDetail change, no page RSC change, no new props.

- timestamp: 2026-05-27
  checked: Owner studio/hero (SignedPhoto) slides vs wear-pic (SignedWearPic) slides.
  found: Owner photo slides (lines 440-459) and the catalog-fallback slide (lines 462-470) carry NO badge and NO social row. The social row is gated on `isWearPicSlide` (line 419: `selectedIndex >= ownerSlideCount && wearPicSlideCount > 0`). `activeWearPic` (line 420) resolves only on wear-pic slides.
  implication: The overlay MUST be rendered only inside the wear-pic slide map (lines 483-507) or gated by `isWearPicSlide`, so owner/catalog slides never get a social overlay.

## Resolution

root_cause: |
  The wear-pic like + comment-count controls render as a standalone vertical-stacked flex row
  (WatchPhotoSection.tsx:563-594) positioned BELOW both the carousel viewport (closes line 542)
  and the position indicator (lines 547-556). They sit two elements removed from the photo with
  no visual tether, so users do not perceive them as belonging to the wear pic on screen. This was
  a deliberate 62-UI-SPEC Surface 2 decision ("BENEATH the active slide, not overlaid ON the slide",
  lines 117-119) that Phase 62 UAT Test 4 overruled: the user wants the controls overlaid on the
  photo, bottom-right.

fix: |
  Relocate the like/comment controls from the standalone row (lines 563-594) to an absolutely-
  positioned overlay anchored bottom-RIGHT inside the wear-pic slide's existing `relative` wrapper
  (the same `flex-none w-full h-full relative` div at line 484 that already hosts the bottom-LEFT
  Worn badge). Wrap LikeButton + the comment-count button in a container with the established
  overlay scrim treatment (`bg-background/80 backdrop-blur-sm rounded-full` — matching the Worn
  badge / arrow-button token chain) so the bare icons are legible over arbitrary photos.

  Implementation shape (per-slide, inside the wear-pic map at lines 483-507):
    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-1">
      <LikeButton ... target={{ type: 'wear', id: wp.wearEventId }} ... />
      <button onClick={() => { setCommentSheetOpen(true) }} ...>  {/* MessageCircle + count */}
    </div>

  Key constraints to honor:
  - Anchor bottom-RIGHT (`absolute bottom-2 right-2`); the Worn badge stays bottom-LEFT
    (`absolute bottom-2 left-2`, line 499) — no collision.
  - Render the overlay PER wear-pic slide (inside the map at 483-507), keyed to `wp.wearEventId`,
    NOT once on `activeWearPic`. Because each slide is its own positioned container, putting the
    overlay inside the map ties it to the visible photo and reuses `wp`'s own social state.
    Owner photo slides (440-459) and catalog fallback (462-470) get NO overlay — they are outside
    this map, so the owner-vs-wear-pic gate is structural and automatic.
  - The bottom-sheet host (WearCommentHost, lines 599-620) and `commentSheetOpen` state stay where
    they are; only the trigger button moves into the overlay. `onCountChange` sync and the
    `wearPicCommentCounts[wp.wearEventId]` count display logic move with the comment button.
  - Keep onClick on both controls. Do NOT convert to onPointerDown — the Phase 52 Router-Cache
    stale-instance lesson applies only to the editMode/eye-hide one-shot toggles, not to
    fresh-per-interaction like/comment.
  - Delete the now-empty standalone row (563-594) and its `isWearPicSlide && activeWearPic` wrapper;
    keep the position indicator (547-556) unchanged.
  - Contrast: the `bg-background/80 backdrop-blur-sm` scrim is the SAME treatment already proven for
    the Worn badge and arrow buttons (UI-SPEC Color §84, CSS Chain Assertion 1) — legible over
    light and dark photos.
  - Touch targets: LikeButton already carries `min-h-[44px] min-w-[44px]`; preserve `min-h-[44px]
    min-w-[44px]` on the comment button. The rounded scrim pill can hug the two 44px targets.

verification: Not performed — diagnose-only mode (find_root_cause_only). plan-phase --gaps will implement and re-verify via prod UAT Test 4.
files_changed: []
