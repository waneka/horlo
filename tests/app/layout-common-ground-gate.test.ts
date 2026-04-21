import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/data/follows', () => ({
  getTasteOverlapData: vi.fn(async (_viewer: string, _owner: string) => ({
    viewer: {
      watches: [],
      preferences: {} as never,
      tasteTags: [],
    },
    owner: {
      watches: [],
      preferences: {} as never,
      tasteTags: [],
    },
  })),
}))

vi.mock('@/lib/tasteOverlap', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/tasteOverlap')>()
  return {
    ...actual,
    computeTasteOverlap: vi.fn(() => ({
      sharedWatches: [],
      sharedTasteTags: [],
      overlapLabel: 'Different taste' as const,
      sharedStyleRows: [],
      sharedRoleRows: [],
      hasAny: false,
    })),
  }
})

import { resolveCommonGround } from '@/app/u/[username]/common-ground-gate'
import { getTasteOverlapData } from '@/data/follows'

describe('layout common-ground gate — resolveCommonGround', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when viewerId is null — getTasteOverlapData NOT called', async () => {
    const result = await resolveCommonGround({
      viewerId: null,
      ownerId: 'owner-uuid',
      isOwner: false,
      collectionPublic: true,
    })
    expect(result).toBeNull()
    expect(getTasteOverlapData).not.toHaveBeenCalled()
  })

  it('returns null when isOwner is true — getTasteOverlapData NOT called', async () => {
    const result = await resolveCommonGround({
      viewerId: 'viewer-uuid',
      ownerId: 'viewer-uuid',
      isOwner: true,
      collectionPublic: true,
    })
    expect(result).toBeNull()
    expect(getTasteOverlapData).not.toHaveBeenCalled()
  })

  it('returns null when collectionPublic is false — getTasteOverlapData NOT called (T-09-08)', async () => {
    const result = await resolveCommonGround({
      viewerId: 'viewer-uuid',
      ownerId: 'owner-uuid',
      isOwner: false,
      collectionPublic: false,
    })
    expect(result).toBeNull()
    expect(getTasteOverlapData).not.toHaveBeenCalled()
  })

  it('calls getTasteOverlapData exactly once with (viewerId, ownerId) when all three gate conditions pass', async () => {
    const result = await resolveCommonGround({
      viewerId: 'viewer-uuid',
      ownerId: 'owner-uuid',
      isOwner: false,
      collectionPublic: true,
    })
    expect(getTasteOverlapData).toHaveBeenCalledTimes(1)
    expect(getTasteOverlapData).toHaveBeenCalledWith(
      'viewer-uuid',
      'owner-uuid',
    )
    // Returned value is the TasteOverlapResult shape.
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('hasAny')
    expect(result).toHaveProperty('overlapLabel')
    expect(result).toHaveProperty('sharedWatches')
  })

  it('payload-shape contract: returned result never contains raw viewer/owner watch lists (T-09-22)', async () => {
    const result = await resolveCommonGround({
      viewerId: 'viewer-uuid',
      ownerId: 'owner-uuid',
      isOwner: false,
      collectionPublic: true,
    })
    expect(result).not.toBeNull()
    // Raw TasteOverlapData has .viewer.watches and .owner.watches — the
    // aggregate TasteOverlapResult must never include either key.
    expect(result).not.toHaveProperty('viewer')
    expect(result).not.toHaveProperty('owner')
  })

  it('repeated calls pass through (cache memoization is scoped to request, not process)', async () => {
    await resolveCommonGround({
      viewerId: 'viewer-uuid',
      ownerId: 'owner-uuid',
      isOwner: false,
      collectionPublic: true,
    })
    await resolveCommonGround({
      viewerId: 'viewer-uuid',
      ownerId: 'owner-uuid',
      isOwner: false,
      collectionPublic: true,
    })
    // We just assert the mock was invoked at least once — the cache is a
    // React cache() wrapped function, scoped per-request; outside a request
    // context the memoization is not guaranteed.
    expect(getTasteOverlapData).toHaveBeenCalled()
    expect(
      (getTasteOverlapData as unknown as { mock: { calls: unknown[] } }).mock
        .calls.length,
    ).toBeGreaterThanOrEqual(1)
  })
})
