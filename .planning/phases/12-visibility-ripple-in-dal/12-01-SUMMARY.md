---
phase: 12
plan: "01"
subsystem: test-infrastructure
tags: [privacy, visibility, tdd, red-state, integration-tests]
dependency_graph:
  requires: [phase-11-schema]
  provides: [phase12-test-matrix, getWearRailForViewer-unit-assertions, getFeedForUser-unit-assertions]
  affects: []
tech_stack:
  added: []
  patterns: [privacy-first-UAT-rule, test-before-touch, env-gated-integration-tests]
key_files:
  created:
    - tests/integration/phase12-visibility-matrix.test.ts
  modified:
    - tests/data/getWearRailForViewer.test.ts
    - tests/data/getFeedForUser.test.ts
decisions:
  - "Unit 10/11 in getWearRailForViewer use column-name-walking instead of JSON.stringify to handle Drizzle circular refs"
  - "getFeedForUser select projection test passes immediately (select never projected wornPublic); WHERE and metadata-gate tests fail as intended"
  - "wishlist action cells left as .skip with TODO for Plan 04 auth-context wiring"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-22"
  tasks: 3
  files: 3
requirements:
  - WYWT-10
  - WYWT-11
---

# Phase 12 Plan 01: Visibility Matrix Test Scaffold Summary

Phase 12 Plan 01 authored the privacy-first integration test matrix and modified two existing unit test files to assert the new SQL shape — all committed in red state before any DAL function is touched.

## What Was Built

Three test files authored/modified:

1. **`tests/integration/phase12-visibility-matrix.test.ts`** — New 330-line integration matrix covering 3 visibility tiers × 3 viewer relationships × 4 surfaces (profile worn tab, WYWT rail, feed, wishlist action). 15+ `it()` cells, env-gated on `DATABASE_URL`.

2. **`tests/data/getWearRailForViewer.test.ts`** — Added Unit 9-11 asserting the new SQL shape: leftJoin presence, no `worn_public` in WHERE, no `wornPublic` in SELECT projection.

3. **`tests/data/getFeedForUser.test.ts`** — Added 3 "Phase 12" tests asserting: no `worn_public` in WHERE, `metadata->>'visibility'` gate present, no `wornPublic` in SELECT.

## Test Cells Authored (Matrix File)

| Cell | Pitfall Covered | Red Reason |
|------|-----------------|------------|
| G-5 baseline: owner sees own private wear | G-5 self-bypass preserved | `getWearEventsForViewer` doesn't exist yet |
| Stranger CANNOT see followers wear (V-2) | G-3 inverted follow check | Same |
| Stranger CANNOT see private wear | Basic privacy gate | Same |
| Follower CANNOT see other actor private wear | Private tier isolation | Same |
| G-4 outer gate: profile_public=false blocks public wear | G-4 outer gate | Same |
| G-3 directional: Of viewing V doesn't see V's followers wear | G-3 direction | Same |
| Follower CAN see followers wear | Positive case | Same |
| Stranger CAN see public wear (profile_public=true) | Positive case | Same |
| WYWT rail: follower sees followers wear | Rail privacy | Current code uses wornPublic, not visibility |
| WYWT rail: stranger doesn't see followers wear | Rail stranger gate | Same |
| WYWT rail: follower sees public wear | Rail positive | Same |
| WYWT rail: G-4 outer gate excludes private-profile actor | Rail G-4 | Same |
| WYWT rail: owner sees own followers wear (G-5 self-bypass) | Rail self-include | Same |
| Feed: Op public + Of followers visible; Or private excluded | D-09 metadata gate | Current code uses wornPublic, not metadata.visibility |
| Feed D-09 fail-closed: legacy no-visibility row invisible | D-09 fail-closed | Same |
| Feed F-05 own-filter preserved | F-05 regression | Same |
| WYWT-11: worn_public column dropped (final cell) | WYWT-11 | Column still exists until Plan 06 |

## Red State Confirmation

All commits are in red state:

- **`tests/integration/phase12-visibility-matrix.test.ts`** — Imports `getWearEventsForViewer` which does not exist in `src/data/wearEvents.ts`. When `DATABASE_URL` is set: 11 of 17 cells fail (DAL function missing + current wornPublic gate behavior). The import itself is the structural red-state guarantee. Commit: `2bf8848`

- **`tests/data/getWearRailForViewer.test.ts`** — Unit 9 fails (no leftJoin in current code), Unit 10 fails (worn_public still in WHERE), Unit 11 fails (wornPublic still in select projection). 3 of 3 new tests fail. Existing 8 tests pass. Commit: `bf959f4`

- **`tests/data/getFeedForUser.test.ts`** — Phase 12 WHERE test fails (worn_public still in WHERE clause), Phase 12 metadata gate test fails (no visibility reference yet). 2 of 3 new tests fail. The select projection test passes correctly since getFeedForUser never projected wornPublic in SELECT. Existing 9 tests pass. Commit: `8d31fad`

## Privacy-First Ordering Verified

`git log -- tests/integration/phase12-visibility-matrix.test.ts src/data/wearEvents.ts` confirms: matrix test commit (`2bf8848`) precedes any `src/data/wearEvents.ts` modification. No DAL function was touched in this plan.

## Deviations from Plan

**1. [Rule 1 - Bug] Drizzle circular reference in JSON.stringify**
- **Found during:** Task 2 (Unit 10/11) and Task 3
- **Issue:** `JSON.stringify(drizzleColumnArgs)` throws `TypeError: Converting circular structure to JSON` because Drizzle column objects reference their parent table
- **Fix:** Replaced `JSON.stringify` with a `WeakSet`-based tree-walking function that collects SQL column `.name` values and checks projection object keys directly
- **Files modified:** `tests/data/getWearRailForViewer.test.ts`, `tests/data/getFeedForUser.test.ts`
- **Commits:** `bf959f4`, `8d31fad`

## What Plan 02 Must Do

Plan 02 will turn the matrix file green by:
1. Renaming `getPublicWearEventsForViewer` → `getWearEventsForViewer` with three-tier predicate
2. Rewriting `getWearRailForViewer` WHERE to use `visibility` column + leftJoin on `follows`
3. Removing `profileSettings.wornPublic` from all WHERE clauses and SELECT projections

## Known Stubs

None — this plan only creates test files, no production code.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `tests/integration/phase12-visibility-matrix.test.ts` exists | FOUND |
| `tests/data/getWearRailForViewer.test.ts` exists | FOUND |
| `tests/data/getFeedForUser.test.ts` exists | FOUND |
| Commit 2bf8848 exists | FOUND |
| Commit bf959f4 exists | FOUND |
| Commit 8d31fad exists | FOUND |
