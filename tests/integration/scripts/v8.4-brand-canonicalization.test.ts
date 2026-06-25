// Wave 0 RED stub — Phase 78 / 78-01-PLAN.md
//
// End-to-end integration stub for scripts/v8.4-brand-canonicalization.ts
// (MIG-01). Runs the dry-run against local Supabase via DATABASE_URL +
// service-role and asserts the operator-resolve artifact is written.
//
// Gated on DATABASE_URL per the local-first verification idiom (analog:
// tests/integration/migration-drop-archetype.test.ts:26). Without
// DATABASE_URL the suite is described-skipped so vitest discovery still
// returns a positive signal in jsdom-default / CI runs.
//
// Plan 03 (Wave 2) will green these it.todo entries by implementing the
// script + spawning it via child_process.execSync from the test.

import { describe, it, expect } from 'vitest'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 78 — v8.4-brand-canonicalization.ts (end-to-end dry-run)', () => {
  it('Wave 0 stub registers in vitest discovery', () => {
    expect(true).toBe(true)
  })

  it.todo('script connects via DATABASE_URL service-role and writes .planning/v8.4-brand-merge-decisions.md (D-78-06)')
  it.todo('artifact is non-empty after successful run')
  it.todo('exit code 0 on first successful run')
})
