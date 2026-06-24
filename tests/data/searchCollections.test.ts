import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 19 Plan 01 Task 3 — searchCollections DAL contract tests.
//
// Verifies SRCH-11 (match paths) + SRCH-12 (two-layer privacy + self-exclusion)
// + D-09..D-12 + D-16 invariants.
//
// The DAL builds a single Drizzle-template-tag raw SQL block via db.execute(sql`...`).
// The SQL object carries `queryChunks` (literal SQL text fragments) plus binds
// (e.g. `${pattern}`, `${viewerId}`). We stringify the captured SQL object with
// a cycle-breaking serializer and run substring assertions on the SQL text
// chunks for the privacy / self-exclusion / match-path / sort-shape invariants.
//
// Mocks ALL upstream DAL dependencies to keep the unit test deterministic and
// to avoid hitting the real DB. computeTasteOverlap is also stubbed so the JS
// post-sort comparator path is exercised without dragging in the full overlap
// engine.
// ---------------------------------------------------------------------------

let executeCalls: Array<{ sqlObj: unknown }> = []
let executeResult: unknown[] = []

vi.mock('@/db', () => ({
  db: {
    execute: vi.fn((sqlObj: unknown) => {
      executeCalls.push({ sqlObj })
      return Promise.resolve(executeResult)
    }),
  },
}))

vi.mock('@/data/watches', () => ({
  getWatchesByUser: vi.fn(async () => []),
}))
vi.mock('@/data/preferences', () => ({
  getPreferencesByUser: vi.fn(async () => ({
    preferredStyles: [],
    dislikedStyles: [],
    preferredDesignTraits: [],
    dislikedDesignTraits: [],
    preferredComplications: [],
    complicationExceptions: [],
    preferredDialColors: [],
    dislikedDialColors: [],
    overlapTolerance: 'medium',
  })),
}))
vi.mock('@/data/wearEvents', () => ({
  getAllWearEventsByUser: vi.fn(async () => []),
}))
vi.mock('@/lib/tasteOverlap', () => ({
  computeTasteOverlap: vi.fn(() => ({
    overlapLabel: 'Some overlap',
    sharedWatches: [],
  })),
}))
vi.mock('@/lib/tasteTags', () => ({
  computeTasteTags: vi.fn(() => []),
}))

import { searchCollections } from '@/data/search'

const VIEWER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

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
  executeCalls = []
  executeResult = []
})

