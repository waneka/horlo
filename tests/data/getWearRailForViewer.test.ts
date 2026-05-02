import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import type { WywtTile } from '@/lib/wywtTypes'

// ---------------------------------------------------------------------------
// PART A — Unit tests (always run): mock Drizzle to assert the SQL shape
// built by getWearRailForViewer. Verifies JOIN targets, 48h cutoff predicate,
// wear_visibility per-row privacy gate, single WHERE clause, ordering.
// ---------------------------------------------------------------------------

type Call = { op: string; args: unknown[] }
let followingRows: Array<{ id: string }> = []
let wearRows: unknown[] = []
let calls: Call[] = []
let selectCount = 0

function makeFollowingChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: (...args: unknown[]) => {
      calls.push({ op: 'follows.from', args })
      return chain
    },
    where: (...args: unknown[]) => {
      calls.push({ op: 'follows.where', args })
      return Promise.resolve(followingRows)
    },
  } as never
  return chain
}

function makeWearChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: (...args: unknown[]) => {
      calls.push({ op: 'wear.from', args })
      return chain
    },
    innerJoin: (...args: unknown[]) => {
      calls.push({ op: 'wear.innerJoin', args })
      return chain
    },
    leftJoin: (...args: unknown[]) => {
      calls.push({ op: 'wear.leftJoin', args })
      return chain
    },
    where: (...args: unknown[]) => {
      calls.push({ op: 'wear.where', args })
      return chain
    },
    orderBy: (...args: unknown[]) => {
      calls.push({ op: 'wear.orderBy', args })
      return Promise.resolve(wearRows)
    },
  } as never
  return chain
}

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      selectCount += 1
      calls.push({ op: 'select', args })
      // First select = follows; subsequent = wear events (the DAL issues 2
      // selects: one to resolve followingIds, one for the big JOIN).
      return selectCount === 1 ? makeFollowingChain() : makeWearChain()
    },
    insert: () => makeWearChain(),
  },
}))

import { getWearRailForViewer } from '@/data/wearEvents'

