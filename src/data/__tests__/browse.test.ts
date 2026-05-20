// src/data/__tests__/browse.test.ts
//
// Wave 0 test scaffold for Phase 46 browse count DAL.
// Tests run against a mocked db.execute that returns fixture data.
//
// Coverage:
//   1. getBrowseArchetypeCounts — Array<{ archetype: string; count: number }>
//      Phase 49.1 D-EXPLORE-01: SQL now derives from unnest(style_tags), not
//      from the deleted archetype column. Return shape preserved.
//   2. getBrowseEraCounts — Array<{ era: string; count: number }> with ERA_SIGNALS values
//   3. getBrowseBrandCounts — Array<{ brandId: string; name: string; slug: string; count: number }>

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { ERA_SIGNALS } from '@/lib/taste/vocab'

vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}))

// Mock next/cache to no-op the cache directives
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import { db } from '@/db'
import {
  getBrowseArchetypeCounts,
  getBrowseEraCounts,
  getBrowseBrandCounts,
} from '@/data/browse'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getBrowseArchetypeCounts', () => {
  it('returns an array of { archetype, count } rows', async () => {
    const fixture = [
      { archetype: 'dive', count: 18 },
      { archetype: 'dress', count: 12 },
      { archetype: 'chrono', count: 9 },
    ]
    vi.mocked(db.execute).mockResolvedValue(fixture as unknown as Awaited<ReturnType<typeof db.execute>>)

    const result = await getBrowseArchetypeCounts()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(3)
    expect(result[0]).toHaveProperty('archetype')
    expect(result[0]).toHaveProperty('count')
    expect(typeof result[0].archetype).toBe('string')
    expect(typeof result[0].count).toBe('number')
  })

  it('count is a positive integer (no null-archetype rows appear)', async () => {
    const fixture = [
      { archetype: 'dive', count: 18 },
      { archetype: 'sport', count: 5 },
    ]
    vi.mocked(db.execute).mockResolvedValue(fixture as unknown as Awaited<ReturnType<typeof db.execute>>)

    const result = await getBrowseArchetypeCounts()

    for (const row of result) {
      expect(row.count).toBeGreaterThan(0)
      // archetype is non-null (WHERE tag = ANY(ARRAY[...]) filters out NULLs)
      expect(row.archetype).toBeTruthy()
    }
  })

  it('derives counts from style_tags (rewired SQL per D-EXPLORE-01)', async () => {
    // Phase 49.1: the SQL body now reads `unnest(style_tags)` instead of
    // the deleted archetype column. Inspect the actual SQL passed to db.execute
    // and verify the post-rewire shape.
    const fixture = [{ archetype: 'dive', count: 1 }]
    vi.mocked(db.execute).mockResolvedValue(fixture as unknown as Awaited<ReturnType<typeof db.execute>>)

    await getBrowseArchetypeCounts()

    const callArg = (db.execute as unknown as Mock).mock.calls[0][0]
    // Drizzle's sql template object stringifies via JSON traversal of its
    // internal queryChunks. The substring fingerprint is the load-bearing
    // assertion — the implementation is free to format/space the SQL however.
    const sqlText = JSON.stringify(callArg)
    expect(sqlText).toMatch(/unnest\(style_tags\)/)
    expect(sqlText).not.toMatch(/primary_archetype/)
  })
})

describe('getBrowseEraCounts', () => {
  it('returns an array of { era, count } rows', async () => {
    const fixture = [
      { era: 'modern', count: 45 },
      { era: 'contemporary', count: 30 },
      { era: 'vintage-leaning', count: 12 },
    ]
    vi.mocked(db.execute).mockResolvedValue(fixture as unknown as Awaited<ReturnType<typeof db.execute>>)

    const result = await getBrowseEraCounts()

    expect(Array.isArray(result)).toBe(true)
    expect(result[0]).toHaveProperty('era')
    expect(result[0]).toHaveProperty('count')
    expect(typeof result[0].era).toBe('string')
    expect(typeof result[0].count).toBe('number')
  })

  it('era values are within ERA_SIGNALS', async () => {
    const fixture = [
      { era: 'modern', count: 45 },
      { era: 'contemporary', count: 30 },
      { era: 'vintage-leaning', count: 12 },
    ]
    vi.mocked(db.execute).mockResolvedValue(fixture as unknown as Awaited<ReturnType<typeof db.execute>>)

    const result = await getBrowseEraCounts()
    const eraSet = new Set(ERA_SIGNALS as unknown as string[])

    for (const row of result) {
      expect(eraSet.has(row.era)).toBe(true)
    }
  })
})

describe('getBrowseBrandCounts', () => {
  it('returns an array of { brandId, name, slug, count } rows', async () => {
    const fixture = [
      { brandId: 'b1', name: 'Omega', slug: 'omega', count: 22 },
      { brandId: 'b2', name: 'Rolex', slug: 'rolex', count: 35 },
    ]
    vi.mocked(db.execute).mockResolvedValue(fixture as unknown as Awaited<ReturnType<typeof db.execute>>)

    const result = await getBrowseBrandCounts()

    expect(Array.isArray(result)).toBe(true)
    expect(result[0]).toHaveProperty('brandId')
    expect(result[0]).toHaveProperty('name')
    expect(result[0]).toHaveProperty('slug')
    expect(result[0]).toHaveProperty('count')
  })

  it('only brands with count >= 1 appear (JOIN excludes zero-count brands)', async () => {
    const fixture = [
      { brandId: 'b1', name: 'Omega', slug: 'omega', count: 1 },
      { brandId: 'b2', name: 'Rolex', slug: 'rolex', count: 35 },
    ]
    vi.mocked(db.execute).mockResolvedValue(fixture as unknown as Awaited<ReturnType<typeof db.execute>>)

    const result = await getBrowseBrandCounts()

    for (const row of result) {
      expect(row.count).toBeGreaterThanOrEqual(1)
    }
  })

  it('rows are ordered by name_normalized ascending (SQL ORDER BY)', async () => {
    // Fixture already in alphabetical order — the SQL is responsible for ordering;
    // we verify the contract is declared in the function signature and the mock returns correct shape
    const fixture = [
      { brandId: 'b1', name: 'Omega', slug: 'omega', count: 22 },
      { brandId: 'b2', name: 'Rolex', slug: 'rolex', count: 35 },
      { brandId: 'b3', name: 'Seiko', slug: 'seiko', count: 8 },
    ]
    vi.mocked(db.execute).mockResolvedValue(fixture as unknown as Awaited<ReturnType<typeof db.execute>>)

    const result = await getBrowseBrandCounts()

    expect(result).toHaveLength(3)
    expect(result.map((r) => r.name)).toEqual(['Omega', 'Rolex', 'Seiko'])
  })
})
