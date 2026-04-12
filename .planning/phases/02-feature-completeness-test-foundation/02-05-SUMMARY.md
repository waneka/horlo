---
doc_type: plan-summary
phase: "02"
plan: "05"
subsystem: test-foundation
tags: [testing, vitest, msw, fixtures, similarity, gap-fill, extractors]
status: complete
completed: 2026-04-11
requirements: [TEST-01, TEST-02, TEST-03]
dependency_graph:
  requires:
    - 02-01 (Watch type extended with CollectionGoal, productionYear, isFlaggedDeal; generateId → crypto.randomUUID)
    - 02-02 (goal-aware analyzeSimilarity, detectLoyalBrands, computeGapFill + GapFillResult)
  provides:
    - tests/fixtures/watches.ts (shared test factory + scenarios)
    - regression safety net for similarity + gap-fill + extractor pipeline
  affects:
    - package.json (+msw devDep)
    - package-lock.json
tech_stack:
  added:
    - msw ^2.13.2 (devDependency only; scaffolded, not wired)
  patterns:
    - Pure-function AAA tests with deterministic fixture factory
    - fileURLToPath(import.meta.url) for __dirname in ESM test files
    - Fixture HTML under tests/fixtures/pages/ read via fs.readFileSync
key_files:
  created:
    - tests/fixtures/watches.ts
    - tests/fixtures/pages/structured-jsonld.html
    - tests/fixtures/pages/html-only.html
    - tests/fixtures/pages/partial.html
    - tests/similarity.test.ts
    - tests/gapFill.test.ts
    - tests/extractors/structured.test.ts
    - tests/extractors/html.test.ts
    - tests/extractors/index.test.ts
  modified:
    - package.json
    - package-lock.json
key_decisions:
  - "MSW installed but unused in Phase 2 (per CONTEXT.md) — scaffold for Phase 6 route-handler integration tests"
  - "Soft `.toContain([...])` assertions on boundary-similarity labels to avoid brittleness under threshold tuning, while hard-mismatch and empty-collection paths use exact equality"
  - "Extractor test fixtures are hand-authored HTML, not recorded pages — keeps the suite hermetic and diffable"
  - "useLlmFallback:false on all extractor integration tests so the suite stays offline and independent of ANTHROPIC_API_KEY"
metrics:
  duration: "~10 minutes"
  tasks_completed: 3
  files_created: 9
  files_modified: 2
  tests_added: 30  # 12 similarity + 9 gapFill + 3 structured + 3 html + 3 index
  total_suite: 427
---

# Phase 02 Plan 05: Test Foundation Summary

One-liner: Test scaffolding for goal-aware similarity, gap-fill, and the 3-stage extractor pipeline using a reusable watch fixture factory and hand-authored HTML fixtures, plus MSW in devDependencies for Phase 6.

## What Shipped

### Task 1 — MSW devDep + watch fixture factory
- Ran `npm install --save-dev msw@^2` (resolved to 2.13.2). MSW is NOT imported anywhere; the install is pure scaffolding per CONTEXT.md's explicit "install now, wire in Phase 6" decision.
- Created `tests/fixtures/watches.ts` as the single source of truth for Watch/UserPreferences test data. Exports:
  - `makeWatch(overrides)` — partial-override factory with deterministic `test-N` ids (stable across runs, no `crypto.randomUUID`).
  - `emptyPreferences` — all-defaults UserPreferences.
  - `preferencesWithGoal(goal)` — quick helper for goal-specific tests.
  - `fixtures.empty / oneWatch / threeSameStyle / threeSameBrand / fiveMixed` — the five scenarios CONTEXT.md's TEST-02 list calls out. `threeSameStyle` is dive-dominant (triggers specialist specialty detection); `threeSameBrand` is all-Rolex (triggers brand-loyalist detection); `fiveMixed` has no dominance (balanced fallback).
- Commits: `f376b37` (fixtures + node_modules install), `95a772e` (package.json devDep re-added after a parallel wave-3 worktree overwrote it), `93b9cb5` (package-lock.json top-level devDep sync).

