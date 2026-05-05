---
phase: 29-nav-profile-chrome-cleanup
plan: 03
subsystem: ui
tags: [tabs, profile, prof-10, tailwind4, scroll, css-only]

# Dependency graph
requires:
  - phase: 14-profile-tabs
    provides: ProfileTabs component with TabsList line variant + active-tab indicator at after:bottom-[-5px]
  - phase: 18-profile-tabs-polish
    provides: TabsList className lock (w-full justify-start gap-2 overflow-x-auto)
provides:
  - PROF-10 horizontal-only scroll behavior on profile tab strip
  - Tailwind 4 arbitrary-variant scrollbar-hiding utilities (first use in codebase)
  - className-assertion test pattern for ProfileTabs TabsList
affects: [phase-30, phase-31, future-horizontal-tabs-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tailwind 4 arbitrary-variant utilities ([scrollbar-width:none], [&::-webkit-scrollbar]:hidden) — first use in codebase"
    - "Consumer-side className override pattern for shared shadcn primitives (does not modify tabsListVariants cva)"

key-files:
  created: []
  modified:
    - src/components/profile/ProfileTabs.tsx
    - tests/components/profile/ProfileTabs.test.tsx

key-decisions:
  - "Locked literal className applied verbatim per CONTEXT D-06/D-07/D-08 — no planner discretion exercised"
  - "tests/components/ui/tabs.tsx left UNCHANGED (Pitfall 7 / D-09) — fix is consumer-local"
  - "New describe block appended AFTER all 7 existing tests (D-11 — non-modifying); no existing test was touched"
  - "Vertical-scroll-passthrough deferred to manual UAT — JSDOM cannot simulate touch/trackpad gesture forwarding"

patterns-established:
  - "Tailwind 4 scrollbar-hiding: [scrollbar-width:none] (Firefox) + [&::-webkit-scrollbar]:hidden (WebKit/Blink). Future maintainers can grep '[&::-webkit-scrollbar]' to find the pattern."
  - "Horizontal-only scroll on a TabsList with active-tab indicator overshoot: combine overflow-x-auto + overflow-y-hidden + pb-{n} where n exceeds the indicator's bottom: -{n*4-1}px overshoot."

requirements-completed: [PROF-10]

# Metrics
duration: 2min
completed: 2026-05-05
---

# Phase 29 Plan 03: PROF-10 Profile Tab Strip Horizontal-Only Scroll Summary

**Append four Tailwind 4 utilities to ProfileTabs TabsList className (overflow-y-hidden, pb-2, [scrollbar-width:none], [&::-webkit-scrollbar]:hidden) to clip the active-tab indicator inside the parent box and suppress the vertical-scrollbar leak — consumer-local fix, shared tabsListVariants primitive untouched.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-05T07:29:41Z
- **Completed:** 2026-05-05T07:31:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- ProfileTabs.tsx:65 TabsList className updated to the locked literal (8 utilities, exact order preserved)
- New PROF-10 className-assertion test appended to ProfileTabs.test.tsx (all 4 PROF-10 utilities + 4 preserved utilities asserted)
- All 8 tests pass (7 pre-existing + 1 new); no regression in tab-rendering / Insights-gate / Common-Ground tests
- src/components/ui/tabs.tsx UNCHANGED (Pitfall 7 / CONTEXT D-09 enforced)
- Tailwind 4 arbitrary-variant scrollbar-hiding utilities introduced as a first-use pattern in this codebase

## Task Commits

Each task was committed atomically:

1. **Task 1: Append 4 utilities to TabsList className in ProfileTabs.tsx** — `d6c24cb` (feat)
2. **Task 2: Append PROF-10 className-assertion test to ProfileTabs.test.tsx** — `f359b72` (test)

## Files Created/Modified

- `src/components/profile/ProfileTabs.tsx` — TabsList line 65 className extended from `w-full justify-start gap-2 overflow-x-auto` to the locked literal `w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`. No other change.
- `tests/components/profile/ProfileTabs.test.tsx` — New describe block `ProfileTabs — PROF-10 horizontal-only scroll className override` appended at end of file (lines 119-139). Existing 7 tests preserved verbatim.

## Decisions Made

None — all decisions were pre-locked in CONTEXT D-06 through D-11 and the PLAN's `<interfaces>` block. The locked literal className was applied verbatim; the test template from PATTERNS.md §6 was used verbatim. No planner discretion was exercised.

## Deviations from Plan

None — plan executed exactly as written.

The four utilities were appended in the locked order (`overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`); the four preserved utilities (`w-full justify-start gap-2 overflow-x-auto`) remain in their original positions; the new test was appended after all existing tests with zero modifications to any pre-existing test.

## Issues Encountered

None.

The pre-existing TypeScript errors surfaced by `npx tsc --noEmit` (DesktopTopNav, PreferencesClient, useSearchState, PreferencesClientEmbedded, WatchForm.isChronometer, WatchForm.notesPublic, phase17-extract-route-wiring, RecentlyEvaluatedRail) are unrelated to this plan's edits — they exist on `main` independent of the className change. `tsc` exited 0 (errors are reported but not treated as fatal in this project's config). The diff scope was verified: only `ProfileTabs.tsx` and `ProfileTabs.test.tsx` were modified.

