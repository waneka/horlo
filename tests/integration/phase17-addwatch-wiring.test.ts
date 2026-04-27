/**
 * Phase 17 Plan 03 — Integration: addWatch → watches_catalog population (CAT-08)
 *
 * Gated on DATABASE_URL so the suite skips cleanly in CI without local Supabase.
 * Inserts a test user directly via SQL (avoids Supabase Admin API / SUPABASE_SERVICE_ROLE_KEY dep).
 *
 * Requirement: CAT-08
 * Truth: "addWatch Server Action populates watches.catalog_id after successful createWatch"
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

import { db } from '@/db'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = Date.now().toString(36)

// Mocks hoisted before any action imports
vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/data/activities', () => ({ logActivity: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/notifications/logger', () => ({ logNotification: vi.fn(() => Promise.resolve()) }))
vi.mock('@/data/notifications', () => ({ findOverlapRecipients: vi.fn(() => Promise.resolve([])) }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn(() => Promise.resolve(null)) }))

import { addWatch } from '@/app/actions/watches'
import { getCurrentUser } from '@/lib/auth'

maybe('Phase 17 Plan 03 — addWatch wiring → catalog_id populated (CAT-08)', () => {
  const userId = randomUUID()
  const stampedBrand = `Rolex-Phase17-${STAMP}`

  beforeAll(async () => {
    // Insert a minimal auth.users row directly — avoids SUPABASE_SERVICE_ROLE_KEY dep
    await db.execute(sql`
      INSERT INTO auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at)
      VALUES (
        ${userId}::uuid,
        ${'phase17-' + STAMP + '@horlo.test'},
        'authenticated',
        'authenticated',
        now(),
        now(),
        now()
      )
      ON CONFLICT (id) DO NOTHING
    `)

    // Configure auth mock to return the seeded test user
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: `phase17-${STAMP}@horlo.test` })
  }, 30_000)

  afterAll(async () => {
    // Clean up watches, catalog rows, and the test user
    await db.execute(
      sql`DELETE FROM watches WHERE user_id = ${userId}::uuid`
    )
    await db.execute(
      sql`DELETE FROM watches_catalog WHERE brand LIKE ${'Rolex-Phase17-' + STAMP + '%'}`
    )
    await db.execute(
      sql`DELETE FROM auth.users WHERE id = ${userId}::uuid`
    )
    vi.restoreAllMocks()
  }, 30_000)

  it('addWatch populates watches.catalog_id after successful createWatch', async () => {
    const result = await addWatch({
      brand: stampedBrand,
      model: 'Submariner',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    const watchId = result.data.id
    expect(watchId).toBeTruthy()

    // Assert: watches.catalog_id is non-null
    const watchRows = await db.execute<{ catalog_id: string | null }>(
      sql`SELECT catalog_id FROM watches WHERE id = ${watchId}::uuid`
    ) as unknown as Array<{ catalog_id: string | null }>
    expect(watchRows[0]?.catalog_id).toBeTruthy()
    const catalogId = watchRows[0]!.catalog_id!

    // Assert: the catalog row exists with source='user_promoted'
    const catalogRows = await db.execute<{ id: string; source: string }>(
      sql`SELECT id, source FROM watches_catalog WHERE brand_normalized = lower(trim(${stampedBrand})) LIMIT 1`
    ) as unknown as Array<{ id: string; source: string }>
    expect(catalogRows).toHaveLength(1)
    expect(catalogRows[0]!.source).toBe('user_promoted')

    // Assert: the catalog row id matches watches.catalog_id
    expect(catalogRows[0]!.id).toBe(catalogId)
  })
})