const VIEWER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('getWearRailForViewer — SQL shape (unit)', () => {
  beforeEach(() => {
    followingRows = []
    wearRows = []
    calls = []
    selectCount = 0
  })

  it('Unit 1: returns { tiles: [], viewerId } when no rows match', async () => {
    const result = await getWearRailForViewer(VIEWER)
    expect(result).toEqual({ tiles: [], viewerId: VIEWER })
  })

  it('Unit 2: issues 2 selects (follows resolve, then wear JOIN)', async () => {
    await getWearRailForViewer(VIEWER)
    const selects = calls.filter((c) => c.op === 'select')
    expect(selects).toHaveLength(2)
  })

  it('Unit 3: wear query uses 3 innerJoin calls (profiles, profileSettings, watches)', async () => {
    await getWearRailForViewer(VIEWER)
    const joinOps = calls.filter((c) => c.op === 'wear.innerJoin')
    expect(joinOps).toHaveLength(3)
  })

  it('Unit 4: wear query attaches exactly one where() clause', async () => {
    await getWearRailForViewer(VIEWER)
    const whereCalls = calls.filter((c) => c.op === 'wear.where')
    expect(whereCalls).toHaveLength(1)
  })

  it('Unit 5: wear query orders by wornDate DESC then createdAt DESC (2 args)', async () => {
    await getWearRailForViewer(VIEWER)
    const orderBy = calls.find((c) => c.op === 'wear.orderBy')
    expect(orderBy).toBeDefined()
    expect(orderBy!.args).toHaveLength(2)
  })

  it('Unit 6: dedupes to most-recent-per-actor — first row per userId wins', async () => {
    wearRows = [
      // user-A has 2 rows sorted DESC; only the first (most recent) should stay
      {
        wearId: 'we-1',
        userId: 'user-A',
        watchId: 'w-A1',
        wornDate: '2026-04-21',
        note: 'today',
        createdAt: new Date('2026-04-21T10:00:00Z'),
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        brand: 'Rolex',
        model: 'GMT',
        imageUrl: null,
      },
      {
        wearId: 'we-0',
        userId: 'user-A',
        watchId: 'w-A0',
        wornDate: '2026-04-20',
        note: 'yesterday',
        createdAt: new Date('2026-04-20T10:00:00Z'),
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        brand: 'Rolex',
        model: 'Sub',
        imageUrl: null,
      },
    ]
    const result = await getWearRailForViewer(VIEWER)
    expect(result.tiles).toHaveLength(1)
    expect(result.tiles[0].wearEventId).toBe('we-1')
    expect(result.tiles[0].watchId).toBe('w-A1')
    expect(result.tiles[0].isSelf).toBe(false)
  })

  it('Unit 7: marks viewer-own rows with isSelf=true', async () => {
    wearRows = [
      {
        wearId: 'we-self',
        userId: VIEWER,
        watchId: 'w-self',
        wornDate: '2026-04-21',
        note: null,
        createdAt: new Date('2026-04-21T14:00:00Z'),
        username: 'me',
        displayName: null,
        avatarUrl: null,
        visibility: 'private', // private, but self-rule admits it
        brand: 'Seiko',
        model: 'SKX007',
        imageUrl: null,
      },
    ]
    const result = await getWearRailForViewer(VIEWER)
    expect(result.tiles).toHaveLength(1)
    expect(result.tiles[0].isSelf).toBe(true)
    expect(result.tiles[0].userId).toBe(VIEWER)
  })

  it('Unit 8: maps DB row fields to WywtTile shape (imageUrl null fallback)', async () => {
    wearRows = [
      {
        wearId: 'we-x',
        userId: 'user-B',
        watchId: 'w-B',
        wornDate: '2026-04-21',
        note: 'heritage day',
        createdAt: new Date('2026-04-21T14:00:00Z'),
        username: 'bob',
        displayName: 'Bob',
        avatarUrl: 'av.png',
        visibility: 'public',
        brand: 'Omega',
        model: 'Speedmaster',
        imageUrl: null,
        photoUrl: null,
      },
    ]
    const result = await getWearRailForViewer(VIEWER)
    const tile: WywtTile = result.tiles[0]
    expect(tile).toEqual({
      wearEventId: 'we-x',
      userId: 'user-B',
      username: 'bob',
      displayName: 'Bob',
      avatarUrl: 'av.png',
      watchId: 'w-B',
      brand: 'Omega',
      model: 'Speedmaster',
      imageUrl: null,
      photoUrl: null,
      wornDate: '2026-04-21',
      note: 'heritage day',
      visibility: 'public',
      isSelf: false,
    })
  })

  it('Unit 12 (Phase 15 UAT): projects wearEvents.photoUrl into tile.photoUrl when present', async () => {
    wearRows = [
      {
        wearId: 'we-photo',
        userId: 'user-A',
        watchId: 'w-A',
        wornDate: '2026-04-21',
        note: null,
        createdAt: new Date('2026-04-21T14:00:00Z'),
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        visibility: 'public',
        brand: 'Rolex',
        model: 'GMT',
        imageUrl: 'https://catalog.example/gmt.jpg',
        // Raw Storage path — DAL must NOT sign this; the page Server Component does.
        photoUrl: 'user-A/evt-1.jpg',
      },
    ]
    const result = await getWearRailForViewer(VIEWER)
    expect(result.tiles).toHaveLength(1)
    expect(result.tiles[0].photoUrl).toBe('user-A/evt-1.jpg')
  })

  it('Unit 13 (Phase 15 UAT): tile.photoUrl is null when wear_events.photo_url is null', async () => {
    wearRows = [
      {
        wearId: 'we-nophoto',
        userId: 'user-A',
        watchId: 'w-A',
        wornDate: '2026-04-21',
        note: null,
        createdAt: new Date('2026-04-21T14:00:00Z'),
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        visibility: 'public',
        brand: 'Rolex',
        model: 'GMT',
        imageUrl: 'https://catalog.example/gmt.jpg',
        photoUrl: null,
      },
    ]
    const result = await getWearRailForViewer(VIEWER)
    expect(result.tiles).toHaveLength(1)
    expect(result.tiles[0].photoUrl).toBeNull()
  })

  // Phase 12 — tests asserting the updated SQL shape after the visibility
  // ripple landed. The per-row wear_visibility gate is enforced via leftJoin + WHERE.

  it('Unit 9 (Phase 12): wear query attaches exactly one leftJoin against follows', async () => {
    await getWearRailForViewer(VIEWER)
    const leftJoinOps = calls.filter((c) => c.op === 'wear.leftJoin')
    expect(leftJoinOps).toHaveLength(1)
  })

})