## Manual UAT Items (Deferred)

Per CONTEXT D-10 and D-11, the following are manual UAT only — JSDOM cannot faithfully simulate touch/trackpad gesture forwarding:

1. Visit `/u/{username}/collection` on a narrow viewport.
2. Confirm horizontal scroll works (touch/trackpad) when tabs overflow.
3. Confirm NO horizontal scrollbar visible (D-08).
4. Confirm NO vertical scrollbar appears at any time (D-06).
5. Confirm vertical scroll gestures on the tab strip pass through to page-level scroll (D-10).
6. Confirm active-tab underline indicator visible relative to the active tab (clipped inside parent's `pb-2` region, unchanged geometry).

These items roll up into the phase-end UAT, not this plan.

## Pattern Established

This plan introduces Tailwind 4 arbitrary-variant scrollbar-hiding utilities as a first-use pattern in the Horlo codebase. Future maintainers searching for cross-browser scrollbar suppression can grep:

```
[&::-webkit-scrollbar]
```

The pattern compiles to standard CSS at build time via Tailwind 4's arbitrary-variant syntax — no `tailwind.config.ts` change is needed (the project uses `@tailwindcss/postcss` ^4 with auto-discovery).

## Next Phase Readiness

- PROF-10 success criterion ("On `/u/[username]`, the profile tab strip scrolls horizontally only when its tabs overflow — no vertical scroll-bar appears, no vertical-scroll gesture is consumed by the tab strip on touch or trackpad") is closed at the unit-test level. Manual UAT confirms the gesture-passthrough behavior at phase-end.
- Phase 29 progress: 3 of 4 plans complete. Plan 04 (FORM-04 implementation) is independent and can run next.
- No follow-up needed for this plan; the consumer-local override is the right boundary per D-09. If the same overflow leak surfaces on `/search` 4-tab strip or any future horizontal TabsList consumer, that would be a v5.0+ primitive cleanup phase.

## Self-Check: PASSED

Verified files exist:
- src/components/profile/ProfileTabs.tsx — present, line 65 contains locked literal
- tests/components/profile/ProfileTabs.test.tsx — present, new describe block at lines 119-139

Verified commits exist:
- d6c24cb — feat(29-03): add horizontal-only scroll utilities to ProfileTabs TabsList
- f359b72 — test(29-03): assert PROF-10 horizontal-only scroll utilities on TabsList

Verified `src/components/ui/tabs.tsx` UNCHANGED across both task commits (Pitfall 7 / D-09).

Verified all 8 tests pass via `npm run test -- tests/components/profile/ProfileTabs.test.tsx`.

---
*Phase: 29-nav-profile-chrome-cleanup*
*Completed: 2026-05-05*
