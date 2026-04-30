import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

const { mockServerAction, mockToastError } = vi.hoisted(() => ({
  mockServerAction: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('@/app/actions/verdict', () => ({
  getVerdictForCatalogWatch: mockServerAction,
}))
vi.mock('sonner', () => ({ toast: { error: mockToastError } }))
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import { WatchSearchRowsAccordion } from '@/components/search/WatchSearchRowsAccordion'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

const buildResult = (id: string, brand: string, model: string): SearchCatalogWatchResult => ({
  catalogId: id, brand, model, reference: null, imageUrl: null,
  ownersCount: 0, wishlistCount: 0, viewerState: null,
})

const fakeBundle = {
  framing: 'cross-user' as const,
  label: 'core-fit' as const,
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: ['Highly aligned with your taste'],
  mostSimilar: [],
  roleOverlap: false,
}

describe('FIT-04 D-05 WatchSearchRowsAccordion (Plan 05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockServerAction.mockResolvedValue({ success: true, data: fakeBundle })
  })

  it('clicking a row trigger expands its panel and renders <CollectionFitCard>', async () => {
    const user = userEvent.setup()
    render(
      <WatchSearchRowsAccordion
        results={[buildResult('c1', 'Rolex', 'Submariner')]}
        q="rolex"
        collectionRevision={3}
      />,
    )
    const trigger = screen.getByRole('button', { name: /Evaluate Rolex Submariner/ })
    await user.click(trigger)
    await waitFor(() => expect(screen.getByText('Collection Fit')).toBeInTheDocument())
  })

  it('opening a second row collapses the first (one-at-a-time, multiple=false default)', async () => {
    const user = userEvent.setup()
    const results = [buildResult('c1', 'Rolex', 'Sub'), buildResult('c2', 'Omega', 'Speed')]
    render(<WatchSearchRowsAccordion results={results} q="" collectionRevision={3} />)
    const triggers = screen.getAllByRole('button')
    await user.click(triggers[0])
    await waitFor(() => expect(mockServerAction).toHaveBeenCalledTimes(1))
    await user.click(triggers[1])
    // second expand fires a second Server Action (for the second item)
    await waitFor(() => expect(mockServerAction).toHaveBeenCalledTimes(2))
    // only the second card should be visible (first collapsed)
    await waitFor(() => {
      const cards = screen.getAllByText('Collection Fit')
      expect(cards.length).toBe(1)
    })
  })

  it('ESC key collapses the open row', async () => {
    const user = userEvent.setup()
    render(
      <WatchSearchRowsAccordion
        results={[buildResult('c1', 'Rolex', 'Sub')]}
        q=""
        collectionRevision={3}
      />,
    )
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    await waitFor(() => expect(screen.getByText('Collection Fit')).toBeInTheDocument())
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByText('Collection Fit')).not.toBeInTheDocument(),
    )
  })

  it('Tab key moves focus between row triggers without entering panel content', async () => {
    const user = userEvent.setup()
    const results = [buildResult('c1', 'A', 'B'), buildResult('c2', 'C', 'D')]
    render(<WatchSearchRowsAccordion results={results} q="" collectionRevision={3} />)
    const triggers = screen.getAllByRole('button')
    triggers[0].focus()
    await user.tab()
    expect(triggers[1]).toHaveFocus()
  })

  it('chevron rotates 180deg when row is open (isOpen=true passed to WatchSearchRow)', async () => {
    const user = userEvent.setup()
    render(
      <WatchSearchRowsAccordion
        results={[buildResult('c1', 'A', 'B')]}
        q=""
        collectionRevision={3}
      />,
    )
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    // base-ui sets aria-expanded="true" on the trigger when open
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'))
    // isOpen=true is confirmed by the "Hide" label being rendered (from WatchSearchRow)
    await waitFor(() => expect(screen.getByText('Hide')).toBeInTheDocument())
  })

  it('button label toggles "Evaluate" → "Hide" via isOpen prop', async () => {
    const user = userEvent.setup()
    render(
      <WatchSearchRowsAccordion
        results={[buildResult('c1', 'A', 'B')]}
        q=""
        collectionRevision={3}
      />,
    )
    expect(screen.getByText('Evaluate')).toBeInTheDocument()
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    await waitFor(() => expect(screen.getByText('Hide')).toBeInTheDocument())
    expect(screen.queryByText('Evaluate')).not.toBeInTheDocument()
  })

  it('first expand fires getVerdictForCatalogWatch Server Action', async () => {
    const user = userEvent.setup()
    render(
      <WatchSearchRowsAccordion
        results={[buildResult('c1', 'A', 'B')]}
        q=""
        collectionRevision={3}
      />,
    )
    await user.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(mockServerAction).toHaveBeenCalledWith({ catalogId: 'c1' }),
    )
  })

  it('re-expand of same row uses cache (no second Server Action call)', async () => {
    const user = userEvent.setup()
    render(
      <WatchSearchRowsAccordion
        results={[buildResult('c1', 'A', 'B')]}
        q=""
        collectionRevision={3}
      />,
    )
    const trigger = screen.getByRole('button')
    await user.click(trigger) // expand → fires Server Action
    await waitFor(() => expect(mockServerAction).toHaveBeenCalledTimes(1))
    await user.click(trigger) // collapse
    await user.click(trigger) // re-expand → cache hit
    // Server Action still called only once
    expect(mockServerAction).toHaveBeenCalledTimes(1)
  })

  it('shows <VerdictSkeleton /> (animate-pulse elements) while Server Action is pending', async () => {
    let resolveAction!: (v: unknown) => void
    mockServerAction.mockReturnValue(
      new Promise((res) => {
        resolveAction = res
      }),
    )
    const user = userEvent.setup()
    render(
      <WatchSearchRowsAccordion
        results={[buildResult('c1', 'A', 'B')]}
        q=""
        collectionRevision={3}
      />,
    )
    await user.click(screen.getByRole('button'))
    // Skeleton should be visible while the promise is unresolved.
    await waitFor(() => {
      const pulses = document.querySelectorAll('[class*="animate-pulse"]')
      expect(pulses.length).toBeGreaterThan(0)
    })
    // Resolve so there are no hanging promises
    resolveAction({ success: true, data: fakeBundle })
  })

  it('Sonner toast fires on Server Action error and panel collapses', async () => {
    mockServerAction.mockResolvedValue({ success: false, error: 'Watch not found' })
    const user = userEvent.setup()
    render(
      <WatchSearchRowsAccordion
        results={[buildResult('c1', 'A', 'B')]}
        q=""
        collectionRevision={3}
      />,
    )
    await user.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('This watch is no longer available.'),
    )
    expect(screen.queryByText('Collection Fit')).not.toBeInTheDocument()
  })
})