describe('searchCollections (SRCH-11, SRCH-12, D-09..D-12, D-16)', () => {
  it('Test 1: server-side 2-char gate — q="a" returns [] without DB call', async () => {
    const out = await searchCollections({ q: 'a', viewerId: VIEWER })
    expect(out).toEqual([])
    expect(executeCalls.length).toBe(0)
  })

  it('Test 1b: whitespace-only q returns [] without DB call', async () => {
    const out = await searchCollections({ q: '   ', viewerId: VIEWER })
    expect(out).toEqual([])
    expect(executeCalls.length).toBe(0)
  })

  it('Test 2: two-layer privacy AND — BOTH profile_public AND collection_public (SRCH-12 / Pitfall 6)', async () => {
    executeResult = []
    await searchCollections({ q: 'rolex', viewerId: VIEWER })
    expect(executeCalls.length).toBeGreaterThan(0)
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    expect(sqlText).toContain('profile_public')
    expect(sqlText).toContain('collection_public')
    // Both must appear with `= true` semantics in the SQL text (not just listed)
    expect(/profile_public[\s\S]{0,100}true/.test(sqlText)).toBe(true)
    expect(/collection_public[\s\S]{0,100}true/.test(sqlText)).toBe(true)
  })

  it('Test 3: self-exclusion — `p.id != viewerId` (Pitfall 5)', async () => {
    executeResult = []
    await searchCollections({ q: 'rolex', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    // The SQL string contains the != operator AND the viewerId is bound
    expect(sqlText).toMatch(/!=/)
    expect(sqlText).toContain(VIEWER)
  })

  it('Test 4: match paths — brand + model + unnest(style_tags|role_tags|complications); NOT design_traits (D-09)', async () => {
    executeResult = []
    await searchCollections({ q: 'tool', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    // Brand + model ILIKE
    expect(sqlText).toMatch(/w\.brand/)
    expect(sqlText).toMatch(/w\.model/)
    // EXISTS(unnest(style_tags|role_tags|complications))
    expect(sqlText).toContain('style_tags')
    expect(sqlText).toContain('role_tags')
    expect(sqlText).toContain('complications')
    expect(sqlText).toContain('unnest')
    // D-09: design_traits is INTENTIONALLY EXCLUDED
    expect(sqlText).not.toContain('design_traits')
  })

  it('Test 5: matchedTags surfaces dedup string[] (D-11)', async () => {
    executeResult = [
      {
        user_id: 'u-alice',
        username: 'alice',
        display_name: 'Alice',
        avatar_url: null,
        match_count: 2,
        matched_watches: [
          { watch_id: 'w1', brand: 'Omega', model: 'Speedmaster', image_url: null, match_path: 'name' },
          { watch_id: 'w2', brand: 'Rolex',  model: 'Submariner',  image_url: null, match_path: 'tag' },
        ],
        matched_tags: ['tool', 'sport'],
      },
    ]
    const out = await searchCollections({ q: 'tool', viewerId: VIEWER })
    expect(out.length).toBe(1)
    expect(out[0].matchedTags).toEqual(['tool', 'sport'])
  })

  it('Test 6: D-16 sort — matchCount DESC, tasteOverlap DESC, username ASC', async () => {
    // Two rows with same matchCount; only username differentiates → username ASC.
    executeResult = [
      {
        user_id: 'u-zoe',
        username: 'zoe',
        display_name: 'Zoe',
        avatar_url: null,
        match_count: 5,
        matched_watches: null,
        matched_tags: null,
      },
      {
        user_id: 'u-alice',
        username: 'alice',
        display_name: 'Alice',
        avatar_url: null,
        match_count: 5,
        matched_watches: null,
        matched_tags: null,
      },
    ]
    const out = await searchCollections({ q: 'rolex', viewerId: VIEWER })
    expect(out.length).toBe(2)
    expect(out[0].username).toBe('alice')
    expect(out[1].username).toBe('zoe')
  })

  it('Test 6b: D-16 sort — matchCount DESC dominates username sort', async () => {
    executeResult = [
      {
        user_id: 'u-alice',
        username: 'alice',
        display_name: 'Alice',
        avatar_url: null,
        match_count: 1,
        matched_watches: null,
        matched_tags: null,
      },
      {
        user_id: 'u-zoe',
        username: 'zoe',
        display_name: 'Zoe',
        avatar_url: null,
        match_count: 9,
        matched_watches: null,
        matched_tags: null,
      },
    ]
    const out = await searchCollections({ q: 'rolex', viewerId: VIEWER })
    expect(out.length).toBe(2)
    // Higher matchCount wins regardless of username
    expect(out[0].username).toBe('zoe')
    expect(out[0].matchCount).toBe(9)
  })

  it('Test 7: D-04 — limit clamp to 20 with default limit', async () => {
    executeResult = Array.from({ length: 50 }, (_, i) => ({
      user_id: `u-${String(i).padStart(2, '0')}`,
      username: `user-${String(i).padStart(2, '0')}`,
      display_name: null,
      avatar_url: null,
      match_count: 50 - i,
      matched_watches: null,
      matched_tags: null,
    }))
    const out = await searchCollections({ q: 'rolex', viewerId: VIEWER })
    expect(out.length).toBeLessThanOrEqual(20)
  })

  it('Test 7b: candidate cap = 50 in SQL', async () => {
    executeResult = []
    await searchCollections({ q: 'rolex', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    // The CANDIDATE_CAP integer is bound somewhere in the SQL — assert "50"
    expect(sqlText).toContain('50')
  })

  it('Test 8: parameterization — q is bound as %trimmed%, never string-concatenated into SQL text', async () => {
    executeResult = []
    await searchCollections({ q: 'rolex', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    // The %rolex% pattern bind appears as a value in the bound chunks
    expect(sqlText).toContain('%rolex%')
    // SQL text should not have ILIKE \'%rolex%\' inline (string-concat form)
    // — the pattern must appear as a bound value, not as a literal in the SQL fragment.
    // Drizzle's queryChunks contain the SQL text fragments (without the bind values
    // baked in) and Param objects with the values. So we should NOT see the
    // string `ILIKE '%rolex%'` literal anywhere in the queryChunks SQL text.
    // (We do see %rolex% in the Param.value, but that's the parameterized bind.)
    expect(sqlText).not.toMatch(/ILIKE '%rolex%'/i)
  })

  it('Test 9: empty result short-circuit — no candidates means no overlap fan-out', async () => {
    executeResult = []
    const out = await searchCollections({ q: 'zzz', viewerId: VIEWER })
    expect(out).toEqual([])
  })

  it('Test 10: matchedWatches mapped from snake_case to camelCase + sliced to 3', async () => {
    executeResult = [
      {
        user_id: 'u-alice',
        username: 'alice',
        display_name: 'Alice',
        avatar_url: null,
        match_count: 5,
        matched_watches: [
          { watch_id: 'w1', brand: 'Omega', model: 'M1', image_url: null, match_path: 'name' },
          { watch_id: 'w2', brand: 'Omega', model: 'M2', image_url: null, match_path: 'tag' },
          { watch_id: 'w3', brand: 'Omega', model: 'M3', image_url: null, match_path: 'tag' },
          { watch_id: 'w4', brand: 'Omega', model: 'M4', image_url: null, match_path: 'tag' },
          { watch_id: 'w5', brand: 'Omega', model: 'M5', image_url: null, match_path: 'tag' },
        ],
        matched_tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      },
    ]
    const out = await searchCollections({ q: 'omega', viewerId: VIEWER })
    expect(out.length).toBe(1)
    expect(out[0].matchedWatches.length).toBe(3) // slice(0, 3)
    expect(out[0].matchedTags.length).toBe(5) // slice(0, 5)
    expect(out[0].matchedWatches[0]).toEqual({
      watchId: 'w1',
      brand: 'Omega',
      model: 'M1',
      imageUrl: null,
      matchPath: 'name',
    })
  })
})

// ---------------------------------------------------------------------------
// 260623-uua: multi-token + unaccent CTE WHERE contract tests.
// Per `project_drizzle_sql_any_array_pitfall` + CLAUDE.md `## Local-First
// Development`: the DAL test mock does NOT execute SQL; these tests assert
// generated SQL shape only. Manual UAT against local Supabase (Task 4 in
// plan) is the authoritative row-count gate.
// ---------------------------------------------------------------------------

describe('260623-uua tokenization (D-01 multi-token CTE WHERE)', () => {
  it("multi-token query emits N AND-grouped per-token OR-blocks in the CTE WHERE", async () => {
    executeResult = []
    await searchCollections({ q: 'omega seamaster', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    // Both tokens bound as %omega% / %seamaster% patterns somewhere in the SQL.
    expect(sqlText).toContain('%omega%')
    expect(sqlText).toContain('%seamaster%')
    // The 5 search-column expressions each appear at least once PER token (5 × 2
    // = 10 branches minimum). Use unnest count as a proxy: 3 unnest expressions
    // (style_tags, role_tags, complications) × 2 tokens = at least 6 unnest
    // mentions in the CTE WHERE block (plus 1 in matched_tag_elements).
    const unnestMatches = sqlText.match(/unnest/g) ?? []
    expect(unnestMatches.length).toBeGreaterThanOrEqual(7)
  })

  it("3 tokens — 3 AND-composed OR-groups", async () => {
    executeResult = []
    await searchCollections({ q: 'rolex sub date', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    expect(sqlText).toContain('%rolex%')
    expect(sqlText).toContain('%sub%')
    expect(sqlText).toContain('%date%')
  })

  it("empty token list after whitespace-only q is impossible past the trimmed gate (defensive guard exists)", async () => {
    executeResult = []
    const out = await searchCollections({ q: '   ', viewerId: VIEWER })
    expect(out).toEqual([])
    // The trimmed.length < 2 gate fires first; no DB call.
    expect(executeCalls.length).toBe(0)
  })
})

describe('260623-uua unaccent fold (D-02 diacritic folding)', () => {
  it("'Héron' query — CTE WHERE contains lower(public.f_unaccent(...)) fold expression", async () => {
    executeResult = []
    await searchCollections({ q: 'Héron', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    expect(sqlText).toContain('lower(public.f_unaccent(')
    // Column-side fold: w.brand wrapped.
    expect(sqlText).toMatch(/lower\(public\.f_unaccent\(w\.brand\)\)/)
    expect(sqlText).toMatch(/lower\(public\.f_unaccent\(w\.model\)\)/)
    // Tag-side fold: tags wrapped via `t WHERE lower(public.f_unaccent(t))`.
    expect(sqlText).toMatch(/lower\(public\.f_unaccent\(t\)\)/)
  })

  it("'Heron' (no accent) — emits the SAME f_unaccent wrap structure as 'Héron'", async () => {
    executeResult = []
    await searchCollections({ q: 'Heron', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    expect(sqlText).toContain('lower(public.f_unaccent(')
    // The lowercased token is bound as %heron% (tokens are lowercased before pattern construction).
    expect(sqlText).toContain('%heron%')
  })

  it('matched_tag_elements uses lower(f_unaccent(t)) ILIKE ANY(ARRAY[...]) (OR across tokens)', async () => {
    executeResult = []
    await searchCollections({ q: 'omega seamaster', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    // ANY(ARRAY[...]) is the OR-across-tokens construct for the tag aggregation.
    expect(sqlText).toContain('ANY(ARRAY[')
    // Tag fold appears on the tag-side of ILIKE.
    expect(sqlText).toMatch(/lower\(public\.f_unaccent\(t\)\) ILIKE/)
  })
})

describe('260623-uua privacy + shape preservation (D-06 verbatim)', () => {
  it('two-layer privacy clauses still appear verbatim after rewrite', async () => {
    executeResult = []
    await searchCollections({ q: 'rolex', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    // Three privacy gates preserved verbatim.
    expect(sqlText).toContain('ps.profile_public = true')
    expect(sqlText).toContain('ps.collection_public = true')
    // viewerId bound via the `!=` predicate.
    expect(sqlText).toMatch(/!=/)
    expect(sqlText).toContain(VIEWER)
  })

  it('CTE outer shape unchanged — jsonb_agg, GROUP BY, ORDER BY, LIMIT preserved', async () => {
    executeResult = []
    await searchCollections({ q: 'rolex', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    expect(sqlText).toContain('jsonb_agg')
    expect(sqlText).toContain('GROUP BY p.id, p.username, p.display_name, p.avatar_url')
    expect(sqlText).toContain('ORDER BY match_count DESC, p.username ASC')
    // matched_tag_elements wrapped in ARRAY(SELECT ...) — the original shape.
    expect(sqlText).toContain('matched_tag_elements')
  })

  it('match_path CASE still yields the two categorical values', async () => {
    executeResult = []
    await searchCollections({ q: 'rolex sub', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    // The CASE still resolves to 'name' or 'tag'.
    expect(sqlText).toContain("'name'")
    expect(sqlText).toContain("'tag'")
    expect(sqlText).toContain('CASE')
  })

  it('design_traits is STILL intentionally excluded (D-09 preserved)', async () => {
    executeResult = []
    await searchCollections({ q: 'tool', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    expect(sqlText).not.toContain('design_traits')
  })
})

describe('260623-uua SQL parameterization (project_drizzle_sql_any_array_pitfall)', () => {
  it('ANY(ARRAY[...]) emits per-pattern parameterized binds via sql.join (not ROW literal)', async () => {
    executeResult = []
    await searchCollections({ q: 'omega seamaster', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    // Each pattern is bound as a Param value (visible in the serialized
    // Drizzle SQL object); the SQL queryChunks should NOT contain a
    // literal "%omega%" interpolated as text after ANY(.
    // The patterns appear as Param.value entries — substring check confirms
    // they're present somewhere in the bind chain.
    expect(sqlText).toContain('%omega%')
    expect(sqlText).toContain('%seamaster%')
    // Negative: no inline `= ANY('{...}')` ROW-literal form would appear if a
    // pattern were string-concatenated. We assert ANY(ARRAY[ pattern bind list
    // shape was used, not the broken `= ANY(${arr})` shape.
    expect(sqlText).not.toMatch(/= ANY\('?\{/)
  })

  it('per-token pattern is bound, never inlined as ILIKE \'%token%\' literal text', async () => {
    executeResult = []
    await searchCollections({ q: 'rolex', viewerId: VIEWER })
    const sqlText = safeStringify(executeCalls[0].sqlObj)
    // Drizzle binds keep %rolex% as a Param value, not as inline SQL text.
    expect(sqlText).not.toMatch(/ILIKE '%rolex%'/i)
  })
})
