/**
 * Phase 20.1 Plan 01 (Wave 0) — RED test scaffold for VerdictStep.
 *
 * Covers verdict-ready visuals: spec preview + CollectionFitCard + 3 buttons +
 * D-06 empty-collection fallback.
 *
 * RED until Plan 03 ships `@/components/watch/VerdictStep`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/components/insights/CollectionFitCard', () => ({
  CollectionFitCard: ({ verdict }: { verdict: { headlinePhrasing?: string } }) => (
    <div data-testid="cfc">{verdict.headlinePhrasing}</div>
  ),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))

// IMPORT UNDER TEST — Plan 03 ships this.
import { VerdictStep } from '@/components/watch/VerdictStep'
import type { VerdictBundleFull } from '@/lib/verdict/types'
import type { ExtractedWatchData } from '@/lib/extractors/types'

const fixtureExtracted: ExtractedWatchData = {
  brand: 'Omega',
  model: 'Speedmaster',
  imageUrl: 'https://example.com/spd.jpg',
}

const fixtureVerdict: VerdictBundleFull = {
  framing: 'cross-user',
  label: 'core-fit',
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: ['Lines up cleanly with your established taste.'],
  mostSimilar: [],
  roleOverlap: false,
}

describe('Phase 20.1 Plan 03 — VerdictStep verdict-ready render', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders spec preview brand+model, the CollectionFitCard headline, and 3 named buttons', () => {
    render(
      <VerdictStep
        extracted={fixtureExtracted}
        verdict={fixtureVerdict}
        hasCollection={true}
        pending={false}
        pendingTarget={null}
        onWishlist={() => {}}
        onCollection={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByText('Omega Speedmaster')).toBeInTheDocument()
    expect(screen.getByTestId('cfc')).toHaveTextContent('Core Fit')
    expect(screen.getByRole('button', { name: 'Add to Wishlist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to Collection' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  })

  it('D-06 empty collection — verdict=null hides CollectionFitCard, shows fallback copy, all 3 buttons still render', () => {
    render(
      <VerdictStep
        extracted={fixtureExtracted}
        verdict={null}
        hasCollection={false}
        pending={false}
        pendingTarget={null}
        onWishlist={() => {}}
        onCollection={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.queryByTestId('cfc')).not.toBeInTheDocument()
    expect(
      screen.getByText('Your collection is empty — fit score not available yet.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to Wishlist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to Collection' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  })

  it('clicking each of the 3 buttons fires the matching handler exactly once', () => {
    const onWishlist = vi.fn()
    const onCollection = vi.fn()
    const onSkip = vi.fn()
    render(
      <VerdictStep
        extracted={fixtureExtracted}
        verdict={fixtureVerdict}
        hasCollection={true}
        pending={false}
        pendingTarget={null}
        onWishlist={onWishlist}
        onCollection={onCollection}
        onSkip={onSkip}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add to Wishlist' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to Collection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onWishlist).toHaveBeenCalledTimes(1)
    expect(onCollection).toHaveBeenCalledTimes(1)
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('pending=true with pendingTarget="wishlist" — Wishlist shows Saving... and all 3 buttons disabled', () => {
    render(
      <VerdictStep
        extracted={fixtureExtracted}
        verdict={fixtureVerdict}
        hasCollection={true}
        pending={true}
        pendingTarget="wishlist"
        onWishlist={() => {}}
        onCollection={() => {}}
        onSkip={() => {}}
      />,
    )
    // Wishlist button copy reflects pending state (D-13 standard pending pattern).
    // The aria-label stays "Add to Wishlist" so screen readers identify the action;
    // the visible text changes to "Saving..." — match by visible text content.
    expect(screen.getByText(/Saving/i)).toBeInTheDocument()
    // All 3 buttons are disabled when any is pending.
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(3)
    buttons.forEach((b) => expect(b).toBeDisabled())
  })
})

/**
 * Phase 20.1 Plan 06 — UAT gap 1 RED tests.
 *
 * Codify the empty-vs-failed-fit copy split: when verdict is null we must
 * distinguish "viewer has no collection yet" (D-06 honest empty state) from
 * "verdict computation failed but viewer's collection is non-empty" (silent
 * upstream failure surfaced honestly per Pitfall 8).
 */
describe('VerdictStep — empty-vs-failed-fit copy split (UAT gap 1)', () => {
  it('renders empty-collection copy when verdict=null AND hasCollection=false', () => {
    render(
      <VerdictStep
        extracted={fixtureExtracted}
        verdict={null}
        hasCollection={false}
        pending={false}
        pendingTarget={null}
        onWishlist={() => {}}
        onCollection={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByText(/collection is empty/i)).toBeInTheDocument()
    expect(screen.queryByText(/Couldn't compute fit/i)).not.toBeInTheDocument()
  })

  it("renders 'Couldn't compute fit' copy when verdict=null AND hasCollection=true", () => {
    render(
      <VerdictStep
        extracted={fixtureExtracted}
        verdict={null}
        hasCollection={true}
        pending={false}
        pendingTarget={null}
        onWishlist={() => {}}
        onCollection={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByText(/Couldn't compute fit/i)).toBeInTheDocument()
    expect(screen.queryByText(/collection is empty/i)).not.toBeInTheDocument()
  })

  it('renders CollectionFitCard when verdict is non-null (regardless of hasCollection)', () => {
    render(
      <VerdictStep
        extracted={fixtureExtracted}
        verdict={fixtureVerdict}
        hasCollection={true}
        pending={false}
        pendingTarget={null}
        onWishlist={() => {}}
        onCollection={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByTestId('cfc')).toBeInTheDocument()
  })
})
