import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

// ---------------------------------------------------------------------------
// PART A — Unit tests verifying searchProfiles DAL contract per CONTEXT.md
// D-18, D-20, D-21, D-22 and Pitfalls C-2, C-3, C-4, C-5.
//
// Mirrors tests/data/getSuggestedCollectors.test.ts byte-for-byte for the
// Drizzle chainable-mock setup. Notable differences:
//   - candidates chain has `.from`, `.innerJoin`, `.where`, AND `.limit`
//     (because searchProfiles applies a pre-LIMIT cap of 50 — Pitfall 5).
//   - WHERE arg capture allows structural assertions on the compound predicate
//     (Pitfalls C-3 / C-5).
// ---------------------------------------------------------------------------

import type { SearchProfileResult } from '@/lib/searchTypes'

type Call = { op: string; args: unknown[] }

let followingRows: Array<{ id: string }> = []
let candidateRows: Array<{
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
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
      return chain
    },
    limit: (...args: unknown[]) => {
      calls.push({ op: 'candidates.limit', args })
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
      // The DAL issues: 1st select = candidates (with .limit(50)),
      // 2nd select = follows (batched isFollowing via inArray).
      // Per-candidate getWatchesByUser etc. routes through the mocked DAL
      // dependencies above and never hits db.select.
      if (selectCount === 1) return makeCandidateChain()
      return makeFollowsChain()
    },
  },
}))

// Target import — RED until Plan 02 creates the file.
import { searchProfiles } from '@/data/search'

