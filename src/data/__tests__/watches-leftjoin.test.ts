// src/data/__tests__/watches-leftjoin.test.ts
// Phase 38 CAT-13 #4 — DAL JOIN observability test.
// Verifies that getWatchesByUser returns Watch[] with catalogTaste populated
// from the LEFT JOIN, including numeric coercion at the mapper boundary.

import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockRows: Array<{ watch: any; taste: any }> = []

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue(mockRows),
          })),
        })),
      })),
    })),
  },
}))

// Import AFTER mocking
import { getWatchesByUser } from '@/data/watches'

beforeEach(() => {
  mockRows = []
  vi.clearAllMocks()
})

describe('Phase 38 CAT-13 #4 — getWatchesByUser LEFT JOIN populates catalogTaste with numeric coercion', () => {
  it('populates catalogTaste from JOIN result and coerces numeric strings to numbers (Pitfall 2)', async () => {
    mockRows = [
      {
        watch: {
          id: 'w1',
          userId: 'u1',
          brand: 'TestBrand',
          model: 'TestModel',
          status: 'owned',
          movementType: 'auto',
          complications: [],
          styleTags: [],
          designTraits: [],
          roleTags: [],
          createdAt: new Date(),
          sortOrder: 0,
          catalogId: 'cat-1',
        },
        // postgres-js surfaces numeric columns as strings — verify Number() coercion:
        taste: {
          formality: '0.85',
          sportiness: '0.75',
          heritageScore: '0.90',
          primaryArchetype: 'dive',
          eraSignal: 'modern',
          designMotifs: ['applied-indices'],
          confidence: '0.85',
          extractedFromPhoto: false,
        },
      },
    ]
    const result = await getWatchesByUser('u1')
    expect(result).toHaveLength(1)
    expect(result[0].catalogTaste?.formality).toBe(0.85)         // number, not string
    expect(typeof result[0].catalogTaste?.formality).toBe('number')
    expect(result[0].catalogTaste?.confidence).toBe(0.85)
    expect(result[0].catalogTaste?.primaryArchetype).toBe('dive')
    expect(result[0].catalogTaste?.designMotifs).toEqual(['applied-indices'])
  })

  it('sets catalogTaste to null when LEFT JOIN matches no catalog row (post-Plan-A: only if catalog row deleted mid-flight)', async () => {
    mockRows = [
      {
        watch: {
          id: 'w1',
          userId: 'u1',
          brand: 'TestBrand',
          model: 'TestModel',
          status: 'owned',
          movementType: 'auto',
          complications: [],
          styleTags: [],
          designTraits: [],
          roleTags: [],
          createdAt: new Date(),
          sortOrder: 0,
          catalogId: null,
        },
        // LEFT JOIN miss — taste itself is null (not just fields null)
        taste: null,
      },
    ]
    const result = await getWatchesByUser('u1')
    expect(result).toHaveLength(1)
    expect(result[0].catalogTaste).toBeNull()
  })
})
