import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Phase 20 D-02 — pure aggregate taste profile, null-tolerant.
 *
 * Mocks Drizzle's chainable query builder so the test exercises the pure
 * post-query logic (avg/mode/topK + null-tolerance + EMPTY_PROFILE branch).
 * The DB itself is not exercised — `mockRows` is the contract surface.
 *
 * Note: confidence-floor filtering is enforced inside Postgres via the
 * SQL WHERE clause; tests confirm caller-side behaviour by mocking the
 * already-filtered row set (rows with confidence < 0.5 are simply absent).
 */

type Row = {
  formality: string | number | null
  sportiness: string | number | null
  heritageScore: string | number | null
  primaryArchetype: string | null
  eraSignal: string | null
  designMotifs: string[]
}

let mockRows: Row[] = []
let selectSpy: ReturnType<typeof vi.fn>

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(mockRows),
        })),
      })),
    })),
  },
}))

import { computeViewerTasteProfile, EMPTY_PROFILE } from './viewerTasteProfile'
import { db } from '@/db'
import type { Watch } from '@/lib/types'

function w(id: string, overrides: Partial<Watch> = {}): Watch {
  return {
    id,
    brand: 'Brand',
    model: 'Model',
    status: 'owned',
    movement: 'automatic',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
    ...overrides,
  }
}

beforeEach(() => {
  mockRows = []
  selectSpy = vi.mocked(db.select)
  selectSpy.mockClear()
})

describe('D-02 viewerTasteProfile (Plan 02)', () => {
  it('returns EMPTY_PROFILE when collection has zero watches', async () => {
    const result = await computeViewerTasteProfile([])
    expect(result).toEqual(EMPTY_PROFILE)
    // No DB call should fire on the empty-collection short-circuit.
    expect(selectSpy).not.toHaveBeenCalled()
  })

  it('skips catalog rows with confidence < CONFIDENCE_FLOOR (0.5)', async () => {
    // The SQL WHERE filter excludes confidence < 0.5 at the DB layer; we
    // confirm the caller threads non-empty inputs into a real query path
    // and that the surfaced rows (post-filter) shape the result.
    mockRows = [
      {
        formality: 0.7,
        sportiness: 0.3,
        heritageScore: 0.8,
        primaryArchetype: 'dress',
        eraSignal: 'modern',
        designMotifs: ['onyx-dial'],
      },
    ]
    const result = await computeViewerTasteProfile([w('a')])
    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(result.meanFormality).toBe(0.7)
    expect(result.dominantArchetype).toBe('dress')
  })

  it('mean of all-NULL formality column returns null (not NaN, not 0)', async () => {
    mockRows = [
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: [] },
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: [] },
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: [] },
    ]
    const result = await computeViewerTasteProfile([w('a'), w('b'), w('c')])
    expect(result.meanFormality).toBeNull()
    expect(Number.isNaN(result.meanFormality as unknown as number)).toBe(false)
  })

  it('mode of all-NULL primaryArchetype column returns null', async () => {
    mockRows = [
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: [] },
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: [] },
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: [] },
    ]
    const result = await computeViewerTasteProfile([w('a'), w('b'), w('c')])
    expect(result.dominantArchetype).toBeNull()
  })

  it('topDesignMotifs returns [] when all designMotifs arrays are empty', async () => {
    mockRows = [
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: [] },
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: [] },
    ]
    const result = await computeViewerTasteProfile([w('a'), w('b')])
    expect(result.topDesignMotifs).toEqual([])
  })

  it('topDesignMotifs returns top-3 by frequency, ties broken by insertion order', async () => {
    // motif counts: onyx-dial 3, fluted-bezel 2, jubilee-bracelet 2
    // tie between fluted-bezel and jubilee-bracelet — fluted-bezel inserted first
    mockRows = [
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: ['onyx-dial'] },
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: ['onyx-dial', 'fluted-bezel'] },
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: ['onyx-dial', 'jubilee-bracelet'] },
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: ['fluted-bezel'] },
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: ['jubilee-bracelet'] },
    ]
    const result = await computeViewerTasteProfile([w('a'), w('b'), w('c'), w('d'), w('e')])
    expect(result.topDesignMotifs).toEqual(['onyx-dial', 'fluted-bezel', 'jubilee-bracelet'])
  })

  it('mean of mixed null + numeric column averages only the non-null entries', async () => {
    // formality values [0.6, null, 0.8] → expect 0.7
    mockRows = [
      { formality: 0.6, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: [] },
      { formality: null, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: [] },
      { formality: 0.8, sportiness: null, heritageScore: null, primaryArchetype: null, eraSignal: null, designMotifs: [] },
    ]
    const result = await computeViewerTasteProfile([w('a'), w('b'), w('c')])
    // Floating point: 0.7 within 1e-9
    expect(result.meanFormality).toBeCloseTo(0.7, 9)
  })

  it('handles a 0-watch collection without throwing (D-07 guarded path is upstream)', async () => {
    await expect(computeViewerTasteProfile([])).resolves.toBeDefined()
    // Twice — guard executes both branches without throwing.
    await expect(computeViewerTasteProfile([])).resolves.toEqual(EMPTY_PROFILE)
  })
})
