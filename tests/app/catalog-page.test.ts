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
  mockRedirect,
  mockDbLimit,
  mockDbWhere,
  mockGetCollectorsForCatalog,
  mockGetSameFamilyForCatalog,
  mockGetLineageForReference,
  mockGetProfileById,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetCatalogById: vi.fn(),
  mockGetWatchesByUser: vi.fn(),
  mockGetPreferencesByUser: vi.fn(),
  mockComputeVerdictBundle: vi.fn(),
  mockComputeViewerTasteProfile: vi.fn(),
  mockNotFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
  // ARCH-02 — canonical redirect mock from tests/app/insights-retirement.test.tsx:3-9.
  // Throws an Error with a NEXT_REDIRECT digest so the page promise rejects and
  // expect(...).rejects.toThrow('NEXT_REDIRECT') assertions fire correctly.
  mockRedirect: vi.fn((url: string) => {
    const err = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: `NEXT_REDIRECT;push;${url};307`,
    })
    throw err
  }),
  mockDbLimit: vi.fn(),
  // WR-01 positive-control: hoist `where()` so we can inspect the predicate
  // arg in the BUG-01 regression guard below. Default impl returns the
  // `{ limit: mockDbLimit }` chain shape the page code expects.
  mockDbWhere: vi.fn(() => ({ limit: mockDbLimit })),
  mockGetCollectorsForCatalog: vi.fn(),
  mockGetSameFamilyForCatalog: vi.fn(),
  mockGetLineageForReference: vi.fn(),
  mockGetProfileById: vi.fn(),
}))

