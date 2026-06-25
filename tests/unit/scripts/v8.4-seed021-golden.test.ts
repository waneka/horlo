// Wave 0 RED stub — Phase 78 / 78-01-PLAN.md
//
// Golden test for SEED-021 canonicalization conflict cases. With a fixture
// catalog containing the four bug-surface brand strings, the dry-run output
// MUST land them in the correct status per D-78-04 (exact-only auto-resolve)
// and B-78-01 (Omega/OMEGA both normalize to `omega` → case-collapse to a
// single canonical brands row, status=auto-resolved):
//
//   - Hamilton vs Hamilton Watch  → status=needs-review (D-78-04)
//   - Héron vs Héron Watches      → status=needs-review (D-78-04)
//   - Brut Date vs Brut Datejust  → status=needs-review (D-78-04)
//   - Omega vs OMEGA              → status=auto-resolved (D-78-04 + B-78-01)
//
// The candidates / notes cell on every needs-review row carries the top 3
// pg_trgm candidates above similarity 0.5 in `name (0.XX)` format (D-78-03).
//
// No DATABASE_URL gate — this is a fixture-based golden test.
//
// Plan 03 (Wave 2) will green these it.todo entries by feeding the SEED-021
// fixture catalog through the script's core function (pure transform) and
// asserting against the produced row literals.

import { describe, it, expect } from 'vitest'

describe('Phase 78 — SEED-021 four-case golden (D-78-04 + B-78-01)', () => {
  it('Wave 0 stub registers in vitest discovery', () => {
    expect(true).toBe(true)
  })

  it.todo('Hamilton vs Hamilton Watch lands status=needs-review per D-78-04')
  it.todo('Héron vs Héron Watches lands status=needs-review per D-78-04')
  it.todo('Brut Date vs Brut Datejust lands status=needs-review per D-78-04')
  it.todo('Omega/OMEGA both land status=auto-resolved with the SAME proposed_target_id per D-78-04 + B-78-01 (case-collapse to single canonical brands row)')
  it.todo('candidates / notes cell carries top 3 fuzzy candidates with score format `name (0.XX)` per D-78-03')
})
