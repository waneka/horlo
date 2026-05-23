---
phase: 56A-wear-view-unification
plan: "07"
type: execute
wave: 2
depends_on: ["06"]
files_modified:
  - src/components/wears/WearsLane.tsx
autonomous: true
gap_closure: true
requirements: []

must_haves:
  truths:
    - "The stories lane shows an IG-stories-style segmented progress indicator at the top (current wear of N highlighted)"
    - "The close (X) sits in the top-RIGHT of the band above the centered photo and no longer overlaps the avatar"
    - "On DESKTOP, left/right arrow controls centered on the photo edges navigate between wears (and cross user lanes at boundaries); arrows are hidden on mobile"
  artifacts:
    - path: "src/components/wears/WearsLane.tsx"
      provides: "Top progress segments driven by embla selectedScrollSnap; close moved to top-3 right-3; md:-only prev/next arrow buttons"
      contains: "selectedScrollSnap"
  key_links:
    - from: "src/components/wears/WearsLane.tsx (progress segments)"
      to: "embla selectedScrollSnap()"
      via: "select-event-driven active segment index"
      pattern: "selectedScrollSnap"
    - from: "src/components/wears/WearsLane.tsx (desktop arrows)"
      to: "emblaApi.scrollPrev/scrollNext"
      via: "md:-only arrow button onClick"
      pattern: "scroll(Prev|Next)"
---

<objective>
Close UAT gaps #3 (MINOR), #4 (COSMETIC), #6 (MINOR) — all of which live in the top/edge chrome
of WearsLane.tsx and all of which sit on top of plan 56A-06's cross-user wiring:

- #3: IG-stories segmented progress indicator at the top — one segment per wear in the current
  user's lane, the current wear highlighted. (Was deferred in 56A-UI-SPEC; user now wants it for
  sense-of-place.)
- #4: move the close (X) from top-3 left-3 to top-3 right-3 so it sits in the empty band above
  the vertically-centered 4:5 photo and no longer overlaps the avatar — coordinated with the
  progress indicator placement.
