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
// Phase 81 Plan 02 extensions:
//
//   Case 5: exclusion-key identity  — viewer owns Watch with (brandId, familyId);
//                                     top-up returns catalog row with same
//                                     (brandId, familyId) but drift denorm brand
//                                     string → synthetic candidate DROPPED
//                                     (Pitfall 5 — self-in-own-rail identity check)
//   Case 6: synthetic FK propagation — top-up rows carry brandId + familyId;
//                                     synthetic Watch surfaces JOIN-derived
//                                     canonical brand string (not row denorm)
//   Case 7: brandNameLookup empty guard — viewer with zero brandId watches
//                                     never awaits the brands SELECT
//                                     (Pitfall 2 — sql.join(empty, …) guard)
//
// Test config notes:
//   - jsdom default per D-17 (no vitest environment-override directive)
//   - vi.mock('@/db') intercepts the public-profiles query AND the watchesCatalog
//     top-up query AND (Phase 81) the brands brandNameLookup query via a single
//     fluent-chain factory routed by the table passed to .from()
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
    brandId: string
    familyId: string
    reference: string | null
    imageUrl: string | null
    ownersCount: number
    styleTags: string[]
  }>
> = async () => []

// Phase 81 D-81-05 — brandNameLookup resolver. Routes to the `brands` SELECT
// path in getRecommendationsForViewer.
let brandNameLookupResolver: () => Promise<
  Array<{ id: string; name: string }>
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
    let routedTo: 'profiles' | 'catalog' | 'brands' | null = null
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
      else if (t?.__tag === 'brands') routedTo = 'brands'
      else routedTo = 'profiles'
      return chain
    }
    chain.innerJoin = passthrough
    chain.leftJoin = passthrough
    chain.where = (...args: unknown[]) => {
      void args
      // Profiles terminal — return a thenable that resolves to the resolver.
      if (routedTo === 'profiles') {
        return {
          then: (resolve: (v: Array<{ id: string }>) => unknown) =>
            publicProfilesResolver().then(resolve),
        }
      }
      // Brands terminal — Phase 81 brandNameLookup SELECT: chain is
      // `.select(...).from(brands).where(...)` with no orderBy/limit tail.
      if (routedTo === 'brands') {
        return {
          then: (
            resolve: (v: Array<{ id: string; name: string }>) => unknown,
          ) => brandNameLookupResolver().then(resolve),
        }
      }
      // Catalog: support BOTH the popularity-path chain (.where().orderBy().limit())
      // AND the broadening-path terminal (.where() alone, no orderBy/limit).
      // Attach .then so an immediate await fires catalogTopUpResolver; subsequent
      // .orderBy()/.limit() calls continue down the chain as before (popularity
      // path) and .limit() returns its own thenable that supersedes this one.
      chain.then = (resolve: (v: unknown[]) => unknown) =>
        catalogTopUpResolver().then(resolve)
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
    // Phase 81 — brandId + familyId added to the mock so INNER JOIN eq()
    // + the brand_id IN clause typecheck against the mock schema tag.
    brandId: { __col: 'watchesCatalog.brandId' },
    familyId: { __col: 'watchesCatalog.familyId' },
    reference: { __col: 'watchesCatalog.reference' },
    imageUrl: { __col: 'watchesCatalog.imageUrl' },
    ownersCount: { __col: 'watchesCatalog.ownersCount' },
    styleTags: { __col: 'watchesCatalog.styleTags' },
  },
  // Phase 81 — brands mock, tagged so the fluent-chain factory routes the
  // brandNameLookup SELECT to brandNameLookupResolver.
  brands: {
    __tag: 'brands',
    id: { __col: 'brands.id' },
    name: { __col: 'brands.name' },
  },
  // Phase 81 — watchFamilies mock, targeted by the INNER JOIN inside
  // topUpFromCatalogPopularity.
  watchFamilies: {
    __tag: 'watchFamilies',
    id: { __col: 'watchFamilies.id' },
    name: { __col: 'watchFamilies.name' },
  },
}))

