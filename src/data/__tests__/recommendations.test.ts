// Phase 75 Plan 02 — DISC-RECS-VARIATION regression tests (D-16).
//
// 4 unit cases (per D-16) for the rotation + sparse-pool top-up logic added
// to `getRecommendationsForViewer` in src/data/recommendations.ts:
//
//   Case 1: window-determinism      — same windowBucket -> identical recs
//   Case 2: cross-window-rotation   — different windowBucket -> ≥1 difference
//   Case 3: sparse-pool top-up      — candidateMap.size<8 -> synthetic rows
//                                     appended with representativeOwnerId:null
//   Case 4: no-regression-on-full-pool — healthy pool -> 12 recs, no nulls
//
// Plus pure-function smoke tests for the EXPORTED helpers `seedFor` +
// `mulberry32` (D-08) which the rotation logic depends on — these run
// without any DB or data-layer mocking.
//
// Test config notes:
//   - jsdom default per D-17 (no vitest environment-override directive)
//   - vi.mock('@/db') intercepts BOTH the public-profiles query AND the
//     watchesCatalog top-up query via a single fluent-chain factory routed
//     by the table passed to .from()
//   - vi.mock the per-user DALs (watches/preferences/wearEvents) so seed
//     collectors' owned-watches lists are deterministic per case
//   - vi.useFakeTimers + vi.setSystemTime control the 6h windowBucket
//
// References: tests/lib/recommendations.test.ts (mkWatch factory),
// src/app/actions/__tests__/moveWishlistToCollection.test.ts (vi.mock idiom).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ────────────────────────────────────────────────────────────────────────────
// Mock surface — declared BEFORE the SUT import (vi.mock hoists, but the
// per-test resolver bindings are read at call time so we can reconfigure
// between cases).
// ────────────────────────────────────────────────────────────────────────────

// Holders the fluent-chain factory below reads at call time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let publicProfilesResolver: () => Promise<Array<{ id: string }>> = async () => []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let catalogTopUpResolver: () => Promise<
  Array<{
    id: string
    brand: string
    model: string
    reference: string | null
    imageUrl: string | null
    ownersCount: number
  }>
> = async () => []

// Per-user resolvers keyed by userId — used by getWatchesByUser mock.
let watchesByUser: Map<string, ReturnType<typeof mkWatch>[]> = new Map()

vi.mock('@/db', () => {
  // Single intelligent fluent-chain factory. Tracks which table was passed
  // to .from() and routes the terminal await to the right resolver. The
  // chain object is its own thenable — awaiting it triggers the resolver.
  // The watchesCatalog chain ends in `.limit(...)`, the profiles chain ends
  // in `.where(...)`; both are awaited as the final step.
  const makeChain = () => {
    let routedTo: 'profiles' | 'catalog' | null = null
    const chain: Record<string, unknown> = {}
    const passthrough = () => chain
    chain.select = passthrough
    chain.from = (table: unknown) => {
      // Route by identity of the imported schema symbol. We don't import
      // the real symbols here — instead inspect the table object's tag
      // (drizzle objects expose `_.name` or `Symbol.for('drizzle:Name')`).
      // Simpler: each schema symbol mock returns a tagged object below.
      const t = table as { __tag?: string } | undefined
      if (t?.__tag === 'watchesCatalog') routedTo = 'catalog'
      else routedTo = 'profiles'
      return chain
    }
    chain.innerJoin = passthrough
    chain.where = (...args: unknown[]) => {
      void args
      // Profiles terminal — return a thenable that resolves to the resolver.
      if (routedTo === 'profiles') {
        return {
          then: (resolve: (v: Array<{ id: string }>) => unknown) =>
            publicProfilesResolver().then(resolve),
        }
      }
      return chain
    }
    chain.orderBy = passthrough
    chain.limit = (..._args: unknown[]) => {
      // Catalog terminal — return a thenable.
      void _args
      return {
        then: (resolve: (v: unknown[]) => unknown) =>
          catalogTopUpResolver().then(resolve),
      }
    }
    return chain
  }
  return {
    db: {
      select: () => makeChain(),
    },
  }
})

