/**
 * Phase 17 Plan 01 — Wave 0 RED stubs for CAT-11 join-shape forward-compat.
 * Tests cover: watches LEFT JOIN watches_catalog returns expected shape;
 * NULL catalog_id does not drop the watches row.
 *
 * Gated on DATABASE_URL so CI stays green without the local stack.
 * These tests are RED until Task 4's [BLOCKING] schema push runs the migrations.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { users, watches, watchesCatalog } from '@/db/schema'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 17 join shape — CAT-11 watches LEFT JOIN watches_catalog', () => {
  const stamp = Date.now().toString(36)

  let userId: string
  let watchWithCatalogId: string
  let watchWithoutCatalogId: string
  let catalogId: string

  beforeAll(async () => {
    userId = randomUUID()

    // Seed user
    await db.insert(users).values({
      id: userId,
      email: `join-shape-${stamp}@horlo.test`,
    }).onConflictDoNothing()

    // Seed 1 catalog row
    catalogId = randomUUID()
    await db.insert(watchesCatalog).values({
      id: catalogId,
      brand: `JoinBrand_${stamp}`,
      model: `JoinModel_${stamp}`,
      source: 'user_promoted',
    }).onConflictDoNothing()

    // Seed 1 watches row WITH catalog_id set
    const [w1] = await db.insert(watches).values({
      userId,
      brand: `JoinBrand_${stamp}`,
      model: `JoinModel_${stamp}`,
      status: 'owned',
      movementType: 'auto',
      catalogId,
    }).returning()
    watchWithCatalogId = w1.id

    // Seed a second catalog row for the second watches row.
    // Phase 38 D-06: catalog_id is NOT NULL — every watches row needs a catalog entry.
    // Test renamed: verifies that LEFT JOIN still works when catalog row exists.
    const catalogId2 = randomUUID()
    await db.insert(watchesCatalog).values({
      id: catalogId2,
      brand: `NoCatalog_${stamp}`,
      model: `NoCatalogModel_${stamp}`,
      source: 'user_promoted',
    }).onConflictDoNothing()
    const [w2] = await db.insert(watches).values({
      userId,
      brand: `NoCatalog_${stamp}`,
      model: `NoCatalogModel_${stamp}`,
      status: 'wishlist',
      movementType: 'quartz',
      catalogId: catalogId2,
    }).returning()
    watchWithoutCatalogId = w2.id
  }, 30_000)

  afterAll(async () => {
    try {
      await db.delete(watches).where(eq(watches.userId, userId))
      await db.delete(watchesCatalog).where(eq(watchesCatalog.id, catalogId))
      await db.delete(users).where(eq(users.id, userId))
    } catch {}
  }, 30_000)

  it('leftJoin(watchesCatalog) returns both watch brand and catalog brand for linked watch', async () => {
    const rows = await db
      .select({
        watchId: watches.id,
        watchBrand: watches.brand,
        catalogBrand: watchesCatalog.brand,
        catalogId: watchesCatalog.id,
      })
      .from(watches)
      .leftJoin(watchesCatalog, eq(watches.catalogId, watchesCatalog.id))
      .where(eq(watches.id, watchWithCatalogId))

    expect(rows).toHaveLength(1)
    expect(rows[0].watchId).toBe(watchWithCatalogId)
    expect(rows[0].watchBrand).toBeDefined()
    expect(rows[0].catalogBrand).toBeDefined()
    expect(rows[0].catalogId).toBe(catalogId)
  })

  it('leftJoin(watchesCatalog) returns catalog columns for second watch (Phase 38: all rows have catalogId)', async () => {
    // Phase 38 D-06: catalog_id is NOT NULL; every watches row has a catalog row.
    // This test verifies the LEFT JOIN still returns the watch row (1 row) with catalog data.
    const rows = await db
      .select({
        watchId: watches.id,
        watchBrand: watches.brand,
        catalogBrand: watchesCatalog.brand,
        catalogId: watchesCatalog.id,
      })
      .from(watches)
      .leftJoin(watchesCatalog, eq(watches.catalogId, watchesCatalog.id))
      .where(eq(watches.id, watchWithoutCatalogId))

    // LEFT JOIN: the watches row is returned with catalog data populated
    expect(rows).toHaveLength(1)
    expect(rows[0].watchId).toBe(watchWithoutCatalogId)
    expect(rows[0].watchBrand).toBeDefined()
    // Post-Phase-38: catalog columns are populated (NOT null) since every watch has catalogId
    expect(rows[0].catalogBrand).toBeDefined()
    expect(rows[0].catalogId).not.toBeNull()
  })
})
