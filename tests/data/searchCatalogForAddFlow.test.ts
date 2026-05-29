import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 67 Plan 02 Task 1 — searchCatalogForAddFlow DAL contract tests.
//
// Verifies the D-01/D-03/D-04/D-05 invariants per CONTEXT.md:
//   - 2-char gate short-circuits before any DB call
//   - ORDER BY has both reference_normalized exact-match tier (D-04/D-05)
//     AND the existing popularity sort copied from searchCatalogWatches
//   - WHERE is ILIKE OR across 3 normalized cols only (no facets — D-03)
//   - Pitfall 4: empty candidates short-circuit the viewerState hydration query
//   - Anti-N+1 batched viewerState hydration with single inArray (SRCH-10)
//   - D-05 owned-wins viewerState precedence
//   - Result row field mapping to SearchCatalogWatchResult shape
//
// Mock infrastructure lifted verbatim from tests/data/searchCatalogWatches.test.ts.
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

import { searchCatalogForAddFlow } from '@/data/catalog'

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

describe('searchCatalogForAddFlow DAL (D-01/D-04/D-05/SRCH-18)', () => {
  it('Test 1: 2-char gate short-circuits before db.select()', async () => {
    const out = await searchCatalogForAddFlow({ q: 'a', viewerId: VIEWER, limit: 20 })
    expect(out).toEqual([])
    expect(selectCount).toBe(0)
  })

  it('Test 2: ORDER BY contains both reference_normalized tier AND owners_count tier (D-04/D-05)', async () => {
    candidateRows = []
    await searchCatalogForAddFlow({ q: 'speedmaster', viewerId: VIEWER, limit: 20 })
    const orderBy = calls.find((c) => c.op === 'cand.orderBy')
    expect(orderBy).toBeDefined()
    const orderJson = safeStringify(orderBy!.args)
    // Exact-reference tier: reference_normalized appears in the ORDER BY
    expect(orderJson).toContain('reference_normalized')
    // Popularity tier: owners_count + wishlist_count appear
    expect(orderJson).toContain('owners_count')
    expect(orderJson).toContain('wishlist_count')
  })

  it('Test 3: WHERE is ILIKE OR across brand_normalized + model_normalized + reference_normalized (no facets)', async () => {
    candidateRows = []
    await searchCatalogForAddFlow({ q: 'speedmaster', viewerId: VIEWER, limit: 20 })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const json = safeStringify(whereCall!.args)
    // ILIKE OR across the three normalized columns
    expect(json).toContain('brand_normalized')
    expect(json).toContain('model_normalized')
    expect(json).toContain('reference_normalized')
    // ilike operator chunks for ALL three normalized columns
    const ilikeOpMatches = json.match(/" ilike "/g) ?? []
    expect(ilikeOpMatches.length).toBeGreaterThanOrEqual(3)
  })

  it('Test 4: empty candidates short-circuits viewerState hydration (Pitfall 4)', async () => {
    candidateRows = []
    const out = await searchCatalogForAddFlow({ q: 'speedmaster', viewerId: VIEWER, limit: 20 })
    expect(out).toEqual([])
    expect(selectCount).toBe(1)
    expect(calls.filter((c) => c.op === 'state.from').length).toBe(0)
  })

  it('Test 5: anti-N+1 single batched viewerState hydration (selectCount === 2)', async () => {
    candidateRows = [
      { id: 'c1', brand: 'Omega', model: 'Speedmaster', reference: '311.30.42.30.01.005', imageUrl: null, ownersCount: 5, wishlistCount: 2 },
      { id: 'c2', brand: 'Omega', model: 'Seamaster', reference: null, imageUrl: null, ownersCount: 4, wishlistCount: 3 },
      { id: 'c3', brand: 'Omega', model: 'Constellation', reference: null, imageUrl: null, ownersCount: 1, wishlistCount: 0 },
    ]
    stateRows = []
    await searchCatalogForAddFlow({ q: 'speedmaster', viewerId: VIEWER, limit: 20 })
    expect(selectCount).toBe(2)
    // Exactly one state.from emitted (single batched query)
    const stateFromCalls = calls.filter((c) => c.op === 'state.from')
    expect(stateFromCalls.length).toBe(1)
    // The state.where includes inArray
    const stateWhere = calls.find((c) => c.op === 'state.where')
    expect(stateWhere).toBeDefined()
    const json = safeStringify(stateWhere!.args)
    expect(json).toContain('" in "')
    // viewerId is bound in the WHERE
    expect(json).toContain(VIEWER)
  })

  it('Test 6: D-05 owned-wins viewerState precedence', async () => {
    candidateRows = [
      { id: 'c1', brand: 'Omega', model: 'Speedmaster', reference: null, imageUrl: null, ownersCount: 5, wishlistCount: 0 },
    ]
    // Wishlist row first, owned row second — owned MUST win regardless of order
    stateRows = [
      { catalogId: 'c1', status: 'wishlist' },
      { catalogId: 'c1', status: 'owned' },
    ]
    const out = await searchCatalogForAddFlow({ q: 'speedmaster', viewerId: VIEWER, limit: 20 })
    expect(out[0].viewerState).toBe('owned')
  })

  it('Test 7: result row field mapping', async () => {
    candidateRows = [
      { id: 'c1', brand: 'Omega', model: 'Speedmaster', reference: '311.30.42.30.01.005', imageUrl: 'https://x/img.jpg', ownersCount: 7, wishlistCount: 3 },
    ]
    stateRows = []
    const out = await searchCatalogForAddFlow({ q: 'speedmaster', viewerId: VIEWER, limit: 20 })
    expect(out[0]).toEqual({
      catalogId: 'c1',
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30.42.30.01.005',
      imageUrl: 'https://x/img.jpg',
      ownersCount: 7,
      wishlistCount: 3,
      viewerState: null,
    })
  })
})
