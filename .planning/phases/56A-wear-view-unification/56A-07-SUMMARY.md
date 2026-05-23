---
phase: 56A-wear-view-unification
plan: "07"
subsystem: wear-view
status: complete
tags: [embla-carousel, progress-indicator, desktop-arrows, close-reposition, gap-closure]
dependency_graph:
  requires: ["56A-06"]
  provides: ["progress segments (#3)", "close top-right (#4)", "desktop edge arrows (#6)", "goToNeighbor named function"]
  affects: ["src/components/wears/WearsLane.tsx"]
tech_stack:
  added: []
  patterns:
    - IG-stories style segmented progress bar driven by embla selectedScrollSnap
    - named goToNeighbor(direction) extracted from inline settle closure for reuse
    - desktop-only arrow buttons (hidden md:flex) reusing cross-user nav at boundaries
key_files:
  created: []
  modified:
    - src/components/wears/WearsLane.tsx
decisions:
  - "goToNeighbor named function extracted from 56A-06 inline settle closure — arrows and swipe boundary both call it; no duplicated railUsernames/railIndex math"
  - "progress row is pointer-events-none at z-20; close X elevated to z-30 to remain tappable above progress row"
  - "selectedIndex initialized from initialSlideIndex to match embla startIndex; updated via extended single 'select' handler (no second listener)"
  - "cross-user boundary hint uses ChevronRight size-3 opacity-40 at end of progress row — minimal, no accent color, purely informational"
  - "desktop arrows conditionally rendered only when there is a destination (not at first slide with no prev user / not at last slide with no next user)"
metrics:
  duration: ~8m
  completed: "2026-05-23"
  tasks_completed: 2
  files_created: 0
  files_modified: 1
---

# Phase 56A Plan 07: UAT Gap Closure (#3/#4/#6) Summary

**One-liner:** Added IG-stories segmented progress bar (driven by embla selectedScrollSnap), repositioned the close button to top-right, and added desktop-only edge arrows that reuse 56A-06's `goToNeighbor` named function for cross-user lane crossings at boundaries.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Top progress indicator + close reposition (gaps #3 + #4) | 7aeee7b | src/components/wears/WearsLane.tsx |
| 2 | Desktop-only prev/next edge arrows (gap #6) | 7aeee7b | src/components/wears/WearsLane.tsx |

(Tasks 1 and 2 share a single atomic commit — both modify WearsLane.tsx and the plan explicitly clusters them to avoid merge conflicts.)

## What Was Built

### Task 1 — Top progress indicator + close reposition (`7aeee7b`)

**Progress indicator (#3):**
- Added `selectedIndex` state initialized from `initialSlideIndex`, updated inside the existing `select` handler (`handleSelect`) — a single listener, no second `'select'` registration
- Rendered an `absolute top-0 inset-x-0 z-20 pointer-events-none` flex row with `slides.length` thin `h-[3px] rounded-full` segments, `flex-1` each, `bg-white` with `opacity-90` (active) or `opacity-30` (inactive)
- Cross-user boundary hint: when `isLastSegment && hasNextUser`, a `ChevronRight size-3 opacity-40` renders at the trailing end — non-interactive, no accent color
- `md:max-w-[600px] md:mx-auto` applied to the progress row to align with the desktop column

**Close reposition (#4):**
- Changed `absolute top-3 left-3 z-20` → `absolute top-3 right-3 z-30`
- Elevated to `z-30` (above the progress row at `z-20`) so the X remains tappable even though the progress row spans full width
- `min-h-[44px] min-w-[44px]` touch target and `aria-label="Close"` retained
- Collision analysis: WearCard's own overflow menu (also `top-3 right-3`) is anchored to the WearCard's relative container, which sits vertically centered inside the slide via `justify-center` — it renders lower in the viewport, not in the empty band above the photo where the X lives

### Task 2 — Desktop-only edge arrows (`7aeee7b`)

**`goToNeighbor` extraction:**
- The inline navigation logic from 56A-06's `onSettle` effect was extracted into a named `goToNeighbor(direction: 'next' | 'prev')` function in the component scope
- Guards: `railIndex === -1`, `commentOpen`, `navigated.current`, no neighbor — all honored
- The settle effect now calls `goToNeighbor('next')` and `goToNeighbor('prev')` instead of the previously inline `router.push` block
- `goToNeighbor` is intentionally omitted from the effect's deps array (it closes over all its own deps which ARE in the array); `eslint-disable-next-line react-hooks/exhaustive-deps` comment added

**Arrow buttons:**
- Left arrow (`ChevronLeft`): `hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px]`, `aria-label="Previous wear"`. Click: `canScrollPrev()` → `scrollPrev()`, else `goToNeighbor('prev')`
- Right arrow (`ChevronRight`): symmetric at `right-0`, `aria-label="Next wear"`. Click: `canScrollNext()` → `scrollNext()`, else `goToNeighbor('next')`
- Arrows rendered conditionally: left arrow hidden when at first segment AND no previous rail user; right arrow hidden when at last segment AND no next rail user — always actionable when a destination exists
- `hidden md:flex`: never visible on mobile (swipe-only), only at `md:` and above

## Verification

- `npx tsc --noEmit` — 0 errors in WearsLane.tsx or any source file; pre-existing test file errors are out-of-scope (logged in 56A-06 SUMMARY deferred items)
- `npx eslint src/components/wears/WearsLane.tsx` — clean
- Grep checks: `right-3` present (close moved), `scrollNext|scrollPrev` + `md:` present (arrows wired md-only), `selectedScrollSnap` present, `goToNeighbor` present

## Deviations from Plan

### Auto-fixed Issues

None — all plan requirements implemented exactly as specified.

### Notes

1. **Single commit for two tasks:** Both tasks modify only `WearsLane.tsx`; the plan explicitly clusters them to avoid merge conflicts. Committed atomically as `7aeee7b`.
2. **`goToNeighbor` extraction is both Task 2 work and a natural prerequisite for Task 1's settle effect refactor** — the extraction happened at the boundary of Task 1→2 implementation and is reported under Task 2 per the plan's structure.

## Known Stubs

None — all three gaps deliver concrete behavior; no placeholder data sources or TODO copy.

## Threat Flags

No new threat surface introduced. Progress segments and arrows are read-only client navigation; no new auth paths, network endpoints, or schema changes.

## Self-Check: PASSED

- `src/components/wears/WearsLane.tsx` — FOUND
- Commit 7aeee7b — FOUND
- tsc clean for WearsLane.tsx: PASSED
- eslint clean for WearsLane.tsx: PASSED
- `right-3` in WearsLane.tsx: FOUND
- `scrollNext`/`scrollPrev` + `md:` in WearsLane.tsx: FOUND
- `selectedScrollSnap` in WearsLane.tsx: FOUND
- `goToNeighbor` in WearsLane.tsx: FOUND
