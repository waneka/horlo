/**
 * Phase 20.1 Plan 01 (Wave 0) — RED test scaffold for /watch/new Server Component.
 *
 * Covers Pitfall 1 (Promise searchParams in Next 16) + intent='owned' whitelist
 * (RESEARCH §Security Domain item 2 — only the literal 'owned' is honored;
 *  any other intent string is normalized to null).
 *
 * RED until Plan 04 rewrites src/app/watch/new/page.tsx to:
 *   - accept Promise searchParams
 *   - render `<AddWatchFlow>` instead of `<WatchForm mode="create">`
 *   - parse catalogId/intent from searchParams with strict whitelist
 *   - pass collectionRevision (viewer.watches.length) to <AddWatchFlow>
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockGetCurrentUser,
  mockGetWatchesByUser,
  mockGetCatalogById,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetWatchesByUser: vi.fn(),
  mockGetCatalogById: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/data/watches', () => ({ getWatchesByUser: mockGetWatchesByUser }))
vi.mock('@/data/catalog', () => ({ getCatalogById: mockGetCatalogById }))
vi.mock('@/components/watch/AddWatchFlow', () => ({
  AddWatchFlow: (props: unknown) => ({
    type: 'AddWatchFlow-mock',
    props: JSON.stringify(props),
  }),
}))
vi.mock('next/navigation', () => ({ notFound: vi.fn() }))

// IMPORT UNDER TEST — Plan 04 rewrites this page; today it ignores searchParams.
import NewWatchPage from '@/app/watch/new/page'

const validCatalogId = '00000000-0000-4000-8000-000000000000'

const fixtureCatalog = {
  id: validCatalogId,
  brand: 'Rolex',
  model: 'Submariner',
  reference: null,
  source: 'admin_curated' as const,
  imageUrl: null,
  imageSourceUrl: null,
  imageSourceQuality: null,
  movement: null,
  caseSizeMm: null,
  lugToLugMm: null,
  waterResistanceM: null,
  crystalType: null,
  dialColor: null,
  isChronometer: null,
  productionYear: null,
  productionYearIsEstimate: false,
  styleTags: [],
  designTraits: [],
  roleTags: [],
  complications: [],
  ownersCount: 0,
  wishlistCount: 0,
  formality: null,
  sportiness: null,
  heritageScore: null,
  primaryArchetype: null,
  eraSignal: null,
  designMotifs: [],
  confidence: null,
  extractedFromPhoto: false,
  createdAt: '2026-04-29T00:00:00.000Z',
  updatedAt: '2026-04-29T00:00:00.000Z',
}

describe('Phase 20.1 Plan 04 — /watch/new searchParams + intent whitelist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'viewer-1', email: 'v@h' })
    mockGetWatchesByUser.mockResolvedValue([])
    mockGetCatalogById.mockResolvedValue(fixtureCatalog)
  })

  it('Pitfall 1 — page awaits searchParams and renders without throwing on empty params', async () => {
    const result = await NewWatchPage({ searchParams: Promise.resolve({}) } as never)
    // Heading copy exact-match per UI-SPEC Copywriting Contract.
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('Add a watch — or just evaluate one')
  })

  it('deep-link ?catalogId=X&intent=owned — passes initialCatalogId, initialIntent="owned", non-null prefill to AddWatchFlow', async () => {
    const result = await NewWatchPage({
      searchParams: Promise.resolve({ catalogId: validCatalogId, intent: 'owned' }),
    } as never)
    const rendered = JSON.stringify(result)
    expect(rendered).toContain(`"initialCatalogId":"${validCatalogId}"`)
    expect(rendered).toContain('"initialIntent":"owned"')
    // initialCatalogPrefill is non-null when getCatalogById returns a row.
    expect(rendered).toMatch(/"initialCatalogPrefill":\{[^}]*"brand":"Rolex"/)
  })

  it("intent whitelist — non-'owned' intent: 'malicious-string' is rejected; initialIntent prop is null", async () => {
    const result = await NewWatchPage({
      searchParams: Promise.resolve({ catalogId: validCatalogId, intent: 'malicious-string' }),
    } as never)
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('"initialIntent":null')
  })

  it('collectionRevision — passes viewer.collection.length to AddWatchFlow', async () => {
    mockGetWatchesByUser.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({ id: `w-${i}` })),
    )
    const result = await NewWatchPage({ searchParams: Promise.resolve({}) } as never)
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('"collectionRevision":7')
  })
})