### Task 2 — similarity.test.ts + gapFill.test.ts (TEST-02)
- `tests/similarity.test.ts` (12 tests) covers:
  - **Empty collection** → exact `core-fit` label + `/first watch/i` reasoning.
  - **All six SimilarityLabel values** asserted across the scenarios (`core-fit`, `familiar-territory`, `role-duplicate`, `taste-expansion`, `outlier`, `hard-mismatch`). Boundary cases use `.toContain([...])` against an acceptable label set so the suite stays green through future threshold tuning; `hard-mismatch` and the empty-collection path use strict equality.
  - **All four collectionGoal values** (`balanced`, `specialist`, `variety-within-theme`, `brand-loyalist`) exercised — each gets its own describe block.
  - **Brand-loyalist routing** — off-brand target asserts both `/off-brand/i` and `/Rolex/` appear in the reasoning array; on-brand target asserts the off-brand line is absent.
  - **Specialist depth reasoning** — when specialist flags role-duplicate, reasoning must include "specialist path" or "depth".
  - **variety-within-theme** — when label is `taste-expansion`, reasoning must include "exactly what".
  - **complicationExceptions (FEAT-01)** — compares `analyzeSimilarity` output with and without `complicationExceptions: ['chronograph']` on a chrono-heavy scenario; asserts `withException.score <= withoutException.score` (filtering the exception from the overlap calc lowers the aggregate avg similarity).
- `tests/gapFill.test.ts` (9 tests) covers **all five GapFillResult kinds**:
  - `first-watch` — empty collection.
  - `numeric` + `goalUsed: 'balanced'` — specialist with <3 owned falls back to balanced.
  - `outside-specialty` — specialist + threeSameStyle + dress target.
  - `numeric` — specialist + threeSameStyle + dive target.
  - `off-brand` — brand-loyalist + threeSameBrand + Tudor target.
  - `numeric` — brand-loyalist + threeSameBrand + Rolex target.
  - `breaks-theme` — variety-within-theme + themed collection + rugged target.
  - `numeric: 0` — all tuples already owned.
  - `numeric: >0` — target introduces a novel tuple.
- Commit: `ef5f0f6`.

### Task 3 — Extractor pipeline tests (TEST-03)
- Three hand-authored fixture HTML files under `tests/fixtures/pages/`:
  - `structured-jsonld.html` — full Product JSON-LD with brand/name/sku/image/offer.
  - `html-only.html` — no JSON-LD; og tags, product divs, spec text, `<title>` with brand hint.
  - `partial.html` — conflict fixture: JSON-LD says brand=Omega, HTML div says "WRONG BRAND FROM HTML". Used to assert structured > html merge precedence.
- `tests/extractors/structured.test.ts` (3 tests) — asserts `brand='Rolex'`, `model=~/Submariner/i`, and at least one extra field populated (actually asserts reference/imageUrl/marketPrice exact values from the fixture).
- `tests/extractors/html.test.ts` (3 tests) — asserts ≥1 field populated on the html-only fixture, that brand is detected as 'Omega', and that an empty HTML input returns an object.
- `tests/extractors/index.test.ts` (3 tests) — asserts `extractWatchData(partial.html, { useLlmFallback: false }).data.brand === 'Omega'` (not "WRONG BRAND FROM HTML"), that the result has `data`/`llmUsed: false`/`fieldsExtracted`, and that the call succeeds with no LLM path and no network.
- All extractor integration tests pass `useLlmFallback: false`, keeping the suite hermetic — no `fetch` mocks needed and no dependency on `ANTHROPIC_API_KEY`.
- Commit: `b6d709d`.

## Test Results

- `npm test` — **427 passed / 0 failed** (up from 397 pre-plan). 30 new tests added across 5 new files.
- Broken down:
  - `tests/similarity.test.ts` — 12 tests
  - `tests/gapFill.test.ts` — 9 tests
  - `tests/extractors/structured.test.ts` — 3 tests
  - `tests/extractors/html.test.ts` — 3 tests
  - `tests/extractors/index.test.ts` — 3 tests

