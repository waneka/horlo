---
phase: 09-follow-system-collector-profiles
plan: 01
subsystem: database
tags: [drizzle, supabase, react-cache, zod, server-actions, taste-overlap, similarity, rls]

# Dependency graph
requires:
  - phase: 07-social-schema-profile-auto-creation
    provides: follows table + follows_unique_pair + RLS policies
  - phase: 08-self-profile-privacy-controls
    provides: profile_settings (public flags), getProfileSettings DAL, revalidatePath('/u/[username]', 'layout') pattern (WR-07)
provides:
  - follows DAL (followUser, unfollowUser, isFollowing, getFollowersForProfile, getFollowingForProfile, getTasteOverlapData)
  - follow/unfollow Server Actions with Zod .strict(), self-follow rejection, and FOLL-03 revalidatePath reconciliation
  - src/lib/tasteOverlap.ts — pure server-safe overlap calculation (shared watches + tags + label + dual bars)
  - React cache()-wrapped getTasteOverlapData for per-request memoization
affects:
  - 09-02-follow-button-and-header-wiring (consumes isFollowing + follow actions)
  - 09-03-follower-following-list-routes (consumes getFollowersForProfile / getFollowingForProfile)
  - 09-04-common-ground-hero-tab-locked-state (consumes getTasteOverlapData + computeTasteOverlap)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - React cache() per-request memoization for DAL loaders shared across a layout + child page
    - Server Action threat model: auth gate → Zod .strict() → app-layer invariants (self-follow rejection) → DAL → revalidatePath
    - Dual-query pattern for follower/following lists — ordered id fetch + batched profile/settings/watch-count joins via inArray (no N+1)
    - Overlap label thresholds anchored to GOAL_THRESHOLDS.balanced so Common Ground tracks similarity-weight recalibration

key-files:
  created:
    - src/data/follows.ts
    - src/app/actions/follows.ts
    - src/lib/tasteOverlap.ts
    - tests/data/follows.test.ts
    - tests/actions/follows.test.ts
    - tests/lib/tasteOverlap.test.ts
  modified: []

key-decisions:
  - "React cache() wraps getTasteOverlapData — per-request memoization only (no cross-request state, preserves D-03)"
  - "Overlap label thresholds anchor to GOAL_THRESHOLDS.balanced (0.65 Strong, 0.45 Some, else Different)"
  - "Self-follow rejection is enforced at the application layer (RLS permits follower_id = auth.uid())"
  - "Follower/following lists use ordered-ids + batched joins via inArray (no N+1, single extra roundtrip)"
  - "revalidatePath('/u/[username]', 'layout') fires on BOTH follow and unfollow — pins FOLL-03 end-to-end count path"
  - "Normalized brand+model intersection uses .trim().toLowerCase() so 'Rolex Submariner' matches 'rolex submariner'"

patterns-established:
  - "DAL composition for Common Ground: parallel Promise.all across watches + preferences + wear-events for both users, then computeTasteTags per side"
  - "cache() wraps the exported DAL function — callers use it transparently as an async function"
  - "Test double for Drizzle chain: single mockRows bucket + calls[] recorder supports asserting op sequence (values, onConflictDoNothing, orderBy)"

requirements-completed: [FOLL-01, FOLL-02, FOLL-03, FOLL-04, PROF-09]

# Metrics
duration: ~12min
completed: 2026-04-21
---

# Phase 9 Plan 01: Data, Actions, and Taste-Overlap Foundation Summary

**Follow/unfollow DAL + Server Actions with Zod .strict() and self-follow rejection, batched follower-list joins with no N+1, and a pure `computeTasteOverlap` library backed by a React cache()-wrapped `getTasteOverlapData` loader.**

## Performance

- **Duration:** ~12 min (first commit 2026-04-21T18:13Z → final commit 2026-04-21T18:18Z + SUMMARY)
- **Started:** 2026-04-21T18:07:00Z (execution start)
- **Completed:** 2026-04-21T18:19:00Z
- **Tasks:** 3 (all green, TDD red→green per task)
- **Files created:** 6
- **Files modified:** 0

## Accomplishments

- Shipped the full Wave 1 data + pure-logic foundation for Phase 9. Plans 02, 03, 04 can now wire UI against a frozen contract.
- `src/data/follows.ts` — six DAL exports: `followUser`, `unfollowUser`, `isFollowing`, `getFollowersForProfile`, `getFollowingForProfile`, plus the cache()-wrapped `getTasteOverlapData`.
- `src/app/actions/follows.ts` — two Server Actions hardened against the Phase 9 STRIDE register (auth gate, mass-assignment via .strict(), self-follow rejection, idempotent via DAL, revalidatePath on both follow + unfollow success paths).
- `src/lib/tasteOverlap.ts` — pure `computeTasteOverlap(viewer, owner)` returning shared watches, shared taste tags, overlap label, and (when both sides have ≥3 owned) shared style/role distributions.
- 37 new tests added across three files (14 tasteOverlap + 10 DAL + 13 actions). Full suite: 1283 tests, 0 failures.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Wave 0 RED — failing tests for follows DAL, actions, and tasteOverlap** — `d0ed854` (test)
2. **Task 2: GREEN — follows DAL + tasteOverlap library** — `4646ae1` (feat)
3. **Task 3: GREEN — follow/unfollow Server Actions** — `7f99b86` (feat)

