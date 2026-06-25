// Wave 0 RED stub — Phase 78 / 78-01-PLAN.md
//
// Integration guard: introspect pg_indexes against the local Supabase DB to
// confirm that the additive Phase 78 schema migration shipped:
//   - watch_families_aliases_gin_idx exists (CANON-03: GIN containment index)
//   - brands.needs_review column exists with default false (CANON-04)
//   - watch_families.needs_review column exists with default false (CANON-04)
//   - existing rows backfill needs_review to false (count zero where IS NOT FALSE)
//
// Gated on DATABASE_URL per the project's local-first verification idiom
// (analog: tests/integration/migration-drop-archetype.test.ts:26). Without
// DATABASE_URL the suite is described-skipped so vitest discovery still
// returns a positive signal in CI / jsdom-default runs.
//
// Plan 02 (Wave 1) will green these it.todo entries by writing the SQL
// migration in supabase/migrations/ and verifying via drizzle/postgres-lib.

import { describe, it, expect } from 'vitest'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 78 — watch_families_aliases_gin_idx + needs_review (introspection)', () => {
  it('Wave 0 stub registers in vitest discovery', () => {
    expect(true).toBe(true)
  })

  it.todo('watch_families_aliases_gin_idx exists in pg_indexes (CANON-03)')
  it.todo('brands.needs_review column exists with default false (CANON-04)')
  it.todo('watch_families.needs_review column exists with default false (CANON-04)')
  it.todo('existing rows backfill needs_review to false (count zero where needs_review IS NOT FALSE)')
})
