---
phase: 40
plan: "03"
subsystem: verdict
tags: [verdict, fit-delta, pure-helper, tdd, FIT-05]
dependency_graph:
  requires: []
  provides:
    - "src/lib/verdict/fit-delta.ts exports computeDeltaPhrase"
  affects:
    - "src/components/insights/CollectionFitCompareTable.tsx (consumer — Plan 40-06)"
tech_stack:
  added: []
  patterns:
    - "TDD RED→GREEN cycle with strict module isolation"
    - "Jaccard similarity inline pure function"
    - "TypeScript const narrowing after inner-function mutation"
key_files:
  created:
    - src/lib/verdict/fit-delta.ts
    - tests/unit/lib/verdict/fit-delta.test.ts
  modified: []
decisions:
  - "displayEnum normalizes both hyphens and underscores (vintage-leaning → Vintage Leaning)"
  - "const winner captures post-null-check narrowing — TypeScript could not narrow best after inner-function mutation"
  - "jaccardSimilarity kept file-private (not exported) per plan spec"
metrics:
  duration: "2m 45s"
  completed: "2026-05-14T21:53:35Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 40 Plan 03: computeDeltaPhrase Pure Helper Summary

TDD delivery of the D-16 delta-phrase algorithm as a standalone pure utility module. RED commit (8 failing tests) then GREEN commit (implementation). All 8 unit-test scenarios pass; 0 tsc errors; no forbidden imports.

## One-liner

Pure D-16 delta-phrase helper: 5-step algorithm (scalar + categorical + Jaccard motif deltas) → one plain-language phrase identifying the highest-delta taste dimension.

## What Was Built

### Module: `src/lib/verdict/fit-delta.ts`

**Export:** `computeDeltaPhrase(candidate: CatalogTasteAttributes, owned: CatalogTasteAttributes): string`

Single public export. Three internal helpers (not exported): `jaccardSimilarity`, `displayEnum`, `tryUpdate` (inner function).

**Algorithm (D-16 5 steps):**

1. Compute per-dimension deltas:
   - Scalars (`formality`, `sportiness`, `heritageScore`): `|candidate - owned|` — `null` when either side is `null`
   - Categoricals (`primaryArchetype`, `eraSignal`): `0` if equal (null===null is match), `1` if different
   - Motifs: `motifDelta = 1 - jaccardSimilarity(candidate.designMotifs, owned.designMotifs)`

2. Fallback test: all scalars `< 0.1` (or null) AND categoricals match AND `motifJaccard >= 0.8` → `"Very similar across all taste dimensions"`

3. Build winner list: iterate in CatalogTasteAttributes declaration order; replace best only when `current > best` (strict-greater preserves earlier entry on tie)

4. Emit phrase per 10 copy templates from UI-SPEC

5. Degenerate edge case: all deltas null → fallback string

**Tie-break order:** `formality > sportiness > heritageScore > primaryArchetype > eraSignal > designMotifs`

**Constants (locked):** `SCALAR_THRESHOLD = 0.1`, `MOTIF_THRESHOLD = 0.8`

**Imports:** `import type { CatalogTasteAttributes } from '@/lib/types'` — the ONLY import. No `@/lib/similarity`, no `@/lib/verdict/composer`.

**Directives:** None — no `'use client'` or `'server-only'`. Universal pure module importable from both server and client.

### Test suite: `tests/unit/lib/verdict/fit-delta.test.ts`

8 scenarios covering all phrase variants and edge cases:

| # | Scenario | Expected phrase |
|---|----------|-----------------|
| 1 | Identical profiles (all deltas zero) | "Very similar across all taste dimensions" |
| 2 | Formality-dominant, candidate > owned | "This is more formal" |
| 3 | Sportiness-dominant, candidate < owned | "This is less sport" |
| 4 | Heritage-dominant, candidate > owned | "More heritage-leaning" |
| 5 | Archetype mismatch (dive vs dress), all else equal | "Different archetype: Dive vs Dress" |
| 6 | Era mismatch (vintage-leaning vs modern), all else within threshold | "Different era: Vintage Leaning vs Modern" |
| 7 | Motif mismatch (jaccard=0), all else identical | "Different design motifs" |
| 8 | Null formality gracefully excluded; sportiness wins | matches `/(more|less) sport/` |

