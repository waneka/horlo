---
phase: 09-follow-system-collector-profiles
plan: 02
subsystem: ui
tags: [react, client-component, use-transition, next-navigation, router-refresh, optimistic-ui, follow, accessibility, tailwind]

# Dependency graph
requires:
  - phase: 09-follow-system-collector-profiles
    plan: 01
    provides: followUser/unfollowUser Server Actions, isFollowing DAL, revalidatePath layout invalidation
  - phase: 08-self-profile-privacy-controls
    provides: ProfileHeader, LockedProfileState, getProfileSettings, /u/[username]/layout.tsx
provides:
  - FollowButton Client Component with three visual variants (primary, locked, inline)
  - Server-hydrated initialIsFollowing via isFollowing() in layout.tsx for both LockedProfileState and ProfileHeader branches
  - Optimistic follow/unfollow with router.refresh() reconciliation and rollback-on-failure
  - Desktop CSS hover-swap + mobile two-tap unfollow pattern (D-09)
  - Self-hidden guard on own-profile + unauth /login?next=<pathname> redirect (T-09-10, T-09-13)
affects:
  - 09-03-follower-following-list-routes (consumes FollowButton inline variant on list rows)
  - 09-04-common-ground-hero-tab-locked-state (FollowButton surface is complete; plan 04 adds hero band + tab)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useState + useTransition + router.refresh() for compound optimistic state (label + count reconcile via parent layout)
    - CSS group-hover / group-focus for desktop hover-swap — no JS timer or pointer tracking
    - Local mobileRevealed state gated by window.matchMedia('(max-width: 639px)') for two-tap unfollow
    - Self-guard + unauth redirect enforced client-side as defense-in-depth above Server Action auth checks

key-files:
  created:
    - src/components/profile/FollowButton.tsx
    - tests/components/profile/FollowButton.test.tsx
    - .planning/phases/09-follow-system-collector-profiles/deferred-items.md
  modified:
    - src/components/profile/ProfileHeader.tsx
    - src/components/profile/LockedProfileState.tsx
    - src/app/u/[username]/layout.tsx
    - tests/components/profile/LockedProfileState.test.tsx

key-decisions:
  - "useState + useTransition chosen over useOptimistic — compound state (label + count) needs explicit rollback control"
  - "FollowButton is self-guarded: returns null when viewerId === targetUserId (defense layer above Server Action rejection)"
  - "Unauth click routes to /login?next=<encodeURIComponent(window.location.pathname)> — same-origin pathname only, no absolute URLs produced"
  - "isFollowing fetched once in layout.tsx before the profile_public branch split so both LockedProfileState (D-08 auto-accept) and ProfileHeader share a single query"
  - "Console.error + rollback is sufficient for Plan 02 error UX — toast wrapper deferred to future phase; UI-SPEC copy strings documented in plan"

patterns-established:
  - "Server-hydrated initial state + client-side optimistic pattern: layout.tsx fetches isFollowing() once, passes initialIsFollowing to component, component re-syncs via useEffect on prop change (Pitfall 4 mitigation)"
  - "CSS-first interactive states: hover-swap uses `group-hover:hidden` + `hidden group-hover:inline` so no JS fires on desktop hover"
  - "Mobile two-tap via matchMedia: component exposes same behavior on both viewports but gates the reveal step to mobile only"

requirements-completed: [FOLL-01, FOLL-02, FOLL-03, PROF-08]

# Metrics
duration: ~22min
completed: 2026-04-21
---

# Phase 9 Plan 02: Follow Button & Header Wiring Summary

**FollowButton Client Component (3 variants) with optimistic follow/unfollow + router.refresh() reconciliation + desktop CSS hover-swap + mobile two-tap; wired into ProfileHeader non-owner slot and LockedProfileState auto-accept card; layout hydrates isFollowing server-side.**

## Performance

