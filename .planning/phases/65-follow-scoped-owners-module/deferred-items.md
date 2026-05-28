
## Plan 65-03 (Integration) Out-of-scope discoveries

**Date:** 2026-05-28 (during Plan 65-03 execution)

### 1. FollowedOwnersModule.tsx uses `font-medium` (raw-palette test failure)

**File:** `src/components/insights/FollowedOwnersModule.tsx`
**Source:** Plan 65-02 (commit `0e23bc74`); Plan 65-02 SUMMARY did not catch this stub
**Discovered:** Running `npm run test` during Plan 65-03 Task 2 verification
**Failure:** `tests/no-raw-palette.test.ts > FollowedOwnersModule.tsx does not use /\bfont-medium\b/`
**Status:** Pre-existing on HEAD before Plan 65-03 began (confirmed by `git stash` + re-run); NOT a Plan 65-03 regression
**Scope decision:** Out of Plan 65-03 scope (which only touches `src/app/w/[ref]/page.tsx`, `src/components/watch/WatchDetailHero.tsx`, `tests/static/watch-detail-ia-order.test.ts`)
**Suggested resolution:** Either Plan 65-02 follow-up fix swapping `font-medium` → semantic-token utility, OR a phase-level palette sweep that already exists in the verification queue. The 2 `font-medium` references on lines 76 + 97 are the affected sites.
**Tracking memory:** This matches the pre-existing pattern noted in `project_baseline_not_green_build_is_gate` ("npm run test has ≥1 pre-existing failure (CommentGateLocked font-medium)") — same class of palette-invariant violation.
