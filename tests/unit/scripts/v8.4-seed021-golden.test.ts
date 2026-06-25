// Phase 78 / 78-03-PLAN.md — GREEN.
//
// Golden test for SEED-021 canonicalization conflict cases. Feeds the
// SEED-021 fixture catalog through the script's pure buildTableRows function
// and asserts the four bug-surface brand strings land in the correct status
// per D-78-04 (exact-only auto-resolve) and B-78-01 (Omega/OMEGA case-collapse).
//
//   - Hamilton Watch  → status=needs-review  (D-78-04: brands has Hamilton,
//                                              not Hamilton Watch; no exact
//                                              match on name_normalized.)
//   - Héron Watches   → status=needs-review  (D-78-04: simulated as needs-review
//                                              in fixture; in local seed Héron
//                                              Watches IS exact-matched but the
//                                              fixture isolates the unit case
//                                              where the operator-queue case
//                                              would surface it.)
//   - Brut Date       → status=needs-review  (D-78-04: brands has Brut Datejust,
//                                              not Brut Date; no exact match.)
//   - Omega + OMEGA   → BOTH status=auto-resolved with the SAME
//                       proposed_target_id (D-78-04 + B-78-01: both raw
//                       strings normalize to `omega` via lower(trim()) and
//                       exact-match the single canonical brands.name_normalized
//                       row. The case-mismatch surfaces via /admin/brands
//                       (Phase 82), NOT via the operator-resolve queue.)
//
// The candidates / notes cell on each needs-review row carries top 3 fuzzy
// candidates above 0.5 in `name (0.XX)` format per D-78-03.
//
// No DATABASE_URL gate — this is a fixture-based golden test.

import { describe, it, expect } from 'vitest'
import {
  buildTableRows,
  type BrandRow,
  type Candidate,
} from '../../../scripts/v8.4-brand-canonicalization'