- **Duration:** ~22 min (first commit 2026-04-21T18:24Z → final task commit 2026-04-21T18:29Z)
- **Started:** 2026-04-21T18:07:00Z (worktree init + context load)
- **Completed:** 2026-04-21T18:29:31Z
- **Tasks:** 3 (all green, TDD red→green on Task 1→2)
- **Files created:** 3
- **Files modified:** 4

## Accomplishments

- Shipped the full primary Follow-button surface for Phase 9. Plan 03 can now reuse the `inline` variant in FollowerListCard; Plan 04 can rely on the ProfileHeader wiring being stable.
- `src/components/profile/FollowButton.tsx` — 155 lines. Three variants share state machine, styling forks on variant. Handles self-guard, unauth redirect, optimistic flip, rollback, desktop hover-swap, mobile two-tap.
- ProfileHeader and LockedProfileState both render the live button; the disabled-Follow-coming-soon placeholder is gone.
- `layout.tsx` fetches `isFollowing(viewerId, profile.id)` exactly once (before the private-profile branch split) and passes it to whichever branch renders.
- 23 new tests on FollowButton + 5 updated tests on LockedProfileState. Full suite: 1325 tests green / 3 skipped / 0 failures.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Wave 0 RED — failing tests for FollowButton states + optimistic + variants** — `0485191` (test)
2. **Task 2: GREEN — FollowButton component with optimistic + rollback + hover-swap** — `64bf055` (feat)
3. **Task 3: GREEN — wire FollowButton into ProfileHeader + LockedProfileState + layout** — `7b4c9da` (feat)

## Files Created/Modified

- `src/components/profile/FollowButton.tsx` — Client Component (3 variants: primary, locked, inline). Owns useState + useTransition + router.refresh(). 155 lines.
- `src/components/profile/ProfileHeader.tsx` — added 4 viewer-context props (viewerId, targetUserId, initialIsFollowing, targetDisplayName); the old `props.isOwner` boolean render now forks between `Edit Profile` (owner) and `FollowButton primary` (non-owner) in the same slot, preserving layout.
- `src/components/profile/LockedProfileState.tsx` — replaced disabled `<Button>` placeholder with live `<FollowButton variant="locked">`; dropped unused `Button` import; added 3 viewer-context props.
- `src/app/u/[username]/layout.tsx` — imported `isFollowing` from `@/data/follows`; computes `initialIsFollowing` once after `isOwner` is known and before the private-profile branch split; passes the hydrated value + `viewerId` + `targetUserId` to both branches.
- `tests/components/profile/FollowButton.test.tsx` — 23 tests covering 6 describe groups: primary variant, optimistic + rollback, hover-swap DOM, mobile two-tap, variants, self guard + unauth.
- `tests/components/profile/LockedProfileState.test.tsx` — added the 3 new required props to `baseProps`; replaced `renders a disabled Follow button` with `renders a live Follow button` + `renders the Following state` + `falls back to @username aria-label when displayName is null` (5 tests total).

## Public API (consumed by Plans 03, 04)

```typescript
// src/components/profile/FollowButton.tsx
export interface FollowButtonProps {
  viewerId: string | null           // null = unauthenticated → click routes to /login
  targetUserId: string              // the user being followed/unfollowed
  targetDisplayName: string         // used in aria-label
  initialIsFollowing: boolean       // server-hydrated from isFollowing() in layout
  variant?: 'primary' | 'locked' | 'inline'   // default 'primary'
}
export function FollowButton(props: FollowButtonProps): JSX.Element | null
```

**Usage by variant:**
- `primary` — ProfileHeader non-owner slot (solid `bg-accent text-accent-foreground` fill)
- `locked` — LockedProfileState private-profile card (visually identical to primary)
- `inline` — list rows in FollowerListCard (outline-only, `border border-border text-foreground`; Plan 03)

**Self-guard:** Returns `null` when `viewerId !== null && viewerId === targetUserId`. Unauth (`viewerId === null`) still renders the button — click navigates to `/login?next=<pathname>` without firing the Server Action.

**ProfileHeader new props:** `viewerId`, `targetUserId`, `initialIsFollowing`, `targetDisplayName`.