vi.mock('drizzle-orm', () => {
  // Tagged-template `sql\`...\`` stub. The impl uses sql for the
  // broadening query's `IN (sql.join(arr.map(b => sql\`${b}\`), sql\`, \`))`
  // — we don't care what it emits, just that the call doesn't throw and
  // the result is something the chain's `.where()` accepts.
  const sqlFn = (..._args: unknown[]) => ({ __op: 'sql' })
  ;(sqlFn as unknown as { join: (..._a: unknown[]) => unknown }).join = (
    ..._a: unknown[]
  ) => ({ __op: 'sql.join' })
  return {
    and: (..._a: unknown[]) => ({ __op: 'and' }),
    eq: (..._a: unknown[]) => ({ __op: 'eq' }),
    ne: (..._a: unknown[]) => ({ __op: 'ne' }),
    asc: (_a: unknown) => ({ __op: 'asc' }),
    desc: (_a: unknown) => ({ __op: 'desc' }),
    isNotNull: (_a: unknown) => ({ __op: 'isNotNull' }),
    sql: sqlFn,
  }
})

vi.mock('@/data/watches', () => ({
  getWatchesByUser: vi.fn(async (userId: string) => {
    return watchesByUser.get(userId) ?? []
  }),
}))

vi.mock('@/data/preferences', () => ({
  // Minimal UserPreferences shape — analyzeSimilarity dereferences
  // preferredStyles / dislikedStyles / preferredComplications /
  // complicationExceptions / preferredDialColors / dislikedDialColors /
  // preferredDesignTraits / dislikedDesignTraits / overlapTolerance.
  // The viewer fixture in Case 3 (quick task 260623-mn3) has populated
  // styleTags so .some() enters the inner callback and the empty-array
  // fallbacks from the prior shape were undefined → fixed by returning
  // a fully-formed UserPreferences object here.
  getPreferencesByUser: vi.fn(async () => ({
    preferredStyles: [],
    dislikedStyles: [],
    preferredDesignTraits: [],
    dislikedDesignTraits: [],
    preferredComplications: [],
    complicationExceptions: [],
    preferredDialColors: [],
    dislikedDialColors: [],
    overlapTolerance: 'medium' as const,
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
    brandNameLookupResolver = async () => []
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
  // Case 3: sparse-pool top-up — brand-match outranks style-match outranks
  // pure-popularity, AND real catalog styleTags project onto synthetic rows
  // so rationale templates fire (quick task 260623-mn3); EXTENDED by
  // quick task 260623-pzz with three new assertions covering multi-brand
  // SET-based match, per-brand variety cap, and pool-broadening call count;
  // Phase 81 Plan 02 — catalog rows carry brandId + familyId, viewer's
  // rolex-uuid/tudor-uuid brandIds drive canonical set membership.
  // ──────────────────────────────────────────────────────────────────────
  it('sparse-pool top-up: brand-match outranks style-match outranks pure-popularity, and real styleTags project onto synthetic rows so rationale templates fire', async () => {
    // 2 peers seed the pool (peer-0 + peer-1 each own 1 unrelated watch).
    // candidateMap.size = 2 after exclusion -> top-up needs 6 more rows to
    // reach SPARSE_POOL_THRESHOLD = 8.
    const profiles = buildSeedPool(2)
    publicProfilesResolver = async () => profiles

    // 4-watch fixture (3 Rolex + 1 Tudor) with canonical brandIds — Phase 81
    // topBrandOf returns { brandId: 'rolex-uuid', brandName: 'Rolex' } (3>1),
    // viewerOwnedBrandIds is now {rolex-uuid, tudor-uuid}. All four watches
    // share styleTags: ['sport'] so dominantStyleOf returns 'sport' share 1.0.
    watchesByUser.set('viewer-1', [
      mkWatch({ id: 'v-1', brand: 'Rolex', model: 'Submariner', styleTags: ['sport'], brandId: 'rolex-uuid', familyId: 'submariner-uuid' }),
      mkWatch({ id: 'v-2', brand: 'Rolex', model: 'Explorer',   styleTags: ['sport'], brandId: 'rolex-uuid', familyId: 'explorer-uuid' }),
      mkWatch({ id: 'v-3', brand: 'Rolex', model: 'GMT',        styleTags: ['sport'], brandId: 'rolex-uuid', familyId: 'gmt-uuid' }),
      mkWatch({ id: 'v-4', brand: 'Tudor', model: 'Black Bay',  styleTags: ['sport'], brandId: 'tudor-uuid', familyId: 'black-bay-uuid' }),
    ])

    // brandNameLookup — 2 rows, one per owned canonical brandId. Feeds
    // topBrandOf's canonical-name resolution + Phase 81 rationaleFor's
    // viewerTopBrand.brandName substitution.
    brandNameLookupResolver = async () => [
      { id: 'rolex-uuid', name: 'Rolex' },
      { id: 'tudor-uuid', name: 'Tudor' },
    ]

    // 10 rows: 4 Rolex (one brand-match-only from 260623-mn3 + three new for
    // the variety-cap test), 1 Seiko (style-match), 1 Tudor (brand-match via
    // owned-set — proves SET membership beats the old single-brand check),
    // 1 Omega + 1 Cartier (pure popularity), 2 fillers.
    //   Rolex Datejust    -> brand-match  -> 100 + 0  + 0.005 = 100.005
    //   Rolex GMT MII     -> brand+style  -> 100 + 50 + 0.090 = 150.090
    //   Rolex Sub Date    -> brand+style  -> 100 + 50 + 0.085 = 150.085
    //   Rolex Daytona     -> brand+style  -> 100 + 50 + 0.070 = 150.070
    //   Tudor Pelagos     -> brand+style  -> 100 + 50 + 0.030 = 150.030
    //   Seiko SKX007      -> style-match  -> 0   + 50 + 0.099 = 50.099
    //   Omega Speedy      -> pure-pop     -> 0   + 0  + 0.080 = 0.080
    //   Cartier Tank      -> pure-pop     -> 0   + 0  + 0.060 = 0.060 (alpha)
    //   Filler-1/2        -> pure-pop     -> small popularity, no signal
    // Instrument with a call counter so we can assert the catalog terminal
    // was awaited >= 1 time (260623-pzz pool-broadening assertion 7c).
    let catalogResolverCalls = 0
    catalogTopUpResolver = async () => {
      catalogResolverCalls++
      return [
        // Deliberately interleaved so fetch-order != score-order. Phase 81 —
        // each row carries brandId + familyId (INNER JOIN would populate).
        { id: 'cat-omega',   brand: 'Omega',   model: 'Speedmaster',     brandId: 'omega-uuid',   familyId: 'speedmaster-uuid',    reference: '310',    imageUrl: null, ownersCount: 80, styleTags: ['casual'] },
        { id: 'cat-rolex',   brand: 'Rolex',   model: 'Datejust',        brandId: 'rolex-uuid',   familyId: 'datejust-uuid',       reference: '126200', imageUrl: null, ownersCount: 5,  styleTags: ['dress'] },
        { id: 'cat-cartier', brand: 'Cartier', model: 'Tank',            brandId: 'cartier-uuid', familyId: 'tank-uuid',           reference: 'WSTA',   imageUrl: null, ownersCount: 60, styleTags: ['dress'] },
        { id: 'cat-seiko',   brand: 'Seiko',   model: 'SKX007',          brandId: 'seiko-uuid',   familyId: 'skx007-uuid',         reference: 'SKX',    imageUrl: null, ownersCount: 99, styleTags: ['sport'] },
        { id: 'cat-filler1', brand: 'Zenith',  model: 'Defy',            brandId: 'zenith-uuid',  familyId: 'defy-uuid',           reference: 'DEFY',   imageUrl: null, ownersCount: 10, styleTags: ['casual'] },
        { id: 'cat-filler2', brand: 'Yema',    model: 'Superman',        brandId: 'yema-uuid',    familyId: 'superman-uuid',       reference: 'SUP',    imageUrl: null, ownersCount: 8,  styleTags: ['casual'] },
        // 260623-pzz extensions: 1 Tudor (owned-set brand-match) + 3 more
        // Rolex rows (variety-cap stress — all score 150+, would dominate
        // the top-up unbounded).
        { id: 'cat-tudor',   brand: 'Tudor',   model: 'Pelagos',         brandId: 'tudor-uuid',   familyId: 'pelagos-uuid',        reference: '25600',  imageUrl: null, ownersCount: 30, styleTags: ['sport'] },
        { id: 'cat-rolex-2', brand: 'Rolex',   model: 'GMT Master II',   brandId: 'rolex-uuid',   familyId: 'gmt-master-ii-uuid',  reference: '126710', imageUrl: null, ownersCount: 90, styleTags: ['sport'] },
        { id: 'cat-rolex-3', brand: 'Rolex',   model: 'Submariner Date', brandId: 'rolex-uuid',   familyId: 'submariner-date-uuid',reference: '126610', imageUrl: null, ownersCount: 85, styleTags: ['sport'] },
        { id: 'cat-rolex-4', brand: 'Rolex',   model: 'Daytona',         brandId: 'rolex-uuid',   familyId: 'daytona-uuid',        reference: '116500', imageUrl: null, ownersCount: 70, styleTags: ['sport'] },
      ]
    }

    setBucket(100)
    const recs = await getRecommendationsForViewer('viewer-1')

    // SPARSE_POOL_THRESHOLD = 8 → final pool size must be at least 8.
    expect(recs.length).toBeGreaterThanOrEqual(8)

    // Filter to synthetic top-up rows (representativeOwnerId === null per D-12).
    const synthetics = recs.filter((r) => r.representativeOwnerId === null)
    expect(synthetics.length).toBeGreaterThan(0)

    const idx = (brand: string, model: string) =>
      synthetics.findIndex((r) => r.brand === brand && r.model === model)

    // 1. Brand-match (Rolex GMT Master II) ranks ahead of style-match (Seiko
    //    SKX007). NOTE [260623-pzz]: this assertion originally referenced
    //    Rolex Datejust (260623-mn3), but the extended fixture adds three
    //    higher-scoring Rolex rows AND a per-brand cap of 2 — Datejust
    //    (100.005, no style overlap) is capped out by the two 150-bucket
    //    Rolexes (GMT MII, Sub Date). Asserting on the surviving top-Rolex
    //    (GMT Master II) preserves the original spirit (a brand-match row
    //    outranks a style-match row) within the new ranking reality.
    expect(idx('Rolex', 'GMT Master II')).toBeGreaterThanOrEqual(0)
    expect(idx('Seiko', 'SKX007')).toBeGreaterThanOrEqual(0)
    expect(idx('Rolex', 'GMT Master II')).toBeLessThan(idx('Seiko', 'SKX007'))

    // 2. Style-match (Seiko SKX007) ranks ahead of both pure-popularity rows.
    expect(idx('Seiko', 'SKX007')).toBeLessThan(idx('Omega', 'Speedmaster'))
    expect(idx('Seiko', 'SKX007')).toBeLessThan(idx('Cartier', 'Tank'))

    // 3. Within the community-fallback bucket, Cartier alphabetically precedes
    //    Omega. The top-up function itself uses an ownersCount/1000 additive
    //    that distinguishes 0.080 (Omega) from 0.060 (Cartier), so Omega
    //    leaves the top-up first; but the OUTER getRecommendationsForViewer
    //    re-sort (line ~251) re-ranks everything by `count*100 + RULE_MATCH_BONUS`
    //    where the community-fallback bucket all collapses to score=0, leaving
    //    the alphabetical brand tiebreaker to decide — Cartier < Omega.
    //    (This pins the two-level sort semantics: top-up's score is internal
    //    to the top-up; the outer re-sort flattens community-fallback rows
    //    back to alpha order.)
    expect(idx('Cartier', 'Tank')).toBeLessThan(idx('Omega', 'Speedmaster'))

    // 4. Rationale-projection: brand-match template fires on the Rolex top-up
    //    row. NOTE [260623-pzz]: switched from Datejust to GMT Master II for
    //    the same cap-survival reason as assertion 1; the template still
    //    fires identically on any Rolex top-up row.
    const rolexRec = synthetics.find((r) => r.brand === 'Rolex' && r.model === 'GMT Master II')
    expect(rolexRec?.rationale).toBe('Fans of Rolex love this')

    // 5. Rationale-projection: dominant-style template fires on the Seiko row
    //    (requires viewer's 'sport' share > 0.5, which the 3/3 fixture gives).
    const seikoRec = synthetics.find((r) => r.brand === 'Seiko' && r.model === 'SKX007')
    expect(seikoRec?.rationale).toBe('Matches your sport collection')

    // 6. Community-fallback still fires for rows that match neither signal.
    const omegaRec = synthetics.find((r) => r.brand === 'Omega' && r.model === 'Speedmaster')
    expect(omegaRec?.rationale).toBe('Popular in the community')
    const cartierRec = synthetics.find((r) => r.brand === 'Cartier' && r.model === 'Tank')
    expect(cartierRec?.rationale).toBe('Popular in the community')

    // ── 260623-pzz new assertions ──────────────────────────────────────

    // 7a. Multi-brand surfacing: Tudor is owned (viewer's brand SET now uses
    //     brandIds — {rolex-uuid, tudor-uuid}) so the Tudor catalog row
    //     brand-matches via the SET. Under Phase 81 the check is on canonical
    //     brand_id (was: case-insensitive string) — closes RECO-02.
    expect(idx('Tudor', 'Pelagos')).toBeGreaterThanOrEqual(0)
    expect(idx('Cartier', 'Tank')).toBeGreaterThanOrEqual(0)
    expect(idx('Tudor', 'Pelagos')).toBeLessThan(idx('Cartier', 'Tank'))

    // 7b. Variety-cap: with 4 Rolex catalog rows all scoring 150+ (the
    //     Datejust scores ~100, the other three score 150+), the unbounded
    //     behavior would surface 3-4 Rolex rows in the synthetic top-up.
    //     The cap MAX_PER_BRAND_IN_TOPUP=2 limits Rolex to at most 2.
    const rolexCount = synthetics.filter((r) => r.brand === 'Rolex').length
    expect(rolexCount).toBeLessThanOrEqual(2)
    expect(rolexCount).toBeGreaterThanOrEqual(1) // cap is 2, not 0

    // 7c. Pool-broadening: the catalog terminal must be awaited at least
    //     once for the popularity slice, and (when viewerOwnedBrandIds is
    //     non-empty) ideally a second time for the owned-brands query.
    //     Two separate queries OR a single UNION both satisfy `>= 1`; the
    //     executor's implementation choice is documented in the SUMMARY.
    //     If the executor chose the two-query strategy, this will be 2;
    //     if they chose a Drizzle `union`, this will still be >=1.
    expect(catalogResolverCalls).toBeGreaterThanOrEqual(1)
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

// ────────────────────────────────────────────────────────────────────────────
// Phase 81 Plan 02 — new test cases.
// ────────────────────────────────────────────────────────────────────────────

describe('getRecommendationsForViewer — Phase 81 D-81-02/03/05', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    publicProfilesResolver = async () => []
    catalogTopUpResolver = async () => []
    brandNameLookupResolver = async () => []
    watchesByUser = new Map()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Case 5: Pitfall 5 exclusion-key identity — viewer owns a Watch with
  // (brandId='hamilton-uuid', familyId='khaki-field-uuid'). A synthetic
  // top-up catalog row shares the same (brandId, familyId) but a drift denorm
  // brand ('Hamilton Watch' vs canonical 'Hamilton') AND drift denorm model.
  // The exclusion set MUST match on FK identity — the drift row MUST be
  // dropped from the rail even though its string keys differ. This is the
  // load-bearing correctness check for Phase 81's whole point.
  it('exclusion-key identity: viewer owns brandId+familyId → synthetic top-up sharing same FKs is DROPPED even with drift denorm strings (Pitfall 5)', async () => {
    // Single peer so candidateMap.size stays sparse and top-up fires.
    publicProfilesResolver = async () => [{ id: 'peer-0' }]

    // Viewer owns Hamilton Khaki Field (canonical strings + canonical FKs).
    watchesByUser.set('viewer-1', [
      mkWatch({
        id: 'v-1',
        brand: 'Hamilton',
        model: 'Khaki Field',
        brandId: 'hamilton-uuid',
        familyId: 'khaki-field-uuid',
      }),
    ])
    // Peer owns something entirely different so the top-up has to fire.
    watchesByUser.set('peer-0', [
      mkWatch({
        id: 'p0-w',
        brand: 'Seiko',
        model: 'SKX',
        brandId: 'seiko-uuid',
        familyId: 'skx-uuid',
      }),
    ])

    brandNameLookupResolver = async () => [
      { id: 'hamilton-uuid', name: 'Hamilton' },
    ]

    // Drift-branded catalog row shares canonical FKs with viewer's watch —
    // MUST be excluded. String key `hamilton watch|khaki field mechanical`
    // is DIFFERENT from viewer's `hamilton|khaki field` (a pre-D-81-02
    // exclusion set would MISS this row, surfacing viewer's own family
    // in their own rail). FK key `hamilton-uuid|khaki-field-uuid` MATCHES.
    catalogTopUpResolver = async () => [
      {
        id: 'cat-hamilton-drift',
        brand: 'Hamilton Watch', // drift denorm — canonical is 'Hamilton'
        model: 'Khaki Field Mechanical', // drift denorm — canonical is 'Khaki Field'
        brandId: 'hamilton-uuid', // CANONICAL FK — matches viewer's owned brand_id
        familyId: 'khaki-field-uuid', // CANONICAL FK — matches viewer's owned family_id
        reference: 'H69439931',
        imageUrl: null,
        ownersCount: 42,
        styleTags: ['field'],
      },
      // A control row that MUST surface — different family_id.
      {
        id: 'cat-seiko',
        brand: 'Seiko',
        model: 'SKX007',
        brandId: 'seiko-uuid',
        familyId: 'skx007-uuid',
        reference: 'SKX',
        imageUrl: null,
        ownersCount: 99,
        styleTags: ['sport'],
      },
    ]

    setBucket(200)
    const recs = await getRecommendationsForViewer('viewer-1')

    // The drift-branded Hamilton row MUST be excluded — self-in-own-rail
    // check. Under old string-key impl the drift denorm string wouldn't
    // match viewer's exclusion set and this would surface (Pitfall 5).
    const hamiltonRec = recs.find((r) => r.brand === 'Hamilton Watch')
    expect(hamiltonRec).toBeUndefined()

    // The control row MUST surface — proves the top-up is running + the
    // exclusion is not overbroad.
    const seikoRec = recs.find((r) => r.brand === 'Seiko')
    expect(seikoRec).toBeDefined()
  })

  // Case 6: synthetic Watch FK propagation — the JOIN-derived canonical
  // brand string (from brands.name via INNER JOIN) surfaces in the
  // Recommendation, not the row's original drift denorm string.
  it('synthetic FK propagation: top-up row surfaces JOIN-derived canonical brand string in the Recommendation', async () => {
    publicProfilesResolver = async () => [{ id: 'peer-0' }]
    watchesByUser.set('viewer-1', [
      mkWatch({
        id: 'v-1',
        brand: 'ViewerBrand',
        model: 'ViewerModel',
        brandId: 'viewer-brand-uuid',
        familyId: 'viewer-family-uuid',
      }),
    ])
    watchesByUser.set('peer-0', [
      mkWatch({
        id: 'p0-w',
        brand: 'PeerBrand',
        model: 'PeerModel',
        brandId: 'peer-brand-uuid',
        familyId: 'peer-family-uuid',
      }),
    ])
    brandNameLookupResolver = async () => [
      { id: 'viewer-brand-uuid', name: 'ViewerBrand' },
    ]

    // Under Phase 81's INNER JOIN, `row.brand` IS the canonical `brands.name`.
    // The mock resolver simulates this — the recommender does NOT further
    // massage the string. Assert the Recommendation's `brand` field matches.
    catalogTopUpResolver = async () => [
      {
        id: 'cat-canonical',
        brand: 'Hamilton', // canonical (as if from brands.name INNER JOIN)
        model: 'Khaki Field', // canonical (as if from watch_families.name INNER JOIN)
        brandId: 'hamilton-uuid',
        familyId: 'khaki-field-uuid',
        reference: 'H69439931',
        imageUrl: null,
        ownersCount: 42,
        styleTags: ['field'],
      },
    ]

    setBucket(300)
    const recs = await getRecommendationsForViewer('viewer-1')

    // Synthetic Hamilton row surfaces with the JOIN-derived canonical brand.
    const rec = recs.find((r) => r.representativeWatchId === 'cat-canonical')
    expect(rec).toBeDefined()
    expect(rec?.brand).toBe('Hamilton')
    expect(rec?.model).toBe('Khaki Field')
    expect(rec?.representativeOwnerId).toBeNull() // synthetic marker
  })

  // Case 7: brandNameLookup empty guard — viewer with zero brandId-keyed
  // watches must skip the brands SELECT entirely (Pitfall 2 — sql.join([])
  // emits invalid `IN ()`). If the guard trips, the resolver would throw
  // and propagate; if the guard holds, the resolver is never called.
  it('brandNameLookup empty guard: viewer with zero brandId watches skips the brands SELECT (Pitfall 2)', async () => {
    publicProfilesResolver = async () => [{ id: 'peer-0' }]

    // Viewer has an owned watch but NO brandId (legacy catalogId=null case).
    watchesByUser.set('viewer-1', [
      mkWatch({ id: 'v-1', brand: 'Legacy', model: 'Model' }),
    ])
    watchesByUser.set('peer-0', [
      mkWatch({ id: 'p0-w', brand: 'Other', model: 'OtherModel' }),
    ])

    // If the empty-guard breaks, this resolver is awaited and throws —
    // propagating the failure to the test.
    let brandLookupCalls = 0
    brandNameLookupResolver = async () => {
      brandLookupCalls++
      throw new Error(
        'brandNameLookup SELECT invoked with zero viewerBrandIds — sql.join empty guard broken (Pitfall 2)',
      )
    }

    setBucket(400)
    await expect(getRecommendationsForViewer('viewer-1')).resolves.toBeDefined()
    expect(brandLookupCalls).toBe(0)
  })
})
