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
      movement: 'automatic',
      catalogId,
    }).returning()
    watchWithCatalogId = w1.id

    // Seed 1 watches row WITHOUT catalog_id (NULL)
    const [w2] = await db.insert(watches).values({
      userId,
      brand: `NoCatalog_${stamp}`,
      model: `NoCatalogModel_${stamp}`,
      status: 'wishlist',
      movement: 'quartz',
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

  it('leftJoin(watchesCatalog) returns null catalog columns when catalog_id IS NULL (does not drop the row)', async () => {
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

    // LEFT JOIN: the watches row is NOT dropped even with no matching catalog row
    expect(rows).toHaveLength(1)
    expect(rows[0].watchId).toBe(watchWithoutCatalogId)
    expect(rows[0].watchBrand).toBeDefined()
    // Catalog columns are null when no FK match
    expect(rows[0].catalogBrand).toBeNull()
    expect(rows[0].catalogId).toBeNull()
  })
})
