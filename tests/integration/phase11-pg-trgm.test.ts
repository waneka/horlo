/**
 * Phase 11 Migration 3 integration tests — SRCH-08 acceptance:
 *   1. pg_trgm extension enabled (schema = extensions)
 *   2. GIN trigram indexes exist on profiles.username + profiles.bio
 *      with gin_trgm_ops opclass
 *   3. EXPLAIN for `username ILIKE '%...%'` uses the trigram index
 *      (not a Seq Scan) — this is the user-facing Phase 16 performance gate
 *
 * Gated on DATABASE_URL so CI stays green without the local stack.
 * Wave 0 contract per .planning/phases/11-schema-storage-foundation/11-VALIDATION.md.
 * Green after Plan 05's [BLOCKING] schema push runs Migration 3.
 *
 * Known flakiness: The EXPLAIN test depends on planner statistics. On a profiles
 * table with fewer than ~50 rows the planner may prefer a Seq Scan for low cost.
 * This file seeds 100 throwaway profiles in beforeAll so the trigram index becomes
 * the cheaper plan; cleanup runs in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { users, profiles } from '@/db/schema'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 11 pg_trgm — SRCH-08 extension + indexes + planner', () => {
  const SEED_COUNT = 100
  const seedIds: string[] = []

  beforeAll(async () => {
    // Seed throwaway profiles so the planner has sufficient cardinality to prefer
    // the trigram index over Seq Scan.
    const stamp = Date.now().toString(36)
    const userRows = Array.from({ length: SEED_COUNT }, (_, i) => ({
      id: randomUUID(),
      email: `trgm-${stamp}-${i}@horlo.test`,
    }))
    // The trigger auto-creates profile rows on users insert. We then UPDATE usernames
    // to unique deterministic values.
    await db.insert(users).values(userRows).onConflictDoNothing()
    seedIds.push(...userRows.map((u) => u.id))
    // Set usernames per seed user so username ILIKE queries find matches.
    for (let i = 0; i < userRows.length; i++) {
      const u = userRows[i]
      await db
        .update(profiles)
        .set({ username: `trgm_user_${stamp}_${i}`, bio: `trigram seed profile number ${i}` })
        .where(sql`${profiles.id} = ${u.id}::uuid`)
    }

    // ANALYZE to update planner statistics — without this the test is flaky on fresh DBs.
    await db.execute(sql`ANALYZE profiles`)
  }, 60_000)

  afterAll(async () => {
    if (seedIds.length === 0) return
    // Cascading delete from users removes profile rows (profile FK is ON DELETE CASCADE).
    await db.delete(users).where(inArray(users.id, seedIds))
  }, 60_000)

  it('pg_trgm extension is enabled (SRCH-08)', async () => {
    const result = await db.execute(sql`
      SELECT extname, extnamespace::regnamespace::text AS schema
        FROM pg_extension
       WHERE extname = 'pg_trgm'
    `)
    const rows = (result as unknown as Array<{ extname: string; schema: string }>) ?? []
    expect(rows).toHaveLength(1)
    expect(rows[0].extname).toBe('pg_trgm')
    // Supabase-idiomatic: extension lives in `extensions` schema, not `public`.
    expect(rows[0].schema).toBe('extensions')
  })

  it('GIN trigram indexes exist with gin_trgm_ops opclass (SRCH-08)', async () => {
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
      expect(r.indexdef).toMatch(/USING gin/i)
      expect(r.indexdef).toMatch(/gin_trgm_ops/)
    }
  })

  it('EXPLAIN SELECT ... WHERE username ILIKE uses the trigram index (SRCH-08 Phase 16 gate)', async () => {
    const result = await db.execute(sql`
      EXPLAIN SELECT id FROM profiles WHERE username ILIKE '%trgm_user%'
    `)
    const rows = (result as unknown as Array<Record<string, string>>) ?? []
    // drizzle's postgres.js execute returns rows with one key per EXPLAIN line.
    const plan = rows.map((r) => Object.values(r)[0]).join('\n')

    // Positive assertion: the trigram index appears in the plan.
    // Flakiness note: if this fails with a "Seq Scan" plan on a fresh DB, seed more rows
    // or run `ANALYZE profiles` before the EXPLAIN. beforeAll does both.
    expect(plan).toMatch(/profiles_username_trgm_idx/i)
    // Negative assertion: the plan must NOT be a pure Seq Scan on profiles (SRCH-08 user-facing gate).
    expect(plan).not.toMatch(/^Seq Scan on profiles\s*$/m)
  })
})
