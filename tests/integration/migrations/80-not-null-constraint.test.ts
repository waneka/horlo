// @vitest-environment node
// Node env required per [[vitest-static-node-env]] — Vercel prebuild externalizes
// node:fs under jsdom-default, causing the postgres lib import to fail.
//
// Wave 0 RED state (Phase 80 Plan 01):
//   This test file is written BEFORE the NOT NULL migration is applied (Plan 04
//   will green cases 1 + 2 by running the migration; case 3 confirms 23502 enforcement).
//   With DATABASE_URL pointing at local Supabase BEFORE the migration:
//   - Cases 1 + 2 FAIL: brand_id / family_id are still nullable (is_nullable = 'YES').
//   - Case 3 FAILS: the INSERT succeeds (no constraint yet — no 23502 thrown).
//   Expected RED state = Plan 04's signal to apply the migration and flip tests GREEN.
//
// Gated on DATABASE_URL: without it, the suite is describe.skip'd so CI + jsdom
// runs remain green (same pattern as tests/integration/migrations/78-gin-index.test.ts).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 80 — watches_catalog brand_id + family_id NOT NULL (CANON-01, CANON-02)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sql: ReturnType<typeof postgres>

  beforeAll(() => {
    const connStr = process.env.DATABASE_URL!
    sql = postgres(connStr, { max: 1, prepare: false })
  })

  afterAll(async () => {
    if (sql) await sql.end({ timeout: 5 })
  })

  it('brand_id is NOT NULL in information_schema (CANON-01)', async () => {
    const rows = await sql<{ is_nullable: string }[]>`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'watches_catalog'
        AND column_name = 'brand_id'
    `
    expect(rows.length).toBe(1)
    // RED in Wave 0: brand_id is still nullable → is_nullable = 'YES'
    // GREEN after Plan 04 migration: is_nullable = 'NO'
    expect(rows[0].is_nullable).toBe('NO')
  })

  it('family_id is NOT NULL in information_schema (CANON-02)', async () => {
    const rows = await sql<{ is_nullable: string }[]>`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'watches_catalog'
        AND column_name = 'family_id'
    `
    expect(rows.length).toBe(1)
    // RED in Wave 0: family_id is still nullable → is_nullable = 'YES'
    // GREEN after Plan 04 migration: is_nullable = 'NO'
    expect(rows[0].is_nullable).toBe('NO')
  })

  it('INSERT with brand_id=NULL raises 23502 (CANON-01 enforcement)', async () => {
    // This INSERT is deliberately malformed (missing required fields beyond the
    // fixture columns). The constraint check fires BEFORE the other NOT NULL
    // violations, so 23502 is the expected error code AFTER Plan 04's migration.
    //
    // RED in Wave 0: INSERT succeeds (columns still nullable) — no 23502 thrown.
    // GREEN after Plan 04 migration: 23502 is raised immediately on brand_id=NULL.
    await expect(
      sql`
        INSERT INTO watches_catalog (brand, model, source, brand_id, family_id)
        VALUES ('Test', 'Test', 'user_promoted', NULL, NULL)
      `,
    ).rejects.toMatchObject({ code: '23502' })
  })
})
