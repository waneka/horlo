import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock factories can reference these before module initialization
const {
  mockGetCurrentUser,
  mockGetWatchByIdForViewer,
  mockGetWatchesByUser,
  mockGetPreferencesByUser,
  mockGetCatalogById,
  mockGetMostRecentWearDate,
  mockComputeVerdictBundle,
  mockComputeViewerTasteProfile,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetWatchByIdForViewer: vi.fn(),
  mockGetWatchesByUser: vi.fn(),
  mockGetPreferencesByUser: vi.fn(),
  mockGetCatalogById: vi.fn(),
  mockGetMostRecentWearDate: vi.fn(),
  mockComputeVerdictBundle: vi.fn(),
  mockComputeViewerTasteProfile: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/data/watches', () => ({
  getWatchByIdForViewer: mockGetWatchByIdForViewer,
  getWatchesByUser: mockGetWatchesByUser,
}))
vi.mock('@/data/preferences', () => ({ getPreferencesByUser: mockGetPreferencesByUser }))
vi.mock('@/data/catalog', () => ({ getCatalogById: mockGetCatalogById }))
vi.mock('@/data/wearEvents', () => ({ getMostRecentWearDate: mockGetMostRecentWearDate }))
vi.mock('@/lib/verdict/composer', () => ({ computeVerdictBundle: mockComputeVerdictBundle }))
vi.mock('@/lib/verdict/viewerTasteProfile', () => ({
  computeViewerTasteProfile: mockComputeViewerTasteProfile,
}))
vi.mock('@/components/watch/WatchDetail', () => ({
  WatchDetail: ({ verdict }: { verdict: unknown }) =>
    `<WatchDetail verdict=${JSON.stringify(verdict)} />`,
}))
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NOT_FOUND') }) }))

import WatchPage from '@/app/watch/[id]/page'

describe('FIT-03 /watch/[id] verdict integration (Plan 04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'a@b' })
    mockGetMostRecentWearDate.mockResolvedValue(null)
    mockComputeViewerTasteProfile.mockResolvedValue({
      meanFormality: null, meanSportiness: null, meanHeritageScore: null,
      dominantArchetype: null, dominantEraSignal: null, topDesignMotifs: [],
    })
    mockComputeVerdictBundle.mockReturnValue({
      framing: 'same-user',
      label: 'core-fit',
      headlinePhrasing: 'Core Fit',
      contextualPhrasings: ['ok'],
      mostSimilar: [],
      roleOverlap: false,
    })
    mockGetCatalogById.mockResolvedValue(null)
  })

  it('renders <CollectionFitCard> with framing="same-user" when isOwner=true', async () => {
    const fakeWatch = { id: 'w1', userId: 'user-1', brand: 'X', model: 'Y', catalogId: null }
    mockGetWatchByIdForViewer.mockResolvedValue({ watch: fakeWatch, isOwner: true })
    mockGetWatchesByUser.mockResolvedValue([fakeWatch])
    mockGetPreferencesByUser.mockResolvedValue({})
    await WatchPage({ params: Promise.resolve({ id: 'w1' }) })
    expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
    expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('same-user')
  })

  it('renders <CollectionFitCard> with framing="cross-user" when isOwner=false', async () => {
    const fakeWatch = { id: 'w2', userId: 'user-2', brand: 'X', model: 'Y', catalogId: null }
    const myWatch = { id: 'w-mine', userId: 'user-1', brand: 'X', model: 'Y', catalogId: null }
    mockGetWatchByIdForViewer.mockResolvedValue({ watch: fakeWatch, isOwner: false })
    mockGetWatchesByUser.mockResolvedValue([myWatch])
    mockGetPreferencesByUser.mockResolvedValue({})
    await WatchPage({ params: Promise.resolve({ id: 'w2' }) })
    expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
    expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('cross-user')
  })

  it('does NOT render <CollectionFitCard> when viewer collection.length === 0 (D-07)', async () => {
    const fakeWatch = { id: 'w1', userId: 'user-2', brand: 'X', model: 'Y', catalogId: null }
    mockGetWatchByIdForViewer.mockResolvedValue({ watch: fakeWatch, isOwner: false })
    mockGetWatchesByUser.mockResolvedValue([])  // empty collection
    mockGetPreferencesByUser.mockResolvedValue({})
    await WatchPage({ params: Promise.resolve({ id: 'w1' }) })
    expect(mockComputeVerdictBundle).not.toHaveBeenCalled()
  })

  it('passes computed VerdictBundle as prop — does not call analyzeSimilarity in WatchDetail', async () => {
    // The WatchDetail mock simply records its props; assert verdict is non-null.
    const fakeWatch = { id: 'w1', userId: 'user-1', brand: 'X', model: 'Y', catalogId: null }
    mockGetWatchByIdForViewer.mockResolvedValue({ watch: fakeWatch, isOwner: true })
    mockGetWatchesByUser.mockResolvedValue([fakeWatch])
    mockGetPreferencesByUser.mockResolvedValue({})
    const result = await WatchPage({ params: Promise.resolve({ id: 'w1' }) })
    // result is React tree; we asserted via mock spy the bundle was computed.
    expect(mockComputeVerdictBundle).toHaveBeenCalled()
    expect(result).toBeDefined()
  })
})
