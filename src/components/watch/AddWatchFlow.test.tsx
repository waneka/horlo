/**
 * Phase 70 Plan 05 — AddWatchFlow orchestrator state machine + cache hygiene.
 *
 * Layout:
 *   - Top-level mocks (vi.mock factories) replace SearchEntry / ConfirmStep /
 *     DupeBanner / ExtractErrorCard / WatchForm / WatchPhotoStep with thin
 *     data-testid presenters that expose buttons firing the orchestrator
 *     callbacks. Children behavior is already covered by their own co-located
 *     tests (Phase 68/69 + Plan 02).
 *   - `describe('Phase 70 — AddWatchFlow orchestrator state machine', ...)`
 *     houses 8 transition tests (T-70-01..T-70-08).
 *   - `describe('Phase 69 — cache hygiene integration (CLNP-07)', ...)` is
 *     PRESERVED verbatim from the prior file — the four-cache reset assertion
 *     must continue to pass per CLNP-07 / SC#5.
 *
 * Verdict-era tests (Phase 20.1 Plan 04 / Plan 06 / Plan 08) are REMOVED — the
 * union they target (`idle`, `verdict-ready`, `wishlist-rationale-open`,
 * `submitting-wishlist`, `submitting-collection`, `extracting`) no longer
 * exists per CLNP-05 / D-01.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ---- Top-level vi.mock factories --------------------------------------------

// Capture router.push for assertion in transition tests.
const pushSpy = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, refresh: vi.fn(), back: vi.fn() }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/app/actions/watches', () => ({
  addWatch: vi.fn(),
  moveWishlistToCollection: vi.fn(),
  // Phase 70 — Server Action wrapper around watchDAL.findViewerWatchByCatalogId.
  // Default: returns { success: true, data: null } (no dupe).
  findViewerWatchByCatalogIdAction: vi.fn().mockResolvedValue({ success: true, data: null }),
}))

// SearchEntry mock — exposes 5 buttons for the 4 onPick branches + onSubmitStructured + onSwitchToUrl.
vi.mock('@/components/watch/SearchEntry', () => ({
  SearchEntry: ({
    onPick,
    onSubmitStructured,
    onSwitchToUrl,
  }: {
    onPick: (r: {
      catalogId: string
      brand: string
      model: string
      reference: string | null
      imageUrl: string | null
      ownersCount: number
      wishlistCount: number
      viewerState: 'owned' | 'wishlist' | null
    }) => void
    onSubmitStructured: (r: { brand?: string; model?: string }, id: string | null) => void
    onSwitchToUrl: () => void
  }) => (
    <div data-testid="search-entry">
      <button
        onClick={() =>
          onPick({
            catalogId: 'cat-null',
            brand: 'Omega',
            model: 'Speedmaster',
            reference: 'REF-001',
            imageUrl: null,
            ownersCount: 0,
            wishlistCount: 0,
            viewerState: null,
          })
        }
      >
        Pick null
      </button>
      <button
        onClick={() =>
          onPick({
            catalogId: 'cat-owned',
            brand: 'Omega',
            model: 'Speedmaster',
            reference: 'REF-001',
            imageUrl: null,
            ownersCount: 1,
            wishlistCount: 0,
            viewerState: 'owned',
          })
        }
      >
        Pick owned
      </button>
      <button
        onClick={() =>
          onPick({
            catalogId: 'cat-owned-noref',
            brand: 'Omega',
            model: 'Speedmaster',
            reference: null,
            imageUrl: null,
            ownersCount: 1,
            wishlistCount: 0,
            viewerState: 'owned',
          })
        }
      >
        Pick owned no-ref
      </button>
      <button
        onClick={() =>
          onPick({
            catalogId: 'cat-wish',
            brand: 'Omega',
            model: 'Speedmaster',
            reference: 'REF-001',
            imageUrl: null,
            ownersCount: 0,
            wishlistCount: 1,
            viewerState: 'wishlist',
          })
        }
      >
        Pick wishlist
      </button>
      <button
        onClick={() => onSubmitStructured({ brand: 'Omega', model: 'Speedmaster' }, 'cat-structured')}
      >
        Submit structured
      </button>
      <button onClick={onSwitchToUrl}>Switch to URL</button>
    </div>
  ),
}))

vi.mock('@/components/watch/ConfirmStep', () => ({
  ConfirmStep: ({
    onPrimary,
    onStartOver,
    onEditDetails,
    pending,
    status,
  }: {
    onPrimary: () => void
    onStartOver: () => void
    onEditDetails: () => void
    pending?: boolean
    status: string
  }) => (
    <div data-testid="confirm-step" data-status={status}>
      <button onClick={onPrimary} disabled={pending}>
        Confirm primary
      </button>
      <button onClick={onStartOver}>Start over</button>
      <button onClick={onEditDetails}>Edit details</button>
    </div>
  ),
}))

vi.mock('@/components/watch/DupeBanner', () => ({
  DupeBanner: ({
    onMoveToCollection,
    onAddAnotherCopy,
    onViewExisting,
    existingStatus,
  }: {
    onMoveToCollection?: () => void
    onAddAnotherCopy: () => void
    onViewExisting: () => void
    existingStatus: 'owned' | 'wishlist'
  }) => (
    <div data-testid={`dupe-banner-${existingStatus}`}>
      <button onClick={onViewExisting}>View existing</button>
      {onMoveToCollection && <button onClick={onMoveToCollection}>Move to Collection</button>}
      <button onClick={onAddAnotherCopy}>Add another copy</button>
    </div>
  ),
}))

vi.mock('@/components/watch/WatchPhotoStep', () => ({
  WatchPhotoStep: ({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) => (
    <div data-testid="photos-pending">
      <button onClick={onDone}>Done</button>
      <button onClick={onSkip}>Skip</button>
    </div>
  ),
}))

// WatchForm fires the widened (watchId, dest, status) onWatchCreated — used by T-70-07 D-17 gate test.
vi.mock('@/components/watch/WatchForm', () => ({
  WatchForm: ({
    onWatchCreated,
  }: {
    onWatchCreated?: (watchId: string, destination: string, status: 'owned' | 'wishlist' | 'grail' | 'sold') => void
  }) => (
    <div data-testid="watch-form">
      <button onClick={() => onWatchCreated?.('w-id', '/u/tester/wishlist', 'wishlist')}>
        Create wishlist
      </button>
      <button onClick={() => onWatchCreated?.('w-id', '/u/tester/collection', 'owned')}>
        Create owned
      </button>
    </div>
  ),
}))

vi.mock('@/components/watch/ExtractErrorCard', () => ({
  ExtractErrorCard: ({
    retryAction,
    manualAction,
    mode,
  }: {
    retryAction: () => void
    manualAction: () => void
    mode?: 'url' | 'structured'
  }) => (
    <div data-testid={`extract-error-${mode ?? 'unknown'}`}>
      <button onClick={retryAction}>Retry</button>
      <button onClick={manualAction}>Manual</button>
    </div>
  ),
}))

// IMPORT UNDER TEST — must be AFTER the vi.mock calls.
import { AddWatchFlow } from '@/components/watch/AddWatchFlow'
import {
  addWatch,
  moveWishlistToCollection,
  findViewerWatchByCatalogIdAction,
} from '@/app/actions/watches'
// Suppress unused-import lint for action handles consumed only by mockResolvedValueOnce.
void addWatch

// ---- Render helper ---------------------------------------------------------

type AddWatchFlowProps = React.ComponentProps<typeof AddWatchFlow>

function renderFlow(overrides?: Partial<AddWatchFlowProps>) {
  const defaults: AddWatchFlowProps = {
    collectionRevision: 3,
    initialCatalogId: null,
    initialIntent: null,
    initialCatalogPrefill: null,
    initialManual: false,
    initialStatus: null,
    initialReturnTo: null,
    viewerUsername: 'tester',
    viewerUserId: 'user-a',
    catalogBrands: [],
  }
  return render(<AddWatchFlow {...defaults} {...overrides} />)
}

// =============================================================================
// Phase 70 — orchestrator state machine
// =============================================================================

describe('Phase 70 — AddWatchFlow orchestrator state machine', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    pushSpy.mockClear()
    global.fetch = vi.fn() as unknown as typeof fetch
    const { __resetUrlExtractCacheForTests } = await import('./useUrlExtractCache')
    __resetUrlExtractCacheForTests()
    // Re-establish default mocks (clearAllMocks wipes mockResolvedValue defaults).
    vi.mocked(findViewerWatchByCatalogIdAction).mockResolvedValue({ success: true, data: null })
  })

  // T-70-01 — DUPE-01 owned-pick with reference → router.push /w/REF-001, no confirm.
  it('T-70-01 — owned-pick with non-null reference → router.push("/w/REF-001"); no confirm screen', async () => {
    renderFlow()
    fireEvent.click(screen.getByText('Pick owned'))
    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith('/w/REF-001')
    })
    expect(screen.queryByTestId('confirm-step')).not.toBeInTheDocument()
  })

  // T-70-02 — DUPE-01 owned-pick with null reference → confirming + DupeBanner-owned (D-06).
  it('T-70-02 — owned-pick with null reference → confirming + DupeBanner-owned mounted (D-06 fallback)', async () => {
    vi.mocked(findViewerWatchByCatalogIdAction).mockResolvedValueOnce({
      success: true,
      data: { id: 'existing-owned-id', status: 'owned', reference: null },
    })
    renderFlow()
    fireEvent.click(screen.getByText('Pick owned no-ref'))
    expect(await screen.findByTestId('dupe-banner-owned')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-step')).toBeInTheDocument()
    expect(pushSpy).not.toHaveBeenCalled()
  })

  // T-70-03 — DUPE-02 structured-submit on owned existing → DupeBanner-owned + Add another copy clears.
  it('T-70-03 — structured-submit on owned existing → DupeBanner-owned mounted; "Add another copy" clears dupeContext', async () => {
    vi.mocked(findViewerWatchByCatalogIdAction).mockResolvedValueOnce({
      success: true,
      data: { id: 'existing-owned-id', status: 'owned', reference: 'REF-OWNED' },
    })
    renderFlow()
    fireEvent.click(screen.getByText('Submit structured'))
    expect(await screen.findByTestId('dupe-banner-owned')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-step')).toBeInTheDocument()

    // Click "Add another copy" — DupeBanner unmounts; ConfirmStep stays.
    fireEvent.click(screen.getByText('Add another copy'))
    await waitFor(() => {
      expect(screen.queryByTestId('dupe-banner-owned')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('confirm-step')).toBeInTheDocument()
  })

  // T-70-04 — DUPE-03 wishlist pick → DupeBanner-wishlist + Move to Collection succeeds.
  it('T-70-04 — wishlist pick → DupeBanner-wishlist; Move to Collection calls action; success routes to /u/tester/collection', async () => {
    vi.mocked(findViewerWatchByCatalogIdAction).mockResolvedValueOnce({
      success: true,
      data: { id: 'wish-id-001', status: 'wishlist', reference: 'REF-001' },
    })
    vi.mocked(moveWishlistToCollection).mockResolvedValueOnce({
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { id: 'wish-id-001', status: 'owned' } as any,
    })
    renderFlow()
    fireEvent.click(screen.getByText('Pick wishlist'))
    expect(await screen.findByTestId('dupe-banner-wishlist')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Move to Collection'))
    await waitFor(() => {
      expect(moveWishlistToCollection).toHaveBeenCalledWith('wish-id-001')
    })
    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith('/u/tester/collection')
    })
  })

  // T-70-05 — CLNP-06 skip link → manual-entry, no router.push.
  it('T-70-05 — "Skip search — enter manually" link → manual-entry; router.push NOT called', async () => {
    renderFlow()
    fireEvent.click(screen.getByText('Skip search — enter manually'))
    expect(await screen.findByTestId('watch-form')).toBeInTheDocument()
    expect(pushSpy).not.toHaveBeenCalled()
  })

  // T-70-06 — URL-backup branch: switch + Find specs → POST /api/extract-watch {mode:'url',...} → confirming.
  it('T-70-06 — onSwitchToUrl → extracting-url branch; Find specs → fetch {mode:"url",url} → confirming', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        catalogId: 'cat-url',
        data: { brand: 'Omega', model: 'Speedmaster' },
      }),
    } as Response)

    renderFlow()
    fireEvent.click(screen.getByText('Switch to URL'))
    // Inline URL input + Find specs renders.
    const urlInput = await screen.findByLabelText('Watch page URL')
    expect(urlInput).toBeInTheDocument()
    expect(screen.getByText('← Back to search')).toBeInTheDocument()

    fireEvent.change(urlInput, { target: { value: 'https://example.com/spd' } })
    fireEvent.click(screen.getByRole('button', { name: /Find specs/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/extract-watch',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ mode: 'url', url: 'https://example.com/spd' }),
        }),
      )
    })
    expect(await screen.findByTestId('confirm-step')).toBeInTheDocument()
  })

  // T-70-07 — D-17 photos-pending gate: wishlist commit skips photos, owned commit mounts photos.
  it('T-70-07a — D-17 gate: manual-entry WatchForm with status="wishlist" skips photos-pending and routes direct', async () => {
    renderFlow()
    fireEvent.click(screen.getByText('Skip search — enter manually'))
    const form = await screen.findByTestId('watch-form')
    expect(form).toBeInTheDocument()
    fireEvent.click(screen.getByText('Create wishlist'))
    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith('/u/tester/wishlist')
    })
    expect(screen.queryByTestId('photos-pending')).not.toBeInTheDocument()
  })

  it('T-70-07b — D-17 gate: manual-entry WatchForm with status="owned" mounts photos-pending (no direct router.push)', async () => {
    renderFlow()
    fireEvent.click(screen.getByText('Skip search — enter manually'))
    await screen.findByTestId('watch-form')
    fireEvent.click(screen.getByText('Create owned'))
    expect(await screen.findByTestId('photos-pending')).toBeInTheDocument()
    // The router push happens only on photo step Done/Skip, not on the create.
    expect(pushSpy).not.toHaveBeenCalled()
  })

  // T-70-08 — initialState precedence (D-03).
  it('T-70-08a — initialCatalogId + initialIntent="owned" + initialCatalogPrefill → form-prefill', () => {
    renderFlow({
      initialCatalogId: 'cat-deep',
      initialIntent: 'owned',
      initialCatalogPrefill: { brand: 'Rolex', model: 'Submariner' },
    })
    expect(screen.getByTestId('watch-form')).toBeInTheDocument()
    expect(screen.queryByTestId('search-entry')).not.toBeInTheDocument()
  })

  it('T-70-08b — initialManual=true → manual-entry', () => {
    renderFlow({ initialManual: true })
    expect(screen.getByTestId('watch-form')).toBeInTheDocument()
    expect(screen.queryByTestId('search-entry')).not.toBeInTheDocument()
  })

  it('T-70-08c — neither set → search-idle', () => {
    renderFlow()
    expect(screen.getByTestId('search-entry')).toBeInTheDocument()
    expect(screen.queryByTestId('watch-form')).not.toBeInTheDocument()
  })

  // CLNP-06 link is rendered BELOW SearchEntry in the search-idle branch.
  it('CLNP-06 — skip link renders below SearchEntry in search-idle branch', () => {
    renderFlow()
    expect(screen.getByTestId('search-entry')).toBeInTheDocument()
    expect(screen.getByText('Skip search — enter manually')).toBeInTheDocument()
  })
})

// =============================================================================
// Phase 69 Plan 06 (CLNP-07): cross-cache hygiene integration — PRESERVED VERBATIM
// =============================================================================

/**
 * Phase 69 Plan 06 (CLNP-07): cross-cache hygiene integration.
 *
 * D-09 contract: a single user-switch must clear ALL FOUR module-scope caches
 * (useCatalogSearchCache, useStructuredExtractCache, useUrlExtractCache,
 * useWatchSearchVerdictCache) so that signing in as a different viewer does
 * NOT surface the previous user's cached typeahead/extract/verdict bytes.
 *
 * This test is the composition proof for the per-hook unit tests shipped in
 * Plans 02 + 03. Each hook owns its own user-switch reset (D-06: inline mutation
 * in render). This test asserts the contract holds when the four are exercised
 * back-to-back at the AddWatchFlow plumbing layer.
 */

