/**
 * Phase 11 schema smoke tests — existence + shape assertions for the
 * migration outputs. Combines WYWT-09 (wear_events extension + enum +
 * note CHECK), WYWT-13 (wear-photos bucket), and SRCH-08 (pg_trgm extension
 * + GIN indexes) because all three are simple existence checks against
 * a post-migration local DB.
 *
 * Wave 0 contract per .planning/phases/11-schema-storage-foundation/11-VALIDATION.md.
 * Written in Plan 01 but only exercises green assertions after Plan 05's
 * [BLOCKING] schema push runs all 5 migrations locally.
 *
 * Gated on DATABASE_URL so this stays skipped in CI without the local stack
 * (mirrors the tests/integration/home-privacy.test.ts pattern).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'

import { db } from '@/db'
import { users, wearEvents, profileSettings, watches } from '@/db/schema'
import { eq } from 'drizzle-orm'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 11 schema — WYWT-09 / WYWT-13 / SRCH-08 existence checks', () => {
  // WYWT-09: wear_visibility enum exists with correct values
  it('wear_visibility enum has values public, followers, private (WYWT-09)', async () => {
    const result = await db.execute(sql`
      SELECT enumlabel
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'wear_visibility'
       ORDER BY e.enumsortorder
    `)
    const rows = (result as unknown as Array<{ enumlabel: string }>) ?? []
    const labels = rows.map((r) => r.enumlabel)
    expect(labels).toEqual(['public', 'followers', 'private'])
  })

  // WYWT-09: wear_events has photo_url (text, nullable) and visibility (wear_visibility, not null, default 'public')
  it('wear_events has photo_url and visibility columns (WYWT-09)', async () => {
    const result = await db.execute(sql`
      SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'wear_events'
         AND column_name IN ('photo_url', 'visibility')
       ORDER BY column_name
    `)
    const rows = (result as unknown as Array<{
      column_name: string
      data_type: string
      udt_name: string
      is_nullable: string
      column_default: string | null
    }>) ?? []
    const byName = Object.fromEntries(rows.map((r) => [r.column_name, r]))
    expect(byName.photo_url).toBeDefined()
    expect(byName.photo_url.data_type).toBe('text')
    expect(byName.photo_url.is_nullable).toBe('YES')
    expect(byName.visibility).toBeDefined()
    expect(byName.visibility.udt_name).toBe('wear_visibility')
    expect(byName.visibility.is_nullable).toBe('NO')
    expect(byName.visibility.column_default).toMatch(/'public'::wear_visibility/)
  })

  // WYWT-09: wear_events.note has CHECK length <= 200 — exercise by attempting a 201-char insert
  describe('wear_events.note CHECK constraint (WYWT-09)', () => {
    const testUserId = '00000000-0000-0000-0000-0000000b1101'
    let testWatchId: string

    beforeAll(async () => {
      // Seed a user + watch so the CHECK-violating insert has valid FK targets.
      await db
        .insert(users)
        .values({ id: testUserId, email: `check-${Date.now()}@horlo.test` })
        .onConflictDoNothing()
      const [w] = await db
        .insert(watches)
        .values({
          userId: testUserId,
          brand: 'CheckBrand',
          model: 'CheckModel',
          status: 'owned',
          movement: 'automatic',
        })
        .returning()
      testWatchId = w.id
    }, 30_000)

    afterAll(async () => {
      await db.delete(wearEvents).where(eq(wearEvents.userId, testUserId))
      await db.delete(watches).where(eq(watches.userId, testUserId))
      await db.delete(profileSettings).where(eq(profileSettings.userId, testUserId))
      await db.delete(users).where(eq(users.id, testUserId))
    }, 30_000)

    it('rejects wear_events insert with note length > 200', async () => {
      const longNote = 'x'.repeat(201)
      await expect(
        db.insert(wearEvents).values({
          userId: testUserId,
          watchId: testWatchId,
          wornDate: '2026-04-22',
          note: longNote,
        }),
      ).rejects.toThrow(/wear_events_note_length|check constraint/i)
    })

    it('accepts wear_events insert with note length exactly 200', async () => {
      const okNote = 'x'.repeat(200)
      const [row] = await db
        .insert(wearEvents)
        .values({
          userId: testUserId,
          watchId: testWatchId,
          wornDate: '2026-04-23',
          note: okNote,
        })
        .returning()
      expect(row.note).toHaveLength(200)
    })
  })

  // WYWT-13: wear-photos Storage bucket exists and is private
  it('wear-photos storage bucket exists and is private (WYWT-13)', async () => {
    const result = await db.execute(sql`
      SELECT id, public FROM storage.buckets WHERE id = 'wear-photos'
    `)
    const rows = (result as unknown as Array<{ id: string; public: boolean }>) ?? []
    expect(rows).toHaveLength(1)
    expect(rows[0].public).toBe(false)
  })

  // SRCH-08: pg_trgm extension enabled (ideally in extensions schema)
  it('pg_trgm extension is enabled (SRCH-08)', async () => {
    const result = await db.execute(sql`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'
    `)
    const rows = (result as unknown as Array<{ extname: string }>) ?? []
    expect(rows).toHaveLength(1)
  })

  // SRCH-08: GIN trigram indexes on profiles.username and profiles.bio exist
  it('GIN trigram indexes exist on profiles.username and profiles.bio (SRCH-08)', async () => {
    const result = await db.execute(sql`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN ('profiles_username_trgm_idx', 'profiles_bio_trgm_idx')
       ORDER BY indexname
    `)
    const rows = (result as unknown as Array<{ indexname: string; indexdef: string }>) ?? []
    expect(rows.map((r) => r.indexname)).toEqual([
      'profiles_bio_trgm_idx',
      'profiles_username_trgm_idx',
    ])
    for (const r of rows) {
      expect(r.indexdef).toMatch(/gin/i)
      expect(r.indexdef).toMatch(/gin_trgm_ops/)
    }
  })

  // SRCH-08: EXPLAIN shows username ILIKE uses the GIN trigram index, not a Seq Scan
  it('username ILIKE uses GIN trigram index (SRCH-08)', async () => {
    const result = await db.execute(sql`
      EXPLAIN SELECT id FROM profiles WHERE username ILIKE '%tyler%'
    `)
    const rows = (result as unknown as Array<Record<string, string>>) ?? []
    // drizzle's execute returns postgres.js result rows; EXPLAIN returns one column named 'QUERY PLAN'.
    const plan = rows.map((r) => Object.values(r)[0]).join('\n')
    // Bitmap Index Scan on profiles_username_trgm_idx is the expected plan step.
    expect(plan).toMatch(/profiles_username_trgm_idx/i)
  })
})
