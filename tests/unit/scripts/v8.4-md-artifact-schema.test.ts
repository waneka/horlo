// Phase 78 / 78-03-PLAN.md — GREEN.
//
// Unit parser test for .planning/v8.4-brand-merge-decisions.md. Asserts that
// the dry-run script's emitted GFM table conforms to D-78-01:
//   columns:  brand_raw | normalized | proposed_target_id | status |
//             candidates / notes
//   one row per distinct lower(trim(brand)) value
//   no embedded-pipe leaks in cells
//
// No DATABASE_URL gate — this is a pure parser test using the exported
// pure functions from scripts/v8.4-brand-canonicalization.ts.

import { describe, it, expect } from 'vitest'
import {
  buildTableRows,
  formatCell,
  type BrandRow,
  type Candidate,
} from '../../../scripts/v8.4-brand-canonicalization'

describe('Phase 78 — v8.4-brand-merge-decisions.md GFM artifact schema (parser)', () => {
  const fixtureRows: BrandRow[] = [
    {
      brand_raw: 'Audemars Piguet',
      brand_normalized: 'audemars piguet',
      proposed_target_id: '11111111-1111-1111-1111-111111111111',
    },
    {
      brand_raw: 'Hamilton Watch',
      brand_normalized: 'hamilton watch',
      proposed_target_id: null,
    },
    {
      brand_raw: 'Omega',
      brand_normalized: 'omega',
      proposed_target_id: '22222222-2222-2222-2222-222222222222',
    },
  ]
  const fixtureCands = new Map<string, Candidate[]>([
    ['hamilton watch', [{ name: 'hamilton', score: 0.6 }]],
  ])

  it('first non-blank `|`-line is exactly the D-78-01 header row', () => {
    const lines = buildTableRows(fixtureRows, fixtureCands)
    expect(lines[0]).toBe(
      '| brand_raw | normalized | proposed_target_id | status | candidates / notes |',
    )
  })

  it('second `|`-line starts with `| ---` separator per GFM table spec', () => {
    const lines = buildTableRows(fixtureRows, fixtureCands)
    expect(lines[1].startsWith('| ---')).toBe(true)
  })

  it('every data row has exactly 6 pipe characters (5 cells + 2 boundaries) per D-78-01', () => {
    const lines = buildTableRows(fixtureRows, fixtureCands)
    // Skip header (line 0) and separator (line 1); data rows are 2..n.
    const dataRows = lines.slice(2)
    expect(dataRows.length).toBe(fixtureRows.length)
    for (const line of dataRows) {
      // GFM row "| a | b | c | d | e |" has exactly 6 `|` characters.
      const pipeCount = (line.match(/\|/g) || []).length
      expect(pipeCount).toBe(6)
    }
  })

  it('every status cell matches one of `auto-resolved | needs-review` (script never emits operator-edited values)', () => {
    const lines = buildTableRows(fixtureRows, fixtureCands)
    const dataRows = lines.slice(2)
    const validStatuses = new Set(['auto-resolved', 'needs-review'])
    for (const line of dataRows) {
      // Cells: ['', ' brand_raw ', ' normalized ', ' proposed_target_id ', ' status ', ' notes ', '']
      const cells = line.split('|').map((c) => c.trim())
      const status = cells[4]
      expect(validStatuses.has(status)).toBe(true)
    }
  })

  it('formatCell escapes embedded `|` characters to prevent table corruption (T-78-03-01)', () => {
    expect(formatCell('Brand|With|Pipe')).toBe('Brand\\|With\\|Pipe')
    expect(formatCell(null)).toBe('')
    expect(formatCell(undefined)).toBe('')
    expect(formatCell('clean')).toBe('clean')
  })
})