- #6: desktop-only (md:) prev/next arrow buttons centered vertically on the photo's left/right
  edges, driving emblaApi.scrollPrev()/scrollNext(), crossing user lanes at boundaries (reusing
  56A-06's cross-user navigation).

These three are clustered into ONE plan because they all edit WearsLane.tsx and all relate to the
same top band — splitting them into separate same-wave plans would guarantee merge conflicts.

Purpose: deliver the stories chrome polish on top of the cross-user foundation.
Output: WearsLane renders progress segments, a top-right close, and desktop edge arrows.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/56A-wear-view-unification/56A-CONTEXT.md
@.planning/phases/56A-wear-view-unification/56A-UI-SPEC.md
@.planning/phases/56A-wear-view-unification/56A-PATTERNS.md
@.planning/phases/56A-wear-view-unification/56A-06-PLAN.md

This plan DEPENDS ON 56A-06 (cross-user boundary navigation). The desktop arrows (#6) reuse 06's
neighbor-lane navigation at boundaries — read the 06 SUMMARY for the exact helper/handler names
once 06 has executed.

<interfaces>
Current WearsLane structure (src/components/wears/WearsLane.tsx after 06):
  - outer container: a div with className fixed inset-0 h-dvh overflow-hidden md:static ...
  - close button: currently absolute top-3 left-3 z-20 (lines 117-124) — MOVE to top-3 right-3
  - embla viewport: ref={emblaRef} (line 127)
  - slide container: a div with className flex h-full (line 132)
  - per-slide wrapper: flex-[0_0_100%] min-w-0 flex flex-col justify-center (line 134)
  - existing select listener effect already reads emblaApi.selectedScrollSnap() (lines 94-107)

Embla API (verified node_modules/embla-carousel/components/EmblaCarousel.d.ts):
  selectedScrollSnap(): number    // active slide index — drives the highlighted progress segment
  scrollSnapList(): number[]      // .length === segment count
  scrollPrev(jump?: boolean): void
  scrollNext(jump?: boolean): void
  canScrollPrev(): boolean        // false on first slide — at-boundary, defer to 06 cross-user nav
  canScrollNext(): boolean        // false on last slide  — at-boundary, defer to 06 cross-user nav
</interfaces>

UI-SPEC contracts to honor:
- §4 Close Affordance: X icon 20px, min-h-[44px] min-w-[44px] touch target, text-white, aria-label "Close".
  (Position changes from top-left to top-RIGHT per gap #4.)
- §3 Overflow menu lives inside WearCard at top-3 right-3 OVER the photo. The X reposition is the band
  ABOVE the centered photo (the empty space created by justify-center), not on the photo — coordinate
  so the X does not collide with the WearCard's own overflow menu button.
- Color: stories chrome controls are text-white. Progress segments: active = high-opacity white,
  inactive = low-opacity white (IG-stories convention). Tap targets (arrows) honor the 44px minimum;
  thin progress segments are non-interactive.
- Accent (--accent) is reserved for active nav only — do NOT use accent on progress segments or arrows.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Top progress indicator + close reposition (gaps #3 + #4)</name>
  <files>src/components/wears/WearsLane.tsx</files>
  <read_first>
    - src/components/wears/WearsLane.tsx (lines 94-107 the existing select-listener effect that
      already reads selectedScrollSnap(); lines 109-145 the outer container + close button + embla
      viewport JSX) — the file being modified.
    - 56A-UI-SPEC.md §4 Close Affordance + §7 WearsLane + § Route-Specific Layout Contracts — the
      visual contract for the X button and the centered-photo band.
    - 56A-06-SUMMARY.md — to learn the names of any state/handlers 06 introduced (so the new
      selectedScrollSnap subscription does not duplicate or conflict with 06's listeners).
  </read_first>
  <action>
    Add a top segmented progress indicator and move the close button.

    PROGRESS INDICATOR (#3): add a selectedIndex state in WearsLane, updated from the embla select
    event (extend the existing select effect at lines 94-107 rather than adding a second listener —
    keep ONE select handler). Render a horizontal row of slides.length segments at the top of the
    outer container, absolute-positioned top-0 inset-x-0 with p-3 insets and z-20 (above the photo
    scrims at z-10). Each segment: a thin rounded bar, flex-1, with a small gap between segments; the
    segment at selectedIndex is high-opacity white, the rest are low-opacity white. The segment count
    reflects the CURRENT user's wears only. Add a cross-user boundary HINT (D-06 sense-of-place):
    when on the last segment AND a next user exists in the rail (railIndex/railUsernames from 56A-06),
    render a subtle cue that the next swipe crosses to another user (e.g. a small chevron/dot or a
    faint affordance at the right end of the segment row) — keep it minimal, text-white low opacity,
    no accent color. Mark the whole progress row pointer-events-none so it never intercepts swipes.

    CLOSE REPOSITION (#4): change the close button className from absolute top-3 left-3 ... to
    absolute top-3 right-3 ..., keeping z-20 min-h-[44px] min-w-[44px] flex items-center justify-center
    text-white and aria-label="Close". Collision check: the WearCard renders its own overflow menu at
    absolute top-3 right-3 OVER the photo (WearCard.tsx:129). The X here lives in the band ABOVE the
    centered photo (empty space from justify-center), so its visual position differs even though both
    use top-3 right-3 relative to their own containers. Verify they do not stack: the X is anchored to
    the WearsLane OUTER container (full-viewport top); the overflow menu is anchored to the WearCard's
    relative photo container (vertically centered, lower down). If they DO collide on a short photo,
    nudge the X (keep X at the true top while the photo+overflow sits centered lower). Do NOT move or
    duplicate the WearCard overflow menu — it is owned by WearCard (plan 56A-02), out of scope here.

    Coordinate the progress row and the X: both occupy the top band. The progress row is full-width and
    pointer-events-none; the X is a small tappable target at the right. Lay them out so the X sits at
    the top-right corner and the segments sit legibly (progress row spanning full width with the X
    overlaid at right, OR segments just below the X) — pick the layout that keeps both legible and the
    X tappable.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "WearsLane" || echo "no type errors"; grep -q "right-3" src/components/wears/WearsLane.tsx && echo "close moved" || echo "MISSING close move"</automated>
  </verify>
  <acceptance_criteria>
    - WearsLane maintains a selectedIndex state updated from the embla select event (single select
      handler, no duplicate listener).
    - A top progress row renders slides.length segments; the segment at selectedIndex is visually
      highlighted (higher opacity) vs. the others.
    - When selectedIndex is the last segment and a next rail user exists, a subtle cross-user hint
      renders at the right end of the row.
    - The progress row is pointer-events-none (never intercepts swipes).
    - The close button className contains top-3 right-3 (no longer left-3), retains min-h-[44px]
      min-w-[44px] and aria-label="Close".
    - The X does not visually overlap the avatar (top overlay) or the WearCard overflow menu button.
    - No accent color used on segments or chrome; controls are text-white.
    - npx tsc --noEmit reports no new errors for WearsLane.tsx.
  </acceptance_criteria>
  <done>A segmented progress indicator tracks the current wear; the close button is in the top-right band and clears the avatar and overflow menu.</done>
</task>

<task type="auto">
  <name>Task 2: Desktop-only prev/next edge arrows (gap #6)</name>
  <files>src/components/wears/WearsLane.tsx</files>
  <read_first>
    - src/components/wears/WearsLane.tsx (the embla viewport + outer container JSX after Task 1) —
      the file being modified.
    - 56A-06-SUMMARY.md — for the exact name of 06's cross-user navigation handler(s); the arrows
      reuse the SAME boundary navigation so a desktop click at the last/first slide crosses lanes.
    - 56A-UI-SPEC.md § Route-Specific Layout Contracts (desktop centered 600px column) — arrows are
      desktop-only chrome; md:max-w-[600px] md:mx-auto is the desktop photo column.
  </read_first>
  <action>
    Add two arrow buttons, hidden on mobile and shown only at md: and up (hidden md:inline-flex or
    hidden md:flex). Position them absolute, vertically centered on the photo's left and right edges
    (top-1/2 -translate-y-1/2, left arrow at left-…, right arrow at right-…), z-20, text-white,
    min-h-[44px] min-w-[44px] touch targets, lucide ChevronLeft/ChevronRight (20px), aria-labels
    "Previous wear" / "Next wear".

    Click behavior:
    - Right arrow: if emblaApi.canScrollNext() then emblaApi.scrollNext(); else (at last slide) invoke
      56A-06's forward cross-user navigation (the same handler the swipe boundary uses) so the arrow
      advances to the next user's lane.
    - Left arrow: if emblaApi.canScrollPrev() then emblaApi.scrollPrev(); else (at first slide) invoke
      56A-06's backward cross-user navigation.
    - Reuse 06's existing cross-user navigation function — do NOT re-implement railUsernames/railIndex
      math here; call the shared handler. If 06 exposed it as an inline closure, refactor it into a
      small named function callable from both the swipe-boundary effect and the arrow onClick.

    Disable/hide an arrow only if there is genuinely no destination (e.g. left arrow when on the first
    slide AND there is no previous rail user); otherwise it is always actionable. Keep arrows md:-only —
    they must NOT render on mobile (mobile uses swipe).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "WearsLane" || echo "no type errors"; grep -qE "scrollNext|scrollPrev" src/components/wears/WearsLane.tsx && grep -q "md:" src/components/wears/WearsLane.tsx && echo "arrows wired (md-only)" || echo "MISSING arrows"</automated>
  </verify>
  <acceptance_criteria>
    - Two arrow buttons render with hidden md:* (visible only at md: and up, never on mobile).
    - Arrows are absolute, vertically centered on the photo edges (left and right), z-20, text-white,
      min-h-[44px] min-w-[44px], with aria-labels "Previous wear"/"Next wear".
    - Right arrow calls scrollNext() mid-lane and 06's forward cross-user nav at the last slide.
    - Left arrow calls scrollPrev() mid-lane and 06's backward cross-user nav at the first slide.
    - The cross-user logic is the SAME shared function used by the swipe boundary (no duplicated
      railUsernames/railIndex math).
    - npx tsc --noEmit and npm run lint report no new errors for WearsLane.tsx.
  </acceptance_criteria>
  <done>Desktop users can navigate wears (and cross user lanes at boundaries) via edge arrows; arrows are hidden on mobile.</done>
</task>

</tasks>

<verification>
- npx tsc --noEmit passes for WearsLane.tsx (no new errors).
- npm run lint clean for WearsLane.tsx.
- Behavior: a top segmented progress bar tracks the current wear; the close X is top-right and clears
  the avatar; on a desktop viewport, left/right edge arrows navigate wears and cross user lanes at the
  ends; arrows are absent on a mobile viewport.
</verification>

<success_criteria>
- IG-stories progress indicator renders, tracks selectedScrollSnap, and hints the cross-user boundary (#3).
- Close button repositioned to top-right, no avatar/overflow collision (#4).
- Desktop-only edge arrows drive scrollPrev/scrollNext and reuse 06's cross-user nav at boundaries (#6).
</success_criteria>

<output>
After completion, create `.planning/phases/56A-wear-view-unification/56A-07-SUMMARY.md`
</output>
