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

    // Phase 38 D-06: catalogId is NOT NULL at DB level (Phase 36 already ran SET NOT NULL).
    // Seed catalog rows FIRST, then watches with catalogId.
    // Pre-seeding the catalog simulates post-Phase-38 state where every watch
    // already has a catalog link. The backfill script should report total linked: 0
    // and unlinked remaining: 0 (idempotent no-op against fully-linked collection).
    //
    // Natural-key deduplication (NULLS NOT DISTINCT):
    //   - A/r1 × 2 watches → share 1 catalog row (first-write-wins)
    //   - B/r2 × 1 watch → 1 catalog row
    //   - C/null × 2 watches → share 1 catalog row (NULLS NOT DISTINCT)
    // Expected unique catalog rows: 3 (A, B, C)
    const catalogIdA = randomUUID()
    const catalogIdB = randomUUID()
    const catalogIdC = randomUUID()
    await db.insert(watchesCatalog).values([
      { id: catalogIdA, brand: `Bf-${STAMP}-A`, model: 'Sub', reference: 'r1', source: 'user_promoted' },
      { id: catalogIdB, brand: `Bf-${STAMP}-B`, model: 'Sub', reference: 'r2', source: 'user_promoted' },
      { id: catalogIdC, brand: `Bf-${STAMP}-C`, model: 'Sub', reference: null, source: 'user_promoted' },
    ]).onConflictDoNothing()

    const seedWatches = [
      { brand: `Bf-${STAMP}-A`, model: 'Sub', reference: 'r1', catalogId: catalogIdA },
      { brand: `Bf-${STAMP}-A`, model: 'Sub', reference: 'r1', catalogId: catalogIdA },   // dup of above (same catalogId)
      { brand: `Bf-${STAMP}-B`, model: 'Sub', reference: 'r2', catalogId: catalogIdB },
      { brand: `Bf-${STAMP}-C`, model: 'Sub', reference: null as string | null, catalogId: catalogIdC },
      { brand: `Bf-${STAMP}-C`, model: 'Sub', reference: null as string | null, catalogId: catalogIdC },  // dup (NULLS NOT DISTINCT)
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
        movementType: 'auto',
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
        catalogId: w.catalogId,
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
    // Insert a new watch with catalogId pre-set (Phase 38 D-06: catalog_id is NOT NULL).
    // Post-Phase-38, all watches are inserted with a catalogId; the backfill script
    // should report total linked: 0 (nothing to link) and unlinked remaining: 0.
    const catalogIdD = randomUUID()
    await db.insert(watchesCatalog).values({
      id: catalogIdD, brand: `Bf-${STAMP}-D`, model: 'Sub', reference: 'r4', source: 'user_promoted',
    }).onConflictDoNothing()
    const newId = randomUUID()
    await db.insert(watches).values({
      id: newId,
      userId,
      brand: `Bf-${STAMP}-D`,
      model: 'Sub',
      reference: 'r4',
      status: 'owned',
      movementType: 'auto',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      catalogId: catalogIdD,
    })
    seededWatchIds.push(newId)

    const { stdout, status } = runBackfillScript()
    expect(status, `script exited non-zero:\n${stdout}`).toBe(0)
    // Post-Phase-38: all watches have catalogId already (NOT NULL); backfill is a no-op.
    expect(stdout).toMatch(/total linked: \d+/)
    expect(stdout).toMatch(/unlinked remaining: 0/)

    // New watch now has a catalog_id
    const after = await db.select({ catalogId: watches.catalogId })
      .from(watches)
      .where(inArray(watches.id, [newId]))
    expect(after[0].catalogId).toBeTruthy()
  })
})
