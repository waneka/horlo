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

type CandRow = {
  id: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null
  ownersCount: number
  wishlistCount: number
}

let candidateRows: CandRow[] = []
// 260623-uua: fuzzy fallback tier — when strict returns empty AND trimmed.length >= 3
// AND tokens.length > 0, a second candidate-shaped select runs. fallbackRows
// supplies its rows.
let fallbackRows: CandRow[] = []
let stateRows: Array<{ catalogId: string | null; status: string }> = []
let calls: Call[] = []
let selectCount = 0

// Polymorphic chain — supports BOTH the state-shaped (from→where) and
// candidate-shaped (from→where→orderBy→limit) chains in a single object.
// The `op` prefix is supplied by the caller so call-site assertions can
// distinguish strict/fallback/state/brand by op name. The terminal method
// (.where for state, .limit for candidate) returns the appropriate Promise
// based on the caller's intent (signaled by which method the DAL invokes).
function makePolyChain(opPrefix: string, terminalRows: () => unknown[]) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: (...args: unknown[]) => {
      calls.push({ op: `${opPrefix}.from`, args })
      return chain
    },
    where: (...args: unknown[]) => {
      calls.push({ op: `${opPrefix}.where`, args })
      // For state-shaped chains, .where is the terminal. We return a
      // thenable that ALSO behaves like a chain — so a DAL that calls
      // .orderBy().limit() after .where() still works (the chain object
      // exposes orderBy + limit), but if the caller awaits the .where
      // result directly (state-hydration shape) they get the rows.
      const thenable = Object.assign(Promise.resolve(terminalRows()), chain)
      return thenable
    },
    orderBy: (...args: unknown[]) => {
      calls.push({ op: `${opPrefix}.orderBy`, args })
      return chain
    },
    limit: (...args: unknown[]) => {
      calls.push({ op: `${opPrefix}.limit`, args })
      return Promise.resolve(terminalRows())
    },
  } as never
  return chain
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => {
      selectCount += 1
      // Order of selects (no filters.brand path exercised by these tests):
      //   #1 = strict candidate; #2 = (state if strict had rows) OR (fallback
      //   if strict empty); #3 = state when fallback fired AND returned rows.
      if (selectCount === 1) return makePolyChain('cand', () => candidateRows)
      if (selectCount === 2) {
        if (candidateRows.length > 0) return makePolyChain('state', () => stateRows)
        return makePolyChain('fallback', () => fallbackRows)
      }
      return makePolyChain('state', () => stateRows)
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
  fallbackRows = []
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

  it('Test 3 + 4: WHERE references all 3 normalized cols + uses ILIKE on the unaccent fold (D-01, D-02 / 260623-uua)', async () => {
    candidateRows = []
    await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const json = safeStringify(whereCall!.args)
    // ILIKE OR across the three normalized columns — column identifiers still present.
    expect(json).toContain('brand_normalized')
    expect(json).toContain('model_normalized')
    expect(json).toContain('reference_normalized')
    // 260623-uua: brand+model now wrapped in lower(public.f_unaccent(...)) on
    // both sides of an ILIKE; reference still uses the Drizzle ilike() helper
    // (its generated column already strips diacritics).
    expect(json).toContain('lower(public.f_unaccent(')
    expect(json).toContain('ILIKE')
    // Reference branch still emits the Drizzle ilike() helper chunk.
    expect(json).toMatch(/" ilike "/)
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

  it('Test 7: empty candidates short-circuits before inArray (Pitfall 4) — 260623-uua: even when fuzzy fallback ALSO returns 0', async () => {
    candidateRows = []
    fallbackRows = []
    const out = await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    expect(out).toEqual([])
    // Pitfall 4 invariant preserved: NO state-hydration query fires when the
    // final candidate set is empty (strict tier + fuzzy fallback both empty).
    expect(calls.filter((c) => c.op === 'state.from').length).toBe(0)
    // 260623-uua: strict + fallback select fire (2), but state does NOT (3rd never reached).
    expect(selectCount).toBe(2)
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

  it('Test 12 (hotfix 260513-hvu): zero-popularity name-match rows ARE returned by ILIKE — pre-fix the score-zero AND-gate excluded them', async () => {
    // Pre-fix: rows with ownersCount=0 AND wishlistCount=0 were excluded by the
    // (owners + 0.5*wishlist) > 0 AND-gate, stranding the 100 seeded catalog
    // rows bootstrapped in Phase 39b-01. Post-fix: WHERE is ILIKE-OR-only,
    // popularity moved to ORDER BY ranking.
    candidateRows = [
      {
        id: 'cseed',
        brand: 'Omega',
        model: 'Speedmaster',
        reference: '311.30.42.30.01.005',
        imageUrl: null,
        ownersCount: 0,
        wishlistCount: 0,
      },
    ]
    stateRows = []
    const out = await searchCatalogWatches({ q: 'omega', viewerId: VIEWER })
    expect(out.length).toBe(1)
    expect(out[0].catalogId).toBe('cseed')
    expect(out[0].ownersCount).toBe(0)
    expect(out[0].wishlistCount).toBe(0)
    expect(out[0].viewerState).toBeNull()
    // Negative WHERE assertion: the score-zero predicate's `0.5 *` coefficient
    // must NOT have leaked into the WHERE bind. (ORDER BY captures hit
    // cand.orderBy, not cand.where, so this is a clean negative against the
    // post-fix WHERE.)
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const whereJson = safeStringify(whereCall!.args)
    expect(whereJson).not.toContain('0.5')
  })
})

// ---------------------------------------------------------------------------
// 260623-uua: multi-token + unaccent + pg_trgm fuzzy fallback contract tests.
// Per `project_drizzle_sql_any_array_pitfall` + CLAUDE.md `## Local-First
// Development`: the DAL test mock does NOT execute SQL; these tests assert
// generated SQL shape and code-path branching. Manual UAT against local
// Supabase (Task 4 in plan) is the authoritative row-count gate.
// ---------------------------------------------------------------------------

describe('260623-uua tokenization (D-01 multi-token AND-of-ORs)', () => {
  it('multi-token query — both tokens appear as parameterized binds in WHERE', async () => {
    candidateRows = []
    fallbackRows = []
    await searchCatalogWatches({ q: 'omega seamaster', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    expect(whereCall).toBeDefined()
    const json = safeStringify(whereCall!.args)
    // Each token is bound as a %token% pattern (Drizzle parameterizes per-call).
    // We expect the literal token strings in the serialized SQL because they
    // appear in bind parameter values.
    expect(json).toContain('omega')
    expect(json).toContain('seamaster')
  })

  it("'jaeger la' — 2 tokens both lowercased and bound (matches across hyphenated 'jaeger-lecoultre' per token-wise substring)", async () => {
    candidateRows = []
    fallbackRows = []
    await searchCatalogWatches({ q: 'Jaeger la', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    const json = safeStringify(whereCall!.args)
    // Tokens are lowercased before binding (lowerQ in the DAL).
    expect(json).toContain('jaeger')
    // 'la' is 2 chars; appears as bound pattern `%la%`.
    expect(json).toMatch(/%la%/)
  })

  it('whitespace inside q produces N>1 token-clauses (AND-composed)', async () => {
    candidateRows = []
    fallbackRows = []
    // 3 tokens — each must produce its own f_unaccent ILIKE OR-group.
    await searchCatalogWatches({ q: 'rolex sub date', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    const json = safeStringify(whereCall!.args)
    // The Drizzle ilike() helper for the reference branch fires once per token.
    // Count operator-chunk occurrences as a proxy for token-clause count.
    const ilikeOpMatches = json.match(/" ilike "/g) ?? []
    // At minimum each of the 3 tokens contributes ONE reference branch ilike.
    expect(ilikeOpMatches.length).toBeGreaterThanOrEqual(3)
  })
})

describe('260623-uua unaccent fold (D-02 diacritic folding)', () => {
  it("'Héron' query — WHERE contains lower(public.f_unaccent(...)) fold expression", async () => {
    candidateRows = []
    fallbackRows = []
    await searchCatalogWatches({ q: 'Héron', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    const json = safeStringify(whereCall!.args)
    expect(json).toContain('lower(public.f_unaccent(')
    // The query string preserves the original character on the bind side; the
    // unaccent() runs in Postgres at execution time, not in TypeScript.
    expect(json).toMatch(/%[Hh]éron%/)
  })

  it("'Heron' (no accent) — emits the SAME f_unaccent wrap structure as 'Héron'", async () => {
    candidateRows = []
    fallbackRows = []
    await searchCatalogWatches({ q: 'Heron', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    const json = safeStringify(whereCall!.args)
    expect(json).toContain('lower(public.f_unaccent(')
    // The fold is applied to BOTH sides of the ILIKE — column AND pattern.
    // The pattern bind is `%heron%`.
    expect(json).toMatch(/%heron%/)
  })

  it("reference branch is NOT wrapped in f_unaccent (reference_normalized already strips diacritics)", async () => {
    candidateRows = []
    fallbackRows = []
    await searchCatalogWatches({ q: 'rolex', viewerId: VIEWER })
    const whereCall = calls.find((c) => c.op === 'cand.where')
    const json = safeStringify(whereCall!.args)
    // reference_normalized appears via the Drizzle ilike() helper, NOT under
    // a f_unaccent wrap. There should be a reference_normalized substring that
    // is NOT immediately preceded by 'f_unaccent('.
    expect(json).toContain('reference_normalized')
    // Negative: the substring 'f_unaccent(' should never wrap reference_normalized.
    expect(json).not.toMatch(/f_unaccent\([^)]*reference_normalized/)
  })
})

describe('260623-uua pg_trgm fuzzy fallback tier (D-04)', () => {
  it('strict empty AND trimmed.length >= 3 → fallback select fires; trim_unaccent + similarity() in WHERE', async () => {
    candidateRows = []
    fallbackRows = []
    await searchCatalogWatches({ q: 'Jeager', viewerId: VIEWER })
    // strict select #1 fires, returns []; fallback select #2 fires.
    expect(selectCount).toBe(2)
    const fallbackWhere = calls.find((c) => c.op === 'fallback.where')
    expect(fallbackWhere).toBeDefined()
    const json = safeStringify(fallbackWhere!.args)
    // similarity() over the WHOLE query, both columns, both folded.
    expect(json).toContain('similarity(')
    expect(json).toContain('lower(public.f_unaccent(')
    // Threshold > 0.3 is bound into the SQL text.
    expect(json).toContain('0.3')
  })

  it('strict empty AND trimmed.length < 3 → fallback does NOT fire', async () => {
    candidateRows = []
    fallbackRows = []
    // '/-' trims to '/-' (2 chars). Strict tier runs, returns []. Fallback
    // guard (trimmed.length >= 3) blocks the 2nd select.
    await searchCatalogWatches({ q: '/-', viewerId: VIEWER })
    expect(selectCount).toBe(1)
    expect(calls.filter((c) => c.op === 'fallback.from').length).toBe(0)
  })

  it('strict had rows → fallback does NOT fire (substitute, not union)', async () => {
    candidateRows = [
      { id: 'c1', brand: 'Omega', model: 'Speedmaster', reference: null, imageUrl: null, ownersCount: 5, wishlistCount: 0 },
    ]
    stateRows = []
    await searchCatalogWatches({ q: 'omega', viewerId: VIEWER })
    expect(calls.filter((c) => c.op === 'fallback.from').length).toBe(0)
    // strict (1) + state (2) selects only — no fallback.
    expect(selectCount).toBe(2)
  })

  it('fallback ORDER BY ranks by similarity DESC (best fuzzy first)', async () => {
    candidateRows = []
    fallbackRows = []
    await searchCatalogWatches({ q: 'jeager', viewerId: VIEWER })
    const fallbackOrder = calls.find((c) => c.op === 'fallback.orderBy')
    expect(fallbackOrder).toBeDefined()
    const json = safeStringify(fallbackOrder!.args)
    // GREATEST(similarity(brand, q), similarity(model, q)) DESC is the primary tier.
    expect(json).toContain('GREATEST')
    expect(json).toContain('similarity(')
  })

  it('fallback rows hydrated by state query (when fallback produces hits)', async () => {
    candidateRows = []
    fallbackRows = [
      { id: 'cf1', brand: 'Jaeger-LeCoultre', model: 'Reverso', reference: null, imageUrl: null, ownersCount: 1, wishlistCount: 0 },
    ]
    stateRows = []
    const out = await searchCatalogWatches({ q: 'Jeager', viewerId: VIEWER })
    expect(out.length).toBe(1)
    expect(out[0].catalogId).toBe('cf1')
    expect(out[0].brand).toBe('Jaeger-LeCoultre')
    // strict (1) + fallback (2) + state (3) selects fired.
    expect(selectCount).toBe(3)
  })
})
