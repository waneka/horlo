// Wave 0 RED stub — Phase 78 / 78-01-PLAN.md
//
// Unit test for the --regenerate merge-forward behavior (D-78-07). When
// .planning/v8.4-brand-merge-decisions.md already exists, the default run
// MUST exit non-zero. The --regenerate flag MUST merge: preserve any row
// whose status is non-needs-review (merge:<uuid>, new, skip) verbatim,
// overwrite needs-review rows with fresh proposals, and append brand_raw
// rows new since the last run at the bottom. --force overwrites
// unconditionally regardless of existing content.
//
// No DATABASE_URL gate — this test writes temp .md fixtures and exercises
// the merge transform directly (pure function).
//
// Plan 03 (Wave 2) will green these it.todo entries by exposing the merge
// transform as a testable function in scripts/v8.4-brand-canonicalization.ts.

import { describe, it, expect } from 'vitest'

describe('Phase 78 — v8.4-brand-canonicalization --regenerate merge-forward (D-78-07)', () => {
  it('Wave 0 stub registers in vitest discovery', () => {
    expect(true).toBe(true)
  })

  it.todo('default run with existing .md exits non-zero per D-78-07')
  it.todo('--regenerate preserves rows whose status is merge:<uuid> verbatim per D-78-07')
  it.todo('--regenerate preserves rows whose status is `new` verbatim per D-78-07')
  it.todo('--regenerate preserves rows whose status is `skip` verbatim per D-78-07')
  it.todo('--regenerate overwrites rows whose status is `needs-review` with fresh proposals per D-78-07')
  it.todo('--regenerate appends fresh brand_raw rows not in prior .md at the bottom per D-78-07')
  it.todo('--force overwrites unconditionally regardless of existing rows per D-78-07')
})
