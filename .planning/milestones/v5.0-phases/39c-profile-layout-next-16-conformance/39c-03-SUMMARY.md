---
phase: 39c-profile-layout-next-16-conformance
plan: "03"
subsystem: ui
tags: [nextjs, server-components, suspense, caching, profile, streaming]

# Dependency graph
requires:
  - phase: 39c-profile-layout-next-16-conformance
    plan: "01"
    provides: ProfileShellSkeleton component at profile-shell-skeleton.tsx
  - phase: 39c-profile-layout-next-16-conformance
    plan: "02"
    provides: ProfileShellResolver cached Server Component at profile-shell-resolver.tsx
provides:
  - ProfileGate Server Component (viewer-dependent branching, uncached layer)
  - Refactored layout.tsx as 17-line thin Suspense shell with zero uncached top-level fetches
affects: [39c-04, 39c-05, 39c-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "'import server-only' guard on uncached viewer-dependent Server Components"
    - "ProfileGate pattern: getCurrentUser() OUTSIDE cached scope → cached resolver → notFound() BEFORE isFollowing await → locked/public branch"
    - "Thin layout shell: layout body = <main> + <Suspense fallback={<Skeleton/>}> + <Gate>{children}</Gate>"

key-files:
  created:
    - src/app/u/[username]/profile-gate.tsx
  modified:
    - src/app/u/[username]/layout.tsx

key-decisions:
  - "wearEvents destructured but unused in gate (tasteTags computed by resolver) — dropped from destructure to clean lint"
  - "Prop type uses idiomatic multi-line TypeScript format (not single-line inline) — semantically correct, minor format deviation from RESEARCH Example 2 verbatim"
  - "Pre-existing LayoutProps TS error documented in plan is not present at runtime — build passes clean"

patterns-established:
  - "Pattern: viewer-dependent gate (ProfileGate) is the uncached layer; cached resolver is called INSIDE the gate"
  - "Pattern: notFound() placed BEFORE isFollowing await to preserve 404 status (Pitfall 5 avoidance)"

requirements-completed: [NEXT16-CONFORMANCE]

# Metrics
duration: 5min
completed: 2026-05-14
---

# Phase 39c Plan 03: ProfileGate + Layout Refactor Summary

**ProfileGate Server Component and thin Suspense shell layout replacing 8 uncached top-level fetches with a single cached ProfileShellResolver + viewer-dependent gate, producing Partial Prerender for /u/[username]**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-14T05:28:09Z
- **Completed:** 2026-05-14T05:33:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Created `profile-gate.tsx`: uncached Server Component with `import 'server-only'` guard that owns all viewer-dependent branching (getCurrentUser, isFollowing, locked-vs-public decision, common-ground overlap)
- Refactored `layout.tsx` from 147 lines to 17 lines: removed all 8 uncached top-level data fetches, replaced with `<Suspense fallback={<ProfileShellSkeleton/>}><ProfileGate username={username}>{children}</ProfileGate></Suspense>`
- Build confirmed `/u/[username]` and `/u/[username]/[tab]` as "◐ (Partial Prerender)" — static shell with dynamic server-streamed content, exactly the Next 16 cacheComponents outcome targeted by D-39c-01

## Task Commits

Each task was committed atomically:

1. **Task 1: Author ProfileGate Server Component** - `50c49e9` (feat)
2. **Task 2: Refactor layout.tsx into thin Suspense shell** - `a6048c6` (feat)

## Files Created/Modified
- `src/app/u/[username]/profile-gate.tsx` - New uncached viewer-dependent gate; resolves viewerId, calls cached ProfileShellResolver, calls notFound() before isFollowing await, branches locked/public, renders LockedProfileState or public composition
- `src/app/u/[username]/layout.tsx` - Refactored to 17-line thin shell; zero uncached top-level fetches; imports Suspense + ProfileGate + ProfileShellSkeleton only

## Decisions Made
- `wearEvents` returned by the resolver is not destructured in the gate (tasteTags are computed inside the resolver); dropping it avoids an unused-variable lint warning
- Prop type annotation uses idiomatic multi-line TypeScript format rather than single-line inline — semantically identical to RESEARCH Example 2, format is idiomatic
- Pre-existing lint errors (115 total across the codebase) are baseline; our changes added no new errors

## Deviations from Plan

None — plan executed exactly as written. The gate body mirrors RESEARCH Example 2 and the refactored layout mirrors RESEARCH Example 3 exactly.

Minor format note (not a deviation): prop types use multi-line format instead of single-line `{ username: string; children: React.ReactNode }` — this is idiomatic TypeScript, semantically equivalent.

## Load-bearing Static Grep Evidence (SC#1)

```
! grep -nE "getCurrentUser|getProfileByUsername|getProfileSettings|isFollowing|getFollowerCounts|getWatchesByUser|getAllWearEventsByUser|resolveCommonGround" src/app/u/[username]/layout.tsx
```
→ Empty output (all 8 prior uncached top-level reads removed from layout body). PASS.

## T-39c-01 + T-39c-04 Mitigation Evidence

T-39c-01 (Information Disclosure — viewer resolution):
- `! grep -n "'use cache'" src/app/u/[username]/profile-gate.tsx` → PASS (gate is uncached layer)
- `getCurrentUser()` is the SOLE entry point for viewer identity in the gate

T-39c-04 (Information Disclosure — locked-vs-public branching):
- `grep -n "settings.profilePublic" src/app/u/[username]/profile-gate.tsx` → line 70: `if (!isOwner && !settings.profilePublic)`
- Locked branch reads cached `settings.profilePublic` AFTER resolver returns, renders only `<LockedProfileState/>` (no follower lists, no watches, no wear events in the cached scope)

## SC#6 Preservation Evidence

`grep -n "LockedProfileState" src/app/u/[username]/profile-gate.tsx` → lines 7 (import), 72 (render)

The existing `!isOwner && !settings.profilePublic` branch from current `layout.tsx:47` is reproduced verbatim inside the gate at line 70. SC#6 (private-profile gating preserved) is intact.

## Build Result

`npm run build` exits 0. `/u/[username]` shows as `◐ (Partial Prerender)` in the route table — confirms the static shell prerenders correctly with dynamic server-streamed content for the gate.

## Issues Encountered

None.

## Next Phase Readiness

- ProfileGate and thin shell layout are complete — prerequisite for Plans 04 (unstable_instant), 05 (invalidation wiring), 06 (revert diagnostic commit)
- The Partial Prerender confirmation in the build output is the primary quality gate for this plan; further prod verification occurs in Plan 06 (D-39c-09)

---
*Phase: 39c-profile-layout-next-16-conformance*
*Completed: 2026-05-14*
