---
phase: 10-activity-feed
fixed_at: 2026-04-21T00:00:00Z
review_path: .planning/phases/10-activity-feed/10-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-04-21T00:00:00Z
**Source review:** .planning/phases/10-activity-feed/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (all Warnings; no Critical findings in REVIEW.md)
- Fixed: 4
- Skipped: 0

All 4 warnings from `10-REVIEW.md` were fixable cleanly against the current
source tree. Each was committed atomically with a `fix(10): {id} {summary}`
message. The full vitest suite (2059 tests, 44 skipped) passes after all 4
commits.

## Fixed Issues

### WR-01: Cursor schema allows `NaN` / non-finite overlap values

**Files modified:** `src/app/actions/suggestions.ts`, `tests/actions/suggestions.test.ts`
**Commit:** `cdf7e48`
**Applied fix:** Tightened `cursorSchema.overlap` from `z.number()` to
`z.number().finite()` so `NaN`, `+Infinity`, and `-Infinity` now return
`'Invalid request'` from `loadMoreSuggestions`. Without this, an adversarial
or mis-formed cursor could make the downstream comparator
`c.overlap < cursor.overlap` evaluate false for every row, silently stalling
pagination on page 1. Added three regression tests (`Test 5a`, `5b`, `5c`) —
one each for `NaN`, `+Infinity`, `-Infinity` — verifying the DAL is never
called. Also expanded the cursor schema JSDoc to call out why `.finite()` is
load-bearing.

### WR-02: `PersonalInsightsGrid` loads taste-overlap data for followers without honoring their privacy settings

**Files modified:** `src/components/home/PersonalInsightsGrid.tsx`, `tests/components/home/PersonalInsightsGrid.test.tsx`
**Commit:** `78ac552`
**Applied fix:** Replaced the direct `getTasteOverlapData` + `computeTasteOverlap`
call path with the existing `resolveCommonGround` gate from
`@/app/u/[username]/common-ground-gate`, which already enforces
`collectionPublic=true` on the owner. Added a pre-filter so only followers
with `profilePublic=true` are even considered (closing the previously-public
→ now-private drift). The gate is called per candidate with
`isOwner: false` (a viewer inspecting a follower is by definition not the
owner of the follower's profile). This closes both leaks called out in the
finding:
1. A follower who later toggled `profile_public=false` no longer has their
   `displayName` / `avatarUrl` / `username` surfaced on the home's Common
   Ground card.
2. A follower with `collection_public=false` no longer has their
   `sharedWatches.length` (count-only) disclosed — the gate short-circuits
   to `null` before `getTasteOverlapData` is called.

Added three regression tests in a new
`PersonalInsightsGrid — WR-02 Common Ground privacy gates` describe block:
- **Test A**: single follower with `profilePublic=false` → no card, no leak,
  `getTasteOverlapData` never invoked.
- **Test B**: single follower with `collectionPublic=false` → gate returns
  null, no card, `getTasteOverlapData` never invoked.
- **Test C**: mixed followers → private one filtered out, public one renders
  with the correct "N shared" count, and `getTasteOverlapData` is called
  exactly once (for the public follower only).

### WR-03: `WywtSlide` button is not disabled after a successful add, allowing re-submit when `status === 'added'`

**Files modified:** `src/components/home/WywtSlide.tsx`, `tests/components/home/WywtOverlay.test.tsx`
**Commit:** `65ecc28`
**Applied fix:** Added an early-return guard at the top of
`handleAddToWishlist`: `if (pending || status === 'added') return`. This
makes the handler idempotent after success — a rapid second dispatch
reaching the handler before React's `pending` state has propagated, or any
latent re-render path that re-invokes the handler, now no-ops instead of
creating a duplicate `watches` row via `createWatch`. Updated the JSDoc to
document the guard's purpose (the `status === 'added'` arm is the load-
bearing one; `pending` is belt-and-suspenders for the fast-tap case that
`useTransition` was already designed to cover). The review's suggestion to
also add `status === 'added'` to the Retry button's `disabled` prop was
declined because the Retry button is only rendered when `status === 'error'`
and `status` is a discriminated union — the two states are mutually
exclusive so the prop-level guard would be dead code. The handler-level
guard is the semantically-complete fix.

Added one regression test (`WR-03 Test 8`) asserting that after a successful
add, the action has been called exactly once AND both the "Add to wishlist"
and "Retry" buttons are unmounted — i.e. there is no UI affordance to
re-submit and the invocation count stays at 1.

### WR-04: `getFeedForUser` cursor tuple bypasses `id`-tiebreak ordering in strict equality case

**Files modified:** `src/lib/feedTypes.ts`, `src/data/activities.ts`
**Commit:** `6d4711f`
**Applied fix:** Docs-only clarification, as the review itself recommended
("No runtime change required"). Reworded the `FeedCursor` interface JSDoc
and the inline comment on `getFeedForUser` to make it explicit that:
- Postgres `timestamptz` has microsecond precision (not millisecond as the
  old comment implied),
- The `id` tiebreaker is a *rare-case* invariant that only fires when two
  rows share a microsecond-identical `created_at`,
- UUID v4 `id` values give effective uniqueness, which is what FEED-03
  leans on for a total order under concurrent inserts.

No test changes — the review flagged this as docs-only and the runtime
behavior was already correct.

---

_Fixed: 2026-04-21T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