**LockedProfileState new props:** `viewerId`, `targetUserId`, `initialIsFollowing`.

## Decisions Made

- **useState + useTransition over useOptimistic.** UI-SPEC line 418 locks this choice: compound state (isFollowing + count) and the explicit rollback branch on failure are cleaner with explicit `setIsFollowing(!next)` in the error branch. The Phase 8 `NoteVisibilityPill` uses `useOptimistic` because it only owns a single boolean; FollowButton's failure path needs to roll back without a server round-trip.
- **Self-guard enforced client-side AND server-side.** FollowButton returns `null` when `viewerId === targetUserId` (no render). Server Action `followUser` also rejects `parsed.data.userId === user.id`. Both layers are required — the client guard prevents the UI from ever asking the user to self-follow; the server guard blocks direct API hits.
- **Unauth redirect uses `window.location.pathname`, not a template-interpolated `/u/{username}`.** Keeps the `next` param always same-origin and relative; eliminates the class of bugs where a hard-coded interpolation could produce an absolute URL. Verified `/login` route exists at `src/app/login/page.tsx` (`test -f` at plan time and again at task time).
- **`isFollowing` fetched once before branch split.** Placed after `isOwner` is known but before the `profilePublic` gate so both `LockedProfileState` (D-08 auto-accept) and `ProfileHeader` paths share the same query. When `viewerId` is null or the viewer is the owner, we short-circuit to `false` and skip the DB roundtrip.
- **Mobile viewport detection via `matchMedia` query.** Two-tap path triggers only on `(max-width: 639px)` (Tailwind `sm` breakpoint). Test suite stubs both modes to exercise both behaviors.
- **Pitfall 4 mitigation via `useEffect`.** Re-syncs local `isFollowing` with `initialIsFollowing` when the parent hydrates a fresh prop (e.g. after `router.refresh()` pulls updated layout data on a tab where follow state changed in another tab).

## Deviations from Plan

**None — plan executed exactly as written.**

Minor implementation note: Task 3 plan text said "remove the `Button` import if no longer used" — it was no longer used after the disabled placeholder was replaced, so the import was dropped. Also dropped the `Lock` icon import's companion `Button` import (verified via ESLint: 0 errors).

## Issues Encountered

1. **Worktree branch base mismatch at start.** The worktree HEAD was at `b204ade` (pre-Plan-01) instead of `86cf52a` (Plan 01 complete). Resolved with `git reset --hard 86cf52a`. No downstream impact; all Plan 01 artifacts available on disk post-reset (they were already committed).
2. **Pre-existing TypeScript/ESLint issues on `layout.tsx`.** Discovered during Task 3 verification: `LayoutProps` global type unresolvable under `tsc --noEmit` (Next.js 16 generates it in `.next/types`), `Date.now()` flagged by `react-hooks/purity`, and `tests/balance-chart.test.tsx` has a stale `@ts-expect-error`. All three reproduced on the base commit via `git stash` round-trip — pre-existing, out of scope per SCOPE BOUNDARY rule. Logged in `.planning/phases/09-follow-system-collector-profiles/deferred-items.md`.

## Assumptions Validated/Invalidated

- **`/login` route exists and accepts `next` param.** Validated: `test -f src/app/login/page.tsx` succeeds both at plan time and at task time. The `next` handling is a pre-existing login handler concern (carry-forward from prior phases); Plan 02 only originates the param with a same-origin pathname.
- **`router.refresh()` reconciles layout-level counts.** Validated at the test boundary (mock `router.refresh` is asserted called once after successful action). The actual count reconciliation (getFollowerCounts re-running via layout refresh) is pinned by Plan 01's revalidatePath spy tests and will be verified end-to-end via human UAT in Phase 9 completion.
- **jsdom does not apply CSS group-hover.** Validated: tests assert DOM presence of both "Following" and "Unfollow" spans when following, with visibility controlled by Tailwind classes. This is the documented jsdom limitation; desktop browsers apply the CSS correctly.
- **`window.matchMedia` stubbable per-test.** Validated: `Object.defineProperty(window, 'matchMedia', ...)` overrides cleanly in `beforeEach` + per-describe setup for the mobile two-tap suite.

