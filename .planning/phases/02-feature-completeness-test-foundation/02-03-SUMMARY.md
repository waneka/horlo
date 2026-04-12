---
phase: 02-feature-completeness-test-foundation
plan: 03
subsystem: ui
tags: [wishlist, badges, gap-fill, deal-flag, shadcn, warm-brass]

requires:
  - phase: 02-01
    provides: CollectionGoal enum, extended Watch (productionYear, isFlaggedDeal), crypto.randomUUID
  - phase: 02-02
    provides: computeGapFill() + GapFillResult (5 kinds), goal-aware analyzeSimilarity
provides:
  - Production-year input + detail display
  - Deal + gap-fill badges on wishlist/grail WatchCards
  - WatchDetail isFlaggedDeal checkbox + gap-fill Card + last-worn line
  - Wishlist grid sort — good-deal items first
  - Shared src/lib/wear.ts (daysSince, SLEEPING_BEAUTY_DAYS)
affects: [02-04 insights page, future UI phases]

tech-stack:
  added: []
  patterns:
    - "Shared wear helper at src/lib/wear.ts — single source of daysSince / SLEEPING_BEAUTY_DAYS"
    - "Status badges stack top-right on WatchCard: Status → Deal → Gap-fill"
    - "Wishlist-only surfaces are gated on watch.status === 'wishlist' || 'grail'"

key-files:
  created:
    - src/lib/wear.ts
  modified:
    - src/components/watch/WatchForm.tsx
    - src/components/watch/WatchCard.tsx
    - src/components/watch/WatchDetail.tsx
    - src/components/watch/WatchGrid.tsx

key-decisions:
  - "Removed local daysSince from WatchDetail — imports shared helper instead"
  - "Deal badge auto-triggers when marketPrice <= targetPrice; isFlaggedDeal is an additive manual override"
  - "Gap-fill badge renders on all wishlist/grail cards regardless of deal status"

patterns-established:
  - "Semantic-token-only palette for new surfaces (no raw Tailwind colors)"
  - "44px minimum touch target on mobile-critical controls"

requirements-completed: [VIS-05, FEAT-03, FEAT-04, FEAT-05]

duration: ~15min
completed: 2026-04-11
---

# Plan 02-03: Actionable Wishlist Summary

**Wishlist cards now surface deal + gap-fill badges, detail has flag-as-deal toggle and gap-fill callout, and a shared wear helper feeds both the grid and detail.**

## Performance

- **Tasks:** 3/3 (Task 3 is a human-verify checkpoint)
- **Files modified:** 5

## Accomplishments
- Production year input in WatchForm + display in WatchDetail
- Deal + gap-fill badges on wishlist/grail WatchCards
- WatchDetail: last-worn line, isFlaggedDeal checkbox, gap-fill Card
- Wishlist grid sorts good-deal items first
- `src/lib/wear.ts` shared helper consumed by WatchDetail (and ready for 02-04)

## Task Commits

1. **Task 1:** Shared wear helper + form productionYear + card badges + grid sort — `1232be4` (feat)
2. **Task 2:** WatchDetail — last-worn, flag-deal toggle, gap-fill callout, productionYear row — `c7bb74e` (feat)
3. **Task 3:** Human-verify checkpoint — approved by user (no code change)

## Files Created/Modified
- `src/lib/wear.ts` — daysSince + SLEEPING_BEAUTY_DAYS (new, shared)
- `src/components/watch/WatchForm.tsx` — productionYear field in Specifications
- `src/components/watch/WatchCard.tsx` — Deal + gap-fill badges (wishlist/grail only)
- `src/components/watch/WatchGrid.tsx` — wishlist deal-sort
- `src/components/watch/WatchDetail.tsx` — last-worn line, productionYear row, flag-deal toggle, gap-fill Card

## Decisions Made
- Shared `wear.ts` instead of keeping daysSince local to WatchDetail — avoids duplication once 02-04 insights need the same helper.
- Deal badge auto-triggers on marketPrice ≤ targetPrice; isFlaggedDeal is additive manual override.
- Gap-fill badge renders for all wishlist/grail cards regardless of deal status.

## Deviations from Plan
None — plan executed as written.

## Issues Encountered
- Parallel-wave merge note: 02-05 (tests) ran concurrently and touched `package.json` for MSW; no conflict in this plan's files. Logged in 02-05 SUMMARY.

## User Setup Required
None.

## Next Phase Readiness
- Wave 4 (02-04) can consume `src/lib/wear.ts` and the same badge/gap-fill patterns for the insights page.
- Human verification of both themes (warm/brass, dark mode) and 375px touch targets approved.

---
*Phase: 02-feature-completeness-test-foundation*
*Completed: 2026-04-11*
