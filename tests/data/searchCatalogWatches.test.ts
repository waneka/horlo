import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 19 Plan 01 Task 2 — searchCatalogWatches DAL contract tests.
//
// Verifies the SRCH-09 (Watches catalog matches) + SRCH-10 (anti-N+1 viewer-
// state hydration) invariants per CONTEXT.md D-01..D-06.
//
// Mirrors tests/data/searchProfiles.test.ts byte-for-byte for the Drizzle
// chainable-mock setup. Notable differences:
//   - candidates chain: from → where → orderBy → limit (resolves with rows)
//   - state chain:     from → where (resolves with rows; the inArray/eq
//     predicate is captured for assertion).
// ---------------------------------------------------------------------------

type Call = { op: string; args: unknown[] }

let candidateRows: Array<{
  id: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null
  ownersCount: number
  wishlistCount: number
}> = []
let stateRows: Array<{ catalogId: string | null; status: string }> = []
let calls: Call[] = []
let selectCount = 0

function makeCandidateChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: (...args: unknown[]) => {
      calls.push({ op: 'cand.from', args })
      return chain
    },
    where: (...args: unknown[]) => {
      calls.push({ op: 'cand.where', args })
      return chain
    },
    orderBy: (...args: unknown[]) => {
      calls.push({ op: 'cand.orderBy', args })
      return chain
    },
    limit: (...args: unknown[]) => {
      calls.push({ op: 'cand.limit', args })
      return Promise.resolve(candidateRows)
    },
  } as never
  return chain
}

function makeStateChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: (...args: unknown[]) => {
      calls.push({ op: 'state.from', args })
      return chain
    },
    where: (...args: unknown[]) => {
      calls.push({ op: 'state.where', args })
      return Promise.resolve(stateRows)
    },
  } as never
  return chain
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => {
      selectCount += 1
      // 1st select = candidates query; 2nd select = viewer-state hydration.
      return selectCount === 1 ? makeCandidateChain() : makeStateChain()
    }),
  },
}))

import { searchCatalogWatches } from '@/data/catalog'

const VIEWER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

// Drizzle objects carry circular back-references that crash JSON.stringify.
// Use a cycle-breaking serializer for substring assertions on captured args.
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>()
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v as object)) return '[Circular]'
      seen.add(v as object)
    }
    return v
  })
}

beforeEach(() => {
  calls = []
  candidateRows = []
  stateRows = []
  selectCount = 0
})

