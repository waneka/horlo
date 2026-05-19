// src/data/__tests__/catalog-facets.test.ts
//
// Phase 46 Plan 02 — searchCatalogWatches brand/era/genre/archetype facet tests.
// Coverage (D-11, D-12):
//   1. searchCatalogWatches with { archetype: 'dive' } and q:'' triggers a DB call (facet gate lifted)
//   2. searchCatalogWatches with { era: 'modern' } triggers a DB call (facet gate lifted)
//   3. searchCatalogWatches with { genre: 'dive' } sends same archetype predicate as { archetype: 'dive' }
//   4. searchCatalogWatches with { archetype: 'dive', genre: 'pilot' } — archetype wins (Pitfall 4)
//   5. searchCatalogWatches with { brand: 'rolex' } triggers a DB call with brand subquery
//   6. searchCatalogWatches with no facet and empty q returns [] without a DB call (no regression)

import { describe, it, expect, vi, beforeEach } from 'vitest'

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
      return selectCount === 1 ? makeCandidateChain() : makeStateChain()
    }),
  },
}))

import { searchCatalogWatches } from '@/data/catalog'

const VIEWER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

// Drizzle objects carry circular back-references that crash JSON.stringify.
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

describe('searchCatalogWatches facet extension (Phase 46 Plan 02)', () => {
  it('archetype filter: query-free run — { archetype: "dive" } with empty q triggers a DB call (D-11)', async () => {
    candidateRows = []
    await searchCatalogWatches({ q: '', viewerId: VIEWER, filters: { archetype: 'dive' } })
    // hasActiveFacet must lift the q-gate so the DB is called
    expect(selectCount).toBeGreaterThanOrEqual(1)
    // WHERE predicate must reference primaryArchetype / primary_archetype
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const json = safeStringify(whereCall!.args)
    expect(json).toContain('primary_archetype')
    expect(json).toContain('dive')
  })

  it('era filter: query-free run — { era: "modern" } with empty q triggers a DB call (D-11)', async () => {
    candidateRows = []
    await searchCatalogWatches({ q: '', viewerId: VIEWER, filters: { era: 'modern' } })
    expect(selectCount).toBeGreaterThanOrEqual(1)
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const json = safeStringify(whereCall!.args)
    expect(json).toContain('era_signal')
    expect(json).toContain('modern')
  })

  it('genre filter: { genre: "dive" } applies the same primaryArchetype predicate as { archetype: "dive" }', async () => {
    candidateRows = []
    await searchCatalogWatches({ q: 'dive', viewerId: VIEWER, filters: { genre: 'dive' } })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const json = safeStringify(whereCall!.args)
    // genre maps to primary_archetype column (Pitfall 4)
    expect(json).toContain('primary_archetype')
    expect(json).toContain('dive')
  })

  it('archetype-wins precedence: { archetype: "dive", genre: "pilot" } — archetype value used, genre ignored (Pitfall 4)', async () => {
    candidateRows = []
    await searchCatalogWatches({ q: 'watch', viewerId: VIEWER, filters: { archetype: 'dive', genre: 'pilot' } })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const json = safeStringify(whereCall!.args)
    // 'dive' (archetype) should appear; 'pilot' (genre) should NOT appear as separate predicate
    expect(json).toContain('dive')
    // pilot should NOT appear — archetype wins
    const pilotOccurrences = (json.match(/pilot/g) ?? []).length
    const diveOccurrences = (json.match(/dive/g) ?? []).length
    // dive must appear at least once (archetype predicate bound value)
    expect(diveOccurrences).toBeGreaterThanOrEqual(1)
    // pilot must not appear as a bound SQL value in the WHERE (archetype wins)
    expect(pilotOccurrences).toBe(0)
  })

  it('brand filter: { brand: "rolex" } triggers a DB call with brand subquery containing the slug (D-12)', async () => {
    candidateRows = []
    await searchCatalogWatches({ q: 'watch', viewerId: VIEWER, filters: { brand: 'rolex' } })
    expect(selectCount).toBeGreaterThanOrEqual(1)
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const json = safeStringify(whereCall!.args)
    // brand subquery must reference 'brands' table slug
    expect(json).toContain('brands')
    expect(json).toContain('rolex')
  })

  it('no-facet-no-query regression: empty q with no facets returns [] without DB call (Pitfall 3)', async () => {
    const out = await searchCatalogWatches({ q: '', viewerId: VIEWER })
    expect(out).toEqual([])
    expect(selectCount).toBe(0)
  })

  it('no-facet-no-query regression: short q with no facets returns [] without DB call', async () => {
    const out = await searchCatalogWatches({ q: 'a', viewerId: VIEWER })
    expect(out).toEqual([])
    expect(selectCount).toBe(0)
  })
})