## Deviations from Plan

### Parallel-worktree merge recovery (not a code issue)
- **Found during:** Task 1 commit
- **Issue:** A parallel wave-3 executor (`02-03`) committed to main between my `npm install` and my first commit, and its commit did not preserve the msw entry in `package.json` — so when my `git add package.json package-lock.json tests/fixtures/watches.ts` ran, `package.json` was not in a modified state and only `tests/fixtures/watches.ts` made it into commit `f376b37`.
- **Fix:** Ran `npm pkg set devDependencies.msw="^2.13.2"` + `npm install` to restore both `package.json` and the lockfile's top-level devDep entry, then made two small follow-up commits (`95a772e`, `93b9cb5`) to land the msw package metadata. No functional impact — `node_modules/msw` was already installed, and the only reason the test suite touches msw at all is the `devDependencies` field (it is never imported).
- **Commits:** `95a772e`, `93b9cb5`

### Structured test extras assertion adjusted to actual `ExtractedWatchData` shape
- **Found during:** Task 3
- **Issue:** The plan's draft test referenced `data.price` and `data.description`, but `ExtractedWatchData` in `src/lib/extractors/types.ts` has no such fields — it uses `reference`, `marketPrice`, `imageUrl`, and `notes`.
- **Fix:** Changed the "extras" filter to `[data.reference, data.marketPrice, data.imageUrl]` and added stronger exact-value assertions (`reference === '126610LN'`, `marketPrice === 9550`, `imageUrl === 'https://example.com/sub.jpg'`). Keeps the intent ("at least one additional field alongside brand/model") but asserts against the real type. Documented in the plan's `<action>` note that the shape could differ.
- **Commit:** `b6d709d`

### `__dirname` for ESM test files
- **Found during:** Task 3
- **Issue:** The plan's draft tests use `__dirname` directly, which is not available in ESM (vitest runs tests as ESM under Next.js 16).
- **Fix:** Added `const __dirname = dirname(fileURLToPath(import.meta.url))` at the top of each extractor test file. Fully in-scope for Rule 3 (blocking).
- **Commit:** `b6d709d`

## Deferred Issues

None. All plan tasks completed; 427/427 tests passing.

## Pre-existing Out-of-Scope Issues Noted

- `tests/balance-chart.test.tsx` has a stale `@ts-expect-error` directive that surfaces under `npx tsc --noEmit`. NOT introduced by this plan; belongs to a prior phase's chart work. Not fixed (Rule: scope boundary) — logged here for the verifier.
- `recharts` emits `width(0)/height(0)` stderr warnings during `BalanceChart` tests. Cosmetic only; the tests themselves pass.

## Self-Check: PASSED

**Files exist:**
- `tests/fixtures/watches.ts` — FOUND
- `tests/fixtures/pages/structured-jsonld.html` — FOUND
- `tests/fixtures/pages/html-only.html` — FOUND
- `tests/fixtures/pages/partial.html` — FOUND
- `tests/similarity.test.ts` — FOUND
- `tests/gapFill.test.ts` — FOUND
- `tests/extractors/structured.test.ts` — FOUND
- `tests/extractors/html.test.ts` — FOUND
- `tests/extractors/index.test.ts` — FOUND

**Commits exist:**
- `f376b37` test(02-05): install MSW devDep + create watch fixtures module — FOUND
- `95a772e` test(02-05): add msw to package.json devDependencies — FOUND
- `93b9cb5` test(02-05): sync package-lock.json for msw devDep — FOUND
- `ef5f0f6` test(02-05): cover similarity + gapFill across labels, goals, exceptions — FOUND
- `b6d709d` test(02-05): extractor pipeline fixture tests (structured, html, merge) — FOUND

**Verification:**
- `npm test` exits 0 with 427 passed / 0 failed.
- `node -e "console.log(require('./package.json').devDependencies.msw)"` prints `^2.13.2`.
- No test file imports from `msw` (scaffold-only, as required by TEST-01).
