import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'
import { users, watches, watchesCatalog, watchesCatalogDailySnapshots } from '@/db/schema'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = `rc${Date.now().toString(36)}`

maybe('Phase 17 refresh-counts function -- CAT-09 + CAT-10', () => {
  const userId = randomUUID()
  let catalogId: string
  const seededWatchIds: string[] = []

  beforeAll(async () => {
    await db.insert(users).values({ id: userId, email: `${STAMP}@horlo.test` }).onConflictDoNothing()

    // Seed 1 catalog row
    const catRes = await db.execute<{ id: string }>(sql`
      INSERT INTO watches_catalog (brand, model, reference, source)
      VALUES (${`Rc-${STAMP}-X`}, 'Sub', 'r1', 'user_promoted')
      RETURNING id
    `)
    catalogId = (catRes as unknown as Array<{ id: string }>)[0].id

    // 3 watches: 2 owned, 1 wishlist, all linked to the catalog row
    const seedRows = [
      { id: randomUUID(), status: 'owned' as const },
      { id: randomUUID(), status: 'owned' as const },
      { id: randomUUID(), status: 'wishlist' as const },
    ]
    for (const r of seedRows) {
      await db.insert(watches).values({
        id: r.id, userId, brand: `Rc-${STAMP}-X`, model: 'Sub', reference: 'r1',
        status: r.status, movement: 'automatic', catalogId,
      })
      seededWatchIds.push(r.id)
    }
  })

  afterAll(async () => {
    if (seededWatchIds.length > 0) {
      await db.execute(sql`DELETE FROM watches WHERE id = ANY(${seededWatchIds}::uuid[])`)
    }
    await db.execute(sql`DELETE FROM watches_catalog_daily_snapshots WHERE catalog_id = ${catalogId}::uuid`)
    await db.execute(sql`DELETE FROM watches_catalog WHERE id = ${catalogId}::uuid`)
    await db.execute(sql`DELETE FROM users WHERE id = ${userId}::uuid`)
  })

  it('refresh counts -- owners + wishlist', async () => {
    await db.execute(sql`SELECT public.refresh_watches_catalog_counts()`)
    const result = await db.select().from(watchesCatalog).where(sql`id = ${catalogId}::uuid`)
    expect(result[0].ownersCount).toBe(2)
    expect(result[0].wishlistCount).toBe(1)
  })

  it('snapshot written for today', async () => {
    const snaps = await db.select().from(watchesCatalogDailySnapshots)
      .where(sql`catalog_id = ${catalogId}::uuid`)
    expect(snaps.length).toBe(1)
    expect(snaps[0].ownersCount).toBe(2)
    expect(snaps[0].wishlistCount).toBe(1)
    // snapshot_date is text in our schema (ISO date string YYYY-MM-DD)
    const today = new Date().toISOString().slice(0, 10)
    expect(snaps[0].snapshotDate).toBe(today)
  })

  it('snapshot idempotent same-day', async () => {
    await db.execute(sql`SELECT public.refresh_watches_catalog_counts()`)
    const snaps = await db.select().from(watchesCatalogDailySnapshots)
      .where(sql`catalog_id = ${catalogId}::uuid`)
    expect(snaps.length).toBe(1)   // ON CONFLICT DO UPDATE -- still 1 row
  })

  it('resets counts when watches deleted', async () => {
    if (seededWatchIds.length > 0) {
      await db.execute(sql`DELETE FROM watches WHERE id = ANY(${seededWatchIds}::uuid[])`)
      seededWatchIds.length = 0   // afterAll cleanup tolerates empty
    }
    await db.execute(sql`SELECT public.refresh_watches_catalog_counts()`)
    const result = await db.select().from(watchesCatalog).where(sql`id = ${catalogId}::uuid`)
    expect(result[0].ownersCount).toBe(0)
    expect(result[0].wishlistCount).toBe(0)
  })
})
