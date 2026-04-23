import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import type { Watch } from '@/lib/types'

// ---------------------------------------------------------------------------
// PART A — Unit tests (always run): mock Drizzle to assert the privacy matrix
// enforced by getWatchByIdForViewer's WHERE clause. The mocked chain returns
// whatever rows the individual test sets in `watchRows` (the row shape is the
// JOIN projection: { watch, profilePublic, collectionPublic, wishlistPublic }).
// ---------------------------------------------------------------------------

type Call = { op: string; args: unknown[] }
let watchRows: unknown[] = []
let calls: Call[] = []

function makeWatchChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: (...args: unknown[]) => {
      calls.push({ op: 'watch.from', args })
      return chain
    },
    innerJoin: (...args: unknown[]) => {
      calls.push({ op: 'watch.innerJoin', args })
      return chain
    },
    where: (...args: unknown[]) => {
      calls.push({ op: 'watch.where', args })
      return chain
    },
    limit: (...args: unknown[]) => {
      calls.push({ op: 'watch.limit', args })
      return Promise.resolve(watchRows)
    },
  } as never
  return chain
}

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      calls.push({ op: 'select', args })
      return makeWatchChain()
    },
  },
}))

import { getWatchByIdForViewer } from '@/data/watches'

const VIEWER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const OWNER = '11111111-2222-4333-8444-555555555555'
const WATCH_ID = 'ffffffff-1111-4222-8333-444444444444'

