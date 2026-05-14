import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Phase 40 SRCH-16 — Zod schema facet extension for searchWatchesAction.
 *
 * Verifies four cases:
 *   1. Valid facet: { q, movement } → success: true
 *   2. Valid facet: { q, size, style } → success: true
 *   3. Invalid enum: { q, movement: 'invalid_enum' } → success: false, 'Invalid request'
 *   4. Extraneous key: { q, extraneousKey } → success: false, 'Invalid request' (.strict() guard)
 *
 * Tests 1 + 2 are RED until Task 3 extends the Zod schema.
 * Tests 3 + 4 currently PASS because .strict() rejects all unrecognized keys.
 * After Task 3: all 4 turn GREEN.
 *
 * Mock pattern mirrors tests/actions/search.test.ts — vi.mock of @/lib/auth and
 * @/data/catalog so the DAL is never actually invoked.
 */

const mockGetCurrentUser = vi.fn()
const mockSearchCatalogWatches = vi.fn()

vi.mock('@/lib/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}))

vi.mock('@/data/catalog', () => ({
  searchCatalogWatches: (...args: unknown[]) => mockSearchCatalogWatches(...args),
}))

import { searchWatchesAction } from '@/app/actions/search'

beforeEach(() => {
  mockGetCurrentUser.mockReset()
  mockSearchCatalogWatches.mockReset()
  mockGetCurrentUser.mockResolvedValue({ id: 'test-user-id' })
  mockSearchCatalogWatches.mockResolvedValue([])
})

describe('searchWatchesAction — Phase 40 SRCH-16 facet schema', () => {
  it('case 1: accepts valid movement facet alongside q', async () => {
    const out = await searchWatchesAction({ q: 'sub', movement: 'auto' })
    expect(out).toMatchObject({ success: true })
  })

  it('case 2: accepts valid size + style facets alongside q', async () => {
    const out = await searchWatchesAction({ q: 'sub', size: '40-42', style: 'tool,diver' })
    expect(out).toMatchObject({ success: true })
  })

  it('case 3: rejects invalid movement enum value', async () => {
    const out = await searchWatchesAction({ q: 'sub', movement: 'invalid_enum' })
    expect(out).toEqual({ success: false, error: 'Invalid request' })
  })

  it('case 4: rejects extraneous key (.strict() mass-assignment guard)', async () => {
    const out = await searchWatchesAction({ q: 'sub', extraneousKey: 'x' })
    expect(out).toEqual({ success: false, error: 'Invalid request' })
  })
})
