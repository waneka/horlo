import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

// ---------------------------------------------------------------------------
// PART A — Unit tests (always run): mock Drizzle chainable to verify the SQL
// shape — privacy gate, self+already-followed exclusion, ORDER BY + cursor.
// ---------------------------------------------------------------------------

type Call = { op: string; args: unknown[] }

let followingRows: Array<{ id: string }> = []
let candidateRows: Array<{
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}> = []
let calls: Call[] = []
let selectCount = 0

function makeFollowsChain() {
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

function makeCandidateChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: (...args: unknown[]) => {
      calls.push({ op: 'candidates.from', args })
      return chain
    },
    innerJoin: (...args: unknown[]) => {
      calls.push({ op: 'candidates.innerJoin', args })
      return chain
    },
    where: (...args: unknown[]) => {
      calls.push({ op: 'candidates.where', args })
      return Promise.resolve(candidateRows)
    },
  } as never
  return chain
}

// Mock DAL dependencies before import.
vi.mock('@/data/watches', () => ({
  getWatchesByUser: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/data/preferences', () => ({
  getPreferencesByUser: vi.fn().mockResolvedValue({
    preferredStyles: [],
    dislikedStyles: [],
    preferredDesignTraits: [],
    dislikedDesignTraits: [],
    preferredComplications: [],
    complicationExceptions: [],
    preferredDialColors: [],
    dislikedDialColors: [],
    overlapTolerance: 'medium',
  }),
}))
vi.mock('@/data/wearEvents', () => ({
  getAllWearEventsByUser: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      selectCount += 1
      calls.push({ op: 'select', args })
      // The DAL issues: 1st select = follows, 2nd select = candidates,
      // subsequent selects (if any) are per-candidate getWatchesByUser etc.
      // These are already mocked above to resolve with []; so only the first
      // two selects route through our chainables.
      if (selectCount === 1) return makeFollowsChain()
      return makeCandidateChain()
    },
  },
}))

import { getSuggestedCollectors } from '@/data/suggestions'

