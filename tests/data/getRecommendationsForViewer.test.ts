import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Recommendation } from '@/lib/discoveryTypes'

// ---------------------------------------------------------------------------
// Integration tests (gated on NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
// seed real profiles + watches + follows, then assert the recommendation DAL
// composes tasteOverlap + candidate filtering + privacy correctly.
// Mirrors the precedent in tests/data/getFeedForUser.test.ts + getWearRailForViewer.test.ts.
// ---------------------------------------------------------------------------

const hasLocalDb =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasLocalDb ? describe : describe.skip

maybe('getRecommendationsForViewer — integration', () => {
  type DalT = typeof import('@/data/recommendations')
  type SchemaT = typeof import('@/db/schema')
  type DbT = typeof import('@/db')
  type WatchesDalT = typeof import('@/data/watches')

  let dal: DalT
  let schema: SchemaT
  let dbModule: DbT
  let watchDAL: WatchesDalT
  let viewer: { id: string; email: string }
  let similar: { id: string; email: string }
  let privatePeer: { id: string; email: string }
  let cleanup: () => Promise<void>

  const seedProfile = async (
    u: { id: string; email: string },
    username: string,
    opts: Partial<{ profilePublic: boolean; collectionPublic: boolean }> = {},
  ) => {
    await dbModule.db
      .insert(schema.users)
      .values({ id: u.id, email: u.email })
      .onConflictDoNothing()
    await dbModule.db
      .insert(schema.profiles)
      .values({ id: u.id, username })
      .onConflictDoNothing()
    await dbModule.db
      .insert(schema.profileSettings)
      .values({
        userId: u.id,
        profilePublic: opts.profilePublic ?? true,
        collectionPublic: opts.collectionPublic ?? true,
        wishlistPublic: true,
      })
      .onConflictDoNothing()
  }

  const seedOwned = async (
    userId: string,
    brand: string,
    model: string,
    imageUrl?: string,
  ) => {
    const w = await watchDAL.createWatch(userId, {
      brand,
      model,
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      imageUrl,
    })
    return w
  }

  const seedWishlist = async (userId: string, brand: string, model: string) => {
    return watchDAL.createWatch(userId, {
      brand,
      model,
      status: 'wishlist',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })
  }

  beforeAll(async () => {
    dal = await import('@/data/recommendations')
    schema = await import('@/db/schema')
    dbModule = await import('@/db')
    watchDAL = await import('@/data/watches')
    const { seedTwoUsers } = await import('../fixtures/users')
    const seed = await seedTwoUsers()
    viewer = seed.userA
    similar = seed.userB

    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })
    const res = await admin.auth.admin.createUser({
      email: `test-rec-priv-${Date.now()}@horlo.test`,
      password: 'pw-priv',
      email_confirm: true,
    })
    if (res.error) throw new Error(res.error.message)
    privatePeer = { id: res.data.user!.id, email: res.data.user!.email! }

    cleanup = async () => {
      await seed.cleanup()
      await admin.auth.admin.deleteUser(privatePeer.id)
    }

    const now = Date.now()
    await seedProfile(viewer, `rec-viewer-${now}`)
    await seedProfile(similar, `rec-similar-${now}`)
    await seedProfile(privatePeer, `rec-priv-${now}`, {
      profilePublic: false,
      collectionPublic: false,
    })
  }, 45_000)

  afterAll(async () => {
    if (!cleanup) return
    try {
      const { inArray } = await import('drizzle-orm')
      const userIds = [viewer.id, similar.id, privatePeer.id]
      await dbModule.db
        .delete(schema.watches)
        .where(inArray(schema.watches.userId, userIds))
    } catch {
      // best-effort
    }
    await cleanup()
  }, 45_000)

  it('Test 8: similar collector owns overlap + extras → recommends only extras (viewer-owned excluded)', async () => {
    // Viewer: 3 owned (Rolex Submariner, Tudor Black Bay, Seiko SKX)
    // Similar: SAME 3 + Omega Speedmaster + Rolex Daytona
    await seedOwned(viewer.id, 'Rolex', 'Submariner')
    await seedOwned(viewer.id, 'Tudor', 'Black Bay')
    await seedOwned(viewer.id, 'Seiko', 'SKX')
    await seedOwned(similar.id, 'Rolex', 'Submariner')
    await seedOwned(similar.id, 'Tudor', 'Black Bay')
    await seedOwned(similar.id, 'Seiko', 'SKX')
    await seedOwned(similar.id, 'Omega', 'Speedmaster')
    await seedOwned(similar.id, 'Rolex', 'Daytona')

    const recs: Recommendation[] = await dal.getRecommendationsForViewer(
      viewer.id,
    )

    expect(recs.length).toBeLessThanOrEqual(12)
    // Must include extras
    const keys = recs.map((r) => `${r.brand.toLowerCase()}|${r.model.toLowerCase()}`)
    expect(keys).toContain('omega|speedmaster')
    expect(keys).toContain('rolex|daytona')
    // Must NOT include viewer-owned
    expect(keys).not.toContain('rolex|submariner')
    expect(keys).not.toContain('tudor|black bay')
    expect(keys).not.toContain('seiko|skx')
  })

  it('Test 9: viewer-wishlisted excluded — wishlist Omega Speedmaster, it drops out of recs', async () => {
    await seedWishlist(viewer.id, 'Omega', 'Speedmaster')
    const recs = await dal.getRecommendationsForViewer(viewer.id)
    const keys = recs.map((r) => `${r.brand.toLowerCase()}|${r.model.toLowerCase()}`)
    expect(keys).not.toContain('omega|speedmaster')
    // Rolex Daytona still in
    expect(keys).toContain('rolex|daytona')
  })

  it('Test 10: normalized dedupe — "Rolex SUBMARINER" vs "Rolex submariner" match', async () => {
    // Owned by viewer is "Rolex Submariner"; if similar adds "Rolex SUBMARINER"
    // (same key after .trim().toLowerCase()), it must NOT appear.
    await seedOwned(similar.id, 'Rolex ', 'SUBMARINER')
    const recs = await dal.getRecommendationsForViewer(viewer.id)
    const keys = recs.map((r) => `${r.brand.toLowerCase().trim()}|${r.model.toLowerCase().trim()}`)
    // The normalized key "rolex|submariner" must appear at MOST 0 times (viewer owns it).
    expect(keys.filter((k) => k === 'rolex|submariner')).toHaveLength(0)
  })

  it('Test 11: private profiles excluded from seed pool', async () => {
    // privatePeer owns a VERY unique watch; if they were sampled, it would show up.
    await seedOwned(privatePeer.id, 'Grand Seiko', 'Snowflake-Private')
    const recs = await dal.getRecommendationsForViewer(viewer.id)
    const keys = recs.map(
      (r) => `${r.brand.toLowerCase()}|${r.model.toLowerCase()}`,
    )
    expect(keys).not.toContain('grand seiko|snowflake-private')
  })

  it('Test 12: empty owned collection returns empty recs', async () => {
    // Create a new isolated viewer by truncating this viewer's watches.
    // NOTE: prior tests seeded owned+wishlist watches for `viewer`. The empty
    // branch is exercised by creating a fresh stateless query against a
    // nonexistent user. For isolation we simply verify that a user with 0
    // owned watches returns [].
    const isolatedRecs = await dal.getRecommendationsForViewer(
      '99999999-9999-4999-8999-999999999999',
    )
    expect(isolatedRecs).toEqual([])
  })

  it('Test 13: every returned Recommendation has a non-empty rationale string', async () => {
    const recs = await dal.getRecommendationsForViewer(viewer.id)
    for (const r of recs) {
      expect(typeof r.rationale).toBe('string')
      expect(r.rationale.length).toBeGreaterThan(0)
    }
  })

  it('Test 14: results sorted by score DESC (stable)', async () => {
    const recs = await dal.getRecommendationsForViewer(viewer.id)
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score)
    }
  })
})