vi.mock('@/db/schema', () => ({
  profiles: { __tag: 'profiles', id: { __col: 'profiles.id' } },
  profileSettings: {
    __tag: 'profileSettings',
    userId: { __col: 'profileSettings.userId' },
    profilePublic: { __col: 'profileSettings.profilePublic' },
    collectionPublic: { __col: 'profileSettings.collectionPublic' },
  },
  watchesCatalog: {
    __tag: 'watchesCatalog',
    id: { __col: 'watchesCatalog.id' },
    brand: { __col: 'watchesCatalog.brand' },
    model: { __col: 'watchesCatalog.model' },
    reference: { __col: 'watchesCatalog.reference' },
    imageUrl: { __col: 'watchesCatalog.imageUrl' },
    ownersCount: { __col: 'watchesCatalog.ownersCount' },
  },
}))

vi.mock('drizzle-orm', () => ({
  and: (..._a: unknown[]) => ({ __op: 'and' }),
  eq: (..._a: unknown[]) => ({ __op: 'eq' }),
  ne: (..._a: unknown[]) => ({ __op: 'ne' }),
  asc: (_a: unknown) => ({ __op: 'asc' }),
  desc: (_a: unknown) => ({ __op: 'desc' }),
}))

vi.mock('@/data/watches', () => ({
  getWatchesByUser: vi.fn(async (userId: string) => {
    return watchesByUser.get(userId) ?? []
  }),
}))

vi.mock('@/data/preferences', () => ({
  getPreferencesByUser: vi.fn(async () => ({
    movementPreferences: [],
    styleTolerance: 0.5,
    sizeTolerance: 0.5,
    rolePriorities: [],
  })),
}))

vi.mock('@/data/wearEvents', () => ({
  getAllWearEventsByUser: vi.fn(async () => []),
}))

// computeTasteTags + computeTasteOverlap left as their real impls — they're
// pure, deterministic, and operate on the mocked watches we pass in.

// ────────────────────────────────────────────────────────────────────────────
// SUT imports (after vi.mock above — vitest hoists the mocks correctly).
// ────────────────────────────────────────────────────────────────────────────

import {
  getRecommendationsForViewer,
  mulberry32,
  seedFor,
} from '@/data/recommendations'
import type { Watch } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Test fixtures.
// ────────────────────────────────────────────────────────────────────────────

// Minimal Watch factory — mirrors tests/lib/recommendations.test.ts:6-19.
let _watchSeq = 0
function mkWatch(overrides: Partial<Watch> = {}): Watch {
  _watchSeq++
  return {
    id: overrides.id ?? `watch-${_watchSeq}`,
    brand: overrides.brand ?? 'Generic',
    model: overrides.model ?? 'Model',
    status: overrides.status ?? 'owned',
    movement: overrides.movement ?? 'auto',
    complications: overrides.complications ?? [],
    styleTags: overrides.styleTags ?? [],
    designTraits: overrides.designTraits ?? [],
    roleTags: overrides.roleTags ?? [],
    ...overrides,
  }
}

const ROTATION_WINDOW_MS = 6 * 60 * 60 * 1000

// Time helper — set Date.now() to the START of a given windowBucket.
function setBucket(bucket: number) {
  vi.setSystemTime(new Date(bucket * ROTATION_WINDOW_MS + 100))
}

// Build a fixture: VIEWER owns nothing in common with PEER_N collectors;
// PEER_N collectors each own one unique (brand, model). Returns the array
// of public-profile rows to register with publicProfilesResolver.
function buildSeedPool(peerCount: number): Array<{ id: string }> {
  watchesByUser = new Map()
  // Viewer needs ≥1 owned watch for the algorithm to proceed at all.
  watchesByUser.set('viewer-1', [
    mkWatch({ id: 'v-1', brand: 'ViewerBrand', model: 'ViewerModel' }),
  ])
  const profiles: Array<{ id: string }> = []
  for (let i = 0; i < peerCount; i++) {
    const id = `peer-${i}`
    profiles.push({ id })
    // Each peer owns one unique watch — gives a deterministic overlap-score
    // of (sharedWatches.length * 10 + sharedTasteTags.length); since no
    // shared watches AND minimal taste tags, all peers score near-zero
    // and tie-break by stable sort order (insertion order in Array.sort).
    // To produce distinct ranking, we let peer-0 own a watch that overlaps
    // a viewer taste tag via brand match… actually simpler: rely on the
    // sort being stable; the test asserts "different windows produce some
    // difference" which a uniform PRNG over 30 entries does even when the
    // base ranking is uniform.
    watchesByUser.set(id, [
      mkWatch({
        id: `p${i}-w`,
        brand: `Brand${i}`,
        model: `Model${i}`,
      }),
    ])
  }
  return profiles
}

