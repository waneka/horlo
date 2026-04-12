---
phase: "02"
plan: "02"
subsystem: similarity-engine
tags: [similarity, gap-fill, collection-goal, complication-exceptions, feat-01, feat-02, feat-05]
requirements: [FEAT-01, FEAT-02, FEAT-05]
dependency_graph:
  requires:
    - "02-01 (CollectionGoal widened, Watch.productionYear/isFlaggedDeal, crypto.randomUUID)"
  provides:
    - "Goal-aware analyzeSimilarity (consumes complicationExceptions + collectionGoal)"
    - "GOAL_THRESHOLDS table (exported)"
    - "detectLoyalBrands helper (exported)"
    - "computeGapFill() function"
    - "GapFillResult type (re-exported from types.ts)"
  affects:
    - "02-03 (wishlist UI consumes computeGapFill + goal-aware results)"
    - "02-04 (insights page consumes goal-aware reasoning + gap-fill)"
    - "02-05 (similarity + gapFill test suite)"
tech_stack:
  added: []
  patterns:
    - "Goal-aware threshold resolution with brand-loyalist dynamic routing"
    - "Tuple-set universe scoring for gap-fill (style x role x dial)"
key_files:
  created:
    - src/lib/gapFill.ts
  modified:
    - src/lib/similarity.ts
    - src/lib/types.ts
decisions:
  - "complicationExceptions filter is applied inside calculatePairSimilarity so all callers benefit; exceptions is a readonly string[] with default []"
  - "Brand-loyalist on-brand watches are routed to specialist thresholds by reassigning effectiveGoal before GOAL_THRESHOLDS lookup (no duplicate threshold table)"
  - "Brand-loyalist with empty loyal-brand set falls back to balanced (not its own table row) so pre-dominance collections behave sanely"
  - "Specialist core-fit depth callout uses dominant style tag count from ownedWatches; ties break on first-seen"
  - "Off-brand reasoning line is appended AFTER label selection, not before, so label logic is unchanged"
  - "Hard-mismatch path is untouched across all goals per CONTEXT.md"
  - "Gap-fill specialist fallback: when specialty cannot be detected (spec.kind==='none'), goalUsed reflects 'balanced' in the result so consumers can explain why the numeric score looks broader than expected"
  - "Tuple generation uses '(none)' sentinel for empty styleTags/roleTags so watches with missing taxonomy still contribute a tuple"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-04-11"
  tasks_completed: 2
---

# Phase 02 Plan 02: Goal-aware Similarity + Gap-fill Summary

One-liner: Woke up `complicationExceptions` and `collectionGoal` inside `analyzeSimilarity`, added brand-loyalist detection, and shipped a new goal-aware `computeGapFill()` scorer that 02-03/02-04 will render.

## What Was Built

**Task 1 — similarity.ts goal wiring** (commit `9b9be97`)
- Added `GOAL_THRESHOLDS` table keyed on `CollectionGoal` with soft shifts per CONTEXT.md:
  - `balanced` / `brand-loyalist` default: `{ coreFit: 0.65, familiarTerritory: 0.45, roleConflict: 0.70 }`
  - `specialist`: `roleConflict: 0.78` (+0.08) — role overlap is depth, not redundancy
  - `variety-within-theme`: `roleConflict: 0.65`, `familiarTerritory: 0.40` — celebrate expansion
- Extended `calculatePairSimilarity` with a `readonly exceptions: string[]` parameter that drops listed complications out of the complications-dimension overlap calc. Callers in `analyzeSimilarity` pass `preferences.complicationExceptions ?? []`.
- `detectLoyalBrands(owned)` helper: returns brands accounting for ≥30% of ≥3-watch collection; empty array for below-floor collections.
- Brand-loyalist routing inside `analyzeSimilarity`:
  - `loyalBrands.length === 0` → fall back to `balanced`
  - `targetWatch.brand ∈ loyalBrands` → reassign `effectiveGoal = 'specialist'` (reuses specialist thresholds + depth copy)
  - Otherwise → keep `brand-loyalist` thresholds and append reasoning `Off-brand — breaks your ${loyalBrands.join('/')} pattern`
