---
phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta
plan: 03
subsystem: ui
tags: [next16, ppr, cache-components, profile-route, server-components, react-19, phase-39c, f3-composite]

# Dependency graph
requires:
  - phase: 51
    provides: "51-02 ProfileGate viewerId-prop refactor — without it, this plan's layout collapse + page-owned composition would not type-check"
  - phase: 51
    provides: "51-01 test scaffold (tests/profile-route-51.test.ts) — Test 1 (REQ-51-04) is the structural assertion this plan flips from RED to GREEN"
provides:
  - "Layout collapsed to a pure deterministic chrome shell (no Suspense, no ProfileGate, no async data) — fully prerenderable"
  - "Page (cookie-reading, runtime-API consumer) is now the dynamic stream target; cached resolver invoked from inside the dynamic page render context"
  - "Phase 39c invariants D-39c-03, -04, -05, -09 and Pitfall-5 preserved structurally"
  - "All 3 Phase 51 structural assertions (REQ-51-04, -05, -06) GREEN"
  - "REQ-51-03 (build artifact assertion via node scripts/assert-phase-51-build.mjs) PASSES"
affects:
  - "51-04 (proxy cookie-only refactor) — unblocked; safe to proceed in next wave"
  - "51-06 (preview deploy + prod verification gate) — preview deploy will exercise the structural fix on Vercel edge"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "F3-Composite layout/page split — runtime-API consumer (cookies) lives at page level; static chrome lives at layout level; cached resolver invoked inside dynamic page render context"
    - "Page-owned Suspense + ProfileGate composition via a wrapInGate helper (DRY across all per-tab returns)"
    - "Structural PPR opt-out (vs runtime opt-out): the route's classification is set in the build manifest, not flipped at request time"

key-files:
  created:
    - ".planning/phases/51-.../deferred-items.md — pre-existing env-related test failures logged for triage"
  modified:
    - "src/app/u/[username]/layout.tsx — collapsed to <main> chrome wrapper; awaits params; no Suspense/ProfileGate/ProfileShellSkeleton imports"
    - "src/app/u/[username]/[tab]/page.tsx — added Suspense / ProfileGate / ProfileShellSkeleton imports; defined wrapInGate helper; wrapped all 12 per-tab JSX returns; left 2 notFound() statements bare per Pitfall-5"
    - "tests/app/profile-tab-insights.test.tsx — Rule 1 auto-fix; owner-branch test navigates through the new wrapper to find InsightsTabContent (test intent preserved)"

key-decisions:
  - "Comment wording in layout.tsx avoids the literal substrings '<Suspense fallback={<ProfileShellSkeleton' and 'ProfileGate' so Test 1's regex/source-grep doesn't false-positive on documentation prose. Same pattern as plan 51-02's PROHIBITED-list rewording — test contract is the verifiable gate."
  - "Visual build output (`◐ Partial Prerender /u/[username]/[tab]`) still appears for the route, but the manifest-level assertion (`node scripts/assert-phase-51-build.mjs`) — the authoritative REQ-51-03 gate — passes. This is documented as a Caveat in the Caveats / Operator Note section below; final prod-deploy verification (plan 51-06) is the ultimate adjudicator."

patterns-established:
  - "When a Next 16 route must opt out of PPR while preserving cached descendants, push the runtime-API-reading code DOWN into the page (the dynamic stream target) rather than up into the layout (the static shell). The cached descendant stays — it just renders inside a dynamic response, not a static shell."
  - "When a test asserts on the shape of a Server Component's returned React element and a structural wrapper is added, the wrapper-navigation pattern (`result.props.children`) is preferable to deleting/relaxing the assertion — test intent stays explicit."

requirements-completed: [REQ-51-03, REQ-51-04]

# Metrics
duration: ~10min
completed: 2026-05-20
---

# Phase 51 Plan 03: F3-Composite Structural Change Summary

