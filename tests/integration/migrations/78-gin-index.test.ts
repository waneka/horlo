// Phase 78 / 78-02-PLAN.md — Wave 1 GREEN integration introspection guard.
//
// Introspects the local Supabase DB (or any DATABASE_URL target) to confirm
// the additive Phase 78 schema migration shipped:
//   - watch_families_aliases_gin_idx exists (CANON-03: GIN containment index)
//   - brands.needs_review column exists with default false (CANON-04)
//   - watch_families.needs_review column exists with default false (CANON-04)
//   - watch_families.aliases column exists with default '{}' (CANON-03, D-78-08)
//   - existing rows backfill needs_review to false (count zero where IS NOT FALSE)
//     and aliases to '{}' (count zero where IS DISTINCT FROM '{}')
//
// Gated on DATABASE_URL per the project's local-first verification idiom
// (analog: tests/integration/migration-drop-archetype.test.ts:26). Without
// DATABASE_URL the suite is described-skipped so vitest discovery still
// returns a positive signal in CI / jsdom-default runs.
//
// Connection: `postgres` lib with `{ max: 1, prepare: false }` per
// scripts/inventory-explore-catalog.ts:36 pattern. Opened in beforeAll,
// closed in afterAll.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 78 — watch_families_aliases_gin_idx + needs_review (introspection)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sql: ReturnType<typeof postgres>

  beforeAll(() => {
    const connStr = process.env.DATABASE_URL!
    sql = postgres(connStr, { max: 1, prepare: false })
  })

  afterAll(async () => {
    if (sql) await sql.end({ timeout: 5 })
  })

  it('watch_families_aliases_gin_idx exists in pg_indexes (CANON-03)', async () => {
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'watch_families_aliases_gin_idx'
    `
    expect(rows.length).toBe(1)
    expect(rows[0].indexname).toBe('watch_families_aliases_gin_idx')
  })

  it('brands.needs_review column exists with default false (CANON-04)', async () => {
    const rows = await sql<{
      data_type: string
      is_nullable: string
      column_default: string | null
    }[]>`
      SELECT data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'brands'
        AND column_name = 'needs_review'
    `
    expect(rows.length).toBe(1)
    expect(rows[0].data_type).toBe('boolean')
    expect(rows[0].is_nullable).toBe('NO')
    expect(rows[0].column_default).toMatch(/^false/)
  })

  it('watch_families.needs_review column exists with default false (CANON-04)', async () => {
    const rows = await sql<{
      data_type: string
      is_nullable: string
      column_default: string | null
    }[]>`
      SELECT data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'watch_families'
        AND column_name = 'needs_review'
    `
    expect(rows.length).toBe(1)
    expect(rows[0].data_type).toBe('boolean')
    expect(rows[0].is_nullable).toBe('NO')
    expect(rows[0].column_default).toMatch(/^false/)
  })

  it("watch_families.aliases column exists with default '{}' (CANON-03, D-78-08)", async () => {
    const rows = await sql<{
      data_type: string
      is_nullable: string
      column_default: string | null
    }[]>`
      SELECT data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'watch_families'
        AND column_name = 'aliases'
    `
    expect(rows.length).toBe(1)
    // Postgres reports text[] columns as data_type = 'ARRAY'.
    expect(rows[0].data_type).toBe('ARRAY')
    expect(rows[0].is_nullable).toBe('NO')
    // Postgres may normalize bare `'{}'` to `'{}'::text[]` — accept either form.
    expect(rows[0].column_default).toMatch(/'\{\}'/)
  })

  it("backfill defaults: needs_review=false on both tables; aliases='{}' on watch_families (CANON-03, CANON-04, D-78-08)", async () => {
    const rows = await sql<{
      brands_bad: number
      families_bad: number
      aliases_bad: number
    }[]>`
      SELECT
        (SELECT count(*)::int FROM brands         WHERE needs_review IS NOT FALSE)            AS brands_bad,
        (SELECT count(*)::int FROM watch_families WHERE needs_review IS NOT FALSE)            AS families_bad,
        (SELECT count(*)::int FROM watch_families WHERE aliases      IS DISTINCT FROM '{}')   AS aliases_bad
    `
    expect(rows[0].brands_bad).toBe(0)
    expect(rows[0].families_bad).toBe(0)
    expect(rows[0].aliases_bad).toBe(0)
  })
})