// Mock the inline Drizzle SELECT via mocking @/db.
// WR-01: `where()` is now the hoisted `mockDbWhere` so the predicate AST
// passed to it (the `and(eq(userId), eq(catalogId), eq(status, 'owned'))`
// expression) can be inspected by the positive-control test that guards
// BUG-01 from regression. Previously the inline `vi.fn(() => ({ limit }))`
// stub discarded the predicate arg, which is why the three BUG-01 tests
// would still pass even if the `status='owned'` filter were removed.
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockDbWhere,
      })),
    })),
  },
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/data/catalog', () => ({ getCatalogById: mockGetCatalogById }))
vi.mock('@/data/watches', () => ({ getWatchesByUser: mockGetWatchesByUser }))
vi.mock('@/data/preferences', () => ({ getPreferencesByUser: mockGetPreferencesByUser }))
// Phase 39b Plan 04 — NSV-18 roster DAL. Mock the new server fetch added to
// the page Promise.all; default returns { collectors: [], totalCount: 0 } so
// OtherOwnersRoster self-hides (D-39b-07) and existing assertions continue
// to focus on the verdict/CTA props.
vi.mock('@/data/discovery', () => ({
  getCollectorsForCatalog: mockGetCollectorsForCatalog,
}))
// Phase 39b Plan 05 — NSV-02/16 rail DALs. Same pattern as Plan 04 (mock new
// page-tree-level DAL imports so the shallow @/db mock doesn't have to cover
// db.execute / db.leftJoin chains). Defaults to empty arrays so the rails
// self-hide (D-39b-07) and existing assertions continue to focus on the
// verdict / CTA props.
vi.mock('@/data/hierarchy', () => ({
  getSameFamilyForCatalog: mockGetSameFamilyForCatalog,
  getLineageForReference: mockGetLineageForReference,
}))
// Phase 48 Plan 01 — close the @/data/profiles mock gap (A1/Pitfall 1 per RESEARCH.md).
// getProfileById is called inside Promise.all (page.tsx line 67) to resolve the viewer
// username for CatalogPageActions. Without this mock the test environment attempts to
// import the real module, which may fail or return undefined in the jsdom environment.
vi.mock('@/data/profiles', () => ({ getProfileById: mockGetProfileById }))
vi.mock('@/lib/verdict/composer', () => ({ computeVerdictBundle: mockComputeVerdictBundle }))
vi.mock('@/lib/verdict/viewerTasteProfile', () => ({
  computeViewerTasteProfile: mockComputeViewerTasteProfile,
}))
vi.mock('@/lib/verdict/shims', () => ({
  catalogEntryToSimilarityInput: vi.fn((entry: unknown) => entry),
}))
vi.mock('next/navigation', () => ({ notFound: mockNotFound, redirect: mockRedirect }))
vi.mock('@/components/insights/CollectionFitCard', () => ({
  CollectionFitCard: ({ verdict }: { verdict: unknown }) =>
    `<CollectionFitCard verdict=${JSON.stringify(verdict)} />`,
}))
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => `<img src="${src}" alt="${alt}" />`,
}))
// Phase 20.1 Plan 05 D-05 — CatalogPageActions Client Component renders the 3
// CTAs (Add to Wishlist / Add to Collection / Skip) below CollectionFitCard
// in cross-user framing (ARCH-02: owned refs now redirect instead of rendering).
//
// Plan 05 deviation (Rule 1 — bug): Plan 01's RED scaffold mocked
// CatalogPageActions to a template-literal string and asserted via
// `JSON.stringify(result).toMatch(/CatalogPageActions/)`. JSON.stringify of a
// React JSX element only serializes plain props — the `type` field (a function
// reference) is dropped, so a regex against the component name can never
// match. The fix is to assert against unique props that only CatalogPageActions
// receives at the page tree level — `catalogId` (a string-uuid prop), `spec`
// (an object prop), and `framing="cross-user"` (the discriminator).
//
// Mock kept as a no-op render so the type identity is unique in vi.mock
// resolution. Test assertions updated below to match props.
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
  // Phase 49.1 Plan 06 — primaryArchetype dropped from CatalogEntry shape.
  eraSignal: null, designMotifs: [],
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
    mockGetCollectorsForCatalog.mockResolvedValue({ collectors: [], totalCount: 0 })
    mockGetSameFamilyForCatalog.mockResolvedValue([])
    mockGetLineageForReference.mockResolvedValue([])
    mockGetProfileById.mockResolvedValue(null)  // Phase 48 Plan 01 — @/data/profiles mock default
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

  it('ARCH-02 — redirects to /watch/{viewer.watches.id} when viewer already owns this catalog ref', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([{
      id: 'mine-1',
      acquisitionDate: '2026-04-12',
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
    }])
    // ARCH-02: the page throws NEXT_REDIRECT before reaching the verdict path.
    await expect(CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) }))
      .rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/watch/mine-1')
    // redirect() throws before computeVerdictBundle is ever called.
    expect(mockComputeVerdictBundle).not.toHaveBeenCalled()
  })

  it('ARCH-02 — redirect target is /watch/{viewer.watches.id} (per-user UUID), not /watch/{catalogId}', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([{
      id: 'per-user-uuid-abc',
      acquisitionDate: '2026-04-12',
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
    }])
    await expect(CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) }))
      .rejects.toThrow('NEXT_REDIRECT')
    // Must redirect to the per-user UUID, NOT the catalog UUID.
    expect(mockRedirect).toHaveBeenCalledWith('/watch/per-user-uuid-abc')
    expect(mockRedirect).not.toHaveBeenCalledWith(`/watch/${validCatalogId}`)
  })

  // -------------------------------------------------------------------------
  // Phase 20.1 Plan 05 D-05 — render 3 CTAs below CollectionFitCard in
  // cross-user framing; hide them when viewer owns the ref (ARCH-02 redirect
  // fires before actionsSpec is set); hide when no verdict.
  // -------------------------------------------------------------------------
  it('D-05 — renders 3 CTAs (CatalogPageActions) when framing is cross-user', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([])  // viewer does NOT own this catalog ref
    const result = await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    const rendered = JSON.stringify(result)
    // CatalogPageActions is the only child receiving both `catalogId` and `spec`
    // props at the page tree level. Match the discriminator props (function
    // `type` references don't survive JSON.stringify — see deviation note).
    expect(rendered).toMatch(/"catalogId":"00000000-0000-4000-8000-000000000000"/)
    expect(rendered).toMatch(/"spec":\{/)
    expect(rendered).toMatch(/"framing":"cross-user"/)
  })

  it('D-05 / ARCH-02 — does NOT render CTAs when viewer owns this catalog ref (redirect fires first)', async () => {
    // ARCH-02: when the viewer owns the catalog ref, redirect() throws before
    // actionsSpec is ever set — so CTAs are never rendered. Assert via redirect
    // throw rather than inspecting rendered output.
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([{
      id: 'per-user-uuid-abc',
      acquisitionDate: '2026-04-12',
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
    }])
    await expect(CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) }))
      .rejects.toThrow('NEXT_REDIRECT')
    // redirect fires before actionsSpec is constructed — CTAs are never in the tree.
    expect(mockRedirect).toHaveBeenCalledWith('/watch/per-user-uuid-abc')
  })

  it('D-39b-04 — DOES render CTAs when collection is empty (NSV-20 fresh-account dead-end closure, supersedes Phase 20 D-05 "no CTAs when empty")', async () => {
    // Phase 39b NSV-20 lock: fresh-account viewer (collection.length === 0)
    // now sees the 3-CTA block (Add to Wishlist / Add to Collection / Skip)
    // below either ReferenceIdentityCard (when catalogTaste.confidence >= 0.5)
    // OR the fallback caption. This supersedes the Phase 20 D-05 "no card, no
    // CTAs" suppression at the former lines 112-113 of catalog page.tsx.
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([])  // empty collection
    mockDbLimit.mockResolvedValue([])  // not owned
    const result = await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    const rendered = JSON.stringify(result)
    // CatalogPageActions IS now rendered for the fresh-account viewer
    // (actionsSpec is built in the new else branch at G-4).
    expect(rendered).toMatch(/"spec":\{/)
    expect(rendered).toMatch(/"framing":"cross-user"/)
  })

  // -------------------------------------------------------------------------
  // Phase 48 Plan 01 — BUG-01 regression coverage (D-10).
  // A wishlist/grail/sold watch viewed via /catalog/[catalogId] must NOT
  // trigger the 'You own this watch' callout or a redirect.
  // These tests simulate the FIXED query behavior: findViewerWatchByCatalogId
  // returns [] for any non-owned status row (status='owned' filter applied).
  // The mock bypasses the Drizzle .where() chain entirely — mockDbLimit=[]
  // is what the fixed query returns for wishlist/grail/sold rows (RESEARCH.md
  // Pitfall 3). The owned-path regression guard ("ARCH-02 — redirects to...")
  // guards the positive path (owned row → redirect fires).
  // -------------------------------------------------------------------------

  it('BUG-01 — wishlist watch does NOT trigger "You own this watch" callout', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([])  // fixed query returns [] for status='wishlist'
    await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
    expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('cross-user')
  })

  it('BUG-01 — grail watch does NOT trigger "You own this watch" callout', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([])  // fixed query returns [] for status='grail'
    await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
    expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('cross-user')
  })

  it('BUG-01 — sold watch does NOT trigger "You own this watch" callout', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([])  // fixed query returns [] for status='sold'
    await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
    expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('cross-user')
  })

  // -------------------------------------------------------------------------
  // WR-01 (Phase 48 REVIEW.md): the three BUG-01 tests above mock
  // mockDbLimit→[] regardless of what predicate is passed to where(), so they
  // would still pass if a future commit removed the eq(status, 'owned') clause
  // — re-introducing the bug for any wishlist/grail/sold row that shares a
  // catalogId. This positive-control test asserts the predicate AST itself
  // contains the literal string 'owned', so reverting the filter breaks the
  // test. Drizzle's eq()/and() produce structured SQL objects whose serialized
  // form includes the parameter value — sufficient for a regression guard.
  // -------------------------------------------------------------------------
  it("BUG-01 — query is scoped to status='owned' (predicate guard)", async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([])
    await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    // findViewerWatchByCatalogId calls where() exactly once with the
    // and(eq(userId), eq(catalogId), eq(status, 'owned')) AST.
    expect(mockDbWhere).toHaveBeenCalledTimes(1)
    const predicate = mockDbWhere.mock.calls[0][0]

    // Drizzle's predicate AST is a deeply-nested object graph with circular
    // back-references (PgTable -> PgUUID column -> table), so JSON.stringify
    // throws. Walk the graph manually with a visited-set and a depth cap,
    // searching for the literal string 'owned' in any leaf value. If the
    // eq(watchesTable.status, 'owned') conjunct is removed in a future
    // regression, the parameter value disappears from the AST and this
    // assertion fails — which is the regression guard the WR-01 review
    // finding asked for.
    function containsValue(node: unknown, needle: string, seen = new WeakSet<object>(), depth = 0): boolean {
      if (depth > 20) return false
      if (node === null || node === undefined) return false
      if (typeof node === 'string') return node === needle
      if (typeof node !== 'object') return false
      if (seen.has(node as object)) return false
      seen.add(node as object)
      if (Array.isArray(node)) {
        return node.some((item) => containsValue(item, needle, seen, depth + 1))
      }
      return Object.values(node as Record<string, unknown>).some(
        (v) => containsValue(v, needle, seen, depth + 1),
      )
    }
    expect(containsValue(predicate, 'owned')).toBe(true)
  })

  // -------------------------------------------------------------------------
  // SC#5 (Phase 50.1 Plan 01) — static assertion that the v7.0 Variant C
  // TODO comment exists at the OtherOwnersRoster render anchor. Mirrors the
  // fs.readFileSync pattern from tests/app/insights-retirement.test.tsx:47-52.
  // -------------------------------------------------------------------------
  it('SC#5 — TODO comment for v7.0 Variant C is present at the OtherOwnersRoster anchor', async () => {
    const fs = await import('node:fs')
    const content = fs.readFileSync('src/app/catalog/[catalogId]/page.tsx', 'utf8')
    expect(content).toContain('revisit for Variant C in v7.0')
  })
})
