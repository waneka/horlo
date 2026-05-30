// src/data/__tests__/catalog-search-tokens.test.ts
//
// Phase 72 — searchCatalogForAddFlow multi-token regression tests (SRCH-01).
// Coverage (D-11):
//   - single-token "Brut" returns matching row (regression guard)
//   - multi-token "Brut Datejust" returns matching row (primary SRCH-01 fix)
//   - multi-token "Timex Weekender" returns matching row (primary SRCH-01 fix)
//   - token-order invariance: "Datejust Brut" returns same row as "Brut Datejust"
//   - whitespace-only query returns [] (defensive empty-token guard)

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

import { searchCatalogForAddFlow } from '@/data/catalog'

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

// Seed rows — full candidate shape required by the DAL mapper
const BRUT_DATEJUST_ROW = {
  id: 'catalog-001',
  brand: 'Brut',
  model: 'Datejust 36',
  reference: '126234',
  imageUrl: null,
  ownersCount: 5,
  wishlistCount: 2,
}

const TIMEX_WEEKENDER_ROW = {
  id: 'catalog-002',
  brand: 'Timex',
  model: 'Weekender 38mm',
  reference: null,
  imageUrl: null,
  ownersCount: 3,
  wishlistCount: 1,
}

beforeEach(() => {
  calls = []
  candidateRows = []
  stateRows = []
  selectCount = 0
})

describe('searchCatalogForAddFlow — SRCH-01 multi-token regression tests (Phase 72)', () => {
  it('(T1) single-token "Brut" returns the matching row (regression guard)', async () => {
    candidateRows = [BRUT_DATEJUST_ROW]
    const result = await searchCatalogForAddFlow({ q: 'Brut', viewerId: VIEWER, limit: 10 })
    expect(result).toHaveLength(1)
    expect(result[0].catalogId).toBe('catalog-001')
    expect(result[0].brand).toBe('Brut')
  })

  it('(T2) multi-token "Brut Datejust" returns the matching row and WHERE has separate per-token patterns (SRCH-01)', async () => {
    candidateRows = [BRUT_DATEJUST_ROW]
    const result = await searchCatalogForAddFlow({ q: 'Brut Datejust', viewerId: VIEWER, limit: 10 })
    expect(result).toHaveLength(1)
    expect(result[0].catalogId).toBe('catalog-001')

    // WHERE-clause inspection: per-token AND-of-ORs must produce SEPARATE token patterns.
    // The fused multi-token pattern "%brut datejust%" MUST NOT be present —
    // that would indicate the old single-token implementation (which fails in prod because
    // no single column contains "brut datejust" as a substring).
    // The individual patterns "%brut%" and "%datejust%" MUST each appear, confirming
    // that each token is independently bound per D-02 + D-04.
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const json = safeStringify(whereCall!.args)
    // Individual token patterns present (D-02 AND-of-ORs)
    expect(json).toContain('%brut%')
    expect(json).toContain('%datejust%')
    // Fused multi-token pattern absent (confirms tokenization happened)
    expect(json).not.toContain('%brut datejust%')
  })

  it('(T3) multi-token "Timex Weekender" returns the matching row and WHERE has separate per-token patterns (SRCH-01)', async () => {
    candidateRows = [TIMEX_WEEKENDER_ROW]
    const result = await searchCatalogForAddFlow({ q: 'Timex Weekender', viewerId: VIEWER, limit: 10 })
    expect(result).toHaveLength(1)
    expect(result[0].catalogId).toBe('catalog-002')

    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const json = safeStringify(whereCall!.args)
    // Individual token patterns present
    expect(json).toContain('%timex%')
    expect(json).toContain('%weekender%')
    // Fused multi-token pattern absent
    expect(json).not.toContain('%timex weekender%')
  })

  it('(T4) token-order invariance: "Datejust Brut" returns the same row as "Brut Datejust"', async () => {
    // Forward order
    candidateRows = [BRUT_DATEJUST_ROW]
    const resultForward = await searchCatalogForAddFlow({ q: 'Brut Datejust', viewerId: VIEWER, limit: 10 })

    // Reverse order — reset state, re-seed
    calls = []
    candidateRows = [BRUT_DATEJUST_ROW]
    stateRows = []
    selectCount = 0
    const resultReverse = await searchCatalogForAddFlow({ q: 'Datejust Brut', viewerId: VIEWER, limit: 10 })

    // Both orders must return the same row (AND-of-ORs is commutative in semantics)
    expect(resultForward).toHaveLength(1)
    expect(resultReverse).toHaveLength(1)
    expect(resultForward[0].catalogId).toBe(resultReverse[0].catalogId)
  })

  it('(T5) whitespace-only query returns [] without calling cand.where (early-return guard)', async () => {
    // "   " trims to "" which is length 0 < SEARCH_ADD_FLOW_TRIM_MIN_LEN (2)
    // The upstream early-return fires before any DB call is made.
    const result = await searchCatalogForAddFlow({ q: '   ', viewerId: VIEWER, limit: 10 })
    expect(result).toEqual([])
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeUndefined()
  })
})
