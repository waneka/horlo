// Phase 79 / 79-01-PLAN.md — Wave 0 RED stub.
//
// Unit test for D-79-01 strict pre-flight gate (`strictPreflightGate`).
// Before --apply --mode=both issues any SQL write, the gate verifies the brand
// AND family decisions files are fully resolved AND match the live catalog
// state. Refuse cases:
//   (a) row with status='needs-review'
//   (b) row with unknown status token (per D-78-02 grammar)
//   (c) merge:<uuid> pointing at non-existent brands.id
//   (d) merge:<uuid> pointing at non-existent watch_families.id
//   (e) live catalog brand absent from decisions file (drift)
//   (f) live catalog (brand, model) absent from family decisions file
// Pass case:
//   all rows terminal + all merge UUIDs valid + no drift → returns
//   { brandMap, familyMap, summary } for the downstream apply.
//
// No DATABASE_URL gate — strictPreflightGate accepts an injected existence
// check fn, so the test stays fixture-only. Plan 02 introduces the export +
// the injected-fn shape; Plan 03 extends with the family map.

import { describe, it, expect } from 'vitest'
// TODO Plan 02/03: uncomment when strictPreflightGate export lands.
// import { strictPreflightGate } from '../../../scripts/v8.4-brand-canonicalization'

describe('Phase 79 — v8.4 strict pre-flight gate (D-79-01)', () => {
  it('Wave 0 RED stub loads', () => {
    expect(true).toBe(true)
  })

  it.todo('D-79-01: refuses on row with status=needs-review')
  it.todo('D-79-01: refuses on row with unknown status token (per D-78-02 grammar)')
  it.todo(
    'D-79-01: refuses on merge:<uuid> target not found in brands table (injected existence check returns empty)',
  )
  it.todo('D-79-01: refuses on merge:<uuid> target not found in watch_families table')
  it.todo('D-79-01: refuses on live catalog brand absent from decisions file')
  it.todo(
    'D-79-01: refuses on live (brand, model) triple absent from family decisions file (MIG-03 + DISP-03 coverage)',
  )
  it.todo(
    'D-79-01: passes when all rows terminal + all merge UUIDs valid + no catalog drift; returns { brandMap, familyMap, summary } (MIG-02 + MIG-03 coverage)',
  )
})
