// Wave 0 RED stub — Phase 78 / 78-01-PLAN.md
//
// Integration invariant: the dry-run NEVER writes to the database (D-78-05).
// Snapshots COUNT(*) and MAX(updated_at) for brands / watch_families /
// watches_catalog before and after running the script; the snapshots MUST
// be identical (no INSERT/UPDATE/DELETE fired).
//
// Gated on DATABASE_URL per the local-first verification idiom (analog:
// tests/integration/migration-drop-archetype.test.ts:26). Without
// DATABASE_URL the suite is described-skipped so vitest discovery still
// returns a positive signal in CI / jsdom-default runs.
//
// Plan 03 (Wave 2) will green these it.todo entries by spawning the script
// via child_process.execSync between the before/after snapshots and
// asserting equality.

import { describe, it, expect } from 'vitest'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 78 — v8.4-brand-canonicalization read-only invariant (D-78-05)', () => {
  it('Wave 0 stub registers in vitest discovery', () => {
    expect(true).toBe(true)
  })

  it.todo('SELECT count(*) FROM brands before == after running dry-run (D-78-05)')
  it.todo('SELECT count(*) FROM watch_families before == after running dry-run (D-78-05)')
  it.todo('SELECT count(*) FROM watches_catalog before == after running dry-run (D-78-05)')
  it.todo('SELECT max(updated_at) FROM brands before == after running dry-run (D-78-05: no UPDATE fired)')
})
