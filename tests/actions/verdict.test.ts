import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock functions are available when vi.mock factories run
const {
  mockGetCurrentUser,
  mockGetCatalogById,
  mockGetWatchesByUser,
  mockGetPreferencesByUser,
  mockComputeViewerTasteProfile,
  mockComputeVerdictBundle,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetCatalogById: vi.fn(),
  mockGetWatchesByUser: vi.fn(),
  mockGetPreferencesByUser: vi.fn(),
  mockComputeViewerTasteProfile: vi.fn(),
  mockComputeVerdictBundle: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/data/catalog', () => ({ getCatalogById: mockGetCatalogById }))
vi.mock('@/data/watches', () => ({ getWatchesByUser: mockGetWatchesByUser }))
vi.mock('@/data/preferences', () => ({ getPreferencesByUser: mockGetPreferencesByUser }))
vi.mock('@/lib/verdict/composer', () => ({ computeVerdictBundle: mockComputeVerdictBundle }))
vi.mock('@/lib/verdict/viewerTasteProfile', () => ({
  computeViewerTasteProfile: mockComputeViewerTasteProfile,
}))
// shim is pure — no need to mock; it'll consume the fake catalog entry.

import { getVerdictForCatalogWatch } from '@/app/actions/verdict'

const validUuid = '00000000-0000-4000-8000-000000000000'

const fakeCatalogEntry = {
  id: validUuid, brand: 'X', model: 'Y', reference: null, source: 'admin_curated',
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

describe('D-06 getVerdictForCatalogWatch Server Action (Plan 05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockComputeViewerTasteProfile.mockResolvedValue({
      meanFormality: null, meanSportiness: null, meanHeritageScore: null,
      dominantArchetype: null, dominantEraSignal: null, topDesignMotifs: [],
    })
    mockComputeVerdictBundle.mockReturnValue({
      framing: 'cross-user',
      label: 'core-fit',
      headlinePhrasing: 'Core Fit',
      contextualPhrasings: ['ok'],
      mostSimilar: [],
      roleOverlap: false,
    })
  })

  it('returns {success:false, error:"Not authenticated"} when getCurrentUser throws', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('unauth'))
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid })
    expect(r).toEqual({ success: false, error: 'Not authenticated' })
  })

  it('returns {success:false, error:"Invalid request"} when catalogId is not a UUID', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    const r = await getVerdictForCatalogWatch({ catalogId: 'not-a-uuid' })
    expect(r).toEqual({ success: false, error: 'Invalid request' })
  })

  it('returns {success:false, error:"Invalid request"} when extra fields present (Zod .strict)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid, viewerId: 'attacker' })
    expect(r).toEqual({ success: false, error: 'Invalid request' })
  })

  it('returns {success:false, error:"Watch not found"} when getCatalogById returns null', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    mockGetCatalogById.mockResolvedValue(null)
    mockGetWatchesByUser.mockResolvedValue([])
    mockGetPreferencesByUser.mockResolvedValue({})
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid })
    expect(r).toEqual({ success: false, error: 'Watch not found' })
  })

  it('returns {success:true, data:VerdictBundle} for valid request with viewer.collection.length > 0', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    mockGetCatalogById.mockResolvedValue(fakeCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'w1' }])
    mockGetPreferencesByUser.mockResolvedValue({})
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.framing).toBe('cross-user')
    }
  })

  it('VerdictBundle is plain JSON-serializable (no Date, Map, Set in returned object — Pitfall 3)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    mockGetCatalogById.mockResolvedValue(fakeCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([])
    mockGetPreferencesByUser.mockResolvedValue({})
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid })
    expect(r.success).toBe(true)
    // round-trip JSON should preserve the value (no exotic types)
    if (r.success) {
      expect(JSON.parse(JSON.stringify(r.data))).toEqual(r.data)
    }
  })

  it('framing in returned bundle is "cross-user" (search rows are always non-owned per Plan 05 contract)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    mockGetCatalogById.mockResolvedValue(fakeCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([])
    mockGetPreferencesByUser.mockResolvedValue({})
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid })
    if (r.success) {
      expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('cross-user')
    }
  })

  it('uses user.id from getCurrentUser — never accepts viewerId from input (V4 ASVS)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'authenticated-user', email: 'a@b' })
    mockGetCatalogById.mockResolvedValue(fakeCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([])
    mockGetPreferencesByUser.mockResolvedValue({})
    await getVerdictForCatalogWatch({ catalogId: validUuid })
    expect(mockGetWatchesByUser).toHaveBeenCalledWith('authenticated-user')
    expect(mockGetPreferencesByUser).toHaveBeenCalledWith('authenticated-user')
  })
})
