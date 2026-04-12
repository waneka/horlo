---
phase: 02-feature-completeness-test-foundation
plan: 04
subsystem: ui
tags: [insights, good-deals, sleeping-beauties, collection-goal, shadcn, warm-brass]

requires:
  - phase: 02-01
    provides: CollectionGoal enum, extended Watch
  - phase: 02-02
    provides: goal-aware analyzeSimilarity, detectLoyalBrands, computeGapFill
  - phase: 02-03
    provides: src/lib/wear.ts (daysSince, SLEEPING_BEAUTY_DAYS), badge patterns

provides:
  - GoodDealsSection component (pinned card on insights)
  - SleepingBeautiesSection component (pinned card on insights)
  - Goal-aware Observations card with 4-branch copy
  - Insights page restructured with decision surfaces above stats
affects: [future insights enhancements]

tech-stack:
  added: []
  patterns:
    - "Goal-aware copy switching on preferences.collectionGoal with 'balanced' default"
    - "detectLoyalBrands() used for brand-loyalist variant with fallback copy"

key-files:
  created:
    - src/components/insights/GoodDealsSection.tsx
    - src/components/insights/SleepingBeautiesSection.tsx
  modified:
    - src/app/insights/page.tsx

key-decisions:
  - "GoodDealsSection includes both auto-deal (marketPrice <= targetPrice) and manual flag (isFlaggedDeal)"
  - "SleepingBeautiesSection excludes null lastWornDate watches — unworn is not sleeping"
  - "Observations card uses ?? 'balanced' fallback when collectionGoal is unset"

patterns-established:
  - "Insights section components in src/components/insights/ with empty-state copy"
  - "Goal-aware UI copy with 4-branch switch pattern"

requirements-completed: [VIS-05, FEAT-02, FEAT-04]

duration: ~12min
completed: 2026-04-11
---

# Plan 02-04: Insights Decision Surface Summary

**Insights page now surfaces Good Deals and Sleeping Beauties pinned sections with goal-aware Observations copy switching on collectionGoal.**

## Performance

- **Tasks:** 3/3 (Task 3 is human-verify checkpoint)
- **Files modified:** 3

## Accomplishments
- GoodDealsSection: pinned card listing flagged/auto-deal wishlist watches
- SleepingBeautiesSection: owned watches unworn ≥30 days, sorted by days desc
- Goal-aware Observations card with 4 collectionGoal branches + detectLoyalBrands for brand-loyalist
- Insights page restructured: decision surfaces → stats → observations

## Task Commits

1. **Task 1:** GoodDealsSection + SleepingBeautiesSection components — `edfabde` (feat)
2. **Task 2:** Wire sections into insights page + goal-aware observations — `0db56f8` (feat)
3. **Task 3:** Human-verify checkpoint — approved by user (no code change)

## Files Created/Modified
- `src/components/insights/GoodDealsSection.tsx` — pinned Good Deals card (new)
- `src/components/insights/SleepingBeautiesSection.tsx` — pinned Sleeping Beauties card (new)
- `src/app/insights/page.tsx` — layout restructure, goal-aware Observations card

## Decisions Made
- Auto-deal + manual flag both populate GoodDealsSection (union, not either/or)
- Null lastWornDate excluded from Sleeping Beauties — unworn ≠ sleeping
- Observations default to `'balanced'` when collectionGoal unset

## Deviations from Plan
None — plan executed as written.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- All 5 plans complete. Phase ready for verification and code review.

---
*Phase: 02-feature-completeness-test-foundation*
*Completed: 2026-04-11*