// Helper to build a full watches row as returned by a Drizzle select({ watch: watches, ... })
function makeWatchRow(overrides: Partial<{
  id: string
  userId: string
  status: Watch['status']
  brand: string
  model: string
}> = {}) {
  return {
    id: overrides.id ?? WATCH_ID,
    userId: overrides.userId ?? OWNER,
    brand: overrides.brand ?? 'Rolex',
    model: overrides.model ?? 'Submariner',
    reference: null,
    status: overrides.status ?? ('owned' as Watch['status']),
    pricePaid: null,
    targetPrice: null,
    marketPrice: null,
    movement: 'automatic' as const,
    complications: [],
    caseSizeMm: null,
    lugToLugMm: null,
    waterResistanceM: null,
    strapType: null,
    crystalType: null,
    dialColor: null,
    styleTags: [],
    designTraits: [],
    roleTags: [],
    acquisitionDate: null,
    productionYear: null,
    isFlaggedDeal: null,
    isChronometer: null,
    notes: null,
    notesPublic: true,
    notesUpdatedAt: null,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('getWatchByIdForViewer — privacy matrix (unit)', () => {
  beforeEach(() => {
    watchRows = []
    calls = []
  })

  it('Unit 1: returns null when DB yields no rows', async () => {
    watchRows = []
    const result = await getWatchByIdForViewer(VIEWER, WATCH_ID)
    expect(result).toBeNull()
  })

  it('Unit 2: owner path — viewerId === watch.userId returns { watch, isOwner: true }', async () => {
    // Owner short-circuits via OR branch; the SQL still runs with a JOIN so the
    // row projection includes profile flags (but the WHERE admits because the
    // owner branch is true regardless of flag values).
    watchRows = [
      {
        watch: makeWatchRow({ userId: VIEWER }),
        profilePublic: false, // flags irrelevant for owner branch
        collectionPublic: false,
        wishlistPublic: false,
      },
    ]
    const result = await getWatchByIdForViewer(VIEWER, WATCH_ID)
    expect(result).not.toBeNull()
    expect(result!.isOwner).toBe(true)
    expect(result!.watch.id).toBe(WATCH_ID)
  })

  it('Unit 3: non-owner + profile_public=false path — returns null', async () => {
    // Simulate DB: profile_public=false means the WHERE filter eliminated the
    // row, so no rows come back.
    watchRows = []
    const result = await getWatchByIdForViewer(VIEWER, WATCH_ID)
    expect(result).toBeNull()
  })

  it('Unit 4: non-owner + owned watch + collection_public=true → { watch, isOwner: false }', async () => {
    watchRows = [
      {
        watch: makeWatchRow({ userId: OWNER, status: 'owned' }),
        profilePublic: true,
        collectionPublic: true,
        wishlistPublic: false,
      },
    ]
    const result = await getWatchByIdForViewer(VIEWER, WATCH_ID)
    expect(result).not.toBeNull()
    expect(result!.isOwner).toBe(false)
    expect(result!.watch.status).toBe('owned')
  })

  it('Unit 5: non-owner + owned watch + collection_public=false → null', async () => {
    // DB WHERE clause filters the row out; no rows returned.
    watchRows = []
    const result = await getWatchByIdForViewer(VIEWER, WATCH_ID)
    expect(result).toBeNull()
  })

  it('Unit 6: non-owner + wishlist watch + wishlist_public=true → { watch, isOwner: false }', async () => {
    watchRows = [
      {
        watch: makeWatchRow({ userId: OWNER, status: 'wishlist' }),
        profilePublic: true,
        collectionPublic: false,
        wishlistPublic: true,
      },
    ]
    const result = await getWatchByIdForViewer(VIEWER, WATCH_ID)
    expect(result).not.toBeNull()
    expect(result!.isOwner).toBe(false)
    expect(result!.watch.status).toBe('wishlist')
  })

  it('Unit 7: non-owner + wishlist watch + wishlist_public=false → null', async () => {
    watchRows = []
    const result = await getWatchByIdForViewer(VIEWER, WATCH_ID)
    expect(result).toBeNull()
  })

  it('Unit 8: non-owner + sold watch uses collection_public', async () => {
    watchRows = [
      {
        watch: makeWatchRow({ userId: OWNER, status: 'sold' }),
        profilePublic: true,
        collectionPublic: true,
        wishlistPublic: false,
      },
    ]
    const result = await getWatchByIdForViewer(VIEWER, WATCH_ID)
    expect(result).not.toBeNull()
    expect(result!.isOwner).toBe(false)
    expect(result!.watch.status).toBe('sold')
  })

  it('Unit 9: non-owner + grail watch uses collection_public', async () => {
    watchRows = [
      {
        watch: makeWatchRow({ userId: OWNER, status: 'grail' }),
        profilePublic: true,
        collectionPublic: true,
        wishlistPublic: false,
      },
    ]
    const result = await getWatchByIdForViewer(VIEWER, WATCH_ID)
    expect(result).not.toBeNull()
    expect(result!.isOwner).toBe(false)
    expect(result!.watch.status).toBe('grail')
  })

  it('Unit 10: maps DB row through mapRowToWatch', async () => {
    const row = makeWatchRow({
      userId: OWNER,
      status: 'owned',
      brand: 'Omega',
      model: 'Speedmaster',
    })
    watchRows = [
      {
        watch: row,
        profilePublic: true,
        collectionPublic: true,
        wishlistPublic: true,
      },
    ]
    const result = await getWatchByIdForViewer(VIEWER, WATCH_ID)
    expect(result).not.toBeNull()
    expect(result!.watch.id).toBe(row.id)
    expect(result!.watch.brand).toBe('Omega')
    expect(result!.watch.status).toBe('owned')
    // mapRowToWatch strips userId / createdAt / updatedAt — verify shape
    expect((result!.watch as unknown as { userId?: string }).userId).toBeUndefined()
  })

  it('Unit 11: single JOIN query — one select, one innerJoin, one where, one limit', async () => {
    await getWatchByIdForViewer(VIEWER, WATCH_ID)
    expect(calls.filter((c) => c.op === 'select')).toHaveLength(1)
    expect(calls.filter((c) => c.op === 'watch.innerJoin')).toHaveLength(1)
    expect(calls.filter((c) => c.op === 'watch.where')).toHaveLength(1)
    expect(calls.filter((c) => c.op === 'watch.limit')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// PART B — Integration tests (run only against a live local Supabase stack).
// Exercises the full privacy matrix end-to-end: owner short-circuit, public/
// private profile gate, per-tab flag, uniform-null for missing vs private.
// Trigger-aware seeding: Phase 7's on_public_user_created trigger auto-creates
// profiles + profile_settings rows on every public.users insert — UPDATE the
// trigger-generated rows (do NOT INSERT) to avoid PK collisions.
// ---------------------------------------------------------------------------

const hasLocalDb =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasLocalDb ? describe : describe.skip

maybe('getWatchByIdForViewer — integration', () => {
  type DalT = typeof import('@/data/watches')
  type SchemaT = typeof import('@/db/schema')
  type DbT = typeof import('@/db')

  let dal: DalT
  let schema: SchemaT
  let dbModule: DbT
  let userA: { id: string; email: string }
  let userB: { id: string; email: string }
  let bOwnedWatchId: string
  let bWishlistWatchId: string
  let cleanup: () => Promise<void>

  // Trigger-aware: UPDATE the auto-created profiles row (don't INSERT) to avoid
  // PK collision with the on_public_user_created trigger.
  const upsertProfile = async (userId: string, username: string) => {
    await dbModule.db
      .insert(schema.profiles)
      .values({ id: userId, username })
      .onConflictDoUpdate({
        target: schema.profiles.id,
        set: { username },
      })
    // profile_settings also auto-created by trigger with defaults (all public).
    // No-op insert ensures row exists without clobbering any test-specific state.
    await dbModule.db
      .insert(schema.profileSettings)
      .values({
        userId,
        profilePublic: true,
        collectionPublic: true,
        wishlistPublic: true,
      })
      .onConflictDoUpdate({
        target: schema.profileSettings.userId,
        set: {
          profilePublic: true,
          collectionPublic: true,
          wishlistPublic: true,
        },
      })
  }

  const setProfileFlags = async (
    userId: string,
    flags: Partial<{
      profilePublic: boolean
      collectionPublic: boolean
      wishlistPublic: boolean
    }>,
  ) => {
    const { eq: eqFn } = await import('drizzle-orm')
    await dbModule.db
      .update(schema.profileSettings)
      .set(flags)
      .where(eqFn(schema.profileSettings.userId, userId))
  }

  beforeAll(async () => {
    dal = await import('@/data/watches')
    schema = await import('@/db/schema')
    dbModule = await import('@/db')
    const { seedTwoUsers } = await import('../fixtures/users')
    const seed = await seedTwoUsers()
    userA = seed.userA
    userB = seed.userB

    await upsertProfile(userA.id, `rdb-viewer-${Date.now()}`)
    await upsertProfile(userB.id, `rdb-owner-${Date.now()}`)

    // Seed B with one owned + one wishlist watch
    const owned = await dal.createWatch(userB.id, {
      brand: 'Rolex',
      model: 'Submariner',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    } as never)
    const wishlist = await dal.createWatch(userB.id, {
      brand: 'Omega',
      model: 'Speedmaster',
      status: 'wishlist',
      movement: 'manual',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    } as never)
    bOwnedWatchId = owned.id
    bWishlistWatchId = wishlist.id

    cleanup = async () => {
      try {
        const { inArray } = await import('drizzle-orm')
        await dbModule.db
          .delete(schema.watches)
          .where(inArray(schema.watches.userId, [userA.id, userB.id]))
      } catch {
        // best-effort
      }
      await seed.cleanup()
    }
  }, 45_000)

  afterAll(async () => {
    if (cleanup) await cleanup()
  }, 45_000)

  it('Integration 1: A views B\'s owned watch (profile_public=true, collection_public=true) → non-owner', async () => {
    // Ensure default flags
    await setProfileFlags(userB.id, {
      profilePublic: true,
      collectionPublic: true,
      wishlistPublic: true,
    })
    const result = await dal.getWatchByIdForViewer(userA.id, bOwnedWatchId)
    expect(result).not.toBeNull()
    expect(result!.isOwner).toBe(false)
    expect(result!.watch.id).toBe(bOwnedWatchId)
  })

  it("Integration 2: B views B's own owned watch → isOwner=true", async () => {
    const result = await dal.getWatchByIdForViewer(userB.id, bOwnedWatchId)
    expect(result).not.toBeNull()
    expect(result!.isOwner).toBe(true)
  })

  it("Integration 3: B.collection_public=false → A sees null for B's owned; B still sees own", async () => {
    await setProfileFlags(userB.id, { collectionPublic: false })
    try {
      const aResult = await dal.getWatchByIdForViewer(userA.id, bOwnedWatchId)
      expect(aResult).toBeNull()
      const bResult = await dal.getWatchByIdForViewer(userB.id, bOwnedWatchId)
      expect(bResult).not.toBeNull()
      expect(bResult!.isOwner).toBe(true)
    } finally {
      await setProfileFlags(userB.id, { collectionPublic: true })
    }
  })

  it("Integration 4: B.wishlist_public=false → A sees null for wishlist; still sees owned", async () => {
    await setProfileFlags(userB.id, { wishlistPublic: false })
    try {
      const wishlistResult = await dal.getWatchByIdForViewer(userA.id, bWishlistWatchId)
      expect(wishlistResult).toBeNull()
      const ownedResult = await dal.getWatchByIdForViewer(userA.id, bOwnedWatchId)
      expect(ownedResult).not.toBeNull()
      expect(ownedResult!.isOwner).toBe(false)
    } finally {
      await setProfileFlags(userB.id, { wishlistPublic: true })
    }
  })

  it('Integration 5: B.profile_public=false → A sees null for BOTH; B still sees own', async () => {
    await setProfileFlags(userB.id, { profilePublic: false })
    try {
      const aOwned = await dal.getWatchByIdForViewer(userA.id, bOwnedWatchId)
      const aWishlist = await dal.getWatchByIdForViewer(userA.id, bWishlistWatchId)
      expect(aOwned).toBeNull()
      expect(aWishlist).toBeNull()
      const bOwned = await dal.getWatchByIdForViewer(userB.id, bOwnedWatchId)
      expect(bOwned).not.toBeNull()
      expect(bOwned!.isOwner).toBe(true)
    } finally {
      await setProfileFlags(userB.id, { profilePublic: true })
    }
  })

  it('Integration 6: non-existent watchId → null regardless of viewer', async () => {
    const bogusId = '00000000-0000-4000-8000-000000000000'
    const aResult = await dal.getWatchByIdForViewer(userA.id, bogusId)
    const bResult = await dal.getWatchByIdForViewer(userB.id, bogusId)
    expect(aResult).toBeNull()
    expect(bResult).toBeNull()
  })
})