// ---------------------------------------------------------------------------
// PART B — Integration tests (run only against a live local Supabase stack):
// seeds real profiles + follows + wear events, asserts the 48h window,
// wear_events.visibility per-row gate, self-include rule, and non-follow exclusion.
// Mirrors the precedent in tests/data/getFeedForUser.test.ts.
// ---------------------------------------------------------------------------

const hasLocalDb =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasLocalDb ? describe : describe.skip

maybe('getWearRailForViewer — integration', () => {
  type DalT = typeof import('@/data/wearEvents')
  type SchemaT = typeof import('@/db/schema')
  type DbT = typeof import('@/db')
  type WatchesDalT = typeof import('@/data/watches')

  let dal: DalT
  let schema: SchemaT
  let dbModule: DbT
  let watchDAL: WatchesDalT
  let viewer: { id: string; email: string }
  let alice: { id: string; email: string }
  let bob: { id: string; email: string }
  let charlie: { id: string; email: string }
  let cleanup: () => Promise<void>

  const seedProfile = async (
    u: { id: string; email: string },
    username: string,
  ) => {
    await dbModule.db.insert(schema.users).values({ id: u.id, email: u.email }).onConflictDoNothing()
    await dbModule.db
      .insert(schema.profiles)
      .values({ id: u.id, username })
      .onConflictDoNothing()
    await dbModule.db
      .insert(schema.profileSettings)
      .values({
        userId: u.id,
        profilePublic: true,
        collectionPublic: true,
        wishlistPublic: true,
      })
      .onConflictDoNothing()
  }

  const seedWatch = async (userId: string, brand = 'Rolex', model = 'Sub') => {
    const w = await watchDAL.createWatch(userId, {
      brand,
      model,
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    } as never)
    return w.id
  }

  const seedWear = async (
    userId: string,
    watchId: string,
    wornDate: string,
    createdAt?: Date,
    visibility?: 'public' | 'followers' | 'private',
  ) => {
    const [row] = await dbModule.db
      .insert(schema.wearEvents)
      .values({ userId, watchId, wornDate, createdAt: createdAt ?? new Date(), ...(visibility ? { visibility } : {}) })
      .returning()
    return row
  }

  const today = () => new Date().toISOString().slice(0, 10)
  const daysAgo = (n: number) =>
    new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  beforeAll(async () => {
    dal = await import('@/data/wearEvents')
    schema = await import('@/db/schema')
    dbModule = await import('@/db')
    watchDAL = await import('@/data/watches')
    const { seedTwoUsers } = await import('../fixtures/users')
    const seed = await seedTwoUsers()
    viewer = seed.userA
    alice = seed.userB

    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const bobRes = await admin.auth.admin.createUser({
      email: `test-wywt-bob-${Date.now()}@horlo.test`,
      password: 'pw-B',
      email_confirm: true,
    })
    const charlieRes = await admin.auth.admin.createUser({
      email: `test-wywt-charlie-${Date.now()}@horlo.test`,
      password: 'pw-C',
      email_confirm: true,
    })
    if (bobRes.error) throw new Error(bobRes.error.message)
    if (charlieRes.error) throw new Error(charlieRes.error.message)
    bob = { id: bobRes.data.user!.id, email: bobRes.data.user!.email! }
    charlie = { id: charlieRes.data.user!.id, email: charlieRes.data.user!.email! }

    cleanup = async () => {
      await seed.cleanup()
      await admin.auth.admin.deleteUser(bob.id)
      await admin.auth.admin.deleteUser(charlie.id)
    }

    // Seed profiles: viewer public, alice public, bob public, charlie public
    await seedProfile(viewer, `wywt-viewer-${Date.now()}`)
    await seedProfile(alice, `wywt-alice-${Date.now()}`)
    await seedProfile(bob, `wywt-bob-${Date.now()}`)
    await seedProfile(charlie, `wywt-charlie-${Date.now()}`)

    // Follow graph: viewer -> alice, viewer -> bob. (NOT following charlie.)
    await dbModule.db
      .insert(schema.follows)
      .values({ followerId: viewer.id, followingId: alice.id })
      .onConflictDoNothing()
    await dbModule.db
      .insert(schema.follows)
      .values({ followerId: viewer.id, followingId: bob.id })
      .onConflictDoNothing()
  }, 45_000)

  afterAll(async () => {
    if (!cleanup) return
    try {
      const { inArray } = await import('drizzle-orm')
      const userIds = [viewer.id, alice.id, bob.id, charlie.id]
      await dbModule.db
        .delete(schema.wearEvents)
        .where(inArray(schema.wearEvents.userId, userIds))
      await dbModule.db
        .delete(schema.watches)
        .where(inArray(schema.watches.userId, userIds))
      await dbModule.db
        .delete(schema.follows)
        .where(inArray(schema.follows.followerId, userIds))
    } catch {
      // best-effort cleanup
    }
    await cleanup()
  }, 45_000)

  it('Test 1: empty rail for viewer with no follows and no own wear', async () => {
    // Temporarily drop the follows seeded in beforeAll so this viewer has none.
    const { eq: eqFn } = await import('drizzle-orm')
    const savedFollows = await dbModule.db
      .select()
      .from(schema.follows)
      .where(eqFn(schema.follows.followerId, viewer.id))
    await dbModule.db.delete(schema.follows).where(eqFn(schema.follows.followerId, viewer.id))
    try {
      const result = await dal.getWearRailForViewer(viewer.id)
      expect(result.tiles).toHaveLength(0)
      expect(result.viewerId).toBe(viewer.id)
    } finally {
      // Restore follows
      for (const f of savedFollows) {
        await dbModule.db
          .insert(schema.follows)
          .values({ followerId: f.followerId, followingId: f.followingId })
          .onConflictDoNothing()
      }
    }
  })

  it('Test 2: viewer with own wear today — 1 tile isSelf=true', async () => {
    const watchId = await seedWatch(viewer.id, 'Seiko', 'SKX007')
    await seedWear(viewer.id, watchId, today())
    const result = await dal.getWearRailForViewer(viewer.id)
    const selfTile = result.tiles.find((t) => t.userId === viewer.id)
    expect(selfTile).toBeDefined()
    expect(selfTile!.isSelf).toBe(true)
    expect(selfTile!.watchId).toBe(watchId)
  })

  it('Test 3: followed user with 3 wears in last 48h — 1 tile (most recent)', async () => {
    const watchA = await seedWatch(alice.id, 'Rolex', 'Submariner-A')
    const watchB = await seedWatch(alice.id, 'Rolex', 'Submariner-B')
    const watchC = await seedWatch(alice.id, 'Rolex', 'Submariner-C')
    // 3 wears spanning 0h, 12h, 36h ago all within 48h
    await seedWear(alice.id, watchA, today(), new Date(Date.now() - 1_000))
    await seedWear(alice.id, watchB, today(), new Date(Date.now() - 12 * 3600 * 1000))
    await seedWear(alice.id, watchC, daysAgo(1), new Date(Date.now() - 36 * 3600 * 1000))
    const result = await dal.getWearRailForViewer(viewer.id)
    const aliceTiles = result.tiles.filter((t) => t.userId === alice.id)
    expect(aliceTiles).toHaveLength(1)
    // Most-recent: watchA (0h ago, today)
    expect(aliceTiles[0].watchId).toBe(watchA)
  })

  it('Test 4: followed user with visibility=private wear — their wear is OMITTED from viewer rail', async () => {
    // The per-row visibility gate on wear_events.visibility determines whether a wear
    // appears in the rail. A private wear from a followed user must not surface.
    const watchBob = await seedWatch(bob.id, 'Omega', 'Speedy')
    await seedWear(bob.id, watchBob, today(), undefined, 'private')
    const result = await dal.getWearRailForViewer(viewer.id)
    const bobTiles = result.tiles.filter((t) => t.userId === bob.id)
    expect(bobTiles).toHaveLength(0)
  })

  it('Test 5: viewer self wear is always included (G-5 self-bypass — visibility gate does not apply to own wear)', async () => {
    // Per-wear visibility (public/followers/private) lives on wear_events.visibility.
    // Self-include is unconditional (viewer always sees their own wear regardless of visibility).
    const result = await dal.getWearRailForViewer(viewer.id)
    const selfTile = result.tiles.find((t) => t.userId === viewer.id)
    expect(selfTile).toBeDefined()
    expect(selfTile!.isSelf).toBe(true)
  })

  it('Test 6: non-followed user (charlie) — their wear is NOT in the rail', async () => {
    const watchCharlie = await seedWatch(charlie.id, 'Tudor', 'BB58')
    await seedWear(charlie.id, watchCharlie, today())
    const result = await dal.getWearRailForViewer(viewer.id)
    const charlieTiles = result.tiles.filter((t) => t.userId === charlie.id)
    expect(charlieTiles).toHaveLength(0)
  })

  it('Test 7: wear from 50h ago is EXCLUDED (outside 48h window)', async () => {
    // Bob's wear events default to 'public' visibility, so the 48h window gate is
    // the only gate being tested here.
    const { eq: eqFn } = await import('drizzle-orm')

    // Wipe bob's existing wears first
    await dbModule.db.delete(schema.wearEvents).where(eqFn(schema.wearEvents.userId, bob.id))

    const watchOld = await seedWatch(bob.id, 'Citizen', 'PromasterOld')
    const fiftyHoursAgo = new Date(Date.now() - 50 * 3600 * 1000)
    const wornDate50h = fiftyHoursAgo.toISOString().slice(0, 10)
    await seedWear(bob.id, watchOld, wornDate50h, fiftyHoursAgo)

    const result = await dal.getWearRailForViewer(viewer.id)
    const bobTiles = result.tiles.filter((t) => t.userId === bob.id)
    expect(bobTiles).toHaveLength(0)
  })

  it('Test 8: multiple eligible tiles ordered by wornDate DESC', async () => {
    const result = await dal.getWearRailForViewer(viewer.id)
    for (let i = 1; i < result.tiles.length; i++) {
      expect(result.tiles[i - 1].wornDate >= result.tiles[i].wornDate).toBe(true)
    }
  })

  it('Test 9: viewer + followed both have same-day own-wear — both appear', async () => {
    // Ensure alice has a wear today already (from Test 3). Viewer too (Test 2).
    const result = await dal.getWearRailForViewer(viewer.id)
    const viewerOwn = result.tiles.find((t) => t.userId === viewer.id)
    const aliceOwn = result.tiles.find((t) => t.userId === alice.id)
    expect(viewerOwn).toBeDefined()
    expect(aliceOwn).toBeDefined()
    expect(viewerOwn!.isSelf).toBe(true)
    expect(aliceOwn!.isSelf).toBe(false)
  })
})