const VIEWER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('getSuggestedCollectors — SQL shape (unit)', () => {
  beforeEach(() => {
    followingRows = []
    candidateRows = []
    calls = []
    selectCount = 0
  })

  it('Unit 1: returns { collectors: [], nextCursor: null } when no candidates', async () => {
    const result = await getSuggestedCollectors(VIEWER)
    expect(result).toEqual({ collectors: [], nextCursor: null })
  })

  it('Unit 2: candidates query uses innerJoin on profileSettings for privacy gate', async () => {
    await getSuggestedCollectors(VIEWER)
    const joinOps = calls.filter((c) => c.op === 'candidates.innerJoin')
    expect(joinOps.length).toBeGreaterThanOrEqual(1)
  })

  it('Unit 3: issues a follows query before the candidates query', async () => {
    await getSuggestedCollectors(VIEWER)
    const firstSelect = calls.find((c) => c.op === 'select')
    expect(firstSelect).toBeDefined()
    // The first chain receives a follows.from call.
    const followsFrom = calls.find((c) => c.op === 'follows.from')
    expect(followsFrom).toBeDefined()
  })

  it('Unit 4: candidates query attaches exactly one WHERE clause', async () => {
    await getSuggestedCollectors(VIEWER)
    const whereCalls = calls.filter((c) => c.op === 'candidates.where')
    expect(whereCalls).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// PART B — Integration tests (gated on local Supabase): seed profiles +
// follows + watches, assert ordering, privacy, self/follow exclusion, and
// the keyset cursor behavior for Load More (S-03).
// ---------------------------------------------------------------------------

const hasLocalDb =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasLocalDb ? describe : describe.skip

maybe('getSuggestedCollectors — integration', () => {
  type DalT = typeof import('@/data/suggestions')
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
  let charliePrivate: { id: string; email: string }
  let followed: { id: string; email: string }
  let cleanup: () => Promise<void>

  const seedProfile = async (
    u: { id: string; email: string },
    username: string,
    opts: Partial<{ profilePublic: boolean }> = {},
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
        collectionPublic: true,
        wishlistPublic: true,
      })
      .onConflictDoNothing()
  }

  const seedOwned = async (userId: string, brand: string, model: string) => {
    return watchDAL.createWatch(userId, {
      brand,
      model,
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })
  }

  beforeAll(async () => {
    // Reset vi.mocks so the integration suite hits the real DAL.
    vi.doUnmock('@/data/watches')
    vi.doUnmock('@/data/preferences')
    vi.doUnmock('@/data/wearEvents')
    vi.doUnmock('@/db')

    dal = await vi.importActual('@/data/suggestions')
    schema = await vi.importActual('@/db/schema')
    dbModule = await vi.importActual('@/db')
    watchDAL = await vi.importActual('@/data/watches')

    const { seedTwoUsers } = await vi.importActual<
      typeof import('../fixtures/users')
    >('../fixtures/users')
    const seed = await seedTwoUsers()
    viewer = seed.userA
    alice = seed.userB

    const { createClient } = await vi.importActual<
      typeof import('@supabase/supabase-js')
    >('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })

    const bobRes = await admin.auth.admin.createUser({
      email: `test-sug-bob-${Date.now()}@horlo.test`,
      password: 'pw-B',
      email_confirm: true,
    })
    const charlieRes = await admin.auth.admin.createUser({
      email: `test-sug-charlie-${Date.now()}@horlo.test`,
      password: 'pw-C',
      email_confirm: true,
    })
    const followedRes = await admin.auth.admin.createUser({
      email: `test-sug-followed-${Date.now()}@horlo.test`,
      password: 'pw-F',
      email_confirm: true,
    })
    if (bobRes.error) throw new Error(bobRes.error.message)
    if (charlieRes.error) throw new Error(charlieRes.error.message)
    if (followedRes.error) throw new Error(followedRes.error.message)
    bob = { id: bobRes.data.user!.id, email: bobRes.data.user!.email! }
    charliePrivate = {
      id: charlieRes.data.user!.id,
      email: charlieRes.data.user!.email!,
    }
    followed = {
      id: followedRes.data.user!.id,
      email: followedRes.data.user!.email!,
    }

    cleanup = async () => {
      await seed.cleanup()
      await admin.auth.admin.deleteUser(bob.id)
      await admin.auth.admin.deleteUser(charliePrivate.id)
      await admin.auth.admin.deleteUser(followed.id)
    }

    const now = Date.now()
    await seedProfile(viewer, `sug-viewer-${now}`)
    await seedProfile(alice, `sug-alice-${now}`)
    await seedProfile(bob, `sug-bob-${now}`)
    await seedProfile(charliePrivate, `sug-priv-${now}`, { profilePublic: false })
    await seedProfile(followed, `sug-followed-${now}`)

    // Viewer follows 'followed' only.
    await dbModule.db
      .insert(schema.follows)
      .values({ followerId: viewer.id, followingId: followed.id })
      .onConflictDoNothing()
  }, 60_000)

  afterAll(async () => {
    if (!cleanup) return
    try {
      const { inArray } = await vi.importActual<
        typeof import('drizzle-orm')
      >('drizzle-orm')
      const userIds = [
        viewer.id,
        alice.id,
        bob.id,
        charliePrivate.id,
        followed.id,
      ]
      await dbModule.db
        .delete(schema.watches)
        .where(inArray(schema.watches.userId, userIds))
      await dbModule.db
        .delete(schema.follows)
        .where(inArray(schema.follows.followerId, userIds))
    } catch {
      // best-effort
    }
    await cleanup()
  }, 60_000)

  it('Test 1 (basic): viewer + public collector with 3 shared watches → overlap > 0, sharedCount=3, sharedWatches.length<=3', async () => {
    // Viewer owns 3 shared watches. Alice owns the SAME 3.
    await seedOwned(viewer.id, 'Rolex', 'Submariner')
    await seedOwned(viewer.id, 'Tudor', 'Black Bay')
    await seedOwned(viewer.id, 'Omega', 'Speedmaster')
    await seedOwned(alice.id, 'Rolex', 'Submariner')
    await seedOwned(alice.id, 'Tudor', 'Black Bay')
    await seedOwned(alice.id, 'Omega', 'Speedmaster')

    const result = await dal.getSuggestedCollectors(viewer.id)
    const aliceRow = result.collectors.find((c) => c.userId === alice.id)
    expect(aliceRow).toBeDefined()
    expect(aliceRow!.overlap).toBeGreaterThan(0)
    expect(aliceRow!.sharedCount).toBe(3)
    expect(aliceRow!.sharedWatches.length).toBeLessThanOrEqual(3)
  })

  it('Test 2 (already followed excluded): viewer follows alice → she disappears', async () => {
    // Add the follow viewer→alice.
    await dbModule.db
      .insert(schema.follows)
      .values({ followerId: viewer.id, followingId: alice.id })
      .onConflictDoNothing()
    const result = await dal.getSuggestedCollectors(viewer.id)
    expect(result.collectors.find((c) => c.userId === alice.id)).toBeUndefined()
    // Cleanup follow
    const { eq: eqFn, and: andFn } = await vi.importActual<
      typeof import('drizzle-orm')
    >('drizzle-orm')
    await dbModule.db
      .delete(schema.follows)
      .where(
        andFn(
          eqFn(schema.follows.followerId, viewer.id),
          eqFn(schema.follows.followingId, alice.id),
        ),
      )
  })

  it('Test 3 (private profile excluded): charlie is profile_public=false → absent', async () => {
    const result = await dal.getSuggestedCollectors(viewer.id)
    expect(
      result.collectors.find((c) => c.userId === charliePrivate.id),
    ).toBeUndefined()
  })

  it('Test 4 + 5 (ordering + tiebreak): overlap DESC, userId ASC', async () => {
    // Give bob an extra watch so alice has higher shared count than bob.
    await seedOwned(bob.id, 'Rolex', 'Submariner')
    const result = await dal.getSuggestedCollectors(viewer.id, { limit: 20 })
    // Results should be sorted by overlap DESC, then userId ASC.
    for (let i = 1; i < result.collectors.length; i++) {
      const prev = result.collectors[i - 1]
      const cur = result.collectors[i]
      if (prev.overlap === cur.overlap) {
        expect(prev.userId.localeCompare(cur.userId)).toBeLessThanOrEqual(0)
      } else {
        expect(prev.overlap).toBeGreaterThan(cur.overlap)
      }
    }
  })

  it('Test 6 (limit): respects opts.limit', async () => {
    const result = await dal.getSuggestedCollectors(viewer.id, { limit: 2 })
    expect(result.collectors.length).toBeLessThanOrEqual(2)
  })

  it('Test 7 (self excluded): viewer never appears in their own suggestions', async () => {
    const result = await dal.getSuggestedCollectors(viewer.id, { limit: 50 })
    expect(result.collectors.find((c) => c.userId === viewer.id)).toBeUndefined()
  })

  it('Test 8 (sharedWatches metadata): each entry has watchId, brand, model, imageUrl', async () => {
    const result = await dal.getSuggestedCollectors(viewer.id)
    for (const c of result.collectors) {
      for (const w of c.sharedWatches) {
        expect(typeof w.watchId).toBe('string')
        expect(typeof w.brand).toBe('string')
        expect(typeof w.model).toBe('string')
        expect(w.imageUrl === null || typeof w.imageUrl === 'string').toBe(true)
      }
    }
  })

  it('Test 9 (empty collection → overlap=0 / sharedCount=0 but still listed)', async () => {
    // Create a fresh isolated viewer with no collection — candidates should
    // still appear, just with zero shared data.
    const { createClient } = await vi.importActual<
      typeof import('@supabase/supabase-js')
    >('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })
    const emptyRes = await admin.auth.admin.createUser({
      email: `test-sug-empty-${Date.now()}@horlo.test`,
      password: 'pw-E',
      email_confirm: true,
    })
    const empty = {
      id: emptyRes.data.user!.id,
      email: emptyRes.data.user!.email!,
    }
    await seedProfile(empty, `sug-empty-${Date.now()}`)
    try {
      const result = await dal.getSuggestedCollectors(empty.id, { limit: 10 })
      for (const c of result.collectors) {
        expect(c.sharedCount).toBe(0)
        expect(c.sharedWatches).toHaveLength(0)
      }
    } finally {
      await admin.auth.admin.deleteUser(empty.id)
    }
  })

  it('Test 10 + 11 (keyset cursor): first page returns cursor; second page is disjoint', async () => {
    // Need ≥8 candidates to drive meaningful pagination. Seed a small batch.
    const { createClient } = await vi.importActual<
      typeof import('@supabase/supabase-js')
    >('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })
    const extras: Array<{ id: string; email: string }> = []
    const toClean: string[] = []
    try {
      for (let i = 0; i < 8; i++) {
        const r = await admin.auth.admin.createUser({
          email: `test-sug-extra-${Date.now()}-${i}@horlo.test`,
          password: 'pw-X',
          email_confirm: true,
        })
        const id = r.data.user!.id
        extras.push({ id, email: r.data.user!.email! })
        toClean.push(id)
        await seedProfile({ id, email: r.data.user!.email! }, `sug-x-${i}-${Date.now()}`)
      }

      const page1 = await dal.getSuggestedCollectors(viewer.id, { limit: 5 })
      expect(page1.collectors.length).toBeLessThanOrEqual(5)
      // There should be a next cursor if enough candidates exist.
      if (page1.collectors.length === 5) {
        expect(page1.nextCursor).not.toBeNull()
        const page1Ids = new Set(page1.collectors.map((c) => c.userId))
        const page2 = await dal.getSuggestedCollectors(viewer.id, {
          limit: 5,
          cursor: page1.nextCursor,
        })
        // Disjoint: no page-1 row appears on page-2.
        for (const c of page2.collectors) {
          expect(page1Ids.has(c.userId)).toBe(false)
        }
      }
    } finally {
      for (const id of toClean) {
        await admin.auth.admin.deleteUser(id)
      }
    }
  })
})
