// Phase 79 / 79-03-PLAN.md — GREEN.
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
// Pass cases:
//   brand-only — all brand rows terminal + merge UUIDs valid + no drift → void
//   combined   — brand + family rows all terminal + UUIDs valid + no drift → void
//
// No DATABASE_URL gate — strictPreflightGate accepts injected existence-check
// fns AND a sql tag stub, so the test stays fixture-only. Plan 02 implemented
// the brand-only scope; Plan 03 extends with the family map.

import { describe, it, expect, vi } from 'vitest'
import {
  strictPreflightGate,
  type BrandDecisionRow,
  type FamilyDecisionRow,
} from '../../../scripts/v8.4-brand-canonicalization'

// Minimal sql-tag stub: returns the rows the test pre-arranges via mockResolvedValue.
// strictPreflightGate calls sql exactly TWICE when family rows are present:
//   1. live brand DISTINCT (returns Array<{brand_normalized}>)
//   2. live (brand, model) DISTINCT (returns Array<{brand_normalized, model_normalized}>)
// Brand-only callsites issue only call #1.
function makeSqlStub(
  catalogBrandNorms: string[],
  catalogTriples: Array<{ brand: string; model: string }> = [],
) {
  let call = 0
  return vi.fn(async () => {
    call++
    if (call === 1) {
      return catalogBrandNorms.map((bn) => ({ brand_normalized: bn }))
    }
    return catalogTriples.map((t) => ({
      brand_normalized: t.brand,
      model_normalized: t.model,
    }))
  }) as unknown as Parameters<typeof strictPreflightGate>[0]
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

  it('D-79-01: refuses on merge:<uuid> family target not found in watch_families table', async () => {
    const brandRows: BrandDecisionRow[] = [
      {
        brand_raw: 'Brut',
        brand_normalized: 'brut',
        proposed_target_id: '11111111-1111-1111-1111-111111111111',
        status: 'auto-resolved',
      },
    ]
    const familyRows: FamilyDecisionRow[] = [
      {
        brand_raw: 'Brut',
        family_raw: 'Brut Date',
        family_normalized: 'brut date',
        proposed_target_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        status: 'merge:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        candidates: [],
      },
    ]
    const sql = makeSqlStub(
      ['brut'],
      [{ brand: 'brut', model: 'brut date' }],
    )
    const existingBrandIdsFn = async (uuids: string[]) => new Set(uuids)
    const existingFamilyIdsFn = async () => new Set<string>() // family id NOT in DB
    await expect(
      strictPreflightGate(
        sql,
        brandRows,
        existingBrandIdsFn,
        familyRows,
        existingFamilyIdsFn,
      ),
    ).rejects.toThrow(/family.*merge.*not found/i)
  })

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

  it('D-79-01: refuses on live (brand, model) triple absent from family decisions file (MIG-03 + DISP-03 coverage)', async () => {
    const brandRows: BrandDecisionRow[] = [
      {
        brand_raw: 'Hamilton',
        brand_normalized: 'hamilton',
        proposed_target_id: '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc',
        status: 'auto-resolved',
      },
    ]
    const familyRows: FamilyDecisionRow[] = [
      {
        brand_raw: 'Hamilton',
        family_raw: 'Khaki Field',
        family_normalized: 'khaki field',
        proposed_target_id: 'ffffffff-1111-2222-3333-444444444444',
        status: 'auto-resolved',
        candidates: [],
      },
    ]
    // Catalog has Hamilton brand decided + Khaki Field family decided, but ALSO
    // a Hamilton Jazzmaster catalog row that is NOT in family decisions → drift.
    const sql = makeSqlStub(
      ['hamilton'],
      [
        { brand: 'hamilton', model: 'khaki field' },
        { brand: 'hamilton', model: 'jazzmaster' },
      ],
    )
    const existingBrandIdsFn = async (uuids: string[]) => new Set(uuids)
    const existingFamilyIdsFn = async (uuids: string[]) => new Set(uuids)
    await expect(
      strictPreflightGate(
        sql,
        brandRows,
        existingBrandIdsFn,
        familyRows,
        existingFamilyIdsFn,
      ),
    ).rejects.toThrow(/catalog has.*\(brand, model\)|family/i)
  })

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

  it('D-79-01 PASS (combined brand + family): all rows terminal + UUIDs valid + no drift → resolves to void', async () => {
    const brandRows: BrandDecisionRow[] = [
      {
        brand_raw: 'Hamilton',
        brand_normalized: 'hamilton',
        proposed_target_id: '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc',
        status: 'auto-resolved',
      },
      {
        brand_raw: 'Brut',
        brand_normalized: 'brut',
        proposed_target_id: null,
        status: 'new',
      },
    ]
    const familyRows: FamilyDecisionRow[] = [
      {
        brand_raw: 'Hamilton',
        family_raw: 'Khaki Field',
        family_normalized: 'khaki field',
        proposed_target_id: 'ffffffff-1111-2222-3333-444444444444',
        status: 'auto-resolved',
        candidates: [],
      },
      {
        brand_raw: 'Brut',
        family_raw: 'Brut Date',
        family_normalized: 'brut date',
        proposed_target_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        status: 'merge:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        candidates: [],
      },
    ]
    const sql = makeSqlStub(
      ['hamilton', 'brut'],
      [
        { brand: 'hamilton', model: 'khaki field' },
        { brand: 'brut', model: 'brut date' },
      ],
    )
    const existingBrandIdsFn = async (uuids: string[]) => new Set(uuids)
    const existingFamilyIdsFn = async (uuids: string[]) => new Set(uuids)
    await expect(
      strictPreflightGate(
        sql,
        brandRows,
        existingBrandIdsFn,
        familyRows,
        existingFamilyIdsFn,
      ),
    ).resolves.toBeUndefined()
  })
})
