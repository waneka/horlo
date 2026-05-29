/**
 * Phase 69 Plan 04 (Wave 2) — RED test scaffold for StructuredEntryPanel.
 *
 * Pure-presenter contract:
 *   - 4-field structured-input form (brand+model required, reference+year optional)
 *   - Inline always-visible CatalogPhotoUploader (D-16, EXTR-06)
 *   - Explicit "Find specs" button gates the LLM call (EXTR-05)
 *   - In-place VerdictSkeleton during round-trip (D-17)
 *   - <ExtractErrorCard mode="structured"> on failure (Phase 66 D-06)
 *   - "Have a URL for this watch?" ghost link → onSwitchToUrl (EXTR-07)
 *   - useStructuredExtractCache(viewerUserId) check BEFORE fetch (D-18)
 *   - Pure presenter — no useRouter, no Server Action import, no router.push
 *
 * 10 tests per PLAN <behavior> block:
 *   (1) brand/model labels + required + aria-required="true"; reference/year NOT required
 *   (2) EXTR-05 disabled-state: button disabled when brand="" or model=""
 *   (3) EXTR-05 click gate: fires fetch with mode='structured' body when valid
 *   (4) D-17 in-place skeleton: VerdictSkeleton + Loader2 + "Finding specs…" during round-trip
 *   (5) EXTR-06 inline photo: CatalogPhotoUploader rendered on mount
 *   (6) EXTR-07 URL backup: "Have a URL for this watch?" link → onSwitchToUrl()
 *   (7) Phase 66 D-06: failure → <ExtractErrorCard mode="structured"> body
 *   (8) D-18 cache hit: skips fetch + calls onSubmitStructured(cached.extracted, cached.catalogId || null)
 *   (9) presenter purity: no useRouter/next/navigation import in the SOURCE
 *  (10) success → onSubmitStructured(result, envelope.catalogId) with parsed ExtractedWatchData
 *
 * Phase 70 Wave 0 — onSubmitStructured signature widened to (extracted, catalogId)
 * so the AddWatchFlow orchestrator can DUPE-lookup + addWatch without a side-channel.
 *
 * RED until Task 2 ships `@/components/watch/StructuredEntryPanel`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Mock CatalogPhotoUploader to avoid pulling EXIF / canvas workers into jsdom.
// The mock exposes a "Pick photo" button and a "Clear" button so tests can drive
// the photoBlob lifecycle deterministically (Phase 70 gap plan 06).
vi.mock('@/components/watch/CatalogPhotoUploader', () => ({
  CatalogPhotoUploader: (props: {
    onPhotoReady: (b: Blob) => void
    onClear?: () => void
    disabled?: boolean
  }) => (
    <div data-testid="catalog-photo-uploader" data-disabled={props.disabled ? 'true' : 'false'}>
      Reference Photo
      <button
        type="button"
        data-testid="catalog-photo-mock-pick"
        onClick={() => props.onPhotoReady(new Blob(['x'], { type: 'image/jpeg' }))}
      >
        pick
      </button>
      <button
        type="button"
        data-testid="catalog-photo-mock-clear"
        onClick={() => props.onClear?.()}
      >
        clear
      </button>
    </div>
  ),
}))

// Mock VerdictSkeleton — lightweight stand-in for in-DOM presence assertion.
vi.mock('@/components/insights/VerdictSkeleton', () => ({
  VerdictSkeleton: () => <div data-testid="verdict-skeleton" />,
}))

// Module-level mocks for useStructuredExtractCache — per-test impls reassign
// the mock's return value to seed cache hits / record set() calls.
const cacheGet = vi.fn()
const cacheSet = vi.fn()
vi.mock('@/components/watch/useStructuredExtractCache', () => ({
  useStructuredExtractCache: vi.fn(() => ({ get: cacheGet, set: cacheSet })),
}))

import { StructuredEntryPanel } from '@/components/watch/StructuredEntryPanel'
import type { ExtractedWatchData } from '@/lib/extractors/types'

const BASE_PROPS = {
  viewerUserId: 'user-a',
  onSubmitStructured: vi.fn(),
  onSwitchToUrl: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  cacheGet.mockReset()
  cacheSet.mockReset()
  // Default: cache miss
  cacheGet.mockReturnValue(undefined)
  // Default fetch stub — tests override per case.
  global.fetch = vi.fn() as unknown as typeof fetch
})

describe('StructuredEntryPanel — fields & required (EXTR-03 / D-15)', () => {
  it('(1) brand + model labels rendered; both Inputs required + aria-required=true; reference + year not required', () => {
    render(<StructuredEntryPanel {...BASE_PROPS} />)
    const brand = screen.getByLabelText(/Brand/i) as HTMLInputElement
    const model = screen.getByLabelText(/Model/i) as HTMLInputElement
    const reference = screen.getByLabelText(/Reference/i) as HTMLInputElement
    const year = screen.getByLabelText(/Year/i) as HTMLInputElement

    expect(brand).toBeRequired()
    expect(brand).toHaveAttribute('aria-required', 'true')
    expect(model).toBeRequired()
    expect(model).toHaveAttribute('aria-required', 'true')
    expect(reference).not.toBeRequired()
    expect(year).not.toBeRequired()
  })
})

describe('StructuredEntryPanel — Find specs gate (EXTR-05)', () => {
  it('(2) "Find specs" button is disabled when brand or model empty; enabled when both have non-whitespace content', () => {
    render(<StructuredEntryPanel {...BASE_PROPS} />)
    const btn = screen.getByRole('button', { name: /find specs/i })
    expect(btn).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Brand/i), { target: { value: 'Omega' } })
    expect(btn).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: 'Speedmaster' } })
    expect(btn).toBeEnabled()

    // Whitespace-only does not count as "has content".
    fireEvent.change(screen.getByLabelText(/Brand/i), { target: { value: '   ' } })
    expect(btn).toBeDisabled()
  })

  it('(3) clicking "Find specs" with valid brand+model fires fetch to /api/extract-watch with mode=structured body', async () => {
    const onSubmitStructured = vi.fn()
    // Never-resolving fetch so we can inspect the call without awaiting completion.
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))

    render(<StructuredEntryPanel {...BASE_PROPS} onSubmitStructured={onSubmitStructured} />)
    fireEvent.change(screen.getByLabelText(/Brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: 'Speedmaster' } })
    fireEvent.click(screen.getByRole('button', { name: /find specs/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
    const call = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('/api/extract-watch')
    const init = call[1] as RequestInit
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.mode).toBe('structured')
    expect(body.brand).toBe('Omega')
    expect(body.model).toBe('Speedmaster')
  })

  it('(4) during round-trip the Button is disabled + Loader2 + "Finding specs…"; VerdictSkeleton present; fields stay visible', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))

    render(<StructuredEntryPanel {...BASE_PROPS} />)
    fireEvent.change(screen.getByLabelText(/Brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: 'Speedmaster' } })
    fireEvent.click(screen.getByRole('button', { name: /find specs/i }))

    await waitFor(() => {
      expect(screen.queryByText('Finding specs…')).toBeInTheDocument()
    })
    expect(screen.getByTestId('verdict-skeleton')).toBeInTheDocument()
    // Fields remain visible.
    expect(screen.getByLabelText(/Brand/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Model/i)).toBeInTheDocument()
    // Loading-state Button is disabled.
    const loadingBtn = screen.getByRole('button', { name: /finding specs/i })
    expect(loadingBtn).toBeDisabled()
  })
})

describe('StructuredEntryPanel — inline photo (EXTR-06 / D-16)', () => {
  it('(5) <CatalogPhotoUploader> is rendered on mount (always-visible, not behind a reveal)', () => {
    render(<StructuredEntryPanel {...BASE_PROPS} />)
    expect(screen.getByTestId('catalog-photo-uploader')).toBeInTheDocument()
  })
})

describe('StructuredEntryPanel — URL backup (EXTR-07 / D-16)', () => {
  it('(6) "Have a URL for this watch?" ghost link → onSwitchToUrl() callback', () => {
    const onSwitchToUrl = vi.fn()
    render(<StructuredEntryPanel {...BASE_PROPS} onSwitchToUrl={onSwitchToUrl} />)
    const link = screen.getByRole('button', { name: /Have a URL for this watch\?/i })
    expect(link).toBeInTheDocument()
    fireEvent.click(link)
    expect(onSwitchToUrl).toHaveBeenCalledTimes(1)
  })
})

describe('StructuredEntryPanel — error display (Phase 66 D-06)', () => {
  it('(7) on extract failure with structured-data-missing, ExtractErrorCard renders with mode="structured" body', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { category: 'structured-data-missing' },
        mode: 'structured',
      }),
    } as Response)

    render(<StructuredEntryPanel {...BASE_PROPS} />)
    fireEvent.change(screen.getByLabelText(/Brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: 'Speedmaster' } })
    fireEvent.click(screen.getByRole('button', { name: /find specs/i }))

    // Structured-mode body verbatim from Plan 04 Task 1 (Phase 66 D-06 unlock).
    await waitFor(() => {
      expect(
        screen.getByText(
          "Couldn't find specs for that watch. Try adding a reference number, or enter manually.",
        ),
      ).toBeInTheDocument()
    })
  })
})

describe('StructuredEntryPanel — cache hit (D-18)', () => {
  it('(8) cache hit returns entry without firing fetch and calls onSubmitStructured(cached.extracted)', () => {
    const cachedExtracted: ExtractedWatchData = {
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '3135',
    }
    cacheGet.mockReturnValue({
      catalogId: 'cat-1',
      extracted: cachedExtracted,
      catalogIdError: null,
    })
    const onSubmitStructured = vi.fn()

    render(<StructuredEntryPanel {...BASE_PROPS} onSubmitStructured={onSubmitStructured} />)
    fireEvent.change(screen.getByLabelText(/Brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: 'Speedmaster' } })
    fireEvent.click(screen.getByRole('button', { name: /find specs/i }))

    // Cache key check — confirm we asked the cache with the D-18 JSON-tuple shape.
    expect(cacheGet).toHaveBeenCalled()
    const cacheKey = cacheGet.mock.calls[0][0] as string
    const parsed = JSON.parse(cacheKey)
    expect(parsed.brand).toBe('omega')
    expect(parsed.model).toBe('speedmaster')
    expect(parsed.reference).toBe('')
    expect(parsed.year).toBe(null)

    // No network call when cache hits.
    expect(global.fetch).not.toHaveBeenCalled()
    expect(onSubmitStructured).toHaveBeenCalledTimes(1)
    // Phase 70 Wave 0 — widened emit: cache stores catalogId='cat-1', surfaces
    // as second arg (empty-string coerced to null at boundary; 'cat-1' passes through).
    // Phase 70 gap plan 06 widens to 3 args; the third arg (photoBlob) is undefined
    // because the user did not pick a photo in this test path.
    expect(onSubmitStructured).toHaveBeenCalledWith(cachedExtracted, 'cat-1', undefined)
  })
})

describe('StructuredEntryPanel — presenter purity (counter-assertion)', () => {
  it('(9) source file has no useRouter / next/navigation / Server Action import', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/watch/StructuredEntryPanel.tsx'),
      'utf8',
    )
    expect(src).not.toMatch(/useRouter/)
    expect(src).not.toMatch(/next\/navigation/)
    expect(src).not.toMatch(/from ['"]@\/app\/actions/)
    expect(src).not.toMatch(/router\.push/)
  })
})

describe('StructuredEntryPanel — success path (D-03)', () => {
  it('(10) success envelope → onSubmitStructured(result.data) called with parsed ExtractedWatchData', async () => {
    const extracted: ExtractedWatchData = {
      brand: 'Omega',
      model: 'Speedmaster Professional',
      reference: '311.30.42.30.01.005',
      caseSizeMm: 42,
    }
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: extracted,
        catalogId: 'cat-omega-speed',
        mode: 'structured',
        source: 'llm',
        confidence: 'medium',
      }),
    } as Response)

    const onSubmitStructured = vi.fn()
    render(<StructuredEntryPanel {...BASE_PROPS} onSubmitStructured={onSubmitStructured} />)
    fireEvent.change(screen.getByLabelText(/Brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: 'Speedmaster' } })
    fireEvent.click(screen.getByRole('button', { name: /find specs/i }))

    await waitFor(() => {
      expect(onSubmitStructured).toHaveBeenCalledTimes(1)
    })
    // Phase 70 Wave 0 — envelope.catalogId='cat-omega-speed' surfaces as the
    // second arg of onSubmitStructured. The Network-branch emit at
    // StructuredEntryPanel.tsx (formerly bare emit) now routes catalogId through.
    // Phase 70 gap plan 06 widens to 3 args; the third arg is undefined here
    // because the user did not pick a photo in this test path.
    expect(onSubmitStructured).toHaveBeenCalledWith(extracted, 'cat-omega-speed', undefined)
    // Cache write should fire on success.
    expect(cacheSet).toHaveBeenCalledTimes(1)
  })
})

describe('Phase 70 gap plan 06 — photoBlob forwarding (CR-01 closure)', () => {
  it('(P70-06-a) forwards captured photoBlob through onSubmitStructured on cache-hit path', () => {
    const cachedExtracted: ExtractedWatchData = {
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '3135',
    }
    cacheGet.mockReturnValue({
      catalogId: 'cat-1',
      extracted: cachedExtracted,
      catalogIdError: null,
    })
    const onSubmitStructured = vi.fn()

    render(<StructuredEntryPanel {...BASE_PROPS} onSubmitStructured={onSubmitStructured} />)
    fireEvent.change(screen.getByLabelText(/Brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: 'Speedmaster' } })
    // User picks a photo BEFORE clicking Find specs — CatalogPhotoUploader's
    // onPhotoReady fires with a Blob; StructuredEntryPanel must now capture it
    // (Phase 70 gap plan 06: was `[, setPhotoBlob]` write-only; now readable).
    fireEvent.click(screen.getByTestId('catalog-photo-mock-pick'))
    fireEvent.click(screen.getByRole('button', { name: /find specs/i }))

    expect(onSubmitStructured).toHaveBeenCalledTimes(1)
    const [extracted, catalogId, photoBlob] = onSubmitStructured.mock.calls[0]
    expect(extracted).toBe(cachedExtracted)
    expect(catalogId).toBe('cat-1')
    expect(photoBlob).toBeInstanceOf(Blob)
    expect((photoBlob as Blob).type).toBe('image/jpeg')
  })

  it('(P70-06-b) forwards captured photoBlob through onSubmitStructured on network success path', async () => {
    const extracted: ExtractedWatchData = {
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30.42.30.01.005',
    }
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: extracted,
        catalogId: 'cat-omega-speed',
        mode: 'structured',
      }),
    } as Response)

    const onSubmitStructured = vi.fn()
    render(<StructuredEntryPanel {...BASE_PROPS} onSubmitStructured={onSubmitStructured} />)
    fireEvent.change(screen.getByLabelText(/Brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: 'Speedmaster' } })
    // Pick a photo first, then submit.
    fireEvent.click(screen.getByTestId('catalog-photo-mock-pick'))
    fireEvent.click(screen.getByRole('button', { name: /find specs/i }))

    await waitFor(() => {
      expect(onSubmitStructured).toHaveBeenCalledTimes(1)
    })
    const [data, catalogId, photoBlob] = onSubmitStructured.mock.calls[0]
    expect(data).toBe(extracted)
    expect(catalogId).toBe('cat-omega-speed')
    expect(photoBlob).toBeInstanceOf(Blob)
    expect((photoBlob as Blob).type).toBe('image/jpeg')
  })

  it('(P70-06-c) forwards undefined when no photo was picked (network success path)', async () => {
    const extracted: ExtractedWatchData = {
      brand: 'Omega',
      model: 'Speedmaster',
    }
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: extracted,
        catalogId: 'cat-omega-speed',
        mode: 'structured',
      }),
    } as Response)

    const onSubmitStructured = vi.fn()
    render(<StructuredEntryPanel {...BASE_PROPS} onSubmitStructured={onSubmitStructured} />)
    fireEvent.change(screen.getByLabelText(/Brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: 'Speedmaster' } })
    // Do NOT pick a photo; click submit directly.
    fireEvent.click(screen.getByRole('button', { name: /find specs/i }))

    await waitFor(() => {
      expect(onSubmitStructured).toHaveBeenCalledTimes(1)
    })
    expect(onSubmitStructured).toHaveBeenCalledWith(extracted, 'cat-omega-speed', undefined)
  })

  it('(P70-06-d) forwards undefined after onClear is invoked (post-pick clear)', () => {
    const cachedExtracted: ExtractedWatchData = {
      brand: 'Omega',
      model: 'Speedmaster',
    }
    cacheGet.mockReturnValue({
      catalogId: 'cat-1',
      extracted: cachedExtracted,
      catalogIdError: null,
    })
    const onSubmitStructured = vi.fn()

    render(<StructuredEntryPanel {...BASE_PROPS} onSubmitStructured={onSubmitStructured} />)
    fireEvent.change(screen.getByLabelText(/Brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: 'Speedmaster' } })
    // Pick a photo, then clear it before submitting.
    fireEvent.click(screen.getByTestId('catalog-photo-mock-pick'))
    fireEvent.click(screen.getByTestId('catalog-photo-mock-clear'))
    fireEvent.click(screen.getByRole('button', { name: /find specs/i }))

    expect(onSubmitStructured).toHaveBeenCalledTimes(1)
    expect(onSubmitStructured).toHaveBeenCalledWith(cachedExtracted, 'cat-1', undefined)
  })
})
