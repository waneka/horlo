/**
 * Phase 20.1 Plan 01 (Wave 0) — RED test scaffold for WatchSearchRowsAccordion CTAs.
 *
 * Covers ADD-06 unit-level: 3 CTAs render inside Accordion.Panel after verdict
 * resolves; Hide button collapses the panel; Pitfall 2 stopPropagation on CTAs.
 *
 * RED until Plan 05 modifies WatchSearchRowsAccordion to render the CTAs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockGetVerdict, mockAddWatch, mockRouterPush } = vi.hoisted(() => ({
  mockGetVerdict: vi.fn(),
  mockAddWatch: vi.fn(),
  mockRouterPush: vi.fn(),
}))

vi.mock('@/app/actions/verdict', () => ({ getVerdictForCatalogWatch: mockGetVerdict }))
vi.mock('@/app/actions/watches', () => ({ addWatch: mockAddWatch }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, refresh: vi.fn() }),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/insights/CollectionFitCard', () => ({
  CollectionFitCard: ({ verdict }: { verdict: { headlinePhrasing?: string } }) => (
    <div data-testid="cfc">{verdict.headlinePhrasing}</div>
  ),
}))
vi.mock('@/components/insights/VerdictSkeleton', () => ({
  VerdictSkeleton: () => <div data-testid="vskel" />,
}))

// IMPORT UNDER TEST — Plan 05 will add the 3 CTAs inside Accordion.Panel.
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

const fixtureVerdictCrossUser = {
  framing: 'cross-user' as const,
  label: 'core-fit' as const,
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: ['ok'],
  mostSimilar: [],
  roleOverlap: false,
}

describe('Phase 20.1 Plan 05 — WatchSearchRowsAccordion CTAs (ADD-06 + Pitfall 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetVerdict.mockResolvedValue({ success: true, data: fixtureVerdictCrossUser })
    mockAddWatch.mockResolvedValue({ success: true, data: { id: 'w-new' } })
  })

  it('renders all 3 CTAs (Add to Wishlist, Add to Collection, Hide) inside Accordion.Panel after verdict resolves', async () => {
    render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Evaluate Omega Speedmaster/i }))
    await waitFor(() => screen.getByTestId('cfc'))

    expect(screen.getByRole('button', { name: 'Add to Wishlist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to Collection' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument()
  })

  it('Pitfall 2 — clicking "Add to Wishlist" does NOT close the accordion panel (stopPropagation)', async () => {
    render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Evaluate Omega Speedmaster/i }))
    await waitFor(() => screen.getByTestId('cfc'))

    fireEvent.click(screen.getByRole('button', { name: 'Add to Wishlist' }))
    // Panel still rendered → CFC mock still in DOM.
    expect(screen.getByTestId('cfc')).toBeInTheDocument()
  })

  it('"Hide" button collapses the panel — CTAs and CollectionFitCard disappear from DOM', async () => {
    render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Evaluate Omega Speedmaster/i }))
    await waitFor(() => screen.getByTestId('cfc'))

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Add to Wishlist' })).toBeNull()
    })
  })

  it('UAT gap 5 — clicking row sets data-open attribute on Accordion.Panel (asserts base-ui DOM contract)', async () => {
    const { container } = render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    // Pre-click: Accordion.Panel (identified by aria-labelledby — distinct from
    // the Accordion.Root wrapper which also has role="region" but no aria-labelledby)
    // is not yet mounted by base-ui; only the Root wrapper exists.
    const panelBefore = container.querySelector('[role="region"][aria-labelledby]')
    expect(panelBefore).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Evaluate Omega Speedmaster/i }))
    await waitFor(() => screen.getByTestId('cfc'))

    // Post-click: base-ui mounts AccordionPanel with data-open="" (no value attribute)
    const panelAfter = container.querySelector('[role="region"][aria-labelledby]')
    expect(panelAfter).not.toBeNull()
    expect(panelAfter?.hasAttribute('data-open')).toBe(true)
  })

  it('UAT gap 5 — Accordion.Panel className uses data-[open]: selectors (NOT data-[state=open]:)', async () => {
    // Reads the raw className from a rendered panel and confirms the selectors
    // match base-ui's actual data attribute. This guards against re-introducing
    // the data-[state=open]: selectors that never matched.
    // Panel only mounts AFTER trigger click — base-ui lazy-mounts the panel.
    const { container } = render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Evaluate Omega Speedmaster/i }))
    await waitFor(() => screen.getByTestId('cfc'))

    const panel = container.querySelector(
      '[role="region"][aria-labelledby]',
    ) as HTMLElement | null
    expect(panel).not.toBeNull()
    const cls = panel?.className ?? ''
    // Anti-regression — these selectors do NOT exist in base-ui's data attribute set
    expect(cls).not.toMatch(/data-\[state=open\]/)
    expect(cls).not.toMatch(/data-\[state=closed\]/)
    // The new selector format DOES exist on base-ui
    expect(cls).toMatch(/data-\[open\]|not-data-\[open\]/)
  })
})