## Files Created/Modified

- `src/data/follows.ts` — DAL for follows table + taste-overlap data loader (React cache()-wrapped)
- `src/app/actions/follows.ts` — Zod-validated Server Actions; self-follow rejected; revalidatePath on both directions
- `src/lib/tasteOverlap.ts` — pure `computeTasteOverlap` function; normalizes brand+model; anchors label thresholds to `GOAL_THRESHOLDS.balanced`
- `tests/data/follows.test.ts` — DAL unit tests with chainable Drizzle mock
- `tests/actions/follows.test.ts` — Server Action tests including `revalidatePath` spies on BOTH follow and unfollow (FOLL-03 E2E pin)
- `tests/lib/tasteOverlap.test.ts` — 14 pure-function tests covering normalization, label thresholds, D-05 empty-viewer, dual-bar guards, hasAny

## Public API (for Plans 02, 03, 04)

```typescript
// src/data/follows.ts
export async function followUser(followerId: string, followingId: string): Promise<void>
export async function unfollowUser(followerId: string, followingId: string): Promise<void>
export async function isFollowing(followerId: string, followingId: string): Promise<boolean>

export interface FollowerListEntry {
  userId: string
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  profilePublic: boolean
  watchCount: number
  wishlistCount: number
  followedAt: string  // ISO string
}
export async function getFollowersForProfile(userId: string): Promise<FollowerListEntry[]>
export async function getFollowingForProfile(userId: string): Promise<FollowerListEntry[]>

export interface TasteOverlapData {
  viewer: { watches: Watch[]; preferences: UserPreferences; tasteTags: string[] }
  owner:  { watches: Watch[]; preferences: UserPreferences; tasteTags: string[] }
}
// NOTE: getTasteOverlapData is exported as a React cache()-wrapped function.
// It still behaves as an async function — callers don't need to unwrap it.
export const getTasteOverlapData: (viewerId: string, ownerId: string) => Promise<TasteOverlapData>

// src/app/actions/follows.ts
export async function followUser(data: unknown): Promise<ActionResult<void>>
export async function unfollowUser(data: unknown): Promise<ActionResult<void>>
// Payload shape: { userId: string }  (.strict() — extra keys rejected)
// Caller id is derived from getCurrentUser() — never accepted from client input.

// src/lib/tasteOverlap.ts
export interface SharedWatchEntry {
  brand: string
  model: string
  viewerWatch: Watch
  ownerWatch: Watch
}
export interface SharedDistributionRow {
  label: string
  viewerPct: number  // 0-100
  ownerPct: number   // 0-100
}
export interface TasteOverlapResult {
  sharedWatches: SharedWatchEntry[]
  sharedTasteTags: string[]
  overlapLabel: 'Strong overlap' | 'Some overlap' | 'Different taste'
  sharedStyleRows: SharedDistributionRow[]   // [] when either side has < 3 owned
  sharedRoleRows: SharedDistributionRow[]
  hasAny: boolean  // true iff sharedWatches.length > 0 OR sharedTasteTags.length > 0
}
export function computeTasteOverlap(
  viewer: { watches: Watch[]; preferences: UserPreferences; tasteTags: string[] },
  owner:  { watches: Watch[]; preferences: UserPreferences; tasteTags: string[] },
): TasteOverlapResult
```

## Threshold Values (for Phase 11+ calibration)

Overlap label derivation uses `GOAL_THRESHOLDS.balanced` from `src/lib/similarity.ts`:

| Label | Threshold (avg similarity) |
|-------|----------------------------|
| Strong overlap | >= 0.65 (coreFit) |
| Some overlap | >= 0.45 (familiarTerritory) and < 0.65 |
| Different taste | < 0.45, OR viewer has zero owned (D-05), OR owner has zero owned |

