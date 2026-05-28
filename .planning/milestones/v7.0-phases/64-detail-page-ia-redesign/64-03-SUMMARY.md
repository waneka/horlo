---
phase: 64-detail-page-ia-redesign
plan: 03
subsystem: ui
tags: [rsc, next16, tailwind, watch-detail, gap-fill, hydration]

# Dependency graph
requires:
  - phase: 64-01
    provides: static guards and page structure context
  - phase: 64-02
    provides: WatchDetailHero client island (the preceding split component)
provides:
  - "WatchDetailTrailing RSC: four spec cards + gap-fill callout + Notes for Plan 04 wiring"
affects: [64-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RSC-safe pure function call: computeGapFill called directly in RSC (no hooks needed)"
    - "timeZone UTC pinning in formatDate for React #418 hydration safety in RSC context"
    - "RSC sibling composition: trailing spec content split from client island for D-07"

key-files:
  created:
    - src/components/watch/WatchDetailTrailing.tsx
  modified: []

key-decisions:
  - "WatchDetailTrailing is a pure RSC — no 'use client', no hooks, no event handlers; enables CommentThread to render above spec cards in server tree (D-07)"
  - "formatDate defined locally in this file with timeZone UTC to preserve #418 hydration safety in RSC context"
  - "Comment in file header reworded to avoid containing literal string 'use client' (would cause grep-based RSC assertion to false-positive)"

patterns-established:
  - "formatDate with timeZone UTC: must be used in any RSC or client component that formats date-only fields"
  - "computeGapFill RSC-safe: gapFill.ts imports only types + detectLoyalBrands; verified safe for server components"

requirements-completed: [PAGE-01, PAGE-03]

# Metrics
duration: 8min
completed: 2026-05-27
---

# Phase 64 Plan 03: WatchDetailTrailing RSC Summary

**Pure RSC extraction of four spec cards (Specifications, Pricing, Classification, Tracking) + gap-fill callout + Notes from WatchDetail.tsx monolith, enabling CommentThread to render above spec content in the server tree (D-07)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-27T23:27:00Z
- **Completed:** 2026-05-27T23:35:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `src/components/watch/WatchDetailTrailing.tsx` as a pure RSC — no `'use client'`, no hooks, no event handlers
- All four spec cards (Specifications, Pricing, Classification, Tracking) extracted verbatim from `WatchDetail.tsx` lines 336-512
- Gap-fill callout extracted (lines 516-544) with `computeGapFill` called directly in the RSC (verified RSC-safe)
- Notes card extracted (lines 549-562)
- `formatDate` defined locally with `timeZone: 'UTC'` for React #418 hydration safety
- Build exits 0; unreferenced until Plan 04 wiring

## Task Commits

Each task was committed atomically:

1. **Task 1: Create WatchDetailTrailing RSC** - `42395c5` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/components/watch/WatchDetailTrailing.tsx` - Pure RSC: four spec cards + gap-fill callout + Notes card

## Decisions Made
- The comment at line 1 was reworded from `// NO 'use client'` to `// Pure RSC — no client directive` to avoid the grep assertion `! grep -q "use client"` false-positiving on the prose comment. The RSC invariant is structurally enforced by the absence of the directive.

## Deviations from Plan

None — plan executed exactly as written, with one minor comment wording adjustment to avoid a grep false-positive in the verification check.

## Issues Encountered
- The initial file comment contained `'use client'` in prose (as a negation: `// NO 'use client'`). The plan's verification check `! grep -q "use client"` matched this comment text. Rewrote the comment to avoid the literal string while preserving the RSC intent (Rule 1 auto-fix: the grep assertion is the authoritative check).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `WatchDetailTrailing` RSC is ready to be rendered after `CommentThread` in Plan 04 (`page.tsx` wiring)
- Accepts `{ watch, collection, preferences, lastWornDate }` props from the RSC page
- No blockers

---
*Phase: 64-detail-page-ia-redesign*
*Completed: 2026-05-27*
