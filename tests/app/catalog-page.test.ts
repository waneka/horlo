import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures these are available before vi.mock factories run (hoisting).
const {
  mockGetCurrentUser,
  mockGetCatalogById,
  mockGetWatchesByUser,
  mockGetPreferencesByUser,
  mockComputeVerdictBundle,
  mockComputeViewerTasteProfile,
  mockNotFound,
  mockDbLimit,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetCatalogById: vi.fn(),
  mockGetWatchesByUser: vi.fn(),
  mockGetPreferencesByUser: vi.fn(),
  mockComputeVerdictBundle: vi.fn(),
  mockComputeViewerTasteProfile: vi.fn(),
  mockNotFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
  mockDbLimit: vi.fn(),
}))

// Mock the inline Drizzle SELECT via mocking @/db.
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockDbLimit,
        })),
      })),
    })),
  },
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/data/catalog', () => ({ getCatalogById: mockGetCatalogById }))
vi.mock('@/data/watches', () => ({ getWatchesByUser: mockGetWatchesByUser }))
vi.mock('@/data/preferences', () => ({ getPreferencesByUser: mockGetPreferencesByUser }))
vi.mock('@/lib/verdict/composer', () => ({ computeVerdictBundle: mockComputeVerdictBundle }))
vi.mock('@/lib/verdict/viewerTasteProfile', () => ({
  computeViewerTasteProfile: mockComputeViewerTasteProfile,
}))
vi.mock('@/lib/verdict/shims', () => ({
  catalogEntryToSimilarityInput: vi.fn((entry: unknown) => entry),
}))
vi.mock('next/navigation', () => ({ notFound: mockNotFound }))
vi.mock('@/components/insights/CollectionFitCard', () => ({
  CollectionFitCard: ({ verdict }: { verdict: unknown }) =>
    `<CollectionFitCard verdict=${JSON.stringify(verdict)} />`,
}))
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => `<img src="${src}" alt="${alt}" />`,
}))
// Phase 20.1 Plan 05 D-05 — CatalogPageActions Client Component renders the 3
// CTAs (Add to Wishlist / Add to Collection / Skip) below CollectionFitCard
// in non-self-via-cross-user framing.
vi.mock('@/components/watch/CatalogPageActions', () => ({
  CatalogPageActions: (props: { framing?: string }) =>
    `<CatalogPageActions data-testid="cpa" data-framing="${props.framing}" />`,
}))

import CatalogPage from '@/app/catalog/[catalogId]/page'

const validCatalogId = '00000000-0000-4000-8000-000000000000'

const baseCatalogEntry = {
  id: validCatalogId, brand: 'X', model: 'Y', reference: null, source: 'admin_curated',
  imageUrl: null, imageSourceUrl: null, imageSourceQuality: null,
  movement: null, caseSizeMm: null, lugToLugMm: null, waterResistanceM: null,
  crystalType: null, dialColor: null, isChronometer: null, productionYear: null,
  productionYearIsEstimate: false,
  styleTags: [], designTraits: [], roleTags: [], complications: [],
  ownersCount: 0, wishlistCount: 0,
  formality: null, sportiness: null, heritageScore: null,
  primaryArchetype: null, eraSignal: null, designMotifs: [],
  confidence: null, extractedFromPhoto: false,
  createdAt: '2026-04-29T00:00:00.000Z', updatedAt: '2026-04-29T00:00:00.000Z',
}

describe('D-10 /catalog/[catalogId] page (Plan 06)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'viewer-1', email: 'v@b' })
    mockGetWatchesByUser.mockResolvedValue([])
    mockGetPreferencesByUser.mockResolvedValue({})
    mockComputeViewerTasteProfile.mockResolvedValue({})
    mockComputeVerdictBundle.mockReturnValue({
      framing: 'cross-user', label: 'core-fit', headlinePhrasing: 'Core Fit',
      contextualPhrasings: ['ok'], mostSimilar: [], roleOverlap: false,
    })
    mockDbLimit.mockResolvedValue([])  // viewer does NOT own a watch with this catalogId
  })

  it('returns 404 when catalogId does not exist in watches_catalog', async () => {
    mockGetCatalogById.mockResolvedValue(null)
    await expect(CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) }))
      .rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders <CollectionFitCard> with framing="cross-user" when viewer does not own this catalog ref AND collection > 0', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([])  // not owned
    await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
    expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('cross-user')
  })

  it('hides <CollectionFitCard> entirely when viewer.collection.length === 0 (D-07)', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([])  // empty collection
    mockDbLimit.mockResolvedValue([])  // not owned
    await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    expect(mockComputeVerdictBundle).not.toHaveBeenCalled()
  })

  it('renders "You own this watch" callout when viewer already owns this catalog ref (D-08)', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([{
      id: 'mine-1',
      acquisitionDate: '2026-04-12',
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
    }])
    const result = await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    // D-08 path does NOT call composer; verdict is built inline as VerdictBundleSelfOwned.
    expect(mockComputeVerdictBundle).not.toHaveBeenCalled()
    // Result should contain the self-owned framing — assert via stringified mock CollectionFitCard.
    const rendered = JSON.stringify(result)
    expect(rendered).toMatch(/self-via-cross-user/)
  })

  it('callout link points to /watch/{viewer.watches.id} — per-user UUID, not catalog UUID', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([{
      id: 'per-user-uuid-abc',
      acquisitionDate: '2026-04-12',
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
    }])
    const result = await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    const rendered = JSON.stringify(result)
    expect(rendered).toMatch(/\/watch\/per-user-uuid-abc/)
    expect(rendered).not.toMatch(new RegExp(`/watch/${validCatalogId}`))  // not catalog UUID
  })

  // -------------------------------------------------------------------------
  // Phase 20.1 Plan 05 D-05 — render 3 CTAs below CollectionFitCard in
  // cross-user framing; hide them in self-via-cross-user; hide when no verdict.
  // RED until Plan 05 wires `<CatalogPageActions>` into the page.
  // -------------------------------------------------------------------------
  it('D-05 — renders 3 CTAs (CatalogPageActions) when framing is cross-user', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([])  // viewer does NOT own this catalog ref
    const result = await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    const rendered = JSON.stringify(result)
    expect(rendered).toMatch(/CatalogPageActions/)
    expect(rendered).toMatch(/data-framing="cross-user"/)
  })

  it('D-05 — does NOT render CTAs when framing is self-via-cross-user', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([{
      id: 'per-user-uuid-abc',
      acquisitionDate: '2026-04-12',
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
    }])
    const result = await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    const rendered = JSON.stringify(result)
    expect(rendered).not.toMatch(/CatalogPageActions/)
  })

  it('D-05 — does NOT render CTAs when collection is empty (no verdict per D-07)', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([])  // empty collection
    mockDbLimit.mockResolvedValue([])  // not owned
    const result = await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    const rendered = JSON.stringify(result)
    expect(rendered).not.toMatch(/CatalogPageActions/)
  })
})