const fixtureFullVerdict = {
  framing: 'cross-user' as const,
  label: 'core-fit' as const,
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: ['Lines up cleanly with your established taste.'],
  rationalePhrasings: ['Lines up cleanly with the taste I have already built.'],
  mostSimilar: [],
  roleOverlap: false,
  candidateCatalogTaste: null,
}

describe('Phase 69 — cache hygiene integration (CLNP-07)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { __resetUrlExtractCacheForTests } = await import('./useUrlExtractCache')
    const { __resetVerdictCacheForTests } = await import(
      '@/components/search/useWatchSearchVerdictCache'
    )
    const { __resetCatalogSearchCacheForTests } = await import('./useCatalogSearchCache')
    const { __resetStructuredExtractCacheForTests } = await import(
      './useStructuredExtractCache'
    )
    __resetUrlExtractCacheForTests()
    __resetVerdictCacheForTests()
    __resetCatalogSearchCacheForTests()
    __resetStructuredExtractCacheForTests()
  })

  it('switching viewerUserId clears all 4 module-scope caches in a single user-switch', async () => {
    const { useCatalogSearchCache } = await import('./useCatalogSearchCache')
    const { useStructuredExtractCache } = await import('./useStructuredExtractCache')
    const { useUrlExtractCache } = await import('./useUrlExtractCache')
    const { useWatchSearchVerdictCache } = await import(
      '@/components/search/useWatchSearchVerdictCache'
    )

    // --- Fixtures ---
    const catalogKey = 'omega speedmaster'
    const catalogValue: import('@/lib/searchTypes').SearchCatalogWatchResult[] = [
      {
        catalogId: 'cat-a',
        brand: 'Omega',
        model: 'Speedmaster',
        reference: '3135',
        imageUrl: null,
        ownersCount: 47,
        wishlistCount: 12,
        viewerState: null,
      },
    ]
    const structuredKey = JSON.stringify({
      brand: 'omega',
      model: 'speedmaster',
      reference: '3135',
      year: null,
    })
    const urlKey = 'https://example.com/spd'
    const extractFixture: import('./useUrlExtractCache').ExtractCacheEntry = {
      catalogId: 'cat-a',
      extracted: { brand: 'Omega', model: 'Speedmaster' },
      catalogIdError: null,
    }
    const verdictKey = 'cat-a'

    // --- Seed user-a in all 4 caches ---
    const aCatalog = useCatalogSearchCache('user-a')
    aCatalog.set(catalogKey, catalogValue)
    expect(aCatalog.get(catalogKey)).toEqual(catalogValue)

    const aStructured = useStructuredExtractCache('user-a')
    aStructured.set(structuredKey, extractFixture)
    expect(aStructured.get(structuredKey)).toEqual(extractFixture)

    const aUrl = useUrlExtractCache('user-a')
    aUrl.set(urlKey, extractFixture)
    expect(aUrl.get(urlKey)).toEqual(extractFixture)

    const aVerdict = useWatchSearchVerdictCache(1, 'user-a')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aVerdict.set(verdictKey, fixtureFullVerdict as any)
    expect(aVerdict.get(verdictKey)).toEqual(fixtureFullVerdict)

    // --- User-switch: same revision, different viewerUserId ---
    const bCatalog = useCatalogSearchCache('user-b')
    const bStructured = useStructuredExtractCache('user-b')
    const bUrl = useUrlExtractCache('user-b')
    const bVerdict = useWatchSearchVerdictCache(1, 'user-b')

    // --- Assertions: all 4 caches surface undefined for the user-a keys ---
    expect(bCatalog.get(catalogKey)).toBeUndefined()
    expect(bStructured.get(structuredKey)).toBeUndefined()
    expect(bUrl.get(urlKey)).toBeUndefined()
    expect(bVerdict.get(verdictKey)).toBeUndefined()
  })
})

// Cleanup so the afterEach does not leak state between describe blocks.
afterEach(() => {
  vi.restoreAllMocks()
})
