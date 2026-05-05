// FORM-04 Gap 3 regression test (post 29-05/06 UAT): the URL extract cache
// must skip /api/extract-watch on re-paste of the same URL after AddWatchFlow
// remount. Pre-fix: 29-05 fixed verdict-cache-survives-remount but the upstream
// /api/extract-watch round-trip still fired on every re-paste — user-visible
// bottleneck the verdict cache could not address. Post-fix: useUrlExtractCache
// short-circuits the fetch on hit.
//
// This is the strongest assertion in the FORM-04 gap suite: fetch is called
// EXACTLY ONCE across two pastes of the same URL, even after a key-driven
// remount of AddWatchFlow.

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
import { __resetUrlExtractCacheForTests } from '@/components/watch/useUrlExtractCache'

const baseProps = {
  collectionRevision: 1,                  // non-zero: forces verdict path
  initialCatalogId: null,
  initialIntent: null as 'owned' | null,
  initialCatalogPrefill: null,
  initialManual: false,
  initialStatus: null as 'wishlist' | null,
  initialReturnTo: null,
  viewerUsername: 'tyler',
}

describe('FORM-04 Gap 3 — URL extract cache survives remount', () => {
  let fetchSpy: MockInstance<typeof globalThis.fetch>

  beforeEach(() => {
    __resetVerdictCacheForTests()
    __resetUrlExtractCacheForTests()
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
    // Factory mock — Response bodies are single-read; mockResolvedValue would
    // hand the second call an already-consumed body. With a URL cache hit on
    // the second paste, fetch should never be called twice anyway, but keep
    // the factory shape so a regression doesn't manifest as a confusing
    // "Body has already been read" instead of "called 2 times".
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

  it('same URL pasted after remount does NOT re-fire /api/extract-watch', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<AddWatchFlow key="mount-1" {...baseProps} />)

    // First paste: fetch + verdict compute.
    const urlInput1 = screen.getByPlaceholderText(
      /paste a product page URL/i,
    ) as HTMLInputElement
    await user.type(urlInput1, TEST_URL)
    await user.click(screen.getByRole('button', { name: /extract/i }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /add to wishlist/i }),
      ).toBeInTheDocument()
    })

    // Remount — simulates per-request UUID nonce on /watch/new.
    rerender(<AddWatchFlow key="mount-2" {...baseProps} />)

    // Second paste of the same URL — must hit URL cache, skip the fetch.
    const urlInput2 = screen.getByPlaceholderText(
      /paste a product page URL/i,
    ) as HTMLInputElement
    await user.type(urlInput2, TEST_URL)
    await user.click(screen.getByRole('button', { name: /extract/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /add to wishlist/i }),
      ).toBeInTheDocument()
    })

    // Strongest assertion: fetch fires exactly ONCE across both pastes.
    // Pre-fix: 2 (URL not cached, every paste re-fetches).
    // Post-fix: 1 (second paste hits useUrlExtractCache, skips the fetch).
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Verdict server action also fires only once — 29-05's contract is
    // preserved (verdict cache also survives remount).
    expect(mockGetVerdict).toHaveBeenCalledTimes(1)
  })
})
