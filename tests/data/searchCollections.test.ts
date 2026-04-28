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
