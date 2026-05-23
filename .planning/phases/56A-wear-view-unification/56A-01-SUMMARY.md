---
phase: 56A-wear-view-unification
plan: "01"
subsystem: data-layer + test-scaffolds
status: complete
tags: [dal, tdd, wave-0, test-scaffold, visibility-gate]
dependency_graph:
  requires: []
  provides: [getActiveWearsForUser, wave-0-test-scaffolds]
  affects: [src/data/wearEvents.ts, tests/data/getActiveWearsForUser.test.ts, tests/components/wear/WearCard.test.tsx, tests/integration/phase56a-wears-lane.test.ts, tests/e2e/wears-lane.test.ts]
tech_stack:
  added: []
  patterns: [mocked-drizzle-unit-test, three-tier-visibility-gate, asc-ordering, wave-0-red-scaffold]
key_files:
  created:
    - tests/data/getActiveWearsForUser.test.ts
    - tests/components/wear/WearCard.test.tsx
    - tests/integration/phase56a-wears-lane.test.ts
    - tests/e2e/wears-lane.test.ts
  modified:
    - src/data/wearEvents.ts
decisions:
  - "getActiveWearsForUser self-bypass branch (G-5): skips profileSettings JOIN entirely — viewer===actorId branch has 2 innerJoins (profiles + watches only)"
  - "Wave 0 RED scaffolds use concrete assertions that fail until the target plan lands, annotated with EXPECTED RED comments naming the responsible plan"
  - "Integration scaffold (phase56a-wears-lane.test.ts) uses fs.existsSync for route existence check rather than dynamic import which would fail at module-not-found"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  files_modified: 5
---

# Phase 56A Plan 01: DAL Foundation + Wave 0 Test Scaffolds Summary

**One-liner:** `getActiveWearsForUser` DAL with 48h window, oldest-first ordering, and three-tier visibility gate, plus four Wave 0 test files (one green DAL test + three RED scaffolds) covering all SC-1..SC-5, D-07, D-09, F-2 criteria.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add getActiveWearsForUser DAL read (TDD: RED → GREEN) | f224721 | src/data/wearEvents.ts, tests/data/getActiveWearsForUser.test.ts |
| 2 | Author Wave 0 test scaffolds (1 green + 3 RED) | f6c40b0 | tests/components/wear/WearCard.test.tsx, tests/integration/phase56a-wears-lane.test.ts, tests/e2e/wears-lane.test.ts |

## What Was Built

### Task 1: getActiveWearsForUser (GREEN)

Added `asc` to the drizzle-orm import at line 5 of `src/data/wearEvents.ts` (was missing per PATTERNS.md verification).

Implemented `getActiveWearsForUser(viewerId, actorId)` as a new exported async function at the end of the file. Key design points:

- **48h cutoff**: identical calculation to `getWearRailForViewer` — `Date.now() - 48*60*60*1000` sliced to `YYYY-MM-DD`
- **Self-bypass (G-5)**: when `viewerId === actorId`, returns all wears in the window with only 2 innerJoins (profiles + watches) — profileSettings is intentionally omitted on this branch
- **Non-self branch**: single follow-row lookup → `viewerFollowsActor` boolean → visibility predicate composed as `public-only` or `public-OR-followers` → 3 innerJoins (profileSettings + profiles + watches) with G-4 `profilePublic=true` gate
- **Raw photoUrl**: `wearEvents.photoUrl` returned as-is — no `createSignedUrl`, no `'use cache'` directive (Pitfall F-2)
- **Oldest-first (D-05)**: `orderBy(asc(wearEvents.wornDate), asc(wearEvents.createdAt))` on both branches

TDD flow: RED test written first (7 tests, all failing), GREEN implementation written second, all 7 tests pass.

### Task 2: Wave 0 Test Scaffolds

**`tests/data/getActiveWearsForUser.test.ts`** (GREEN — 7 tests):
- Mocked-drizzle unit tests mirroring PART A structure from `getWearRailForViewer.test.ts`
- Asserts: 2-arg orderBy (D-05), at least 1 where() call (D-04), self-bypass = 1 select + 2 joins, non-self = 2 selects + 3 joins, raw photoUrl passthrough (F-2), empty array on no rows (D-07 precondition)

**`tests/components/wear/WearCard.test.tsx`** (EXPECTED RED until Plan 02):
- SC-4: imports `@/components/wear/WearCard` and asserts it's a function (single shared source)
- D-09: `showAddToWishlist={false}` → "Add to wishlist" not in rendered output; `showAddToWishlist={true}` → present

**`tests/integration/phase56a-wears-lane.test.ts`** (EXPECTED RED until Plans 03/05):
- D-07: asserts `/app/wears/[username]/page` exports a default function (route exists)
- SC-1: asserts `WywtRail` is exported + route file exists via `fs.existsSync`
- SC-5: asserts `WywtOverlay` module no longer exists (currently RED — overlay still present)

**`tests/e2e/wears-lane.test.ts`** (EXPECTED RED until Plans 03/04/05):
- SC-1: tile click → URL matches `/wears/`
- SC-2: `/wears/[username]` has no `nav[aria-label="Primary"]`
- SC-3: `/wear/[id]` has nav and is vertically scrollable

## Verification Results

- `npm run test -- getActiveWearsForUser`: 7/7 PASS
- `npm run test` (full suite): 216 file pass, 2 expected RED Wave 0 scaffolds, 1 pre-existing failure (`tests/app/watch-page-verdict.test.ts` — ECONNREFUSED:5432, DB offline, out-of-scope)

## Deviations from Plan

None — plan executed exactly as written.

The `tests/app/watch-page-verdict.test.ts` failures (4 tests) are pre-existing DB-connectivity failures (ECONNREFUSED port 5432, local Postgres offline). They exist on the commit before this plan started and are outside the scope of this plan.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes in this plan. `getActiveWearsForUser` is server-only (file has `import 'server-only'` at line 1) and the three-tier gate mirrors the established `getWearEventsForViewer` pattern. T-56A-01 (IDOR) and T-56A-02 (signed-URL caching) are both mitigated — confirmed by acceptance greps and DAL test assertions.

## Known Stubs

None in the files created/modified by this plan. The Wave 0 RED scaffold comment placeholders ("EXPECTED RED until Plan 0X") are intentional gates, not stubs.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/data/wearEvents.ts | FOUND |
| tests/data/getActiveWearsForUser.test.ts | FOUND |
| tests/components/wear/WearCard.test.tsx | FOUND |
| tests/integration/phase56a-wears-lane.test.ts | FOUND |
| tests/e2e/wears-lane.test.ts | FOUND |
| Commit f224721 (Task 1) | FOUND |
| Commit f6c40b0 (Task 2) | FOUND |
