---
phase: 56A-wear-view-unification
plan: 05
subsystem: ui
tags: [next-navigation, router-push, embla-carousel, vitest, bottom-nav]

requires:
  - phase: 56A-wear-view-unification/03
    provides: WearsLane route and getActiveWearsForUser DAL live on main

provides:
  - WywtRail tile tap navigates to /wears/[username]?from=... (SC-1)
  - BottomNav hidden on /wears/ routes via pathname.startsWith check (SC-2)
  - SlimTopNav hidden on /wears/ routes via pathname.startsWith check (SC-2)
  - WywtOverlay.tsx and WywtSlide.tsx deleted; no remaining importers (SC-5)
  - phase56a-wears-lane integration test fully green (SC-1, SC-2, SC-5, D-07)

affects: [56A-wear-view-unification, home-rail, nav-chrome]

tech-stack:
  added: []
  patterns:
    - "pathname.startsWith('/wears/') early-return in nav components (Option B — client render gate only, proxy auth gate untouched)"
    - "fs.existsSync instead of dynamic import() for deletion-assertion tests (Vite resolves dynamic imports at bundle time)"

key-files:
  created: []
  modified:
    - src/components/home/WywtRail.tsx
    - src/components/layout/BottomNav.tsx
    - src/components/layout/SlimTopNav.tsx
    - tests/integration/phase56a-wears-lane.test.ts
  deleted:
    - src/components/home/WywtOverlay.tsx
    - src/components/home/WywtSlide.tsx

key-decisions:
  - "SC-5 test assertion uses fs.existsSync rather than dynamic import() — Vite's import-analysis resolves dynamic imports at bundle time (not runtime), so try/catch around import() fails to compile when the file doesn't exist; existsSync is the correct approach for deletion assertions in Vitest+Vite projects"
  - "pathname.startsWith('/wears/') added to BottomNav and SlimTopNav only — NOT added to isPublicPath/public-paths, so the proxy auth gate remains active (T-56A-14)"
  - "markViewed called before router.push in openAt so the rail ring updates immediately even if navigation is slow (D-05 intent preserved)"

patterns-established:
  - "deletion-test pattern: use fs.existsSync for asserting deleted files in Vitest+Vite; dynamic import() fails at bundle time when file is absent"

requirements-completed: [SC-1, SC-2, SC-5]

duration: 3min
completed: 2026-05-23
---

# Phase 56A Plan 05: Cutover + Deletion Summary

**WywtRail rewired to router.push('/wears/[username]'), nav chrome hidden on /wears/ routes, and legacy WywtOverlay + WywtSlide deleted — completing the Wave 3 cutover that turns SC-5 green**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-23T15:58:25Z
- **Completed:** 2026-05-23T16:01:47Z
- **Tasks:** 3
- **Files modified:** 4 (+ 2 deleted)

## Accomplishments

- WywtRail.tsx: removed lazy WywtOverlay import, overlayOpen/activeTileIndex state, and Suspense overlay render block; replaced openAt() body with markViewed + router.push(`/wears/${tile.username}?from=${tile.wearEventId}`); WywtPostDialog self-placeholder flow unchanged (Pitfall 5)
- BottomNav and SlimTopNav: pathname.startsWith('/wears/') early-return added (client render gate only; proxy auth gate untouched; T-56A-14 mitigated)
- Pre-flight grep confirmed zero remaining importers before deletion; WywtOverlay.tsx and WywtSlide.tsx deleted; build succeeds with no unresolved imports
- All 4 integration tests in phase56a-wears-lane.test.ts pass (SC-1 x2, D-07, SC-5)

## Task Commits

1. **Task 1: Rewire WywtRail to navigate + remove overlay state** - `a95ec31` (feat)
2. **Task 2: Hide nav chrome on /wears/ routes** - `77963fe` (feat)
3. **Task 3: Delete legacy WywtOverlay + WywtSlide; turn SC-5 scaffold green** - `3d6bba2` (feat)

## Files Created/Modified

- `src/components/home/WywtRail.tsx` - Added useRouter; replaced openAt() with router.push; removed WywtOverlay import + state + render
- `src/components/layout/BottomNav.tsx` - Added pathname.startsWith('/wears/') early-return after isPublicPath check
- `src/components/layout/SlimTopNav.tsx` - Same pathname check after isPublicPath guard
- `tests/integration/phase56a-wears-lane.test.ts` - Removed EXPECTED RED markers; SC-5 assertion switched to fs.existsSync; all 4 tests green
- `src/components/home/WywtOverlay.tsx` - DELETED (legacy modal approach replaced by routed lane)
- `src/components/home/WywtSlide.tsx` - DELETED (was only used by WywtOverlay)

## Decisions Made

- **fs.existsSync for SC-5 deletion test:** Vite's import-analysis resolves dynamic `import()` calls at bundle time (not runtime), so a `try/catch` around `await import('@/components/home/WywtOverlay')` fails to compile when the file is absent. Used `fs.existsSync` against the filesystem path instead — this is the correct pattern for deletion assertions in Vitest+Vite projects.
- **markViewed before router.push:** Preserves the intent that the rail ring updates immediately on tap, even if navigation is slow or fails (D-05).
- **/wears/ NOT added to public-paths:** The pathname check in BottomNav/SlimTopNav is purely a client-side render gate; /wears/ remains auth-only so the proxy redirects unauthenticated users to /login (T-56A-14).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SC-5 test assertion switched from dynamic import() to fs.existsSync**
- **Found during:** Task 3 (Delete legacy WywtOverlay + WywtSlide)
- **Issue:** The original test scaffold used `try { await import('@/components/home/WywtOverlay') } catch { overlayExists = false }`. Vite's import-analysis resolves module specifiers at bundle time — when the file doesn't exist, the bundler errors out before the try/catch runs. The test failed with a Vite transform error, not a runtime error.
- **Fix:** Replaced dynamic import() with `fs.existsSync(resolve(process.cwd(), 'src/components/home/WywtOverlay.tsx'))` which performs a filesystem check at runtime. The assertion still verifies the deletion contract (file must not exist after Plan 05).
- **Files modified:** tests/integration/phase56a-wears-lane.test.ts
- **Verification:** `npm run test -- phase56a-wears-lane` exits 0 with 4/4 passing
- **Committed in:** 3d6bba2 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test assertion approach)
**Impact on plan:** Fix necessary to make the test compile and run. No scope creep. SC-5 contract correctly enforced via filesystem check.

## Issues Encountered

None beyond the test assertion approach deviation documented above.

## Known Stubs

None.

## Threat Flags

No new security-relevant surface introduced. T-56A-14 mitigated: `/wears/` pathname check lives only in client render path (BottomNav/SlimTopNav), not in isPublicPath/public-paths. Proxy auth gate untouched.

## Next Phase Readiness

Phase 56A is complete. All 5 plans executed:
- P01: Test scaffolds (Wave 0 RED) 
- P02: WearsLane component + wearEvents DAL
- P03: /wears/[username] route + WearCard shared component
- P04: /wear/[wearEventId] refactor to use WearCard
- P05: Cutover + deletion (this plan)

SC-1, SC-2, SC-3, SC-4, SC-5 all satisfied. Build passing. Integration test suite green.

---
*Phase: 56A-wear-view-unification*
*Completed: 2026-05-23*