describe('searchCatalogWatches (SRCH-09, SRCH-10, D-01..D-06)', () => {
  it('Test 1: server-side 2-char gate — q="a" returns [] without DB call', async () => {
    const out = await searchCatalogWatches({ q: 'a', viewerId: VIEWER })
    expect(out).toEqual([])
    expect(selectCount).toBe(0)
  })

  it('Test 1b: whitespace-only q returns [] without DB call', async () => {
    const out = await searchCatalogWatches({ q: '   ', viewerId: VIEWER })
    expect(out).toEqual([])
    expect(selectCount).toBe(0)
  })

  it('Test 2: orderBy uses popularity-DESC + alphabetical tie-break (D-02)', async () => {
    candidateRows = []
    await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    const orderBy = calls.find((c) => c.op === 'cand.orderBy')
    expect(orderBy).toBeDefined()
    const orderJson = safeStringify(orderBy!.args)
    // popularity expression appears (owners + 0.5 * wishlist)
    expect(orderJson).toContain('owners_count')
    expect(orderJson).toContain('wishlist_count')
    expect(orderJson).toContain('0.5')
    // brand_normalized + model_normalized tie-break columns referenced
    expect(orderJson).toContain('brand_normalized')
    expect(orderJson).toContain('model_normalized')
  })

  it('Test 3 + 4: WHERE includes score-zero exclusion + ILIKE OR across 3 normalized cols (D-01, D-02)', async () => {
    candidateRows = []
    await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const json = safeStringify(whereCall!.args)
    // Score-zero exclusion (Phase 18 idiom)
    expect(json).toContain('owners_count')
    expect(json).toContain('wishlist_count')
    // ILIKE OR across the three normalized columns
    expect(json).toContain('brand_normalized')
    expect(json).toContain('model_normalized')
    expect(json).toContain('reference_normalized')
    // ilike operator chunks for ALL three normalized columns
    const ilikeOpMatches = json.match(/" ilike "/g) ?? []
    expect(ilikeOpMatches.length).toBeGreaterThanOrEqual(3)
  })

  it('Test 5: reference normalization (Pitfall 1) — alphanumeric-stripping bind shape', async () => {
    candidateRows = []
    await searchCatalogWatches({ q: '5711-1A', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    const json = safeStringify(whereCall!.args)
    // ref pattern is %57111a% — the alpha-stripped form bound into the SQL
    expect(json).toContain('57111a')
  })

  it('Test 5b: q with no alphanumerics (e.g. "/-") falls back to sql`false` so OR predicate stays valid', async () => {
    candidateRows = []
    // q must be >= 2 trimmed chars to bypass the early return; '/-' is 2 chars trimmed.
    await searchCatalogWatches({ q: '/-', viewerId: VIEWER })
    // No throw, candidates resolved (empty), function returned [] — pass.
    expect(selectCount).toBe(1)
  })

  it('Test 6: anti-N+1 — exactly ONE state-hydration query for N candidates (SRCH-10)', async () => {
    candidateRows = [
      { id: 'c1', brand: 'Rolex', model: 'Submariner', reference: null, imageUrl: null, ownersCount: 5, wishlistCount: 2 },
      { id: 'c2', brand: 'Omega', model: 'Speedmaster', reference: null, imageUrl: null, ownersCount: 4, wishlistCount: 3 },
      { id: 'c3', brand: 'Seiko', model: 'SKX007', reference: null, imageUrl: null, ownersCount: 1, wishlistCount: 0 },
    ]
    stateRows = []
    await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    expect(selectCount).toBe(2)
    // Exactly one state.from emitted
    const stateFromCalls = calls.filter((c) => c.op === 'state.from')
    expect(stateFromCalls.length).toBe(1)
  })

  it('Test 7: empty candidates short-circuits before inArray (Pitfall 4)', async () => {
    candidateRows = []
    const out = await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    expect(out).toEqual([])
    expect(selectCount).toBe(1)
    expect(calls.filter((c) => c.op === 'state.from').length).toBe(0)
  })

  it('Test 8: D-05 owned wins over wishlist for the same catalogId', async () => {
    candidateRows = [
      { id: 'c1', brand: 'Rolex', model: 'Sub', reference: null, imageUrl: null, ownersCount: 5, wishlistCount: 0 },
    ]
    // Wishlist row first, owned row second — owned MUST win regardless of order
    stateRows = [
      { catalogId: 'c1', status: 'wishlist' },
      { catalogId: 'c1', status: 'owned' },
    ]
    const out = await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    expect(out[0].viewerState).toBe('owned')
  })

  it('Test 8b: D-05 owned wins when ordering is reversed (owned first, wishlist second)', async () => {
    candidateRows = [
      { id: 'c1', brand: 'Rolex', model: 'Sub', reference: null, imageUrl: null, ownersCount: 5, wishlistCount: 0 },
    ]
    stateRows = [
      { catalogId: 'c1', status: 'owned' },
      { catalogId: 'c1', status: 'wishlist' },
    ]
    const out = await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    expect(out[0].viewerState).toBe('owned')
  })

  it('Test 8c: D-05 sold + grail are NOT badged (viewerState === null)', async () => {
    candidateRows = [
      { id: 'c1', brand: 'Rolex', model: 'Sub', reference: null, imageUrl: null, ownersCount: 5, wishlistCount: 0 },
    ]
    stateRows = [
      { catalogId: 'c1', status: 'sold' },
      { catalogId: 'c1', status: 'grail' },
    ]
    const out = await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    expect(out[0].viewerState).toBeNull()
  })

  it('Test 9: D-04 — limit clamp to 20 (with default limit)', async () => {
    candidateRows = Array.from({ length: 50 }, (_, i) => ({
      id: `c${i}`,
      brand: 'B',
      model: `M${String(i).padStart(2, '0')}`,
      reference: null,
      imageUrl: null,
      ownersCount: 1,
      wishlistCount: 0,
    }))
    stateRows = []
    const out = await searchCatalogWatches({ q: 'br', viewerId: VIEWER })
    expect(out.length).toBeLessThanOrEqual(20)
  })

  it('Test 9b: pre-LIMIT candidate cap = 50 (Pitfall 5)', async () => {
    candidateRows = []
    await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    const limitCall = calls.find((c) => c.op === 'cand.limit')
    expect(limitCall).toBeDefined()
    expect(limitCall!.args[0]).toBe(50)
  })

  it('Test 10: state-hydration WHERE filters by viewerId AND inArray(catalogId, topIds)', async () => {
    candidateRows = [
      { id: 'c1', brand: 'Rolex', model: 'Sub', reference: null, imageUrl: null, ownersCount: 5, wishlistCount: 0 },
      { id: 'c2', brand: 'Omega', model: 'Speed', reference: null, imageUrl: null, ownersCount: 4, wishlistCount: 1 },
    ]
    stateRows = []
    await searchCatalogWatches({ q: 'sub', viewerId: VIEWER })
    const stateWhere = calls.find((c) => c.op === 'state.where')
    expect(stateWhere).toBeDefined()
    const json = safeStringify(stateWhere!.args)
    // viewerId is bound somewhere in the WHERE
    expect(json).toContain(VIEWER)
    // inArray emits " in " operator chunk
    expect(json).toContain('" in "')
    // candidate ids carried in the bind
    expect(json).toContain('c1')
    expect(json).toContain('c2')
  })

  it('Test 11: result row mapping — fields wired correctly', async () => {
    candidateRows = [
      { id: 'c1', brand: 'Rolex', model: 'Submariner', reference: '116610LN', imageUrl: 'https://x/img.jpg', ownersCount: 7, wishlistCount: 3 },
    ]
    stateRows = []
    const out = await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    expect(out[0]).toEqual({
      catalogId: 'c1',
      brand: 'Rolex',
      model: 'Submariner',
      reference: '116610LN',
      imageUrl: 'https://x/img.jpg',
      ownersCount: 7,
      wishlistCount: 3,
      viewerState: null,
    })
  })
})
