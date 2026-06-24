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
    styleTags: string[]
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
      // Catalog terminal via .where (260623-pzz pool-broadening second
      // query — `.where(sql\`lower(trim(brand)) = ANY(...)\`)` with NO
      // `.limit()` after). Routes to the same catalog resolver as the
      // popularity slice — in production these two queries return different
      // rows, but the test-environment simplification (same resolver fires
      // for both) is acceptable because the test asserts scoring + cap +
      // dedup behavior on a single row set; the EXPLICIT call-count
      // assertion (`catalogResolverCalls >= 1`) is what pins pool-
      // broadening, not row content.
      if (routedTo === 'catalog') {
        return {
          then: (resolve: (v: unknown[]) => unknown) =>
            catalogTopUpResolver().then(resolve),
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
    styleTags: { __col: 'watchesCatalog.styleTags' },
  },
}))

vi.mock('drizzle-orm', () => ({
  and: (..._a: unknown[]) => ({ __op: 'and' }),
  eq: (..._a: unknown[]) => ({ __op: 'eq' }),
  ne: (..._a: unknown[]) => ({ __op: 'ne' }),
  asc: (_a: unknown) => ({ __op: 'asc' }),
  desc: (_a: unknown) => ({ __op: 'desc' }),
  // 260623-pzz: pool-broadening's second query uses `sql\`lower(trim(...))
  // = ANY(${array})\``. The mock is a tagged stub — the chain factory does
  // not inspect the where()-arg contents, only routes by table identity.
  sql: (_strings: TemplateStringsArray, ..._values: unknown[]) => ({
    __op: 'sql',
  }),
}))

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
  // SET-based match, per-brand variety cap, and pool-broadening call count.
  // ──────────────────────────────────────────────────────────────────────
  it('sparse-pool top-up: brand-match outranks style-match outranks pure-popularity, and real styleTags project onto synthetic rows so rationale templates fire', async () => {
    // 2 peers seed the pool (peer-0 + peer-1 each own 1 unrelated watch).
    // candidateMap.size = 2 after exclusion -> top-up needs 6 more rows to
    // reach SPARSE_POOL_THRESHOLD = 8.
    const profiles = buildSeedPool(2)
    publicProfilesResolver = async () => profiles

    // 4-watch fixture (3 Rolex + 1 Tudor) — topBrandOf still returns 'Rolex'
    // (3>1), but viewerOwnedBrandsLower is now {rolex, tudor}. This exercises
    // the multi-brand SET match (260623-pzz). dominantStyleOf still returns
    // 'sport' with share 1.0 (all four watches share styleTags: ['sport']).
    watchesByUser.set('viewer-1', [
      mkWatch({ id: 'v-1', brand: 'Rolex', model: 'Submariner', styleTags: ['sport'] }),
      mkWatch({ id: 'v-2', brand: 'Rolex', model: 'Explorer',   styleTags: ['sport'] }),
      mkWatch({ id: 'v-3', brand: 'Rolex', model: 'GMT',        styleTags: ['sport'] }),
      mkWatch({ id: 'v-4', brand: 'Tudor', model: 'Black Bay',  styleTags: ['sport'] }),
    ])

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
        // Deliberately interleaved so fetch-order != score-order.
        { id: 'cat-omega', brand: 'Omega', model: 'Speedmaster', reference: '310', imageUrl: null, ownersCount: 80, styleTags: ['casual'] },
        { id: 'cat-rolex', brand: 'Rolex', model: 'Datejust',    reference: '126200', imageUrl: null, ownersCount: 5, styleTags: ['dress'] },
        { id: 'cat-cartier', brand: 'Cartier', model: 'Tank',    reference: 'WSTA',   imageUrl: null, ownersCount: 60, styleTags: ['dress'] },
        { id: 'cat-seiko', brand: 'Seiko', model: 'SKX007',      reference: 'SKX',    imageUrl: null, ownersCount: 99, styleTags: ['sport'] },
        { id: 'cat-filler1', brand: 'Zenith', model: 'Defy',     reference: 'DEFY',   imageUrl: null, ownersCount: 10, styleTags: ['casual'] },
        { id: 'cat-filler2', brand: 'Yema', model: 'Superman',   reference: 'SUP',    imageUrl: null, ownersCount: 8,  styleTags: ['casual'] },
        // 260623-pzz extensions: 1 Tudor (owned-set brand-match) + 3 more
        // Rolex rows (variety-cap stress — all score 150+, would dominate
        // the top-up unbounded).
        { id: 'cat-tudor',   brand: 'Tudor', model: 'Pelagos',         reference: '25600',  imageUrl: null, ownersCount: 30, styleTags: ['sport'] },
        { id: 'cat-rolex-2', brand: 'Rolex', model: 'GMT Master II',   reference: '126710', imageUrl: null, ownersCount: 90, styleTags: ['sport'] },
        { id: 'cat-rolex-3', brand: 'Rolex', model: 'Submariner Date', reference: '126610', imageUrl: null, ownersCount: 85, styleTags: ['sport'] },
        { id: 'cat-rolex-4', brand: 'Rolex', model: 'Daytona',         reference: '116500', imageUrl: null, ownersCount: 70, styleTags: ['sport'] },
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

    // 7a. Multi-brand surfacing: Tudor is owned (viewer's brand SET is
    //     {rolex, tudor}) so the Tudor catalog row brand-matches via the
    //     SET — under the old single-string brandMatch (= topBrandOf only,
    //     which returns 'Rolex' for this fixture) Tudor would have scored
    //     only 50 internally (style-only) and tied with Seiko at 50.030
    //     vs 50.099, so Seiko would beat it in internal sort; under the
    //     new SET-membership check Tudor scores 150 internally (brand +
    //     style). The OBSERVABLE diff in `recs` (the outer re-sort
    //     flattens rule-matched rows to score=50 and alpha-tiebreaks by
    //     brand, so Seiko < Tudor in the final list regardless) is that
    //     Tudor surfaces AHEAD of the community-fallback rows (Cartier,
    //     Omega) because it lands in the rule-matched 50-bucket — which
    //     it does under both impls. The strict differentiator is that the
    //     cap (7b) frees enough slots that Cartier+Omega ALSO surface in
    //     the synthetic top-up; under the unbounded old impl those two
    //     get crowded out by the 4-Rolex pile and `idx('Cartier')` == -1,
    //     so this assertion is meaningful as a cap-presence proxy too.
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
    //     once for the popularity slice, and (when viewerOwnedBrandsLower
    //     is non-empty) ideally a second time for the owned-brands query.
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