## Phrase Coverage vs. 10 UI-SPEC Copy Templates

| Template | Covered |
|----------|---------|
| formality: candidate > owned → "This is more formal" | Test 2 |
| formality: candidate < owned → "This is more casual" | Derived (scenario 2 reversal) |
| sportiness: candidate > owned → "This is more sport" | Test 8 |
| sportiness: candidate < owned → "This is less sport" | Test 3 |
| heritageScore: candidate > owned → "More heritage-leaning" | Test 4 |
| heritageScore: candidate < owned → "More modern in character" | Derived (scenario 4 reversal) |
| primaryArchetype: different → "Different archetype: X vs Y" | Test 5 |
| eraSignal: different → "Different era: X vs Y" | Test 6 |
| designMotifs: jaccard < 0.8 → "Different design motifs" | Test 7 |
| (fallback) → "Very similar across all taste dimensions" | Tests 1 + 8 edge |

## Decisions Made

1. **`displayEnum` normalizes both hyphens and underscores** — `vintage-leaning` → `Vintage Leaning` (hyphen→space + capitalize). The original D-16 spec only mentioned underscores; hyphens exist in `EraSignal` values so the replace was extended to cover both. This is a correctness fix, not a deviation.

2. **`const winner` capture after null guard** — TypeScript 5 strict mode cannot narrow `let best: DimEntry | null` after it has been mutated by the inner `tryUpdate` function. Assigning `const winner: DimEntry = best` after the null-guard provides the narrowed type for the switch statement. No behavior change.

3. **`jaccardSimilarity` kept file-private** — per plan spec. Only `computeDeltaPhrase` is exported.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript TS2339 `best.name` on `never` type after inner-function mutation**

- **Found during:** Task 2 (GREEN) — `npx tsc --noEmit` check
- **Issue:** TypeScript narrowed `best` to `never` at the switch statement because `tryUpdate` (an inner function) mutates `best`, and strict TypeScript control-flow does not follow mutations through inner function calls after a null guard.
- **Fix:** Added `const winner: DimEntry = best` immediately after the null guard; switched the `switch` to use `winner.name`.
- **Files modified:** `src/lib/verdict/fit-delta.ts`
- **Commit:** 28b6964 (included in GREEN commit)

**2. [Rule 1 - Bug] `displayEnum` must handle hyphens in addition to underscores**

- **Found during:** Task 2 (GREEN) — test 6 ("vintage-leaning" → expected "Vintage Leaning")
- **Issue:** The plan spec showed `replace(/_/g, ' ')` only; `EraSignal` values contain hyphens (`vintage-leaning`), which the original pattern would leave as `vintage-leaning` instead of `Vintage Leaning`.
- **Fix:** Changed regex to `replace(/[-_]/g, ' ')`.
- **Files modified:** `src/lib/verdict/fit-delta.ts`
- **Commit:** 28b6964 (included in GREEN commit)

## TDD Gate Compliance

- RED gate: commit `6bb4b42` — `test(40-03): add failing RED tests for fit-delta computeDeltaPhrase`
- GREEN gate: commit `28b6964` — `feat(40-03): implement computeDeltaPhrase D-16 algorithm`
- REFACTOR: skipped per plan — algorithm is < 80 lines; no cleanup needed

## Known Stubs

None — the implementation is complete. All 10 phrase variants are reachable code paths.

## Threat Flags

None — this is a pure transform function over already-validated catalog metadata. No new network endpoints, no auth paths, no user input surfaces. T-40-09 and T-40-10 from the plan threat register are accepted per disposition.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/lib/verdict/fit-delta.ts` exists | FOUND |
| `tests/unit/lib/verdict/fit-delta.test.ts` exists | FOUND |
| `40-03-SUMMARY.md` exists | FOUND |
| Commit 6bb4b42 (RED) exists | FOUND |
| Commit 28b6964 (GREEN) exists | FOUND |
