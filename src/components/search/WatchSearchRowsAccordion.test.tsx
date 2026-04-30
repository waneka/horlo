/**
 * Phase 20.1 — WatchSearchRowsAccordion CTAs (ADD-06 + Pitfall 2 + UAT gap 5).
 *
 * Post-gap-5 follow-up:
 *   - Trigger is the right-edge chevron only (not the whole row).
 *     aria-label = "Toggle fit for {brand} {model}".
 *   - Row body is a <Link> to /catalog/[catalogId] (primary action).
 *   - "Hide" CTA removed — collapsing is handled by clicking the chevron again.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockGetVerdict, mockAddWatch, mockRouterPush } = vi.hoisted(() => ({
  mockGetVerdict: vi.fn(),
  mockAddWatch: vi.fn(),
  mockRouterPush: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
    width,
    height,
  }: {
    src: string
    alt: string
    className?: string
    width?: number
    height?: number
  }) => (
    <img src={src} alt={alt} className={className} width={width} height={height} />
  ),
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

describe('WatchSearchRowsAccordion CTAs (ADD-06 + Pitfall 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetVerdict.mockResolvedValue({ success: true, data: fixtureVerdictCrossUser })
    mockAddWatch.mockResolvedValue({ success: true, data: { id: 'w-new' } })
  })

  it('renders 2 CTAs (Add to Wishlist, Add to Collection) inside Accordion.Panel after verdict resolves; no Hide button', async () => {
    render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Toggle fit for Omega Speedmaster/i }))
    await waitFor(() => screen.getByTestId('cfc'))

    expect(screen.getByRole('button', { name: 'Add to Wishlist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to Collection' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull()
  })

  it('Pitfall 2 — clicking "Add to Wishlist" does NOT close the accordion panel (stopPropagation)', async () => {
    render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Toggle fit for Omega Speedmaster/i }))
    await waitFor(() => screen.getByTestId('cfc'))

    fireEvent.click(screen.getByRole('button', { name: 'Add to Wishlist' }))
    expect(screen.getByTestId('cfc')).toBeInTheDocument()
  })

  it('chevron toggle — clicking the trigger again collapses the panel (CTAs disappear)', async () => {
    render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    const trigger = screen.getByRole('button', { name: /Toggle fit for Omega Speedmaster/i })
    fireEvent.click(trigger)
    await waitFor(() => screen.getByTestId('cfc'))

    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Add to Wishlist' })).toBeNull()
    })
  })

  it('UAT gap 5 — clicking trigger sets data-open attribute on Accordion.Panel (asserts base-ui DOM contract)', async () => {
    const { container } = render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    const panelBefore = container.querySelector('[role="region"][aria-labelledby]')
    expect(panelBefore).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Toggle fit for Omega Speedmaster/i }))
    await waitFor(() => screen.getByTestId('cfc'))

    const panelAfter = container.querySelector('[role="region"][aria-labelledby]')
    expect(panelAfter).not.toBeNull()
    expect(panelAfter?.hasAttribute('data-open')).toBe(true)
  })

  it('UAT gap 5 — Accordion.Panel className uses data-[open]: selectors (NOT data-[state=open]:)', async () => {
    const { container } = render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Toggle fit for Omega Speedmaster/i }))
    await waitFor(() => screen.getByTestId('cfc'))

    const panel = container.querySelector(
      '[role="region"][aria-labelledby]',
    ) as HTMLElement | null
    expect(panel).not.toBeNull()
    const cls = panel?.className ?? ''
    expect(cls).not.toMatch(/data-\[state=open\]/)
    expect(cls).not.toMatch(/data-\[state=closed\]/)
    expect(cls).toMatch(/data-\[open\]|not-data-\[open\]/)
  })

  it('row body navigates to /catalog/[catalogId] (split affordance — link is separate from chevron trigger)', () => {
    const { container } = render(
      <WatchSearchRowsAccordion
        results={[fixtureRow]}
        q=""
        collectionRevision={1}
      />,
    )
    const link = container.querySelector('a[href="/catalog/cat-row-uuid"]')
    expect(link).not.toBeNull()
  })
})