Anchoring to the balanced goal (not the viewer's personal `collectionGoal`) keeps Common Ground labels stable across users and makes them track any future recalibration of the similarity engine weights. If Phase 11+ tunes `GOAL_THRESHOLDS.balanced.coreFit`, Common Ground labels adjust automatically.

## Decisions Made

- **React cache() wraps getTasteOverlapData** (plan-level; called out here because it materially changes the call contract). Per-request memoization only — across requests no state persists (D-03 preserved). Plan 04's layout + common-ground tab can both call it in a single render pass with only one DB roundtrip.
- **Self-follow rejection at application layer.** The RLS `follows_insert_own` policy requires `follower_id = auth.uid()` which does NOT block self-follow on its own. Rejection is load-bearing in the Server Action body. A test in `tests/actions/follows.test.ts` pins this behavior with the exact error string `'Cannot follow yourself'`.
- **revalidatePath on BOTH follow and unfollow.** Tests spy on `revalidatePath('/u/[username]', 'layout')` for each action so the FOLL-03 end-to-end count reconciliation is pinned at the action boundary — a regression that drops revalidation fails the test before it ships.
- **No denormalized follower counts.** Counts stay server-computed via `getFollowerCounts` (unchanged, Phase 7/8). At <500 target users, `count(*)` over `follows_following_idx` is ~1ms.
- **Batched joins via inArray** for follower/following lists — one ordered query to fetch follower ids, then three parallel queries (profiles, profile_settings, watch-count aggregates) joined by userId in memory. No N+1, no correlated subqueries.

## Deviations from Plan

**None — plan executed exactly as written.**

Minor in-flight adjustment during Task 2 GREEN: the 'Some overlap' test fixture initially overshot into 'Strong overlap' territory (computed avg similarity ~0.685 from sharing style/design/role tags). Retuned the fixture to share only styleTags + roleTags + caseSize/WR bands so the computed avg lands at ~0.55 — within the documented [0.45, 0.65) 'Some overlap' range. No implementation change; fixture retuning committed alongside Task 2 (`4646ae1`).

## Issues Encountered

1. **Worktree branch base was wrong at start.** The worktree was created from commit `b204ade` (Phase 08 HEAD) instead of the expected `05e0726` (Phase 09 planning approved). Resolved with `git reset --soft 05e07267` before starting any work, then dropped the stashed non-applicable Phase 08 changes. No downstream impact.
2. **Test UUID fixtures.** Initial test fixtures used `00000000-...-0001` which does not match Zod's `.uuid()` v4 regex (version nibble must be 4, variant nibble 8/9/a/b). Switched to proper v4 shapes like `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee`. Caught by tests; fix folded into Task 3 commit.

## Assumptions Validated/Invalidated

- **A2 (threshold calibration)**: Locked to `GOAL_THRESHOLDS.balanced` — documented above and in `computeTasteOverlap` JSDoc. Test fixtures reference `GOAL_THRESHOLDS.balanced.coreFit` / `.familiarTerritory` dynamically so tests track any re-tuning.
- **A9 (revalidatePath layout invalidation)**: Confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` — "Layouts: invalidates the layout, all nested layouts beneath it, and all pages beneath them." The call `revalidatePath('/u/[username]', 'layout')` therefore invalidates all tabs, `/followers`, `/following`, and (Plan 04) `/common-ground` beneath the profile layout.
- **A3 (`follows.update_own` policy harmless)**: No change this plan — documented the reserved-for-future note in the action file's `self-follow rejection` comment rationale.

## User Setup Required

None — no external service configuration, no environment variables, no migrations. All three new files depend only on primitives that shipped in Phase 7/8.

## Known Stubs

None. Every exported function has a complete implementation and test coverage. Plans 02/03/04 will wire these into UI; no deferred wiring here.

## Next Phase Readiness

- **Plan 02** can now import `followUser` / `unfollowUser` from `@/app/actions/follows` and `isFollowing` from `@/data/follows` to wire the FollowButton component.
- **Plan 03** can now import `getFollowersForProfile` / `getFollowingForProfile` for the `/u/[username]/followers` and `/u/[username]/following` routes.
- **Plan 04** can now import `getTasteOverlapData` + `computeTasteOverlap` for the Common Ground hero band and 6th tab. The cache() wrapper means Plan 04 is free to call `getTasteOverlapData` from both the layout and `[tab]/page.tsx` within a single render — one DB roundtrip.
- **No blockers.** RLS policies already applied (Phase 7), no migration needed, test framework already in place.

## Self-Check: PASSED

- File `src/data/follows.ts` exists: FOUND
- File `src/app/actions/follows.ts` exists: FOUND
- File `src/lib/tasteOverlap.ts` exists: FOUND
- File `tests/data/follows.test.ts` exists: FOUND
- File `tests/actions/follows.test.ts` exists: FOUND
- File `tests/lib/tasteOverlap.test.ts` exists: FOUND
- Commit `d0ed854` (Task 1 RED): FOUND
- Commit `4646ae1` (Task 2 GREEN): FOUND
- Commit `7f99b86` (Task 3 GREEN): FOUND
- Full test suite: 24 passed / 1 skipped / 1283 tests green
- ESLint on new files: clean (0 errors, 0 warnings)
- TypeScript: clean on all new files (one pre-existing unrelated TS2578 in `tests/balance-chart.test.tsx`, out of scope)

---
*Phase: 09-follow-system-collector-profiles*
*Completed: 2026-04-21*
