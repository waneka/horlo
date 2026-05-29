import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 67 Plan 01 Task 1 — findViewerWatchByCatalogId DAL contract tests.
//
// Verifies the D-06 (statuses param), D-07 (widened return type), and D-08
// (owned-wins precedence) contract decisions from 67-CONTEXT.md.
//
// Mock infrastructure: single db.select() chainable resolving at .limit().
// Module-level returnedRows + calls arrays reset in beforeEach.
//
// safeStringify from tests/data/searchCatalogWatches.test.ts (cycle-breaker).
// ---------------------------------------------------------------------------

// Phase 70 Wave 0 — row shape widened to include `reference` from the
// watches_catalog leftJoin (RESEARCH §2 / Pitfall #2). Pre-existing tests pass
// rows without a reference field; the chain mock now also accepts a leftJoin
// step inserted between from() and where() in the DAL.
let returnedRows: Array<{ id: string; status: string; reference?: string | null }> = []
let calls: Array<{ op: string; args: unknown[] }> = []

function makeChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: (...args: unknown[]) => {
      calls.push({ op: 'from', args })
      return chain
    },
    // Phase 70 Wave 0 — chain through the new leftJoin step.
    leftJoin: (...args: unknown[]) => {
      calls.push({ op: 'leftJoin', args })
      return chain
    },
    where: (...args: unknown[]) => {
      calls.push({ op: 'where', args })
      return chain
    },
    orderBy: (...args: unknown[]) => {
      calls.push({ op: 'orderBy', args })
      return chain
    },
    limit: (...args: unknown[]) => {
      calls.push({ op: 'limit', args })
      return Promise.resolve(returnedRows)
    },
  } as never
  return chain
}

vi.mock('@/db', () => ({
  db: { select: vi.fn(() => makeChain()) },
}))

import { findViewerWatchByCatalogId } from '@/data/watches'

const USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const CATALOG_ID = '11111111-2222-4333-8444-555555555555'

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
  returnedRows = []
})

describe('findViewerWatchByCatalogId (D-06/D-07/D-08)', () => {
  it('(a) statuses=["owned"], owned row present → returns { id, status: "owned", reference: null }', async () => {
    // Phase 70 Wave 0 — reference field is additive; undefined in mock row → null at boundary.
    returnedRows = [{ id: 'w-1', status: 'owned' }]
    const result = await findViewerWatchByCatalogId(USER_ID, CATALOG_ID, ['owned'])
    expect(result).toEqual({ id: 'w-1', status: 'owned', reference: null })
  })

  it('(b) statuses=["owned","wishlist"], only wishlist row present → returns { id, status: "wishlist", reference: null }', async () => {
    returnedRows = [{ id: 'w-2', status: 'wishlist' }]
    const result = await findViewerWatchByCatalogId(USER_ID, CATALOG_ID, ['owned', 'wishlist'])
    expect(result).toEqual({ id: 'w-2', status: 'wishlist', reference: null })
  })

  it('(c) statuses=["owned","wishlist"], both rows exist → returns owned row (D-08 precedence)', async () => {
    // The DB CASE ORDER BY returns owned first; mock returns that first row
    returnedRows = [{ id: 'w-owned', status: 'owned' }]
    const result = await findViewerWatchByCatalogId(USER_ID, CATALOG_ID, ['owned', 'wishlist'])
    expect(result).toEqual({ id: 'w-owned', status: 'owned', reference: null })
  })

  it('(f) Phase 70 Wave 0 — when catalog row has a reference, leftJoin surfaces it in the return', async () => {
    // RESEARCH §2 closure: DupeBanner "View existing" /w/[ref] target source.
    returnedRows = [{ id: 'w-1', status: 'owned', reference: '311.30.42.30.01.005' }]
    const result = await findViewerWatchByCatalogId(USER_ID, CATALOG_ID, ['owned', 'wishlist'])
    expect(result).toEqual({
      id: 'w-1',
      status: 'owned',
      reference: '311.30.42.30.01.005',
    })
  })

  it('(d) no matching rows → returns null', async () => {
    returnedRows = []
    const result = await findViewerWatchByCatalogId(USER_ID, CATALOG_ID, ['owned', 'wishlist'])
    expect(result).toBeNull()
  })

  it('(e) default invocation (no statuses arg) → owned-only search (BUG-01 backward compat)', async () => {
    returnedRows = [{ id: 'w-1', status: 'owned' }]
    await findViewerWatchByCatalogId(USER_ID, CATALOG_ID) // no statuses arg
    const whereCall = calls.find((c) => c.op === 'where')
    const json = safeStringify(whereCall!.args)
    // Drizzle inArray serializes bound values as {"value":"X","encoder":...}
    // Enum column metadata carries enumValues but not as bound values.
    // Must NOT have 'wishlist' as a bound IN-clause value
    expect(json).not.toContain('"value":"wishlist"')
    // Must have 'owned' as a bound IN-clause value
    expect(json).toContain('"value":"owned"')
  })
})
