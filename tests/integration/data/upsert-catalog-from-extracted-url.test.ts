// @vitest-environment node
// Node env required per [[vitest-static-node-env]].
//
// Wave 0 RED state (Phase 80 Plan 01):
//   `upsertCatalogFromExtractedUrl` does not yet call the brand/family resolver.
//   When DATABASE_URL is set to local Supabase BEFORE Plan 03 ships, this test
//   FAILS: the inserted watches_catalog row has brand_id = NULL and family_id = NULL
//   (the helpers don't write the FKs yet). That NULL result is the RED signal.
//
//   After Plan 03 ships (resolver wired into the upsert helper), this test GREENS:
//   brand_id and family_id will both be non-NULL on the inserted row.
//
// Schema note: The SQL column for the family FK is `family_id` (per src/db/schema.ts L505:
//   `familyId: uuid('family_id')`) — NOT `brand_family_id`. The plan documentation
//   incorrectly referenced `brand_family_id`; this file uses the correct schema column name.
//
// Gated on DATABASE_URL: without it, suite is describe.skip'd (CI stays green).

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import postgres from 'postgres'
import { upsertCatalogFromExtractedUrl } from '@/data/catalog'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe(
  'Phase 80 — upsertCatalogFromExtractedUrl writes NON-NULL brand_id + family_id (INGEST-01..03)',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sql: ReturnType<typeof postgres>
    let insertedCatalogId: string | null = null

    // Fixture brand + model strings are clearly namespaced to prevent collision
    // with real catalog data and to enable safe afterAll cleanup (T-80-V4 mitigation).
    const FIXTURE_BRAND = 'Phase80UpsertExtractTestBrand'
    const FIXTURE_MODEL = 'Phase80UpsertExtractTestModel'
    const FIXTURE_REF = 'P80-UE-001'

    beforeAll(() => {
      const connStr = process.env.DATABASE_URL!
      sql = postgres(connStr, { max: 1, prepare: false })
    })

    afterEach(async () => {
      // Delete the inserted catalog row after each test so re-runs are idempotent.
      if (insertedCatalogId) {
        await sql`DELETE FROM watches_catalog WHERE id = ${insertedCatalogId}`
        insertedCatalogId = null
      }
    })

    afterAll(async () => {
      if (sql) {
        // Cleanup: remove any auto-created brands + watch_families rows created
        // during the test (safe-by-name guard — fixture strings cannot collide with
        // real brand data). brand_family_id is the documented name in plan docs;
        // actual FK column is family_id per schema.ts.
        await sql`
          DELETE FROM watch_families
           WHERE brand_id IN (
             SELECT id FROM brands WHERE name = ${FIXTURE_BRAND}
           )
        `
        await sql`DELETE FROM brands WHERE name = ${FIXTURE_BRAND}`
        await sql.end({ timeout: 5 })
      }
    })

    it(
      'upsertCatalogFromExtractedUrl writes NON-NULL brand_id + family_id on the inserted row (Plan 03 wires this)',
      async () => {
        // Build a minimal valid UrlExtractedCatalogInput fixture.
        const input = {
          brand: FIXTURE_BRAND,
          model: FIXTURE_MODEL,
          reference: FIXTURE_REF,
          // Optional spec fields — leave as null/undefined for minimal fixture.
          movementType: null,
          movementCaliber: null,
          caseSizeMm: null,
          lugToLugMm: null,
          waterResistanceM: null,
          crystalType: null,
          dialColor: null,
          isChronometer: null,
          productionYear: null,
          imageUrl: null,
          imageSourceUrl: null,
          imageSourceQuality: null,
          styleTags: [],
          designTraits: [],
          roleTags: [],
          complications: [],
        } as const

        const catalogId = await upsertCatalogFromExtractedUrl(input)
        expect(catalogId).not.toBeNull()
        insertedCatalogId = catalogId

        // SELECT the inserted row and check both FK columns.
        // Column names per schema.ts: brand_id (L504) and family_id (L505).
        // The plan docs use the alias brand_family_id for the family FK column —
        // the actual Postgres column name is family_id.
        const rows = await sql<{
          brand_id: string | null
          family_id: string | null // also referred to as brand_family_id in plan docs
        }[]>`
          SELECT brand_id, family_id
            FROM watches_catalog
           WHERE id = ${catalogId!}
           LIMIT 1
        `
        expect(rows.length).toBe(1)
        // RED in Wave 0: brand_id is NULL (resolver not wired yet).
        // GREEN after Plan 03: brand_id is the resolved or auto-created brand UUID.
        expect(rows[0].brand_id).not.toBeNull()
        // RED in Wave 0: family_id (brand_family_id) is NULL.
        // GREEN after Plan 03: family_id is the resolved or auto-created family UUID.
        expect(rows[0].family_id).not.toBeNull()
      },
    )
  },
)
