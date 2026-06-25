// Phase 79 / 79-01-PLAN.md — Wave 0 RED stub.
//
// Unit test for the in-memory brand-decision-map → family-row generation
// pipeline (D-79-07) plus alias idempotency (D-79-06). Asserts that:
//   - Hamilton + Hamilton Watch raws collapse to ONE family row per
//     (canonical_brand_id, model) tuple BEFORE the operator opens the file
//     (D-79-07).
//   - 'merge:<uuid>' on the brand side does NOT leak duplicate family rows
//     into the family file (D-79-07).
//   - 'new' brand placeholders propagate their synthetic_key as the family
//     row's scope key so the operator can still resolve by name (D-79-07).
//   - buildFamilyTableRows applied twice on the same merge: decision produces
//     identical output (no duplicate alias in emission — D-79-06 idempotency).
//   - Brut Date → Brut Datejust merge routes the source model_raw into the
//     canonical family row's alias column (D-79-06 + MIG-03; fixture-only,
//     no live DB needed).
//
// No DATABASE_URL gate — pure-function in/out with fixture inputs. The Plan
// 02/03 exports land behind the commented imports below; flip the comments
// when the exports ship.

import { describe, it, expect } from 'vitest'
// TODO Plan 02: uncomment when buildBrandMap + BrandDecisionMap export lands.
// import { buildBrandMap, type BrandDecisionMap } from '../../../scripts/v8.4-brand-canonicalization'
// TODO Plan 03: uncomment when buildFamilyTableRows + FamilyRow + FamilyDecisionMap export lands.
// import {
//   buildFamilyTableRows,
//   type FamilyRow,
//   type FamilyDecisionMap,
// } from '../../../scripts/v8.4-brand-canonicalization'

describe('Phase 79 — v8.4 family-build-decisions (D-79-07 + D-79-06)', () => {
  it('Wave 0 RED stub loads', () => {
    expect(true).toBe(true)
  })

  it.todo(
    'D-79-07: Hamilton + Hamilton Watch raws collapse to ONE canonical brand id in the in-memory map BEFORE family rows are emitted (no DB write)',
  )
  it.todo(
    'D-79-07: merge:<uuid> brand decision does NOT leak duplicate family rows for the merged-source brand',
  )
  it.todo(
    'D-79-07: new brand placeholder synthetic_key propagates as the family row scope key so operator can still resolve the family row by name',
  )
  it.todo(
    'D-79-06: alias idempotent — buildFamilyTableRows applied twice on the same merge: decision produces the same emitted row (no duplicate alias in the output)',
  )
  it.todo(
    "D-79-06 + MIG-03: Brut Date → Brut Datejust merge decision routes the source model_raw into the canonical family row's alias column (fixture-only; no live DB needed)",
  )
})