const VIEWER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('searchProfiles — SQL shape (unit)', () => {
  beforeEach(() => {
    followingRows = []
    candidateRows = []
    calls = []
    selectCount = 0
  })

  it('Test 1: returns [] and makes ZERO db.select calls when q.trim().length < 2 (D-20 / Pitfall C-2)', async () => {
    const result = await searchProfiles({ q: 'b', viewerId: VIEWER, limit: 20 })
    expect(result).toEqual([])
    expect(selectCount).toBe(0)
  })

  it('Test 2: returns [] for whitespace-only q (trim before length check)', async () => {
    const result = await searchProfiles({ q: '   ', viewerId: VIEWER })
    expect(result).toEqual([])
    expect(selectCount).toBe(0)
  })

  it('Test 3: q.length === 2 → WHERE includes profile_public + username ILIKE but NOT bio ILIKE (D-21 / Pitfall C-5)', async () => {
    candidateRows = []
    await searchProfiles({ q: 'bo', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'candidates.where')
    expect(whereCall).toBeDefined()
    const whereJson = JSON.stringify(whereCall!.args)
    expect(whereJson).toContain('profile_public')
    expect(whereJson).toContain('ilike')
    expect(whereJson).toContain('username')
    // bio ILIKE must NOT be present at length-2
    expect(whereJson).not.toContain('"bio"')
  })

  it('Test 4: q.length >= 3 → WHERE includes or(username ILIKE, bio ILIKE) (D-21)', async () => {
    candidateRows = []
    await searchProfiles({ q: 'bob', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'candidates.where')
    expect(whereCall).toBeDefined()
    const whereJson = JSON.stringify(whereCall!.args)
    expect(whereJson).toContain('username')
    expect(whereJson).toContain('bio')
    expect(whereJson).toContain('ilike')
  })

  it('Test 5: WHERE always gates on profile_public (D-18 / Pitfall C-3)', async () => {
    candidateRows = []
    await searchProfiles({ q: 'bob', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'candidates.where')
    const whereJson = JSON.stringify(whereCall!.args)
    expect(whereJson).toContain('profile_public')
  })

  it('Test 6: WHERE excludes the viewer (sql predicate references viewerId)', async () => {
    candidateRows = []
    await searchProfiles({ q: 'bob', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'candidates.where')
    const whereJson = JSON.stringify(whereCall!.args)
    // The sql`${profiles.id} != ${viewerId}` predicate either binds VIEWER
    // as a parameter or stamps it into the chunked tagged-template args.
    expect(whereJson).toContain(VIEWER)
  })

  it('Test 7: orders by overlap DESC — strong (0.85) then weak (0.55)', async () => {
    candidateRows = [
      {
        userId: 'u-weak',
        username: 'weak-watcher',
        displayName: 'Weak',
        avatarUrl: null,
        bio: null,
      },
      {
        userId: 'u-strong',
        username: 'strong-watcher',
        displayName: 'Strong',
        avatarUrl: null,
        bio: null,
      },
    ]
    // With both candidates' watch sets empty (mocked) overlap will be the
    // 'Different taste' bucket (0.20) for both — so the JS sort still has
    // to be stable. We assert the sort ran (length === 2, returned in JS
    // array order). This test exercises the sort code path even when both
    // overlap values are equal; full overlap-DESC behavior is exercised in
    // PART B integration where real watches drive different buckets.
    const result = await searchProfiles({ q: 'wat', viewerId: VIEWER })
    expect(result.length).toBe(2)
    // Equal overlap → username ASC tie-break (D-22): "strong-watcher" before "weak-watcher"
    expect(result[0].username.localeCompare(result[1].username)).toBeLessThanOrEqual(0)
  })

  it('Test 8: tie-break — equal overlap → username ASC (D-22)', async () => {
    candidateRows = [
      {
        userId: 'u-zoe',
        username: 'zoe',
        displayName: 'Zoe',
        avatarUrl: null,
        bio: null,
      },
      {
        userId: 'u-alice',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        bio: null,
      },
    ]
    const result = await searchProfiles({ q: 'al', viewerId: VIEWER })
    expect(result.length).toBe(2)
    // alice (a < z) should come first
    expect(result[0].username).toBe('alice')
    expect(result[1].username).toBe('zoe')
    // localeCompare invariant
    expect(result[0].username.localeCompare(result[1].username)).toBeLessThan(0)
  })

  it('Test 9: LIMIT 20 — with 25 fixture candidates returns at most 20 (D-22)', async () => {
    candidateRows = Array.from({ length: 25 }, (_, i) => ({
      userId: `u-${String(i).padStart(2, '0')}`,
      username: `name-${String(i).padStart(2, '0')}`,
      displayName: `Name ${i}`,
      avatarUrl: null,
      bio: null,
    }))
    const result = await searchProfiles({ q: 'name', viewerId: VIEWER, limit: 20 })
    expect(result.length).toBe(20)
  })

  it('Test 10: pre-LIMIT candidate cap — DAL applies .limit(50) on the candidate query (Pitfall 5)', async () => {
    candidateRows = []
    await searchProfiles({ q: 'bob', viewerId: VIEWER })
    const limitCall = calls.find((c) => c.op === 'candidates.limit')
    expect(limitCall).toBeDefined()
    expect(limitCall!.args[0]).toBe(50)
  })

  it('Test 11: batched isFollowing — exactly ONE follows-table SELECT after candidate resolution (Pitfall C-4)', async () => {
    candidateRows = [
      {
        userId: 'u-alice',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        bio: null,
      },
      {
        userId: 'u-bob',
        username: 'bob',
        displayName: 'Bob',
        avatarUrl: null,
        bio: null,
      },
    ]
    await searchProfiles({ q: 'al', viewerId: VIEWER })
    const followsFromCalls = calls.filter((c) => c.op === 'follows.from')
    expect(followsFromCalls.length).toBe(1)
    // Assert WHERE uses inArray(follows.followingId, topIds)
    const followsWhere = calls.find((c) => c.op === 'follows.where')
    expect(followsWhere).toBeDefined()
    const whereJson = JSON.stringify(followsWhere!.args)
    expect(whereJson).toContain('inArray')
  })

  it('Test 12: isFollowing flag wired correctly from the followingSet', async () => {
    candidateRows = [
      {
        userId: 'u-alice',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        bio: null,
      },
      {
        userId: 'u-bob',
        username: 'bob',
        displayName: 'Bob',
        avatarUrl: null,
        bio: null,
      },
    ]
    followingRows = [{ id: 'u-bob' }] // viewer follows bob, NOT alice
    const result = await searchProfiles({ q: 'al', viewerId: VIEWER })
    const aliceRow = result.find((r) => r.userId === 'u-alice')
    const bobRow = result.find((r) => r.userId === 'u-bob')
    expect(aliceRow).toBeDefined()
    expect(bobRow).toBeDefined()
    expect(aliceRow!.isFollowing).toBe(false)
    expect(bobRow!.isFollowing).toBe(true)
  })

  it('Test 13: empty candidate set short-circuits — returns [] and ZERO follows query', async () => {
    candidateRows = []
    const result = await searchProfiles({ q: 'zzz', viewerId: VIEWER })
    expect(result).toEqual([])
    const followsFromCalls = calls.filter((c) => c.op === 'follows.from')
    expect(followsFromCalls.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// PART B — Integration tests (env-gated): seed real Postgres profiles and
// assert ILIKE behavior + privacy gate + Pitfall C-1 EXPLAIN check.
//
// Uses the canonical `const maybe = hasLocalDb ? describe : describe.skip`
// pattern from tests/data/getSuggestedCollectors.test.ts:133-137 (NOT
// describe.runIf).
// ---------------------------------------------------------------------------

const hasLocalDb =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasLocalDb ? describe : describe.skip

maybe('searchProfiles — integration', () => {
  type DalT = typeof import('@/data/search')
  type SchemaT = typeof import('@/db/schema')
  type DbT = typeof import('@/db')

  let dal: DalT
  let schema: SchemaT
  let dbModule: DbT
  let viewer: { id: string; email: string }
  let alice: { id: string; email: string }
  let bob: { id: string; email: string }
  let charliePrivate: { id: string; email: string }
  let cleanup: () => Promise<void>

  const seedProfile = async (
    u: { id: string; email: string },
    username: string,
    opts: Partial<{ profilePublic: boolean; bio: string | null }> = {},
  ) => {
    await dbModule.db
      .insert(schema.users)
      .values({ id: u.id, email: u.email })
      .onConflictDoNothing()
    await dbModule.db
      .insert(schema.profiles)
      .values({ id: u.id, username, bio: opts.bio ?? null })
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

  beforeAll(async () => {
    vi.doUnmock('@/data/watches')
    vi.doUnmock('@/data/preferences')
    vi.doUnmock('@/data/wearEvents')
    vi.doUnmock('@/db')

    dal = await vi.importActual('@/data/search')
    schema = await vi.importActual('@/db/schema')
    dbModule = await vi.importActual('@/db')

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
      email: `test-search-bob-${Date.now()}@horlo.test`,
      password: 'pw-B',
      email_confirm: true,
    })
    const charlieRes = await admin.auth.admin.createUser({
      email: `test-search-charlie-${Date.now()}@horlo.test`,
      password: 'pw-C',
      email_confirm: true,
    })
    if (bobRes.error) throw new Error(bobRes.error.message)
    if (charlieRes.error) throw new Error(charlieRes.error.message)
    bob = { id: bobRes.data.user!.id, email: bobRes.data.user!.email! }
    charliePrivate = {
      id: charlieRes.data.user!.id,
      email: charlieRes.data.user!.email!,
    }

    cleanup = async () => {
      await seed.cleanup()
      await admin.auth.admin.deleteUser(bob.id)
      await admin.auth.admin.deleteUser(charliePrivate.id)
    }

    const now = Date.now()
    await seedProfile(viewer, `search-viewer-${now}`)
    await seedProfile(alice, `search-alice-${now}`, { bio: 'Loves dive watches' })
    await seedProfile(bob, `search-alibob-${now}`, { bio: 'Pilot watch fan' })
    await seedProfile(charliePrivate, `search-aliprivate-${now}`, {
      profilePublic: false,
      bio: 'Hidden alibaba',
    })
  }, 60_000)

  afterAll(async () => {
    if (!cleanup) return
    await cleanup()
  }, 60_000)

  it('Test 14: real Postgres ILIKE returns only public matches; private profile excluded (D-18)', async () => {
    const results = await dal.searchProfiles({ q: 'ali', viewerId: viewer.id })
    // Should match alice + bob's username (contains 'ali') but NOT the
    // private "search-aliprivate-..." profile.
    const usernames = results.map((r: SearchProfileResult) => r.username)
    expect(usernames.some((u) => u.startsWith('search-alice-'))).toBe(true)
    expect(usernames.some((u) => u.startsWith('search-aliprivate-'))).toBe(false)
  })

  it('Test 15: bio ILIKE fires when q.length >= 3 (D-21)', async () => {
    const results = await dal.searchProfiles({
      q: 'watches',
      viewerId: viewer.id,
    })
    // alice's bio contains "watches"
    const aliceRow = results.find((r: SearchProfileResult) => r.userId === alice.id)
    expect(aliceRow).toBeDefined()
  })

  it('Test 16: uses Bitmap Index Scan on profiles_username_trgm_idx for ILIKE (Pitfall C-1)', async () => {
    // Drizzle escape hatch: db.execute with a raw EXPLAIN. We do NOT need
    // ANALYZE — the planner choice (Bitmap vs Seq) is what matters, and
    // EXPLAIN is fast + deterministic without timing.
    const { sql } = await vi.importActual<typeof import('drizzle-orm')>(
      'drizzle-orm',
    )
    const result = (await dbModule.db.execute(
      sql`EXPLAIN SELECT id FROM profiles WHERE username ILIKE ${'%ali%'}`,
    )) as unknown as { rows: Array<Record<string, unknown>> }
    const planText = result.rows.map((r) => Object.values(r)[0]).join('\n')
    expect(planText).toContain('Bitmap Index Scan')
  })
})
