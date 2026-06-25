// Phase 79 / 79-01-PLAN.md — Wave 0 RED stub.
//
// Unit test for D-79-02 local-vs-prod URL detection (`isLocalDatabaseUrl`).
// Gates the silent-local / interactive-prod confirmation pattern: when the
// script detects a local Supabase connection string (127.0.0.1:54322 or
// localhost:54322) the apply runs silently; for any other host (including the
// alt-port 54323 safety case and unparseable strings) the apply prompts the
// operator for a typed `yes` before issuing the first write.
//
// Covers:
//   - 127.0.0.1:54322 → true
//   - localhost:54322 → true
//   - aws-1.pooler.supabase.com:6543 → false
//   - aws-0.pooler.supabase.com:5432 → false
//   - 127.0.0.1:54323 alt-port → false (safety bias)
//   - unparseable URL → false (fail closed)
//   - empty string → false (fail closed)
//
// No DATABASE_URL gate — pure-function in/bool out. The Plan 02 export lands
// behind the commented import below; flip the comment when the export ships.

import { describe, it, expect } from 'vitest'
// TODO Plan 02: uncomment when isLocalDatabaseUrl export lands.
// import { isLocalDatabaseUrl } from '../../../scripts/v8.4-brand-canonicalization'

describe('Phase 79 — v8.4 isLocalDatabaseUrl (D-79-02)', () => {
  it('Wave 0 RED stub loads', () => {
    expect(true).toBe(true)
  })

  it.todo('D-79-02: returns true for postgres://...@127.0.0.1:54322/postgres')
  it.todo('D-79-02: returns true for postgres://...@localhost:54322/postgres')
  it.todo('D-79-02: returns false for Supabase pooler aws-1.pooler.supabase.com:6543')
  it.todo('D-79-02: returns false for Supabase pooler aws-0.pooler.supabase.com:5432')
  it.todo('D-79-02: returns false for 127.0.0.1:54323 alt-port (safety bias)')
  it.todo('D-79-02: returns false for unparseable connection string (fail closed)')
  it.todo('D-79-02: returns false for empty string (fail closed)')
})
