---
phase: 56A-wear-view-unification
plan: "06"
subsystem: wear-view
status: complete
tags: [embla-carousel, cross-user-swipe, router-push, boundary-detection, gap-closure]
dependency_graph:
  requires: ["56A-03", "56A-05"]
  provides: ["cross-user swipe (D-06)", "railUsernames + railIndex prop threading"]
  affects: ["src/components/wears/WearsLane.tsx", "src/app/wears/[username]/page.tsx"]
tech_stack:
  added: []
  patterns:
    - pointerdown/pointerup delta tracking for embla boundary intent detection
    - single-flight ref guard (navigated) to prevent double router.push
    - embla 'settle' event + canScrollNext/canScrollPrev for boundary classification
key_files:
  created: []
  modified:
    - src/components/wears/WearsLane.tsx
    - src/app/wears/[username]/page.tsx
decisions:
  - "pointerdown+pointerup delta (not just pointerdown position) used for drag direction — delta correctly identifies forward vs backward swipe intent"
  - "embla 'settle' event chosen over 'scroll' for boundary trigger — fires once per drag+release cycle, preventing mid-animation premature push"
  - "single-flight navigated ref resets on unmount only (component remounts at the neighbor route) — prevents double-push from rapid swipes"
  - "railIndex === -1 guard disables cross-user nav entirely for manual URL visits not in the home rail"
metrics:
  duration: ~5m
  completed: "2026-05-23"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 56A Plan 06: Cross-User Swipe (D-06 Gap Closure) Summary

**One-liner:** Wired `railUsernames` + `railIndex` from the server page into `WearsLane`, then added embla boundary detection (`pointerdown/pointerup` delta + `'settle'` event + `canScrollNext/Prev`) that `router.push`es to the neighbor user's `/wears/[username]` lane when swiping past the first or last slide.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Pass railUsernames + actor rail-index from the page to WearsLane | cfea6f7 | src/app/wears/[username]/page.tsx, src/components/wears/WearsLane.tsx |
| 2 | Embla boundary detection → router.push to the neighbor user's lane | aee99d3 | src/components/wears/WearsLane.tsx |

## What Was Built

### Task 1 — Thread railUsernames + railIndex into WearsLane (`cfea6f7`)

**WearsLane.tsx:**
- Extended `WearsLaneProps` with `railUsernames: string[]` and `railIndex: number`
- Destructured both in the component signature
- Added JSDoc on each field explaining server-derivation and the `-1` sentinel

**page.tsx:**
- Removed the `// eslint-disable-next-line @typescript-eslint/no-unused-vars` on `railUsernames`
- Added `railIndex` computation: `railUsernames.findIndex((u) => u?.toLowerCase() === username.toLowerCase())` — case-insensitive to mirror `getProfileByUsername`'s lookup semantics
- Passes both `railUsernames={railUsernames}` and `railIndex={railIndex}` to `<WearsLane>`
- Order stays server-derived from `getWearRailForViewer` (Pitfall 3 preserved)

### Task 2 — Embla boundary detection + cross-user navigation (`aee99d3`)

Added a `useEffect` in `WearsLane` with the following implementation:

**Drag direction detection:**
- `pointerdown` listener on `emblaApi.rootNode()` captures `clientX` at drag start
- `pointerup` listener captures `clientX` at drag end; computes `dragDeltaX = upX - downX`
- Negative delta = swiped left = forward intent; positive delta = swiped right = backward intent
- `dragDeltaX` is consumed on the next `'settle'` event and cleared

**Boundary classification (on `'settle'`):**
- `scrollSnapList().length - 1` vs `selectedScrollSnap()` determines first/last position
- `!canScrollNext()` confirms no further forward snap available (true boundary, not mid-rail)
- `!canScrollPrev()` symmetric for backward

**Navigation:**
- Forward cross: `router.push('/wears/' + railUsernames[railIndex + 1])` — no `?from=` (D-05 default)
- Backward cross: `router.push('/wears/' + railUsernames[railIndex - 1])` — no `?from=`

**Guards (all mandatory per plan):**
- `railIndex === -1`: effect returns early, no listeners registered
- No neighbor (start/end of rail): early return with no error, no wrap
- `commentOpen === true`: `onSettle` returns before any navigation check
- `navigated.current === true`: single-flight guard; set to `true` before `router.push`, never reset (component remounts on neighbor route)

**Cleanup:** `root.removeEventListener` for both pointer events + `emblaApi.off('settle', ...)` in the effect's return function.

**Deps array:** `[emblaApi, railUsernames, railIndex, commentOpen, router]` — mirrors the existing select-listener effect's pattern.

## Verification

- `npx tsc --noEmit` — 0 errors referencing WearsLane or the wears page
- `npm run lint` — clean for both modified files
- Pre-existing type errors in unrelated test files (RecentlyEvaluatedRail, catalog-page, DesktopTopNav) are out-of-scope; logged to deferred-items

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect drag direction variable (pointerDown X stored as `dx`)**
- **Found during:** Task 2 implementation review
- **Issue:** Initial implementation stored the pointerdown X position into a variable named `dx` (implying a delta) and compared it directionally — but `dx` held an absolute position, not a delta. The comparison `if (dx > 0) return` would have used the screen coordinate (always large and positive), not the drag direction.
- **Fix:** Switched to tracking both `pointerDownX` and `dragDeltaX`, computing `dragDeltaX = pointerUpX - pointerDownX` in a `pointerup` listener. The settle handler then consumes the delta, which correctly encodes direction.
- **Files modified:** src/components/wears/WearsLane.tsx
- **Committed in:** aee99d3 (same Task 2 commit — caught before first commit)

## Known Stubs

None — this plan closes a concrete behavior gap (D-06), no stubs introduced.

## Threat Flags

No new threat surface introduced. Cross-user navigation is read-only (`router.push`); the neighbor's page.tsx enforces its own auth gate and visibility rules.

## Self-Check: PASSED

- `src/components/wears/WearsLane.tsx` — FOUND
- `src/app/wears/[username]/page.tsx` — FOUND
- Commit cfea6f7 (Task 1) — FOUND
- Commit aee99d3 (Task 2) — FOUND
- tsc clean for changed files: PASSED
- lint clean for changed files: PASSED