describe('Phase 78 — SEED-021 four-case golden (D-78-04 + B-78-01)', () => {
  // Fixture brands table (simulated):
  //   - canonical Hamilton (uuid-hamilton)
  //   - canonical Omega (uuid-omega)
  //   - canonical Brut Datejust (uuid-brut)
  //   - canonical Héron Watches NOT in brands → needs-review (isolated unit case)
  //
  // Omega + OMEGA: D-78-04 + B-78-01 — both raw catalog strings normalize to
  // `omega` via lower(trim()) and exact-match the SAME canonical brands row,
  // so both auto-resolve to that row. The case-mismatch is surfaced via the
  // /admin/brands view (Phase 82), NOT via the operator-resolve queue.
  const fixtureRows: BrandRow[] = [
    {
      brand_raw: 'Hamilton',
      brand_normalized: 'hamilton',
      proposed_target_id: 'uuid-hamilton',
    },
    {
      brand_raw: 'Hamilton Watch',
      brand_normalized: 'hamilton watch',
      proposed_target_id: null,
    },
    {
      brand_raw: 'Omega',
      brand_normalized: 'omega',
      proposed_target_id: 'uuid-omega',
    },
    {
      brand_raw: 'OMEGA',
      brand_normalized: 'omega',
      proposed_target_id: 'uuid-omega',
    },
    {
      brand_raw: 'Héron Watches',
      brand_normalized: 'héron watches',
      proposed_target_id: null,
    },
    {
      brand_raw: 'Brut Date',
      brand_normalized: 'brut date',
      proposed_target_id: null,
    },
    {
      brand_raw: 'Brut Datejust',
      brand_normalized: 'brut datejust',
      proposed_target_id: 'uuid-brut',
    },
  ]

  function rowsByBrandRaw(lines: string[]): Map<string, string[]> {
    const byBrandRaw = new Map<string, string[]>()
    const dataLines = lines.slice(2) // skip header + separator
    for (const line of dataLines) {
      const cells = line.split('|').map((c) => c.trim())
      // cells = ['', brand_raw, normalized, proposed_target_id, status, notes, '']
      const brandRaw = cells[1]
      if (!byBrandRaw.has(brandRaw)) byBrandRaw.set(brandRaw, [])
      byBrandRaw.get(brandRaw)!.push(line)
    }
    return byBrandRaw
  }

  function cellsForFirstLine(
    byBrandRaw: Map<string, string[]>,
    brandRaw: string,
  ): string[] {
    const lines = byBrandRaw.get(brandRaw)
    expect(lines, `expected at least one row for ${brandRaw}`).toBeTruthy()
    return lines![0].split('|').map((c) => c.trim())
  }

  it('Test 1 — Hamilton Watch lands status=needs-review per D-78-04', () => {
    const lines = buildTableRows(fixtureRows, new Map())
    const byBrandRaw = rowsByBrandRaw(lines)
    const cells = cellsForFirstLine(byBrandRaw, 'Hamilton Watch')
    expect(cells[4]).toBe('needs-review')
    expect(cells[3]).toBe('') // proposed_target_id empty for needs-review
  })

  it('Test 2 — Héron Watches lands status=needs-review per D-78-04', () => {
    const lines = buildTableRows(fixtureRows, new Map())
    const byBrandRaw = rowsByBrandRaw(lines)
    const cells = cellsForFirstLine(byBrandRaw, 'Héron Watches')
    expect(cells[4]).toBe('needs-review')
  })

  it('Test 3 — Brut Date lands status=needs-review per D-78-04', () => {
    const lines = buildTableRows(fixtureRows, new Map())
    const byBrandRaw = rowsByBrandRaw(lines)
    const cells = cellsForFirstLine(byBrandRaw, 'Brut Date')
    expect(cells[4]).toBe('needs-review')
  })

  it('Test 4 — candidates / notes cell carries top 3 fuzzy candidates with `name (0.XX)` format per D-78-03', () => {
    const candidatesByNormalized = new Map<string, Candidate[]>([
      [
        'hamilton watch',
        [
          { name: 'hamilton', score: 0.85 },
          { name: 'hamilton-khaki', score: 0.62 },
        ],
      ],
    ])
    const lines = buildTableRows(fixtureRows, candidatesByNormalized)
    const byBrandRaw = rowsByBrandRaw(lines)
    const cells = cellsForFirstLine(byBrandRaw, 'Hamilton Watch')
    // cells[5] is the notes cell
    expect(cells[5]).toBe('hamilton (0.85), hamilton-khaki (0.62)')
  })

  it('Test 5 — Omega/OMEGA case-collapse: BOTH rows land status=auto-resolved with the SAME proposed_target_id per D-78-04 + B-78-01', () => {
    const lines = buildTableRows(fixtureRows, new Map())
    const byBrandRaw = rowsByBrandRaw(lines)
    // Both raw variants should be emitted; both should auto-resolve to the
    // same canonical brands row.
    const omegaCells = cellsForFirstLine(byBrandRaw, 'Omega')
    const OMEGACells = cellsForFirstLine(byBrandRaw, 'OMEGA')

    // status equality across both rows: both auto-resolved
    expect(omegaCells[4]).toBe('auto-resolved')
    expect(OMEGACells[4]).toBe('auto-resolved')

    // proposed_target_id equality across both rows: same canonical brands row
    expect(omegaCells[3]).toBe('uuid-omega')
    expect(OMEGACells[3]).toBe('uuid-omega')
    expect(omegaCells[3]).toBe(OMEGACells[3])
  })

  it('Test 6 — auto-resolved rows do NOT receive fuzzy candidates (D-78-03: only needs-review carries notes)', () => {
    // Candidates only computed for unresolved rows in main(); buildTableRows
    // accepts a Map and only emits notes for entries present in the map.
    // Auto-resolved rows have no map entry → notes cell is empty.
    const lines = buildTableRows(fixtureRows, new Map())
    const byBrandRaw = rowsByBrandRaw(lines)
    const hamiltonCells = cellsForFirstLine(byBrandRaw, 'Hamilton')
    expect(hamiltonCells[5]).toBe('') // notes empty for auto-resolved
  })

  it('Test 7 — every emitted status cell is one of D-78-02 script-emitted values', () => {
    const lines = buildTableRows(fixtureRows, new Map())
    const byBrandRaw = rowsByBrandRaw(lines)
    const valid = new Set(['auto-resolved', 'needs-review'])
    for (const [_, rows] of byBrandRaw) {
      for (const row of rows) {
        const cells = row.split('|').map((c) => c.trim())
        expect(valid.has(cells[4])).toBe(true)
      }
    }
  })
})
