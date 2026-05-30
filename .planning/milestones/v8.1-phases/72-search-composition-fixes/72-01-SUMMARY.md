---
phase: 72-search-composition-fixes
plan: "01"
subsystem: database
tags: [search, dal, drizzle, multi-token, ilike, vitest]

requires: []
provides:
  - searchCatalogForAddFlow returns matching rows for multi-token queries (AND-of-ORs WHERE)
  - SRCH-01 DAL regression test suite (5 cases, including token-order invariance)
affects: [plan-02, plan-72-02]

tech-stack:
  added: []
  patterns:
    - "AND-of-ORs per whitespace-split token: tokens.map(t => or(ilike(brand,t), ilike(model,t), ilike(ref,t))) → and(...tokenClauses)"
    - "Per-token refToken normalization: token.replace(/[^a-z0-9]+/g, '') mirrors queryNormalized lane"
    - "WHERE-clause RED test: assert %token% present + fused %token1 token2% absent in safeStringify(cand.where.args)"

key-files:
  created:
    - src/data/__tests__/catalog-search-tokens.test.ts
  modified:
    - src/data/catalog.ts

key-decisions:
  - "D-01: DAL fix only — no catalog row edits in this phase"
  - "D-02: AND-of-ORs per whitespace-split token; queryNormalized lane and exactRefOrderTier preserved"
  - "D-03: tokenization is qTrimmed.toLowerCase().split(/\\s+/).filter(Boolean) + defensive tokens.length===0 guard"
  - "D-04: Drizzle parameterized binds only — pattern construction in TypeScript, never SQL-interpolated; T-67-02-01 preserved"
  - "D-11: SRCH-01 regression suite uses catalog-facets.test.ts chain-mock pattern (vi.mock('@/db') + two-chain toggle)"
  - "D-12: no new test-runner config; jsdom default; no @vitest-environment node pragma"
  - "RED gate tightened: WHERE-inspection asserts individual %brut% and %datejust% present AND fused %brut datejust% absent"

patterns-established:
  - "AND-of-ORs DAL multi-token pattern: reusable for future searchCatalogWatches parity (deferred)"
  - "WHERE-clause RED test pattern: safeStringify(cand.where.args) + assert individual token patterns present + fused absent"

requirements-completed:
  - SRCH-01

duration: 3min
completed: "2026-05-30"
---

# Phase 72 Plan 01: SRCH-01 Multi-Token DAL Search Fix Summary

**searchCatalogForAddFlow WHERE clause rewritten from single-substring OR to AND-of-ORs per whitespace-split token, enabling "Brut Datejust" and "Timex Weekender" multi-token queries to return matching rows**

## Performance

- **Duration:** ~3 min 23s
- **Started:** 2026-05-30T07:15:01Z
- **Completed:** 2026-05-30T07:18:24Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Closed SRCH-01: multi-token queries like "Brut Datejust" now return rows where brand matches "brut" AND model matches "datejust" independently
- 5-test DAL regression suite covers single-token regression, two primary failing cases (SRCH-01), token-order invariance, and whitespace guard
- T-67-02-01 SQL injection mitigation preserved; exactRefOrderTier exact-ref ORDER BY tier and popularity chain unchanged
- Build gate exit 0

## WHERE Clause Before / After

**Before (single-token, broken for multi-word):**
```ts
const pattern = `%${lowerQ}%`
.where(or(ilike(brandNormalized, pattern), ilike(modelNormalized, pattern), ...))
// "Brut Datejust" → pattern = "%brut datejust%" → no single column contains it → 0 rows
```

**After (AND-of-ORs per token, D-02):**
```ts
const tokens = qTrimmed.toLowerCase().split(/\s+/).filter(Boolean)
const tokenClauses = tokens.map((token) => {
  const colPattern = `%${token}%`
  const refToken = token.replace(/[^a-z0-9]+/g, '')
  return or(ilike(brandNormalized, colPattern), ilike(modelNormalized, colPattern), ...)
})
.where(and(...tokenClauses))
// "Brut Datejust" → AND(OR(brand ILIKE %brut%,...), OR(brand ILIKE %datejust%,...)) → matches
```

## Test Results (5/5 GREEN)