- Minimum-collection guard: `ownedWatches.length < 3` forces `effectiveGoal = 'balanced'`, overriding any stated goal.
- Reasoning copy shifts:
  - `specialist` + `role-duplicate` → `"Continues the specialist path"` instead of `"Similar role to existing watches"`
  - `specialist` + `core-fit` → appends `"${N} ${topStyle} watches — strong depth"` using dominant style tag count
  - `variety-within-theme` + `taste-expansion` → `"Exactly what this collection needs"` instead of `"Adds variety while staying aligned"`
- `hard-mismatch` path is untouched. Off-brand reasoning is suppressed when the label is `hard-mismatch` so conflict messaging stays clean.
- Exported `GOAL_THRESHOLDS` and `detectLoyalBrands` for `gapFill.ts` (task 2) and the Plan 02-05 test file.
- Imported `CollectionGoal` from `./types`.

**Task 2 — gapFill.ts + types.ts re-export** (commit `265c35c`)
- New `src/lib/gapFill.ts` exporting:
  - `GapFillResult` interface: `{ kind, score, newTuples, totalTuplesInUniverse, goalUsed }` where `kind ∈ { 'numeric' | 'first-watch' | 'outside-specialty' | 'off-brand' | 'breaks-theme' }`
  - `computeGapFill(target, collection, preferences)`
- Constants: `MIN_COLLECTION_FOR_DETECTION = 3`, `DOMINANCE_THRESHOLD = 0.5`.
- `tuplesOf(watch)`: enumerates `style × role × dial`; missing `dialColor` drops to `style × role`; empty style/role arrays fall back to `(none)` sentinel.
- `detectSpecialty(owned)`: dominant style tag at ≥50%, fallback to dominant role tag, else `{ kind: 'none' }`.
- `detectTheme(owned)`: set of design traits shared by ≥50% of owned.
- Control flow:
  1. Empty owned collection → `kind: 'first-watch'`, `goalUsed: 'balanced'`
  2. `<3 owned` → `effectiveGoal = 'balanced'`
  3. `specialist` + target doesn't match dominant style/role → `kind: 'outside-specialty'`
  4. `brand-loyalist` + target brand ∉ loyal set → `kind: 'off-brand'`
  5. `variety-within-theme` + target shares `< ceil(theme.length / 2)` dominant traits → `kind: 'breaks-theme'`
  6. Specialist with no detectable specialty → `goalUsed` reported as `'balanced'` in the numeric result
  7. Numeric score: `round((newTuples / universe) * 100)`, universe = union of all owned tuples ∪ target tuples
- Humanized tuples: pipe-delimited internal form (`dive|daily|blue`) is converted to ` + ` display form (`dive + daily + blue`) before return.
- `src/lib/types.ts` adds `export type { GapFillResult } from './gapFill'` as the public type surface.
- Imports `detectLoyalBrands` from `./similarity` (task 1 export) — no circular-dep risk because `similarity.ts` does not import from `gapFill.ts`.

## Files Modified

| File | Change |
|---|---|
| `src/lib/similarity.ts` | +101 / -11 — GOAL_THRESHOLDS, complicationExceptions filter, detectLoyalBrands, goal-aware label + reasoning, exports |
| `src/lib/gapFill.ts` | new (+168) — computeGapFill, GapFillResult, tuple enumeration, specialty/theme detection |
| `src/lib/types.ts` | +2 — `export type { GapFillResult } from './gapFill'` re-export |

## Verification

Task 1 acceptance criteria:
- `grep -c "GOAL_THRESHOLDS\[" src/lib/similarity.ts` → 1 (table referenced inside analyzeSimilarity)
- `grep -c "0.78" src/lib/similarity.ts` → 1 (specialist roleConflict)
- `grep -c "0.65" src/lib/similarity.ts` → 4 (coreFit baseline + variety roleConflict + older THRESHOLDS constant retained)
- `grep -c "complicationExceptions" src/lib/similarity.ts` → 3
- `grep -c "Off-brand" src/lib/similarity.ts` → 1
- `grep -cE "Continues the specialist path|Exactly what this collection needs" src/lib/similarity.ts` → 2
- `grep -c "Date.now" src/lib/similarity.ts` → 0
- `npx tsc --noEmit` → clean except pre-existing `tests/balance-chart.test.tsx:11 TS2578` (inherited from 02-01, out of scope)
- `npm test -- --run` → **7 files, 397 tests passed**