// ────────────────────────────────────────────────────────────────────────────
// Pure-function tests (no DB / no data layer).
// ────────────────────────────────────────────────────────────────────────────

describe('seedFor — pure function (D-08)', () => {
  it('same (viewerId, windowBucket) → same output', () => {
    expect(seedFor('viewer-1', 100)).toBe(seedFor('viewer-1', 100))
    expect(seedFor('viewer-1', 100)).toEqual(seedFor('viewer-1', 100))
  })

  it('different viewerId → different output (cheap-hash regression)', () => {
    const a = seedFor('viewer-1', 100)
    const b = seedFor('viewer-2', 100)
    expect(a).not.toBe(b)
  })

  it('different windowBucket → different output', () => {
    const a = seedFor('viewer-1', 100)
    const b = seedFor('viewer-1', 101)
    expect(a).not.toBe(b)
  })
})

describe('mulberry32 — pure function (D-08)', () => {
  it('same seed → same emitted sequence', () => {
    const r1 = mulberry32(12345)
    const r2 = mulberry32(12345)
    expect(r1()).toBe(r2())
    expect(r1()).toBe(r2())
    expect(r1()).toBe(r2())
  })

  it('different seed → different first emission', () => {
    const r1 = mulberry32(12345)
    const r2 = mulberry32(67890)
    expect(r1()).not.toBe(r2())
  })

  it('emits values in [0, 1) range', () => {
    const r = mulberry32(42)
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Integration tests — getRecommendationsForViewer with mocked DB + DALs.
// ────────────────────────────────────────────────────────────────────────────

describe('getRecommendationsForViewer — rotation + sparse-pool top-up (D-16)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    publicProfilesResolver = async () => []
    catalogTopUpResolver = async () => []
    watchesByUser = new Map()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 1: window-determinism — same windowBucket → identical recs
  // ──────────────────────────────────────────────────────────────────────
  it('window-determinism: two calls in the same 6h bucket return identical ordered ids', async () => {
    const profiles = buildSeedPool(30)
    publicProfilesResolver = async () => profiles

    // Call 1 at bucket=100.
    setBucket(100)
    const recs1 = await getRecommendationsForViewer('viewer-1')

    // Call 2 also in bucket=100 (1 hour later, still within the 6h window).
    setBucket(100)
    vi.setSystemTime(new Date(100 * ROTATION_WINDOW_MS + 60 * 60 * 1000))
    const recs2 = await getRecommendationsForViewer('viewer-1')

    expect(recs1.length).toBe(recs2.length)
    expect(recs1.length).toBeGreaterThan(0)
    expect(recs1.map((r) => r.representativeWatchId)).toEqual(
      recs2.map((r) => r.representativeWatchId),
    )
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 2: cross-window-rotation — different windowBucket → ≥1 difference
  // ──────────────────────────────────────────────────────────────────────
  it('cross-window-rotation: two calls in different 6h buckets produce a different ordering or set', async () => {
    const profiles = buildSeedPool(30)
    publicProfilesResolver = async () => profiles

    setBucket(100)
    const recs1 = await getRecommendationsForViewer('viewer-1')

    setBucket(101)
    const recs2 = await getRecommendationsForViewer('viewer-1')

    // Both calls must return non-empty rec lists.
    expect(recs1.length).toBeGreaterThan(0)
    expect(recs2.length).toBeGreaterThan(0)

    // Assert ≥1 difference in ordered ids — proxy for "rotation happened."
    // With 30 peers feeding a 30-pool that gets shuffled and sliced to 15,
    // the chance of two different mulberry32 seeds producing identical
    // shuffled orders is effectively nil.
    const ids1 = recs1.map((r) => r.representativeWatchId).join(',')
    const ids2 = recs2.map((r) => r.representativeWatchId).join(',')
    expect(ids1).not.toBe(ids2)
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 3: sparse-pool top-up activates — candidateMap.size<8 →
  // synthetic catalog-popularity rows appended with representativeOwnerId:null
  // ──────────────────────────────────────────────────────────────────────
  it('sparse-pool top-up: <8 peer candidates triggers catalog popularity append; ≥1 rec has representativeOwnerId:null', async () => {
    // 2 peers, each owns 1 watch -> candidateMap.size = 2 after exclusion.
    const profiles = buildSeedPool(2)
    publicProfilesResolver = async () => profiles

    // Catalog top-up returns 6 popular rows. Need 8 - 2 = 6 to reach
    // the SPARSE_POOL_THRESHOLD.
    catalogTopUpResolver = async () => [
      { id: 'cat-1', brand: 'Rolex', model: 'Submariner', reference: '126610', imageUrl: 'https://x/1.jpg', ownersCount: 99 },
      { id: 'cat-2', brand: 'Omega', model: 'Speedmaster', reference: '310', imageUrl: null, ownersCount: 80 },
      { id: 'cat-3', brand: 'Seiko', model: 'SKX007', reference: 'SKX', imageUrl: null, ownersCount: 75 },
      { id: 'cat-4', brand: 'Tudor', model: 'Black Bay', reference: '79230', imageUrl: null, ownersCount: 70 },
      { id: 'cat-5', brand: 'Cartier', model: 'Tank', reference: 'WSTA', imageUrl: null, ownersCount: 60 },
      { id: 'cat-6', brand: 'IWC', model: 'Mark XVIII', reference: 'IW327', imageUrl: null, ownersCount: 55 },
      { id: 'cat-7', brand: 'Patek', model: 'Nautilus', reference: '5711', imageUrl: null, ownersCount: 50 },
    ]

    setBucket(100)
    const recs = await getRecommendationsForViewer('viewer-1')

    // SPARSE_POOL_THRESHOLD = 8 → final pool size must be at least 8.
    expect(recs.length).toBeGreaterThanOrEqual(8)

    // ≥1 rec must carry the synthetic marker representativeOwnerId === null.
    const nullOwnerRecs = recs.filter((r) => r.representativeOwnerId === null)
    expect(nullOwnerRecs.length).toBeGreaterThan(0)

    // Synthetic rows route through community-fallback rationale (D-13).
    for (const r of nullOwnerRecs) {
      expect(r.rationale).toBe('Popular in the community')
    }
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 4: no-regression-on-full-pool — healthy pool returns 12 (REC_CAP)
  // and no rec has representativeOwnerId === null (top-up did NOT fire).
  // ──────────────────────────────────────────────────────────────────────
  it('no-regression-on-full-pool: healthy peer pool returns 12 recs, no representativeOwnerId:null markers', async () => {
    // 30 peers each owning 1 unique watch -> candidateMap.size = 30 > REC_CAP.
    const profiles = buildSeedPool(30)
    publicProfilesResolver = async () => profiles

    // Catalog top-up SHOULD NOT be invoked — if it is invoked but
    // returns [], the test would still pass on the null-owner assertion.
    // To be defensive, also assert the resolver was not awaited by
    // tracking calls.
    let catalogResolverCalls = 0
    catalogTopUpResolver = async () => {
      catalogResolverCalls++
      return []
    }

    setBucket(100)
    const recs = await getRecommendationsForViewer('viewer-1')

    // REC_CAP = 12 → final pool size capped at 12.
    expect(recs.length).toBe(12)

    // No synthetic rows — every rec has a real ownerId string.
    for (const r of recs) {
      expect(r.representativeOwnerId).not.toBeNull()
      expect(typeof r.representativeOwnerId).toBe('string')
    }

    // Defensive: catalog top-up resolver must NOT have been awaited
    // (candidateMap.size=30 >= SPARSE_POOL_THRESHOLD=8).
    expect(catalogResolverCalls).toBe(0)
  })
})
