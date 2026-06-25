// Phase 79 / 79-02-PLAN.md — GREEN (brand cases) / RED (family cases stay todo
// for Plan 03).
//
// Unit test for D-79-01 strict pre-flight gate (`strictPreflightGate`).
// Before --apply --mode=both issues any SQL write, the gate verifies the brand
// AND family decisions files are fully resolved AND match the live catalog
// state. Refuse cases:
//   (a) row with status='needs-review'
//   (b) row with unknown status token (per D-78-02 grammar)
//   (c) merge:<uuid> pointing at non-existent brands.id
//   (d) merge:<uuid> pointing at non-existent watch_families.id   [Plan 03]
//   (e) live catalog brand absent from decisions file (drift)
//   (f) live catalog (brand, model) absent from family decisions file [Plan 03]
// Pass case:
//   all rows terminal + all merge UUIDs valid + no drift → returns void.
//
// No DATABASE_URL gate — strictPreflightGate accepts an injected existence
// check fn AND a sql tag stub, so the test stays fixture-only. Plan 02
// implements the brand-only scope; Plan 03 extends with the family map.

import { describe, it, expect, vi } from 'vitest'
import {
  strictPreflightGate,
  type BrandDecisionRow,
} from '../../../scripts/v8.4-brand-canonicalization'

// Minimal sql-tag stub: returns the rows the test pre-arranges via mockResolvedValue.
// The strictPreflightGate brand-side issues exactly ONE sql tag call (the live
// catalog SELECT DISTINCT). The merge-uuid existence check is injected via the
// fn parameter, so it doesn't reach the sql stub.
function makeSqlStub(catalogBrandNorms: string[]) {
  return vi.fn().mockResolvedValue(
    catalogBrandNorms.map((bn) => ({ brand_normalized: bn })),
  ) as unknown as Parameters<typeof strictPreflightGate>[0]
}

describe('Phase 79 — v8.4 strict pre-flight gate (D-79-01)', () => {
  it('Wave 0 RED stub loads', () => {
    expect(true).toBe(true)
  })

  it('D-79-01: refuses on row with status=needs-review', async () => {
    const rows: BrandDecisionRow[] = [
      {
        brand_raw: 'Tissot',
        brand_normalized: 'tissot',
        proposed_target_id: null,
        status: 'needs-review',
      },
    ]
    const sql = makeSqlStub(['tissot'])
    const existingIdsFn = async () => new Set<string>()
    await expect(strictPreflightGate(sql, rows, existingIdsFn)).rejects.toThrow(
      /needs-review/i,
    )
  })

  it('D-79-01: refuses on row with unknown status token (per D-78-02 grammar)', async () => {
    const rows: BrandDecisionRow[] = [
      {
        brand_raw: 'Tissot',
        brand_normalized: 'tissot',
        proposed_target_id: null,
        status: 'maybe-later',
      },
    ]
    const sql = makeSqlStub(['tissot'])
    const existingIdsFn = async () => new Set<string>()
    await expect(strictPreflightGate(sql, rows, existingIdsFn)).rejects.toThrow(
      /unresolved status|unknown.*status|maybe-later/i,
    )
  })

  it(
    'D-79-01: refuses on merge:<uuid> target not found in brands table (injected existence check returns empty)',
    async () => {
      const rows: BrandDecisionRow[] = [
        {
          brand_raw: 'Hamilton',
          brand_normalized: 'hamilton',
          proposed_target_id: '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc',
          status: 'auto-resolved',
        },
        {
          brand_raw: 'Hamilton Watch',
          brand_normalized: 'hamilton watch',
          proposed_target_id: '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc',
          status: 'merge:20969364-f3b1-4b1d-ab2f-e5d22e9ffabc',
        },
      ]
      const sql = makeSqlStub(['hamilton', 'hamilton watch'])
      const existingIdsFn = async () => new Set<string>() // brand id NOT in DB
      await expect(strictPreflightGate(sql, rows, existingIdsFn)).rejects.toThrow(
        /merge.*not found/i,
      )
    },
  )

  it.todo('D-79-01: refuses on merge:<uuid> target not found in watch_families table')

  it('D-79-01: refuses on live catalog brand absent from decisions file', async () => {
    const rows: BrandDecisionRow[] = [
      {
        brand_raw: 'Rolex',
        brand_normalized: 'rolex',
        proposed_target_id: 'd9b79abe-bdc2-43de-b4ff-e58cd8a1e39f',
        status: 'auto-resolved',
      },
    ]
    // Catalog has BOTH 'rolex' (decided) and 'omega' (NOT in decisions) → drift.
    const sql = makeSqlStub(['rolex', 'omega'])
    const existingIdsFn = async () => new Set<string>()
    await expect(strictPreflightGate(sql, rows, existingIdsFn)).rejects.toThrow(
      /catalog has brand/i,
    )
  })

  it.todo(
    'D-79-01: refuses on live (brand, model) triple absent from family decisions file (MIG-03 + DISP-03 coverage)',
  )

  it('D-79-01 PASS (brand-only): all rows terminal + merge UUIDs valid + no drift → resolves to void', async () => {
    const rows: BrandDecisionRow[] = [
      {
        brand_raw: 'Hamilton',
        brand_normalized: 'hamilton',
        proposed_target_id: '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc',
        status: 'auto-resolved',
      },
      {
        brand_raw: 'Hamilton Watch',
        brand_normalized: 'hamilton watch',
        proposed_target_id: '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc',
        status: 'merge:20969364-f3b1-4b1d-ab2f-e5d22e9ffabc',
      },
      {
        brand_raw: 'Brut',
        brand_normalized: 'brut',
        proposed_target_id: null,
        status: 'new',
      },
    ]
    const sql = makeSqlStub(['hamilton', 'hamilton watch', 'brut'])
    const existingIdsFn = async (uuids: string[]) => new Set(uuids) // merge target exists
    await expect(strictPreflightGate(sql, rows, existingIdsFn)).resolves.toBeUndefined()
  })
})