| # | Test Name | State |
|---|-----------|-------|
| T1 | single-token "Brut" returns matching row (regression guard) | PASS |
| T2 | multi-token "Brut Datejust" returns row + WHERE has separate per-token patterns (SRCH-01) | PASS |
| T3 | multi-token "Timex Weekender" returns row + WHERE has separate per-token patterns (SRCH-01) | PASS |
| T4 | token-order invariance: "Datejust Brut" returns same row as "Brut Datejust" | PASS |
| T5 | whitespace-only query returns [] without calling cand.where (early-return guard) | PASS |

## Build Gate Evidence

`npm run build` exit 0 — confirmed after Task 2 commit `c83d95bb`.

## Task Commits

1. **Task 1: Create SRCH-01 failing DAL regression tests (RED)** - `f970e425` (test)
2. **Task 2: Rewrite searchCatalogForAddFlow WHERE clause to tokenized AND-of-ORs (GREEN)** - `c83d95bb` (feat)

## Files Created/Modified

- `src/data/__tests__/catalog-search-tokens.test.ts` — New SRCH-01 regression suite (5 tests); uses catalog-facets.test.ts chain-mock pattern; safeStringify WHERE-arg inspection; VIEWER constant
- `src/data/catalog.ts` — searchCatalogForAddFlow WHERE clause rewritten to AND-of-ORs; docstring updated with D-02/D-04 tokenization notes and T-67-02-01 reaffirmation; exactRefOrderTier + ORDER BY chain + stateRows hydration untouched

## Decisions Made

- **D-01 cited:** No catalog row edits made. DAL fix alone resolves "TIMEX Weekender 38mm Fabric Strap Watch" because both tokens ("timex", "weekender") now independently match brand_normalized and model_normalized.
- **D-02 cited:** AND-of-ORs pattern; queryNormalized lane (for exactRefOrderTier ORDER BY) preserved exactly.
- **D-03 cited:** tokenization = `qTrimmed.toLowerCase().split(/\s+/).filter(Boolean)`; defensive `if (tokens.length === 0) return []` added (belt-and-suspenders).
- **D-04 cited:** Each `%${token}%` is a TypeScript string bound as a Drizzle parameter; T-67-02-01 mitigation preserved in updated docstring.
- **D-11 cited:** Regression test uses `src/data/__tests__/` co-location + catalog-facets.test.ts two-chain mock pattern.
- **D-12 cited:** No new test-runner config; jsdom default; no `@vitest-environment node` pragma.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RED test tightening: initial WHERE assertions were too permissive**
- **Found during:** Task 1 verification (after writing test, all 5 passed against broken DAL)
- **Issue:** `toContain('brut')` and `toContain('datejust')` both passed with single-token WHERE because `%brut datejust%` contains both strings as substrings. Tests were not actually RED against the broken code.
- **Fix:** Added `expect(json).toContain('%brut%')` and `expect(json).not.toContain('%brut datejust%')` — assert the per-token pattern present AND the fused multi-token pattern absent. This makes T2/T3 correctly RED against the old single-token DAL and GREEN after the fix.
- **Files modified:** `src/data/__tests__/catalog-search-tokens.test.ts`
- **Verification:** T2 and T3 confirmed RED (`expected '...' to contain '%brut%'`); all 5 GREEN after fix.
- **Committed in:** `f970e425` (Task 1 test commit, tightened before commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test precision bug discovered during RED gate verification)
**Impact on plan:** Tightening required for TDD gate integrity. No scope creep.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The WHERE clause change only affects query construction on the catalog read path; all token patterns are Drizzle-parameterized per D-04/T-72-01-01 mitigation.

## Issues Encountered

None beyond the RED gate tightening documented as a deviation above.

## Forward Signal for Plan 02

Plan 02 touches `SearchEntry.tsx` (SRCH-02 keyboard navigation + SRCH-03 footer relocation). Same wave; no coupling to this plan's DAL changes. Plan 02 extends `SearchEntry.test.tsx` with RTL + userEvent keyboard tests and a footer-click structural test.

## Self-Check

- [x] `src/data/__tests__/catalog-search-tokens.test.ts` exists and has 5 tests
- [x] `src/data/catalog.ts` contains `and(...tokenClauses)` (grep confirms ≥1)
- [x] `src/data/catalog.ts` contains T-67-02-01 (grep confirms ≥1)
- [x] `src/data/catalog.ts` contains exactRefOrderTier in ≥2 locations (definition + ORDER BY)
- [x] Commits f970e425 and c83d95bb exist in git log
- [x] Build gate exit 0 confirmed

## Self-Check: PASSED

---
*Phase: 72-search-composition-fixes*
*Completed: 2026-05-30*