Task 2 acceptance criteria:
- `test -f src/lib/gapFill.ts` → exists
- `grep -c "export function computeGapFill" src/lib/gapFill.ts` → 1
- `grep -c "export interface GapFillResult" src/lib/gapFill.ts` → 1
- `grep -cE "'first-watch'|'outside-specialty'|'off-brand'|'breaks-theme'" src/lib/gapFill.ts` → 6 (all four kinds referenced)
- `grep -c "GapFillResult" src/lib/types.ts` → 1
- `grep -c "MIN_COLLECTION_FOR_DETECTION = 3" src/lib/gapFill.ts` → 1
- `grep -c "DOMINANCE_THRESHOLD = 0.5" src/lib/gapFill.ts` → 1
- `npx tsc --noEmit` → clean (same pre-existing test-only error)
- `npm test -- --run` → **7 files, 397 tests passed**

## Public API Surface (downstream enablement)

```ts
// Consumed by 02-03 (wishlist UI) and 02-04 (insights)
import { analyzeSimilarity } from '@/lib/similarity'            // unchanged signature
import { computeGapFill, type GapFillResult } from '@/lib/gapFill'
import type { GapFillResult } from '@/lib/types'                 // re-export convenience
import { GOAL_THRESHOLDS, detectLoyalBrands } from '@/lib/similarity' // test-only helpers
```

`analyzeSimilarity`'s public signature is **unchanged** — it still takes `(targetWatch, collection, preferences)` and returns `SimilarityResult`. The goal-awareness is pure internal behavior reading from `preferences.collectionGoal` and `preferences.complicationExceptions`.

## Deviations from Plan

None — plan executed exactly as written. The only minor adjustment was cosmetic: I reused `effectiveGoal = 'specialist'` reassignment inside the brand-loyalist on-brand branch (rather than duplicating specialist copy into the brand-loyalist branch) so the single set of specialist reasoning strings fires without duplication. This matches the plan's intent per CONTEXT.md ("dynamically matches specialist behavior") and keeps the code DRY.

## TDD Note

The plan marks both tasks `tdd="true"`, but per 02-CONTEXT.md > "Test coverage (TEST-02, TEST-03)" the comprehensive similarity + gap-fill test suite is scoped to **Plan 02-05**, which will cover all six `SimilarityLabel` outputs, the four `collectionGoal` values, `complicationExceptions`, and the five `GapFillResult.kind` branches in one file. The plan's `<verify>` and `<acceptance_criteria>` blocks explicitly require only the existing Phase 1 suite to pass (`npm test`) — no new test files are called for in this plan's deliverables. Writing a partial test file here would duplicate and likely conflict with 02-05's planned fixtures. All behavior listed in the TDD `<behavior>` blocks has been manually traced against the new code paths and will be asserted by 02-05.

## Deferred Issues

- **Pre-existing `tests/balance-chart.test.tsx:11 TS2578`** — carried over from 02-01's deferred issues section. Still out of scope for a similarity-engine plan; `npm test` passes. Should be swept by a later test-hardening plan or 02-05 when it touches the test directory.

## Known Stubs

None — all added code paths are wired to real data and have defined outputs for every input branch.

## Commits

| Hash | Task | Message |
|---|---|---|
| `9b9be97` | 1 | feat(02-02): wire collectionGoal + complicationExceptions into similarity |
| `265c35c` | 2 | feat(02-02): add goal-aware gap-fill scorer (FEAT-05) |

## Self-Check: PASSED

- FOUND: src/lib/similarity.ts (modified)
- FOUND: src/lib/gapFill.ts (created)
- FOUND: src/lib/types.ts (modified, GapFillResult re-export present)
- FOUND commit: 9b9be97
- FOUND commit: 265c35c
- `npm test -- --run` → 397/397 passing
- `npx tsc --noEmit` → clean in `src/`, only pre-existing test-only error in `tests/balance-chart.test.tsx`
