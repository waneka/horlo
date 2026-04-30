/**
 * Phase 20.1 Plan 01 (Wave 0) — RED test scaffold for end-to-end search-accordion
 * commit (ADD-06).
 *
 * Covers:
 *   - Wishlist click in search accordion → addWatch invoked with status='wishlist'
 *     + brand/model from the catalog row payload
 *   - Collection click → router.push('/watch/new?catalogId=...&intent=owned'),
 *     no addWatch call (D-04 RESEARCH Open Q1 recommendation b — navigate, do
 *     not inline-commit collection adds)
 *   - Pitfall 2 — CTA clicks stopPropagation: clicking a CTA button does NOT
 *     toggle the parent Accordion.Item state
 *
 * RED until Plan 05 modifies WatchSearchRowsAccordion to render the 3 CTAs
 * inside Accordion.Panel below CollectionFitCard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const {
  mockAddWatch,
  mockGetVerdict,
  mockRouterPush,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockAddWatch: vi.fn(),
  mockGetVerdict: vi.fn(),
  mockRouterPush: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('@/app/actions/watches', () => ({ addWatch: mockAddWatch }))
vi.mock('@/app/actions/verdict', () => ({ getVerdictForCatalogWatch: mockGetVerdict }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, refresh: vi.fn() }),
}))
vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))
vi.mock('@/components/insights/CollectionFitCard', () => ({
  CollectionFitCard: ({ verdict }: { verdict: { headlinePhrasing?: string } }) => (
    <div data-testid="cfc">{verdict.headlinePhrasing}</div>
  ),
}))
vi.mock('@/components/insights/VerdictSkeleton', () => ({
  VerdictSkeleton: () => <div data-testid="vskel" />,
}))

// IMPORT UNDER TEST — current file exists; Plan 05 modifies it to add 3 CTAs.
import { WatchSearchRowsAccordion } from '@/components/search/WatchSearchRowsAccordion'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

const fixtureRow: SearchCatalogWatchResult = {
  catalogId: 'cat-row-uuid',
  brand: 'Omega',
  model: 'Speedmaster',
  reference: null,
  imageUrl: null,
  ownersCount: 0,
  wishlistCount: 0,
  viewerState: null,
}

const fixtureVerdict = {
  framing: 'cross-user' as const,
  label: 'core-fit' as const,
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: ['ok'],
  mostSimilar: [],
  roleOverlap: false,
}

describe('Phase 20.1 Plan 05 — /search accordion Wishlist commit + Pitfall 2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetVerdict.mockResolvedValue({ success: true, data: fixtureVerdict })
    mockAddWatch.mockResolvedValue({ success: true, data: { id: 'w-new' } })
  })

  it('ADD-06 Wishlist commit — clicking "Add to Wishlist" calls addWatch with status="wishlist" + brand/model + toast.success fires', async () => {
    render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    // Expand the accordion row.
    fireEvent.click(screen.getByRole('button', { name: /Toggle fit for Omega Speedmaster/i }))
    // Wait for verdict mock to resolve and CFC to render.
    await waitFor(() => screen.getByTestId('cfc'))

    // The Wishlist CTA is rendered inside Accordion.Panel by Plan 05.
    fireEvent.click(screen.getByRole('button', { name: 'Add to Wishlist' }))

    await waitFor(() => {
      expect(mockAddWatch).toHaveBeenCalledTimes(1)
    })
    const arg = mockAddWatch.mock.calls[0]![0] as Record<string, unknown>
    expect(arg).toMatchObject({
      status: 'wishlist',
      brand: 'Omega',
      model: 'Speedmaster',
    })
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it('ADD-06 Collection navigate — clicking "Add to Collection" calls router.push("/watch/new?catalogId=...&intent=owned"); addWatch NOT called', async () => {
    render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Toggle fit for Omega Speedmaster/i }))
    await waitFor(() => screen.getByTestId('cfc'))

    fireEvent.click(screen.getByRole('button', { name: 'Add to Collection' }))

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalled()
    })
    const url = mockRouterPush.mock.calls[0]![0] as string
    expect(url).toMatch(/\/watch\/new\?catalogId=cat-row-uuid/)
    expect(url).toMatch(/intent=owned/)
    expect(mockAddWatch).not.toHaveBeenCalled()
  })

  it('Pitfall 2 — clicking "Add to Wishlist" inside Accordion.Panel does NOT toggle the parent Accordion item closed (stopPropagation)', async () => {
    render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    // Expand the accordion row.
    fireEvent.click(screen.getByRole('button', { name: /Toggle fit for Omega Speedmaster/i }))
    await waitFor(() => screen.getByTestId('cfc'))

    // Click the inline Wishlist CTA.
    fireEvent.click(screen.getByRole('button', { name: 'Add to Wishlist' }))

    // Pitfall 2: panel must remain open after CTA click — CFC still rendered.
    expect(screen.getByTestId('cfc')).toBeInTheDocument()
  })
})
