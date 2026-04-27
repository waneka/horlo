/**
 * Phase 17 backfill idempotency test — CAT-05.
 *
 * Proves:
 *   1. First run: links watches WHERE catalog_id IS NULL → catalog rows created, watches.catalog_id set
 *   2. Second run: no-op (total linked: 0, catalog row count unchanged)
 *   3. Late-arriving unlinked row: backfill picks it up on the next invocation
 *   4. NULLS NOT DISTINCT dedup: two watches sharing (brand, model, NULL reference) collapse to one catalog row
 *
 * Gated on DATABASE_URL so CI stays green without the local Supabase stack.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

import { db } from '@/db'
import { users, watches, watchesCatalog } from '@/db/schema'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = `bf${Date.now().toString(36)}`

function runBackfillScript(): { stdout: string; status: number } {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'backfill-catalog.ts')
    const out = execFileSync('npx', ['tsx', scriptPath], {
      encoding: 'utf-8',
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { stdout: out, status: 0 }
  } catch (err: unknown) {
    // execFileSync throws on non-zero exit
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string }
    return {
      stdout: (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? ''),
      status: e.status ?? 1,
    }
  }
}

maybe('Phase 17 backfill — CAT-05 idempotency', () => {
  const userId = randomUUID()
  const seededWatchIds: string[] = []

  beforeAll(async () => {
    // Seed test user (required for watches FK)
    await db.insert(users).values({ id: userId, email: `${STAMP}@horlo.test` }).onConflictDoNothing()

    // Seed 5 watches with NULL catalog_id:
    //   - A/r1 × 2: same natural key — should collapse to 1 catalog row
    //   - B/r2 × 1: distinct key
    //   - C/null × 2: NULLS NOT DISTINCT — should collapse to 1 catalog row
    // Expected unique catalog rows: 3 (A, B, C)
    const seedWatches = [
      { brand: `Bf-${STAMP}-A`, model: 'Sub', reference: 'r1' },
      { brand: `Bf-${STAMP}-A`, model: 'Sub', reference: 'r1' },   // dup of above
      { brand: `Bf-${STAMP}-B`, model: 'Sub', reference: 'r2' },
      { brand: `Bf-${STAMP}-C`, model: 'Sub', reference: null as string | null },
      { brand: `Bf-${STAMP}-C`, model: 'Sub', reference: null as string | null },  // dup (NULLS NOT DISTINCT)
    ]
    for (const w of seedWatches) {
      const id = randomUUID()
      await db.insert(watches).values({
        id,
        userId,
        brand: w.brand,
        model: w.model,
        reference: w.reference,
        status: 'owned',
        movement: 'automatic',
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
      })
      seededWatchIds.push(id)
    }
  })

  afterAll(async () => {
    // Delete in dependency order: watches → catalog → users
    if (seededWatchIds.length > 0) {
      await db.delete(watches).where(inArray(watches.id, seededWatchIds))
    }
    await db.execute(sql`DELETE FROM watches_catalog WHERE brand LIKE ${`Bf-${STAMP}-%`}`)
    await db.execute(sql`DELETE FROM users WHERE id = ${userId}`)
  })

  it('first run links unlinked rows', async () => {
    const { stdout, status } = runBackfillScript()
    expect(status, `script exited non-zero:\n${stdout}`).toBe(0)
    expect(stdout).toMatch(/total linked: \d+/)
    expect(stdout).toMatch(/unlinked remaining: 0/)

    // All 5 seeded watches now have non-null catalog_id
    const result = await db.select({
      id: watches.id,
      catalogId: watches.catalogId,
    }).from(watches).where(inArray(watches.id, seededWatchIds))

    expect(result.length).toBe(5)
    for (const r of result) {
      expect(r.catalogId, `watch ${r.id} still has null catalog_id`).toBeTruthy()
    }

    // 3 unique catalog rows exist (A/r1, B/r2, C/null) — duplicates dedup'd by NULLS NOT DISTINCT
    const catalogRows = await db.select().from(watchesCatalog)
      .where(sql`brand LIKE ${`Bf-${STAMP}-%`}`)
    expect(catalogRows.length).toBe(3)
  })

  it('second run is a no-op', async () => {
    const { stdout, status } = runBackfillScript()
    expect(status, `script exited non-zero:\n${stdout}`).toBe(0)
    expect(stdout).toMatch(/total linked: 0/)
    expect(stdout).toMatch(/unlinked remaining: 0/)

    // Catalog row count unchanged
    const catalogRows = await db.select().from(watchesCatalog)
      .where(sql`brand LIKE ${`Bf-${STAMP}-%`}`)
    expect(catalogRows.length).toBe(3)

    // All watches still have the same non-null catalog_ids
    const result = await db.select({ id: watches.id, catalogId: watches.catalogId })
      .from(watches)
      .where(inArray(watches.id, seededWatchIds))
    for (const r of result) {
      expect(r.catalogId, `watch ${r.id} lost its catalog_id after second run`).toBeTruthy()
    }
  })

  it('zero-unlinked assertion fires when a row remains unlinked', async () => {
    // Insert a new watch (late-arriving row — simulates a watch added before Plan 03 landed).
    // The script must pick it up and link it on the next invocation.
    const newId = randomUUID()
    await db.insert(watches).values({
      id: newId,
      userId,
      brand: `Bf-${STAMP}-D`,
      model: 'Sub',
      reference: 'r4',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })
    seededWatchIds.push(newId)

    const { stdout, status } = runBackfillScript()
    expect(status, `script exited non-zero:\n${stdout}`).toBe(0)
    // Script detected and linked the new row
    expect(stdout).toMatch(/total linked: [1-9]/)
    expect(stdout).toMatch(/unlinked remaining: 0/)

    // New watch now has a catalog_id
    const after = await db.select({ catalogId: watches.catalogId })
      .from(watches)
      .where(inArray(watches.id, [newId]))
    expect(after[0].catalogId).toBeTruthy()
  })
})
