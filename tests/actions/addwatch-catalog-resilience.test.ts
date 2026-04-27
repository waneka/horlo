/**
 * Phase 17 Plan 03 — Unit: addWatch fire-and-forget catalog resilience (CAT-08, Pitfall 9)
 *
 * Proves that a catalog DAL failure NEVER blocks the watch from being saved.
 * upsertCatalogFromUserInput is mocked to throw; addWatch must still return success=true.
 *
 * Requirement: CAT-08
 * Truth: "addWatch returns success=true even when catalog DAL throws (fire-and-forget per Pitfall 9)"
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mocks must come before the action import so Vitest hoists them
vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn(),
}))

vi.mock('@/data/watches', () => ({
  createWatch: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
  linkWatchToCatalog: vi.fn(),
}))

// Catalog DAL — upsertCatalogFromUserInput throws to simulate DB failure
vi.mock('@/data/catalog', () => ({
  upsertCatalogFromUserInput: vi.fn().mockRejectedValue(new Error('boom')),
  upsertCatalogFromExtractedUrl: vi.fn(),
  getCatalogById: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('@/data/activities', () => ({ logActivity: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/notifications/logger', () => ({ logNotification: vi.fn(() => Promise.resolve()) }))
vi.mock('@/data/notifications', () => ({ findOverlapRecipients: vi.fn(() => Promise.resolve([])) }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn(() => Promise.resolve(null)) }))

import { addWatch } from '@/app/actions/watches'
import { getCurrentUser } from '@/lib/auth'
import * as watchDAL from '@/data/watches'
import type { Watch } from '@/lib/types'

const viewerUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeef'
const mockWatch: Watch = {
  id: 'w-resilience-01',
  brand: 'Omega',
  model: 'Seamaster',
  reference: undefined,
  status: 'owned',
  movement: 'automatic',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
}

describe('addWatch catalog resilience — CAT-08 fire-and-forget (Pitfall 9)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'test@horlo.test' })
    vi.mocked(watchDAL.createWatch).mockResolvedValue(mockWatch)
    // Ensure linkWatchToCatalog is never called (catalog threw before it could run)
    vi.mocked(watchDAL.linkWatchToCatalog).mockResolvedValue(undefined)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('returns success=true even when upsertCatalogFromUserInput throws', async () => {
    const result = await addWatch({
      brand: 'Omega',
      model: 'Seamaster',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })

    // The watch was saved — action must succeed
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.id).toBe('w-resilience-01')
  })

  it('logs the catalog failure to console.error with matching message', async () => {
    await addWatch({
      brand: 'Omega',
      model: 'Seamaster',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })

    // The non-fatal log must be emitted
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/catalog wiring failed/),
      expect.any(Error)
    )
  })

  it('does NOT call linkWatchToCatalog when upsertCatalogFromUserInput throws', async () => {
    await addWatch({
      brand: 'Omega',
      model: 'Seamaster',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })

    // linkWatchToCatalog must not be invoked — catalog threw before we got catalogId
    expect(watchDAL.linkWatchToCatalog).not.toHaveBeenCalled()
  })
})