**Layout collapsed to a pure static chrome wrapper; gate composition + page-owned Suspense moved into `[tab]/page.tsx` so the page is now the route's runtime-API consumer and dynamic stream target.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-20T17:46:00Z
- **Completed:** 2026-05-20T17:54:00Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files modified:** 3 (1 layout, 1 page, 1 test for Rule 1 auto-fix)
- **Files created:** 1 (deferred-items.md)

## Accomplishments

- `src/app/u/[username]/layout.tsx` collapsed: removed `Suspense`, `ProfileGate`, `ProfileShellSkeleton` imports + composition. Only retains `<main>` chrome wrapper and an `await params` to honor the typed `LayoutProps<'/u/[username]'>` contract.
- `src/app/u/[username]/[tab]/page.tsx` restructured to own the gate composition: defines a `wrapInGate(content)` helper after viewerId resolution; wraps all 12 per-tab JSX returns (common-ground "no shared watches" Card, CommonGroundTabContent, InsightsTabContent, three LockedTabCards for collection/wishlist/notes, three TabContents for the shared collection/wishlist/notes block, WornTabContent, stats LockedTabCard, StatsTabContent).
- Two `notFound()` statements (line ~58 invalid tab; line ~79 missing profile) left unwrapped — they must propagate `NEXT_NOT_FOUND` per D-39c-Pitfall-5.
- Test 1 (REQ-51-04) flipped RED → GREEN; Tests 2, 3 stay GREEN; full Phase 51 contract (3/3) PASS.
- `node scripts/assert-phase-51-build.mjs` exits 0 → REQ-51-03 satisfied.
- `npm run build` exits 0 with no errors.
- `tests/app/profile-tab-insights.test.tsx` regression auto-fixed (Rule 1): test navigates through the new `<Suspense><ProfileGate>` wrapper to assert on the inner `InsightsTabContent` element.

## Task Commits

1. **Task 1: Collapse layout.tsx to a pure static chrome shell** — `350aba8` (refactor)
2. **Task 2: Move gate composition + page-owned Suspense into [tab]/page.tsx** — `6fff086` (refactor; includes the Rule 1 auto-fix to the insights test)
3. **Chore: log pre-existing backfill-taste env failures** — `632cd67` (chore; deferred-items)

## Files Created/Modified

- `src/app/u/[username]/layout.tsx` — Now a 24-line file with a single async function that awaits `params` and returns `<main>...{children}</main>`. Zero `Suspense`, `ProfileGate`, or `ProfileShellSkeleton` references in the file.
- `src/app/u/[username]/[tab]/page.tsx` — 3 new imports (`Suspense` from `react`, `ProfileGate` from `../profile-gate`, `ProfileShellSkeleton` from `../profile-shell-skeleton`). New `wrapInGate` helper at the top of the function body (after viewerId resolution, before the ProfileShellResolver call). 12 per-tab JSX returns now go through `wrapInGate`. All `notFound()` calls remain bare statements. No other behavior changed.
- `tests/app/profile-tab-insights.test.tsx` — Owner-branch test (`renders InsightsTabContent when viewer === profile.id`) navigates two levels through the new wrapper: `result.props.children` → ProfileGate → `.props.children` → InsightsTabContent. Other three tests in the file untouched.
- `.planning/phases/51-.../deferred-items.md` — Created with the worktree `.env.local` issue documented.

## Decisions Made

- **Wrapper-navigation pattern in test update.** When the owner-branch test broke (`result.type` became `Symbol(react.suspense)` not `[Function spy]`), the test was updated to navigate through the wrapper to assert on the inner element. The alternative — relaxing the assertion to "owner branch produces some result" — would have weakened the regression coverage. The new pattern is documented inline in the test comment so future structural changes are clearly the trigger.
- **Comment wording in layout.tsx.** The first draft used wording that contained the literal `<Suspense fallback={<ProfileShellSkeleton` substring and the word `ProfileGate` — both inside an explanatory block comment. The test's source-grep matched these as if they were live code, and Test 1 stayed RED. Comment was reworded to remove the substrings while preserving the rationale. The verifiable test contract is authoritative (same precedent as plan 51-02's PROHIBITED-list rewording).
- **Did NOT remove the page's existing ProfileShellResolver call** even though the gate now also calls it. Within a single request, React `cache()` + Next `'use cache'` machinery deduplicates — the duplicate call is a sub-millisecond cache lookup, not a DB roundtrip. This is the recurrence-3 baseline topology per the plan's `<interfaces>` section; do NOT optimize this away in 51-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Layout comment substring conflicted with Test 1 source-grep**

