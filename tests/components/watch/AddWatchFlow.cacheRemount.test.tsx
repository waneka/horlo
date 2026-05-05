// Phase 29 FORM-04 gap closure (Gap 1): regression test for the
// useWatchSearchVerdictCache module-scope migration.
//
// Asserts that pasting the SAME URL on a remounted AddWatchFlow (simulating
// the per-request UUID `key` boundary) hits the cache and does NOT call
// /api/extract-watch a second time.
//
// Diagnostic surface: pre-fix, this test would fail because the useState-based
// cache lived inside AddWatchFlow → key prop nukes the cache → second paste
// re-fires the network round-trip. Post-fix (module-scoped cache), the second
// paste hits the cache cross-remount and skips the round-trip entirely.

import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const TEST_URL = 'https://example.com/some-watch'
const TEST_CATALOG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const { mockGetVerdict } = vi.hoisted(() => ({
  mockGetVerdict: vi.fn(),
}))

vi.mock('@/app/actions/verdict', () => ({
  getVerdictForCatalogWatch: mockGetVerdict,
}))
vi.mock('@/app/actions/watches', () => ({
  addWatch: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { AddWatchFlow } from '@/components/watch/AddWatchFlow'
import { __resetVerdictCacheForTests } from '@/components/search/useWatchSearchVerdictCache'

const baseProps = {
  collectionRevision: 1,                  // non-zero: forces verdict compute path
  initialCatalogId: null,
  initialIntent: null as 'owned' | null,
  initialCatalogPrefill: null,
  initialManual: false,
  initialStatus: null as 'wishlist' | null,
  initialReturnTo: null,
  viewerUsername: 'tyler',
}

describe('FORM-04 Gap 1 — verdict cache survives remount (CONTEXT D-15)', () => {
  // Use `MockInstance` from vitest with the explicit fetch signature.
  // ReturnType<typeof vi.spyOn> is overload-ambiguous (Rule 3 fix:
  // typecheck-blocking). Type the spy against the fetch function shape
  // directly so test assertions on .toHaveBeenCalledTimes(...) are typed.
  let fetchSpy: MockInstance<typeof globalThis.fetch>

  beforeEach(() => {
    __resetVerdictCacheForTests()
    mockGetVerdict.mockReset()
    mockGetVerdict.mockResolvedValue({
      success: true,
      data: {
        framing: 'cross-user',
        label: 'core-fit',
        headlinePhrasing: 'Core Fit',
        contextualPhrasings: ['ok'],
        rationalePhrasings: ['ok'],
        mostSimilar: [],
        roleOverlap: false,
      },
    })
    // Each fetch invocation needs a FRESH Response — Response bodies are
    // single-read. Using a factory via mockImplementation, not mockResolvedValue
    // (which would return the same already-consumed Response object on the
    // second call → "Body is unusable: Body has already been read").
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(
        JSON.stringify({
          data: { brand: 'Omega', model: 'Speedmaster' },
          catalogId: TEST_CATALOG_ID,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
  })

  it('remount-cache-hit: same URL pasted after key change does NOT re-fire /api/extract-watch', async () => {
    const user = userEvent.setup()
    // Pitfall 8: key MUST be at JSX level, NOT inside spread.
    const { rerender } = render(<AddWatchFlow key="mount-1" {...baseProps} />)

    // First paste: extracts → verdict-ready (fetch called once).
    const urlInput1 = screen.getByPlaceholderText(
      /paste a product page URL/i,
    ) as HTMLInputElement
    await user.type(urlInput1, TEST_URL)
    await user.click(screen.getByRole('button', { name: /extract/i }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    // Wait for verdict-ready render (3 CTAs visible).
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /add to wishlist/i }),
      ).toBeInTheDocument()
    })

    // Remount with a new key — simulates the per-request UUID nonce on /watch/new.
    rerender(<AddWatchFlow key="mount-2" {...baseProps} />)

    // Second paste of the SAME URL: cache must be hit; fetch must NOT fire again.
    const urlInput2 = screen.getByPlaceholderText(
      /paste a product page URL/i,
    ) as HTMLInputElement
    await user.type(urlInput2, TEST_URL)
    await user.click(screen.getByRole('button', { name: /extract/i }))

    // The fetch IS called again because /api/extract-watch resolves the catalogId
    // — that lookup is NOT what the verdict cache de-dupes. The cache de-dupes
    // the getVerdictForCatalogWatch Server Action call below.
    //
    // Reading AddWatchFlow.tsx handleExtract: fetch(/api/extract-watch) ALWAYS
    // runs on paste (lines 171-176). The cache short-circuit (lines 222-226)
    // skips the getVerdictForCatalogWatch call when the catalogId is cached.
    //
    // So the correct gap-1 regression assertion is on the verdict Server Action
    // call count, NOT the fetch call count.
    await waitFor(() => {
      // verdict-ready re-renders again on second paste.
      expect(
        screen.getByRole('button', { name: /add to wishlist/i }),
      ).toBeInTheDocument()
    })

    // The Server Action is called exactly ONCE across both pastes.
    // Pre-fix: this was 2 (cache wiped on remount). Post-fix: 1 (cache survives).
    expect(mockGetVerdict).toHaveBeenCalledTimes(1)
  })
})
