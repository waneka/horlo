/**
 * Phase 17 Plan 01 — Wave 0 RED stubs for catalog RLS assertions.
 * Tests cover: CAT-02 (public-read / service-role-write RLS) + Pitfall 4
 * for both watches_catalog and watches_catalog_daily_snapshots tables.
 *
 * Gated on DATABASE_URL + NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 * so CI stays green without the local stack.
 * These tests are RED until Task 4's [BLOCKING] schema push runs the migrations.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { watchesCatalog, watchesCatalogDailySnapshots } from '@/db/schema'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabase =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const maybe = hasDrizzle && hasSupabase ? describe : describe.skip

maybe('Phase 17 catalog RLS — CAT-02 + Pitfall 4 (anon SELECT allowed; anon writes blocked)', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  let catalogId: string

  beforeAll(async () => {
    // Seed 1 catalog row via service-role Drizzle client (bypasses RLS)
    catalogId = randomUUID()
    const stamp = Date.now().toString(36)
    await db.insert(watchesCatalog).values({
      id: catalogId,
      brand: `RLSTestBrand_${stamp}`,
      model: `RLSTestModel_${stamp}`,
      source: 'user_promoted',
    }).onConflictDoNothing()

    // Seed 1 snapshot row (for snapshots RLS tests)
    await db.insert(watchesCatalogDailySnapshots).values({
      catalogId,
      snapshotDate: '2026-04-27',
      ownersCount: 1,
      wishlistCount: 0,
    }).onConflictDoNothing()
  }, 30_000)

  afterAll(async () => {
    if (!catalogId) return
    try {
      await db.execute(sql`DELETE FROM watches_catalog_daily_snapshots WHERE catalog_id = ${catalogId}::uuid`)
      await db.execute(sql`DELETE FROM watches_catalog WHERE id = ${catalogId}::uuid`)
    } catch {}
  }, 30_000)

  // ============================================================
  // watches_catalog RLS assertions
  // ============================================================
  describe('watches_catalog — anon client access', () => {
    it('anon can SELECT from watches_catalog', async () => {
      const anon = createClient(url, anonKey, { auth: { persistSession: false } })
      const { data, error } = await anon.from('watches_catalog').select('*')
      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(data!.length).toBeGreaterThanOrEqual(1)
    })

    it('anon write blocked (INSERT) on watches_catalog', async () => {
      const anon = createClient(url, anonKey, { auth: { persistSession: false } })
      const { error } = await anon.from('watches_catalog').insert({
        id: randomUUID(),
        brand: 'AnonInsert',
        model: 'AnonModel',
        source: 'user_promoted',
      })
      expect(error).not.toBeNull()
      const errorText = `${error?.code ?? ''} ${error?.message ?? ''}`
      // 42501 = insufficient_privilege; or RLS/policy message
      expect(errorText).toMatch(/42501|RLS|policy|permission|not allowed|insufficient/i)
    })

    it('anon write blocked (UPDATE) on watches_catalog', async () => {
      // Supabase PostgREST returns 204/null-error for UPDATE that RLS blocks (0 rows matched).
      // The security assertion is: the row must NOT actually be modified in the DB.
      const anon = createClient(url, anonKey, { auth: { persistSession: false } })
      await anon
        .from('watches_catalog')
        .update({ brand: 'AnonUpdated' })
        .eq('id', catalogId)
      // Verify via service-role Drizzle that the row was NOT changed
      const result = await db.execute(
        sql`SELECT brand FROM watches_catalog WHERE id = ${catalogId}::uuid`
      )
      const rows = (result as unknown as Array<{ brand: string }>) ?? []
      expect(rows).toHaveLength(1)
      expect(rows[0].brand).not.toBe('AnonUpdated')
    })

    it('anon write blocked (DELETE) on watches_catalog', async () => {
      // Supabase PostgREST returns 204/null-error for DELETE that RLS blocks (0 rows matched).
      // The security assertion is: the row must still exist in the DB.
      const anon = createClient(url, anonKey, { auth: { persistSession: false } })
      await anon
        .from('watches_catalog')
        .delete()
        .eq('id', catalogId)
      // Verify row still exists via service-role Drizzle
      const result = await db.execute(
        sql`SELECT id FROM watches_catalog WHERE id = ${catalogId}::uuid`
      )
      const rows = (result as unknown as Array<{ id: string }>) ?? []
      expect(rows).toHaveLength(1)
    })
  })

  // ============================================================
  // watches_catalog_daily_snapshots RLS assertions
  // ============================================================
  describe('watches_catalog_daily_snapshots — anon client access', () => {
    it('anon can SELECT from watches_catalog_daily_snapshots', async () => {
      const anon = createClient(url, anonKey, { auth: { persistSession: false } })
      const { data, error } = await anon.from('watches_catalog_daily_snapshots').select('*')
      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(data!.length).toBeGreaterThanOrEqual(1)
    })

    it('anon write blocked (INSERT) on watches_catalog_daily_snapshots', async () => {
      const anon = createClient(url, anonKey, { auth: { persistSession: false } })
      const { error } = await anon.from('watches_catalog_daily_snapshots').insert({
        id: randomUUID(),
        catalog_id: catalogId,
        snapshot_date: '2026-04-28',
        owners_count: 99,
        wishlist_count: 0,
      })
      expect(error).not.toBeNull()
      const errorText = `${error?.code ?? ''} ${error?.message ?? ''}`
      expect(errorText).toMatch(/42501|RLS|policy|permission|not allowed|insufficient/i)
    })

    it('anon write blocked (UPDATE) on watches_catalog_daily_snapshots', async () => {
      // Supabase PostgREST returns 204/null-error for UPDATE that RLS blocks (0 rows matched).
      // Security assertion: the snapshot row must NOT actually be modified.
      const anon = createClient(url, anonKey, { auth: { persistSession: false } })
      await anon
        .from('watches_catalog_daily_snapshots')
        .update({ owners_count: 999 })
        .eq('catalog_id', catalogId)
      // Verify via service-role Drizzle that owners_count was NOT changed to 999
      const result = await db.execute(
        sql`SELECT owners_count FROM watches_catalog_daily_snapshots WHERE catalog_id = ${catalogId}::uuid`
      )
      const rows = (result as unknown as Array<{ owners_count: number }>) ?? []
      expect(rows).toHaveLength(1)
      expect(rows[0].owners_count).not.toBe(999)
    })

    it('anon write blocked (DELETE) on watches_catalog_daily_snapshots', async () => {
      // Supabase PostgREST returns 204/null-error for DELETE that RLS blocks (0 rows matched).
      // Security assertion: the snapshot row must still exist in the DB.
      const anon = createClient(url, anonKey, { auth: { persistSession: false } })
      await anon
        .from('watches_catalog_daily_snapshots')
        .delete()
        .eq('catalog_id', catalogId)
      // Verify row still exists via service-role Drizzle
      const result = await db.execute(
        sql`SELECT id FROM watches_catalog_daily_snapshots WHERE catalog_id = ${catalogId}::uuid`
      )
      const rows = (result as unknown as Array<{ id: string }>) ?? []
      expect(rows).toHaveLength(1)
    })
  })
})
