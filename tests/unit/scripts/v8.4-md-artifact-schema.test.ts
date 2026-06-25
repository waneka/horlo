// Wave 0 RED stub — Phase 78 / 78-01-PLAN.md
//
// Unit parser test for .planning/v8.4-brand-merge-decisions.md. Asserts that
// the dry-run script's output conforms to the locked GFM-table schema
// (D-78-01): columns `brand_raw | normalized | proposed_target_id | status |
// candidates / notes`, one row per distinct lower(trim(brand)) value, no
// embedded-pipe leaks in cells.
//
// No DATABASE_URL gate — this is a pure parser test that reads a fixture
// .md or the produced artifact path.
//
// Plan 03 (Wave 2) will green these it.todo entries by parsing the artifact
// with a GFM-table tokenizer and asserting cell counts + header literal.

import { describe, it, expect } from 'vitest'

describe('Phase 78 — v8.4-brand-merge-decisions.md GFM artifact schema (parser)', () => {
  it('Wave 0 stub registers in vitest discovery', () => {
    expect(true).toBe(true)
  })

  it.todo('output .md has GFM table header `| brand_raw | normalized | proposed_target_id | status | candidates / notes |` per D-78-01')
  it.todo('row count equals distinct lower(trim(watches_catalog.brand)) values')
  it.todo('every row has exactly 5 cells (no embedded pipes leaking into cells) per D-78-01')
})