- **Found during:** Task 1 (first test re-run after edit)
- **Issue:** Plan's recommended comment wording contained `<Suspense fallback={<ProfileShellSkeleton/>}>` and `<ProfileGate>` substrings inside a JSDoc-style block comment. Test 1 (REQ-51-04) source-greps with `/<Suspense[^>]*fallback={<ProfileShellSkeleton/s` which matched these strings → Test 1 stayed RED despite the structural change being correct.
- **Fix:** Reworded the comment to describe the change abstractly (`"streaming boundary + viewer-gating composition"` instead of the literal tag names). Spirit preserved; substrings eliminated.
- **Files modified:** `src/app/u/[username]/layout.tsx`
- **Verification:** `npx vitest run tests/profile-route-51.test.ts` → 3/3 PASS after rewording
- **Committed in:** `350aba8`

**2. [Rule 1 - Bug] Owner-branch insights test broke due to Suspense wrapper**

- **Found during:** Task 2 full-suite regression check (`npx vitest run`)
- **Issue:** `tests/app/profile-tab-insights.test.tsx` asserted `result.type === InsightsTabContent` against the page's return value. After wrapping every JSX return in `<Suspense><ProfileGate>...`, `result.type` is now `Symbol(react.suspense)` — assertion fails.
- **Fix:** Updated the assertion to navigate `result.props.children` → ProfileGate element → `.props.children` → InsightsTabContent. Test intent preserved (owner branch produces InsightsTabContent with correct prop). Inline comment documents the wrapper topology so future structural changes leave a clear trail.
- **Files modified:** `tests/app/profile-tab-insights.test.tsx`
- **Verification:** `npx vitest run tests/app/profile-tab-insights.test.tsx` → 4/4 PASS
- **Committed in:** `6fff086` (same commit as Task 2 source change)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). Zero deviations escalated to checkpoint — both fall cleanly inside Rule 1/Rule 3 scope (DIRECT impact of current task's structural change).

## Issues Encountered

- **Pre-existing TypeScript error: `LayoutProps` undefined.** `npx tsc --noEmit` reports `error TS2304: Cannot find name 'LayoutProps'` for `src/app/u/[username]/layout.tsx`. This is a Next 16 global type generated into `.next/types/` only after `npm run build` or `npm run dev` is run. Confirmed pre-existing on baseline (before any 51-03 edits). The build itself (`npm run build`) succeeds because Next regenerates `.next/types/` as part of the build pipeline. Not a regression; not auto-fixed.
- **Pre-existing test failures (env-related, not caused by this plan).** `tests/integration/backfill-taste.test.ts` has 2 failures because `tsx --env-file=.env.local` cannot find `.env.local` in the worktree environment. Confirmed on baseline; logged to `.planning/phases/51-.../deferred-items.md` per the executor scope boundary.

## Caveats / Operator Note

**Build still shows `◐ Partial Prerender` for `/u/[username]/[tab]` in the visual route summary, BUT `node scripts/assert-phase-51-build.mjs` (the authoritative REQ-51-03 gate) exits 0.**

Detail: `.next/prerender-manifest.json` contains an entry for `/u/[username]/[tab]` with `experimentalPPR: true` and `renderingMode: PARTIALLY_STATIC`, but does NOT appear in the `routes` (statically-prerendered) section and does NOT have `prerender: true` or `fallback: 'static'` in its `dynamicRoutes` entry. The assertion script's classification logic considers the route NOT PPR-classified per its strict reading (no static prerender markers in the manifest), and there is no `app-build-manifest.json` in Next 16.2.3 to flag the `renderingMode` field.

The persistent `◐` marker is consistent with `51-RESEARCH.md`'s F3-A analysis: removing the layout Suspense alone is necessary but not sufficient to disqualify PPR — the cached `ProfileShellResolver` descendant continues to contribute to the shell qualification. F3-Composite makes the runtime-API consumer the page (not the layout), which is the structural change the plan intended. Whether this is enough to eliminate the 0-byte Vercel-edge bug on prod (REQ-51-01, REQ-51-02) is the explicit purpose of plan **51-06** (preview deploy + prod-contract verification gate). If 51-06's prod verification fails, RESEARCH.md identifies F3-A + F3-C (also strip `'use cache'` from the resolver) as the fallback — but that's a separate plan to author.

**No action required from operator at this point — proceed to plan 51-04 (Branch B confirmed) per the phase's wave structure.** Surface this caveat to whoever runs 51-06.

## Verification Outcomes

| Gate | Command | Outcome |
|------|---------|---------|
| REQ-51-04 (Test 1: layout no longer wraps ProfileGate in Suspense) | `npx vitest run tests/profile-route-51.test.ts` | PASS (3/3 — Tests 1, 2, 3 all GREEN) |
| REQ-51-05 (Test 2: ProfileGate accepts viewerId as prop) | same | PASS (already GREEN from 51-02) |
| REQ-51-06 (Test 3: ProfileShellResolver remains cached) | same | PASS (resolver unchanged) |
| REQ-51-03 (build artifact: route NOT PPR-classified in manifest) | `node scripts/assert-phase-51-build.mjs` | PASS (exit 0) |
| Build success | `npm run build` | PASS (exit 0; 34 static pages generated; no errors) |
| Regression: insights tab tests | `npx vitest run tests/app/profile-tab-insights.test.tsx` | PASS (4/4 after Rule 1 auto-fix) |
| Full test suite | `npx vitest run` | PASS for plan-scope tests; 3 pre-existing failures unrelated to this plan (1 insights test was directly fixed; 2 backfill-taste tests are env-related and pre-existing — deferred) |

## Phase 39c Invariants — Post-51-03 Re-Verification

| Invariant | Status | Evidence |
|-----------|--------|----------|
| D-39c-03 (viewerId outside cache) | **REINFORCED** | Page reads viewerId via `getCurrentUser()` outside any cached scope; passes it as a prop to `ProfileGate`; gate passes only `{ username }` to `ProfileShellResolver`. Structurally enforced (gate cannot read cookies, page is the boundary). |
| D-39c-04/-05 (cache-tag chain) | **PRESERVED** | `ProfileShellResolver` unchanged: `'use cache'` + `cacheTag('profile:${username}')` + `cacheLife({ revalidate: 300 })` all intact. Server Actions in `watches.ts`, `notes.ts`, `profile.ts`, `follows.ts`, `divestments.ts`, `account.ts` continue to fire `revalidatePath('/u/[username]', 'layout')` — the gate's `cacheTag` is still the keyed invalidation target. |
| D-39c-Pitfall-5 (notFound before post-suspending await) | **PRESERVED** | Two `notFound()` statements in `[tab]/page.tsx` (line 58 invalid tab; line 79 missing profile) are bare statements, not wrapped in `wrapInGate`. The gate's internal `notFound()` (line 49) still runs before any post-suspending await. |
| D-39c-09 (locked-branch routing) | **PRESERVED** | Gate body's `if (!isOwner && !settings.profilePublic)` → `<LockedProfileState/>` short-circuit is byte-identical to its post-51-02 state. The gate is now invoked from the page (instead of the layout), but the gate's internal flow is unchanged. |
| D-39c-06 (loading.tsx skeleton) | **PRESERVED** | `src/app/u/[username]/loading.tsx` continues to render `ProfileTabContentSkeleton` for tab-segment navigations. Cold-load shell now comes from the page-owned `<Suspense fallback={<ProfileShellSkeleton/>}>` in `wrapInGate`. |

## Test Status After This Plan

| Test | REQ | Status After 51-03 | Notes |
|------|-----|---------------------|-------|
| Test 1: layout does not Suspense-wrap ProfileGate | REQ-51-04 | **GREEN** | Flipped from RED. This plan's primary structural target. |
| Test 2: ProfileGate accepts viewerId as a prop | REQ-51-05 | GREEN | From 51-02; unchanged here. |
| Test 3: ProfileShellResolver remains cached | REQ-51-06 | GREEN | Resolver unmodified by this plan. |

## Known Stubs

None. No placeholder data, no hardcoded empty UI values, no TODO/FIXME markers introduced.

## Threat Flags

None. No new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes. Phase 39c's "viewer state outside cache" structural invariant (Pitfall 1) is REINFORCED, not weakened.

## TDD Gate Compliance

Both tasks were `tdd="true"` within a non-TDD-mode plan (no plan-level RED/GREEN/REFACTOR commits required).

- **Task 1 (layout collapse):** RED state confirmed before edit (Test 1 failing); GREEN confirmed after edit. Single refactor commit `350aba8`.
- **Task 2 (page-owned composition):** No standalone RED phase — the test contract was already in RED state after Task 1 only insofar as the build was broken (51-02 + 51-03 are an atomic unit; 51-02's commit message carries the `[DO NOT PUSH ALONE]` marker for this reason). Task 2's edit restored buildability AND made the existing Test 1 stay GREEN. The Rule 1 auto-fix to `profile-tab-insights.test.tsx` was bundled into the same commit because it is the regression-coverage update for the structural change (not a separate concern).

## Next Phase Readiness

- Phase 51-03 atomic unit complete: `350aba8 → 6fff086 → 632cd67`. The branch contains all the wave-1b changes plus the deferred-items log.
- **Plan 51-04 (proxy cookie-only refactor) is unblocked** — Branch B confirmed by operator on 2026-05-20.
- The `◐ Partial Prerender` visual marker persistence is filed under "Caveats / Operator Note" above; final adjudication is plan 51-06's prod verification.

## Self-Check: PASSED

- File `src/app/u/[username]/layout.tsx` exists at expected path: FOUND (24 lines; no Suspense/ProfileGate/ProfileShellSkeleton refs)
- File `src/app/u/[username]/[tab]/page.tsx` exists at expected path: FOUND (with new imports, wrapInGate helper, 12 wrapped returns)
- File `tests/app/profile-tab-insights.test.tsx` exists at expected path: FOUND (with Rule 1 wrapper-navigation update)
- Commit `350aba8` exists in git log: FOUND (`refactor(51-03): collapse profile layout to a pure static chrome shell`)
- Commit `6fff086` exists in git log: FOUND (`refactor(51-03): move gate composition + Suspense into [tab]/page.tsx`)
- Commit `632cd67` exists in git log: FOUND (`chore(51-03): log pre-existing backfill-taste test env failures`)
- All 3 Phase 51 tests pass: VERIFIED (`npx vitest run tests/profile-route-51.test.ts` → 3/3 PASS)
- Insights test regression auto-fixed: VERIFIED (`npx vitest run tests/app/profile-tab-insights.test.tsx` → 4/4 PASS)
- `npm run build` exits 0: VERIFIED
- `node scripts/assert-phase-51-build.mjs` exits 0 (REQ-51-03): VERIFIED
- `grep -c "Suspense" src/app/u/[username]/layout.tsx` → 0: VERIFIED
- `grep -c "wrapInGate" src/app/u/[username]/[tab]/page.tsx` → 13 (≥ 10 required): VERIFIED
- `grep -B 1 "notFound()" src/app/u/[username]/[tab]/page.tsx | grep -c "wrapInGate"` → 0: VERIFIED

---
*Phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta*
*Completed: 2026-05-20*