## Grounded References

- `/login?next=...` redirect target — `src/app/login/page.tsx` exists (verified at plan time + task time).
- `isFollowing` DAL signature — `src/data/follows.ts::isFollowing(followerId, followingId): Promise<boolean>` (Plan 01 artifact; consumed as-is).
- `followUser` / `unfollowUser` Server Action signatures — `(data: unknown) => Promise<ActionResult<void>>` (Plan 01 artifact; consumed via `{ userId: targetUserId }` payload).
- UI-SPEC class tokens — `bg-accent text-accent-foreground`, `bg-muted text-muted-foreground`, `hover:text-destructive focus:text-destructive`, `border border-border` all match UI-SPEC Interaction Contracts section verbatim (no divergence).

## UI-SPEC Divergences

**None.** All class tokens, aria attributes, copy strings, and interaction paths match UI-SPEC Interaction Contracts section (lines 144-179) and Copywriting Contract (lines 322-367) exactly.

## Test Coverage

- **Plan 02 new tests:** 23 (FollowButton) + 2 added/replaced (LockedProfileState) = 25 new test cases on the Follow surface.
- **Full suite:** 1325 passed / 3 skipped / 0 failed (26 test files, of which 1 is skipped).
- **TypeScript strict on new/modified files:** clean (pre-existing `LayoutProps` + `balance-chart` errors documented separately in deferred-items.md).
- **ESLint on new/modified component+test files:** 0 errors, 0 warnings.

## User Setup Required

None — no external service configuration, no environment variables, no migrations. All three file changes depend only on primitives shipped in Phase 7/8/9-01.

## Known Stubs

None. FollowButton has a complete implementation, both placements consume it in their live form, and the layout fully hydrates initial state server-side. Scanning all four production files for `TODO|FIXME|placeholder|coming soon|not available` returned zero matches.

## Next Phase Readiness

- **Plan 03** can import `FollowButton` from `@/components/profile/FollowButton` and use `variant="inline"` on FollowerListCard rows. The inline variant's outline-only styling is already implemented and tested.
- **Plan 04** can rely on ProfileHeader + LockedProfileState being wired — the CommonGroundHeroBand slot between ProfileHeader and ProfileTabs has the viewer/owner context already flowing through the layout. No new props needed from Plan 04 to Plan 02's surfaces.
- **No blockers.** `/login` route exists, `isFollowing` DAL exists, Server Actions exist, RLS policies already applied in Phase 7.

## Self-Check: PASSED

- File `src/components/profile/FollowButton.tsx` exists: FOUND
- File `tests/components/profile/FollowButton.test.tsx` exists: FOUND
- File `src/components/profile/ProfileHeader.tsx` modified: FOUND (FollowButton import + render slot)
- File `src/components/profile/LockedProfileState.tsx` modified: FOUND (FollowButton variant=locked)
- File `src/app/u/[username]/layout.tsx` modified: FOUND (isFollowing import + call + prop passing)
- File `tests/components/profile/LockedProfileState.test.tsx` updated: FOUND (new baseProps + replaced disabled-test)
- File `.planning/phases/09-follow-system-collector-profiles/deferred-items.md` exists: FOUND
- Commit `0485191` (Task 1 RED): FOUND
- Commit `64bf055` (Task 2 GREEN): FOUND
- Commit `7b4c9da` (Task 3 GREEN): FOUND
- Full test suite: 1325 passed / 3 skipped / 0 failed
- TypeScript on new/modified in-scope files: clean (FollowButton.tsx = 0 errors)
- ESLint on new/modified component files: 0 errors, 0 warnings
- Login route grounding: `src/app/login/page.tsx` exists

---
*Phase: 09-follow-system-collector-profiles*
*Completed: 2026-04-21*
