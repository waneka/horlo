---
phase: 71
plan: "01"
subsystem: test-infrastructure
tags:
  - static-guards
  - dead-code-cleanup
  - vitest-environment-node
  - prebuild
dependency_graph:
  requires: []
  provides:
    - CLNP-02 static guard (AddWatchFlow no-verdict-step)
    - CLNP-03 static guard (add-flow no-CollectionFitCard)
    - Vercel prebuild gate covering all tests/static/ guards
  affects:
    - tests/static/AddWatchFlow.no-verdict-step.test.ts
    - tests/static/AddWatchFlow.no-collection-fit-card.test.ts
    - package.json scripts.prebuild
tech_stack:
  added: []
  patterns:
    - "@vitest-environment node directive on fs-walking static guards"
    - "existsSync vacuous-pass inside each it() block"
    - "imports-only regex: /from ['\"](.*\\/)?ComponentName['\"]/  and /from ['\"].*ComponentName['\"]//"
    - "per-file loop over hardcoded ADD_FLOW_FILES array for multi-file enforcement"
key_files:
  created:
    - tests/static/AddWatchFlow.no-verdict-step.test.ts
    - tests/static/AddWatchFlow.no-collection-fit-card.test.ts
  modified:
    - package.json
decisions:
  - "D-02 (binding): imports-only regex pattern mirroring CollectionFitCard.no-engine.test.ts precedent"
  - "D-04 (binding): hardcoded 8-file ADD_FLOW_FILES array for CLNP-03 — stable post-Phase-70"
  - "D-05 (binding): guards ship in Plan 71-01 before deletes land in Plan 71-02"
  - "prebuild extended to vitest run tests/static/ (directory) — ensures all static guards run on Vercel build, not just npm test"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-29"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
  tests_added: 11
---

# Phase 71 Plan 01: Static Guards (CLNP-02 + CLNP-03) Summary

**One-liner:** Two `@vitest-environment node` static guards enforce no-verdict-step and no-CollectionFitCard invariants across the add-flow tree, with Vercel prebuild wired to the full `tests/static/` directory.

## What Shipped

### Task 1 — CLNP-02 guard (d458b0aa)

`tests/static/AddWatchFlow.no-verdict-step.test.ts` — 3 `it()` cases asserting `AddWatchFlow.tsx` does not import `VerdictStep`, `WishlistRationalePanel`, or `PasteSection`. Uses imports-only regex `/from ['"](?:.*\/)?ComponentName['"]/` that ignores JSDoc/comment prose (D-02). Passes vacuously today: AddWatchFlow.tsx exists but has zero imports of the three dead components post-Phase-70 (only JSDoc prose at lines 35-36, 52 mentions them — not import statements). Guards fire when Plan 71-02's deletes land.

### Task 2 — CLNP-03 guard (18994b48)

`tests/static/AddWatchFlow.no-collection-fit-card.test.ts` — 8 `it()` cases, one per file in the hardcoded `ADD_FLOW_FILES` const (D-04). Each case asserts the file does not import `CollectionFitCard` from any path. Per-file loop generates named test cases (`src/components/watch/ConfirmStep.tsx does not import CollectionFitCard`) for clear failure attribution. All 8 files confirmed clean today.

### Task 3 — Prebuild extension (323d7e2c)

`package.json` `scripts.prebuild` changed from `vitest run tests/static/legacy-watch-routes.test.ts` to `vitest run tests/static/`. The previous single-file prebuild dated to Phase 59's initial guard; subsequent guards (CollectionFitCard.no-engine, ppr-dynamic-before-use-cache, followed-owners-module-rsc, and now the two Phase 71 guards) ran via `npm test` only. The extension ensures every present and future static guard blocks the Vercel deploy.

## Test Run Output

```
npm run prebuild → vitest run tests/static/

Test Files  17 passed (17)
     Tests  458 passed (458)
  Duration  2.48s
```

Both new guards visible:
- AddWatchFlow.no-verdict-step.test.ts (3 tests) GREEN
- AddWatchFlow.no-collection-fit-card.test.ts (8 tests) GREEN

## Prebuild Diff

```diff
- "prebuild": "vitest run tests/static/legacy-watch-routes.test.ts",
+ "prebuild": "vitest run tests/static/",
```

## Forward Coordination

**Plan 71-02** will:
- Delete `VerdictStep.tsx`, `WishlistRationalePanel.tsx`, `PasteSection.tsx`, `RecentlyEvaluatedRail.tsx` and their test files (CLNP-01 + CLNP-04)
- Prune `flowTypes.ts` lines 66-93 (`RailEntry`, `PendingTarget`)
- Sweep 10 `rail`/`setRail`/`railRef` call sites from `AddWatchFlow.tsx`
- **Reword `AddWatchFlow.tsx` top JSDoc (D-03)** to name `tests/static/AddWatchFlow.no-verdict-step.test.ts` as the enforcement mechanism (replaces dead-component name list at lines 35-36, 52)
- Verify `npm run build` exits 0 (build gate per memory `project_baseline_not_green_build_is_gate.md`)

The CLNP-02 guard tolerates the current JSDoc prose at lines 35-36/52 (imports-only regex skips comment text), so Plan 71-02's JSDoc reword is cosmetic from the guard's perspective but important for maintainer clarity.

## Deviations from Plan

None — plan executed exactly as written. Both guards matched the PATTERNS.md verbatim templates. File structure order (directive → comment block → JSDoc → imports → describe) matches `legacy-watch-routes.test.ts` precedent.

## Known Stubs

None. This plan is test+config only; zero source code in `src/` was touched.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. Pure test infrastructure addition.

## Self-Check

- [x] `tests/static/AddWatchFlow.no-verdict-step.test.ts` exists — FOUND
- [x] `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` exists — FOUND
- [x] `package.json` prebuild = `vitest run tests/static/` — VERIFIED
- [x] Commit d458b0aa exists — FOUND
- [x] Commit 18994b48 exists — FOUND
- [x] Commit 323d7e2c exists — FOUND
- [x] `head -1` on both new guards outputs `// @vitest-environment node` — VERIFIED
- [x] `npm run prebuild` exits 0 (458/458 tests) — VERIFIED

## Self-Check: PASSED
