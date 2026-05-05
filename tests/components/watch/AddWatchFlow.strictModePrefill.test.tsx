// Phase 29 FORM-04 gap closure (Gap 2): regression test for the
// StrictMode-safe useLayoutEffect cleanup.
//
// Asserts that when AddWatchFlow is mounted with form-prefill initialState
// (deep-link from /search with ?catalogId=X&intent=owned + a hydrated
// initialCatalogPrefill), the WatchForm renders with brand/model populated
// from the catalog row — and that StrictMode's mount/cleanup/mount cycle
// does NOT clobber the prefill.
//
// Pre-fix: this test would fail because the unconditional cleanup at lines
// 137-143 of AddWatchFlow.tsx runs setState({kind:'idle'}) during StrictMode's
// spurious unmount → form-prefill is replaced with idle → WatchForm is not
// rendered (instead PasteSection is rendered with empty input).
//
// Post-fix: the cleanup body is guarded — state.kind === 'form-prefill'
// hits skip case 2 → cleanup body is a no-op → WatchForm renders with
// brand/model populated.
//
// This test relies on the StrictMode wrapper installed in tests/setup.tsx —
// without it, the cleanup body never runs in jsdom (RTL's render unmount-on-
// teardown is not the same as StrictMode's mount/cleanup/mount on initial
// render). Verify the wrapper is active by reading the SETUP block.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ExtractedWatchData } from '@/lib/extractors'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/app/actions/verdict', () => ({
  getVerdictForCatalogWatch: vi.fn(),
}))
vi.mock('@/app/actions/watches', () => ({
  addWatch: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { AddWatchFlow } from '@/components/watch/AddWatchFlow'

const PREFILL: ExtractedWatchData = {
  brand: 'Omega',
  model: 'Speedmaster Professional',
  reference: '310.30.42.50.01.001',
  movement: 'manual',
  caseSizeMm: 42,
  styleTags: [],
  designTraits: [],
  complications: [],
}

const deepLinkProps = {
  collectionRevision: 1,
  initialCatalogId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  initialIntent: 'owned' as const,
  initialCatalogPrefill: PREFILL,
  initialManual: false,
  initialStatus: null as 'wishlist' | null,
  initialReturnTo: null,
  viewerUsername: 'tyler',
}

describe('FORM-04 Gap 2 — form-prefill survives StrictMode (CONTEXT D-16)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('form-prefill survives StrictMode mount/cleanup/mount: brand and model inputs are populated from initialCatalogPrefill', () => {
    // The test setup (tests/setup.tsx) wraps render() in <StrictMode>, so
    // this exercises the same mount/cleanup/mount cycle Next.js 16 dev runs.
    // Pitfall 8: key MUST appear at JSX level if used; here we omit it
    // because the test exercises the FIRST mount, not key-change remount.
    render(<AddWatchFlow {...deepLinkProps} />)

    // form-prefill state branch renders <WatchForm> with extracted data.
    // WatchForm.tsx labels brand and model inputs with text "Brand *" and
    // "Model *" respectively (lines 268, 283 of WatchForm.tsx).
    const brandInput = screen.getByLabelText(/brand/i) as HTMLInputElement
    const modelInput = screen.getByLabelText(/^model/i) as HTMLInputElement

    // Pre-fix: these would be empty strings (cleanup clobbered form-prefill,
    // PasteSection rendered instead — and even if WatchForm rendered, its
    // initialFormData would re-derive empty because state went to idle).
    // Post-fix: WatchForm is rendered with extractedToPartialWatch values.
    expect(brandInput.value).toBe('Omega')
    expect(modelInput.value).toBe('Speedmaster Professional')
  })

  it('PasteSection is NOT rendered when form-prefill initialState is provided (negative assertion that prefill won)', () => {
    render(<AddWatchFlow {...deepLinkProps} />)

    // PasteSection renders an input with placeholder "Paste a product page URL...".
    // form-prefill state branch does NOT render PasteSection. Pre-fix: cleanup
    // clobbered state to idle → PasteSection rendered → this assertion would fail.
    expect(screen.queryByPlaceholderText(/paste a product page URL/i)).not.toBeInTheDocument()
  })
})
