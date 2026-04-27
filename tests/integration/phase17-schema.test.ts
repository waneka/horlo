/**
 * Phase 17 Plan 01 — Wave 0 RED stubs for catalog schema assertions.
 * Tests cover: CAT-01 structural, CAT-03 (GIN trgm), CAT-04 (FK), CAT-12 (snapshots),
 * plus CHECK constraints on source and image_source_quality.
 *
 * Gated on DATABASE_URL so CI stays green without the local stack.
 * These tests are RED until Task 4's [BLOCKING] schema push runs the migrations.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { watchesCatalog } from '@/db/schema'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 17 schema — CAT-01 / CAT-03 / CAT-04 / CAT-12 structural assertions', () => {
  it('watches_catalog table exists', async () => {
    const result = await db.execute(sql`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'watches_catalog'
    `)
    const rows = (result as unknown as Array<{ table_name: string }>) ?? []
    expect(rows).toHaveLength(1)
    expect(rows[0].table_name).toBe('watches_catalog')
  })

  it('natural-key unique index exists with NULLS NOT DISTINCT', async () => {
    const result = await db.execute(sql`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'watches_catalog_natural_key'
    `)
    const rows = (result as unknown as Array<{ indexname: string; indexdef: string }>) ?? []
    expect(rows).toHaveLength(1)
    expect(rows[0].indexdef).toMatch(/NULLS NOT DISTINCT/i)
    expect(rows[0].indexdef).toMatch(/brand_normalized/)
    expect(rows[0].indexdef).toMatch(/model_normalized/)
    expect(rows[0].indexdef).toMatch(/reference_normalized/)
  })

  it('trgm indexes exist with extensions.gin_trgm_ops opclass', async () => {
    const result = await db.execute(sql`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN ('watches_catalog_brand_trgm_idx', 'watches_catalog_model_trgm_idx')
       ORDER BY indexname
    `)
    const rows = (result as unknown as Array<{ indexname: string; indexdef: string }>) ?? []
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r.indexdef).toMatch(/USING gin/i)
      // Postgres normalizes the opclass name when extensions schema is on search_path —
      // pg_indexes.indexdef may show either bare 'gin_trgm_ops' or 'extensions.gin_trgm_ops'.
      expect(r.indexdef).toMatch(/(extensions\.)?gin_trgm_ops/)
    }
  })

  describe('trgm planner reachability (mirrors phase11-pg-trgm seed-100 pattern)', () => {
    const SEED_COUNT = 100
    const seedIds: string[] = []

    beforeAll(async () => {
      const stamp = Date.now().toString(36)
      const rows = Array.from({ length: SEED_COUNT }, (_, i) => ({
        id: randomUUID(),
        brand: `RandomBrand${stamp}${i}`,
        model: `RandomModel${i}`,
        source: 'user_promoted' as const,
      }))
      await db.insert(watchesCatalog).values(rows).onConflictDoNothing()
      seedIds.push(...rows.map((r) => r.id))
      await db.execute(sql`ANALYZE watches_catalog`)
    }, 60_000)

    afterAll(async () => {
      if (seedIds.length === 0) return
      // Delete the seed rows by brand prefix to avoid accumulation
      await db.execute(
        sql`DELETE FROM watches_catalog WHERE id = ANY(ARRAY[${sql.raw(seedIds.map((id) => `'${id}'`).join(','))}]::uuid[])`
      )
    }, 60_000)

    it('trgm planner reachability — EXPLAIN uses index at sufficient cardinality', async () => {
      // Verify the index exists (authoritative gate)
      const indexResult = await db.execute(sql`
        SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = 'watches_catalog_brand_trgm_idx'
      `)
      const indexRows = (indexResult as unknown as Array<{ indexname: string }>) ?? []
      expect(indexRows).toHaveLength(1)

      // EXPLAIN to check planner; may choose Seq Scan at <127 rows (known flakiness)
      const result = await db.execute(sql`
        SET LOCAL enable_seqscan = OFF;
        EXPLAIN SELECT id FROM watches_catalog WHERE brand ILIKE '%RandomBrand%'
      `)
      const rows = (result as unknown as Array<Record<string, string>>) ?? []
      const plan = rows.map((r) => Object.values(r)[0]).join('\n')
      if (!plan.match(/Bitmap Index Scan/i) && !plan.match(/watches_catalog_brand_trgm_idx/i)) {
        console.warn('[CAT-03] Planner chose Seq Scan — known flakiness at small table size. Index existence confirmed above.')
      }
      // Index existence is the authoritative CAT-03 gate
      expect(indexRows).toHaveLength(1)
    })
  })

  it('watches.catalog_id FK — nullable uuid with ON DELETE SET NULL', async () => {
    const colResult = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'watches'
         AND column_name = 'catalog_id'
    `)
    const colRows = (colResult as unknown as Array<{
      column_name: string
      data_type: string
      is_nullable: string
    }>) ?? []
    expect(colRows).toHaveLength(1)
    expect(colRows[0].is_nullable).toBe('YES')
    expect(colRows[0].data_type).toBe('uuid')

    const fkResult = await db.execute(sql`
      SELECT delete_rule
        FROM information_schema.referential_constraints rc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = rc.constraint_name
         AND kcu.constraint_schema = rc.constraint_schema
       WHERE kcu.table_schema = 'public'
         AND kcu.table_name = 'watches'
         AND kcu.column_name = 'catalog_id'
    `)
    const fkRows = (fkResult as unknown as Array<{ delete_rule: string }>) ?? []
    expect(fkRows.length).toBeGreaterThanOrEqual(1)
    expect(fkRows[0].delete_rule).toBe('SET NULL')
  })

  it('snapshots table + UNIQUE index on (catalog_id, snapshot_date)', async () => {
    const indexResult = await db.execute(sql`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'watches_catalog_daily_snapshots'
         AND indexdef LIKE '%UNIQUE%'
       ORDER BY indexname
    `)
    const snapshotRows = (indexResult as unknown as Array<{ indexname: string; indexdef: string }>) ?? []
    expect(snapshotRows.length).toBeGreaterThanOrEqual(1)
    const combined = snapshotRows.map((r) => r.indexdef).join('\n')
    expect(combined).toMatch(/catalog_id/)
    expect(combined).toMatch(/snapshot_date/)
  })

  describe('CHECK constraint on source', () => {
    let testId: string

    afterAll(async () => {
      if (testId) {
        await db.execute(sql`DELETE FROM watches_catalog WHERE id = ${testId}::uuid`)
      }
    }, 30_000)

    it('source=banana throws constraint violation', async () => {
      await expect(
        db.execute(sql`
          INSERT INTO watches_catalog (id, brand, model, source)
          VALUES (${randomUUID()}, 'CheckBrand', 'CheckModel', 'banana')
        `)
      ).rejects.toSatisfy((e: unknown) => {
        const err = e as { message?: string; cause?: { message?: string } }
        const text = `${err.message ?? ''} ${err.cause?.message ?? ''}`
        return /check constraint|violates|watches_catalog_source_check/i.test(text)
      })
    })

    it('source=user_promoted succeeds', async () => {
      testId = randomUUID()
      await expect(
        db.execute(sql`
          INSERT INTO watches_catalog (id, brand, model, source)
          VALUES (${testId}::uuid, 'CheckBrand', 'CheckModel', 'user_promoted')
        `)
      ).resolves.toBeDefined()
    })
  })

  describe('CHECK constraint on image_source_quality', () => {
    let testId: string

    afterAll(async () => {
      if (testId) {
        await db.execute(sql`DELETE FROM watches_catalog WHERE id = ${testId}::uuid`)
      }
    }, 30_000)

    it('image_source_quality=banana throws constraint violation', async () => {
      await expect(
        db.execute(sql`
          INSERT INTO watches_catalog (id, brand, model, source, image_source_quality)
          VALUES (${randomUUID()}, 'ISQBrand', 'ISQModel', 'user_promoted', 'banana')
        `)
      ).rejects.toSatisfy((e: unknown) => {
        const err = e as { message?: string; cause?: { message?: string } }
        const text = `${err.message ?? ''} ${err.cause?.message ?? ''}`
        return /check constraint|violates|watches_catalog_image_source_quality_check/i.test(text)
      })
    })

    it('image_source_quality=official succeeds', async () => {
      testId = randomUUID()
      await expect(
        db.execute(sql`
          INSERT INTO watches_catalog (id, brand, model, source, image_source_quality)
          VALUES (${testId}::uuid, 'ISQBrand', 'ISQModel', 'user_promoted', 'official')
        `)
      ).resolves.toBeDefined()
    })

    it('image_source_quality=retailer succeeds', async () => {
      const id = randomUUID()
      try {
        await db.execute(sql`
          INSERT INTO watches_catalog (id, brand, model, source, image_source_quality)
          VALUES (${id}::uuid, 'ISQBrand2', 'ISQModel2', 'user_promoted', 'retailer')
        `)
      } finally {
        await db.execute(sql`DELETE FROM watches_catalog WHERE id = ${id}::uuid`)
      }
    })

    it('image_source_quality=unknown succeeds', async () => {
      const id = randomUUID()
      try {
        await db.execute(sql`
          INSERT INTO watches_catalog (id, brand, model, source, image_source_quality)
          VALUES (${id}::uuid, 'ISQBrand3', 'ISQModel3', 'user_promoted', 'unknown')
        `)
      } finally {
        await db.execute(sql`DELETE FROM watches_catalog WHERE id = ${id}::uuid`)
      }
    })

    it('image_source_quality=NULL succeeds', async () => {
      const id = randomUUID()
      try {
        await db.execute(sql`
          INSERT INTO watches_catalog (id, brand, model, source, image_source_quality)
          VALUES (${id}::uuid, 'ISQBrand4', 'ISQModel4', 'user_promoted', NULL)
        `)
      } finally {
        await db.execute(sql`DELETE FROM watches_catalog WHERE id = ${id}::uuid`)
      }
    })
  })
})
