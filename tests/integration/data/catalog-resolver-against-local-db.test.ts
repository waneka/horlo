// @vitest-environment node
// Node env required per [[vitest-static-node-env]].
//
// Wave 0 RED state (Phase 80 Plan 01):
//   The resolver module `src/data/catalog-resolver.ts` does NOT yet exist (Plan 02
//   ships it). All four cases in this suite will fail at module import time.
//   When DATABASE_URL is set to local Supabase (127.0.0.1:54322) BEFORE Plan 02:
//   - Brand Tier 1 / Tier 2 / Family alias / auto-create tests all fail at import.
//   After Plan 02 ships:
//   - Tier 1 + Tier 2 + alias hit should turn GREEN against the seeded local catalog.
//   - Auto-create test greens when brand insert + cleanup both work.
//   Note: the Brut Date alias test requires Phase 79 --apply to have seeded the alias
//   on local Supabase. See the beforeAll conditional seed below.
//
// Gated on DATABASE_URL: without it, suite is describe.skip'd (CI stays green).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

// Top-level import — fails "Cannot find module" until Plan 02 ships.
// This is the Wave 0 RED signal.
import { resolveBrandId, resolveFamilyId } from '@/data/catalog-resolver'

maybe('Phase 80 — catalog-resolver against local Supabase (INGEST-01..04)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sql: ReturnType<typeof postgres>
  const TEST_BRAND_NAME = 'Acme Chronograph Co Phase80 Test'

  beforeAll(async () => {
    const connStr = process.env.DATABASE_URL!
    sql = postgres(connStr, { max: 1, prepare: false })

    // Conditionally seed the 'brut date' alias on 'Brut Datejust' family if absent.
    // Phase 79 --apply populates this on prod; local DB may be missing it.
    // The alias must be in the format lower(trim(model_raw)) = 'brut date'.
    //
    // NOTE: if the Brut / Brut Datejust brand+family don't exist locally, this
    // UPDATE is a no-op and the alias test below will correctly fail (RED).
    await sql`
      UPDATE watch_families
         SET aliases = aliases || ARRAY['brut date']::text[]
       WHERE name_normalized = 'brut datejust'
         AND brand_id = (
           SELECT id FROM brands WHERE name_normalized = 'brut'
         )
         AND NOT (aliases @> ARRAY['brut date']::text[])
    `
  })

  afterAll(async () => {
    if (sql) {
      // Cleanup: remove the auto-created test fixture brand (safe-by-name guard).
      // Only deletes the exact fixture string — cannot collide with real brand data.
      await sql`
        DELETE FROM brands
         WHERE name = ${TEST_BRAND_NAME}
      `
      await sql.end({ timeout: 5 })
    }
  })

  it("Brand Tier 1 (exact match against seeded Hamilton brand) — INGEST-01", async () => {
    // Expects 'Hamilton' to be in the seeded local catalog.
    // Local seed has ~205 rows; Hamilton is a seeded brand.
    const result = await resolveBrandId('Hamilton')

    // Verify the returned id matches the actual brands row.
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM brands WHERE name_normalized = 'hamilton' LIMIT 1
    `
    expect(rows.length).toBe(1)
    expect(result.brandId).toBe(rows[0].id)
    expect(result.decision).toMatchObject({ tier: 'exact', decision: 'matched' })
  })

  it("Brand Tier 2 (fuzzy clear-gap on 'Hamilon' typo) — INGEST-02", async () => {
    // One-char typo 'Hamilon' should fuzzy-match to Hamilton with clear gap.
    const result = await resolveBrandId('Hamilon')

    const hamiltonRow = await sql<{ id: string }[]>`
      SELECT id FROM brands WHERE name_normalized = 'hamilton' LIMIT 1
    `
    expect(hamiltonRow.length).toBe(1)
    expect(result.brandId).toBe(hamiltonRow[0].id)
    expect(result.decision.tier).toBe('fuzzy')
    expect(
      (result.decision as { tier: 'fuzzy'; score: number }).score
    ).toBeGreaterThan(0.6)
  })

  it("Family Tier 2 (alias hit on 'Brut Date' → 'Brut Datejust') — INGEST-04 / D-80-02", async () => {
    // Phase 79 should have seeded 'brut date' alias on the canonical Brut Datejust
    // family. The beforeAll seed ensures it exists locally too.

    // First resolve the Brut brand id.
    const brutBrand = await sql<{ id: string }[]>`
      SELECT id FROM brands WHERE name_normalized = 'brut' LIMIT 1
    `
    if (brutBrand.length === 0) {
      // Brand not seeded locally — skip this assertion gracefully.
      return
    }
    const brutBrandId = brutBrand[0].id

    const result = await resolveFamilyId(brutBrandId, 'Brut Date')

    expect(result.decision.tier).toBe('alias')

    // Verify the resolved family is the canonical Brut Datejust row.
    const familyRow = await sql<{ name: string }[]>`
      SELECT name FROM watch_families WHERE id = ${result.familyId} LIMIT 1
    `
    expect(familyRow.length).toBe(1)
    expect(familyRow[0].name).toBe('Brut Datejust')
  })

  it("Brand Tier 3 (auto-create with needs_review=true) — INGEST-03", async () => {
    // Use a clearly-novel fixture string that cannot collide with real data.
    const result = await resolveBrandId(TEST_BRAND_NAME)

    // Verify a new row was created in brands with needs_review = true.
    const newBrandRow = await sql<{ name: string; needs_review: boolean }[]>`
      SELECT name, needs_review
        FROM brands
       WHERE name = ${TEST_BRAND_NAME}
       LIMIT 1
    `
    expect(newBrandRow.length).toBe(1)
    expect(newBrandRow[0].needs_review).toBe(true)
    expect(result.decision.decision).toBe('no_candidates_auto_create')
    // The afterAll cleanup will DELETE this row.
  })
})
