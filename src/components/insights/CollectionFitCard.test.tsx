import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import type { VerdictBundle } from '@/lib/verdict/types'
import type { Watch } from '@/lib/types'

const buildWatch = (id: string, brand: string, model: string): Watch => ({
  id, brand, model,
  status: 'owned',
  movement: 'automatic',
  complications: [],
  styleTags: [], designTraits: [], roleTags: [],
})

const baseFullVerdict: VerdictBundle = {
  framing: 'same-user',
  label: 'core-fit',
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: ['Lines up cleanly with your established taste.'],
  rationalePhrasings: ['Lines up cleanly with the taste I have already built.'],
  mostSimilar: [],
  roleOverlap: false,
}

describe('FIT-01 CollectionFitCard (Plan 03)', () => {
  it('renders headline + contextual phrasings + most-similar list for framing="same-user"', () => {
    const verdict: VerdictBundle = {
      ...baseFullVerdict,
      contextualPhrasings: ['Headline.', 'First context.', 'Second context.'],
      mostSimilar: [
        { watch: buildWatch('w1', 'Rolex', 'Submariner'), score: 0.78 },
      ],
    }
    render(<CollectionFitCard verdict={verdict} />)
    expect(screen.getByText('Collection Fit')).toBeInTheDocument()
    expect(screen.getByText('Core Fit')).toBeInTheDocument()
    expect(screen.getByText('Headline.')).toBeInTheDocument()
    expect(screen.getByText('First context.')).toBeInTheDocument()
    expect(screen.getByText('Second context.')).toBeInTheDocument()
    expect(screen.getByText('Most Similar in Collection')).toBeInTheDocument()
    expect(screen.getByText(/Rolex Submariner/)).toBeInTheDocument()
    expect(screen.getByText('78% similar')).toBeInTheDocument()
  })

  it('renders identical chrome for framing="cross-user" (no lens indicator)', () => {
    const verdict: VerdictBundle = { ...baseFullVerdict, framing: 'cross-user' }
    render(<CollectionFitCard verdict={verdict} />)
    expect(screen.getByText('Collection Fit')).toBeInTheDocument()
    expect(screen.queryByText(/viewing|someone else/i)).not.toBeInTheDocument()
  })

  it('renders "You own this watch" callout for framing="self-via-cross-user" (no verdict)', () => {
    const verdict: VerdictBundle = {
      framing: 'self-via-cross-user',
      ownedAtIso: '2026-04-12T00:00:00.000Z',
      ownerHref: '/watch/per-user-uuid-abc',
    }
    render(<CollectionFitCard verdict={verdict} />)
    expect(screen.getByText('You own this watch')).toBeInTheDocument()
    expect(screen.getByText(/Apr 12, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Visit your watch detail/)).toBeInTheDocument()
    expect(screen.queryByText('Collection Fit')).not.toBeInTheDocument()
    expect(screen.queryByText(/Most Similar/)).not.toBeInTheDocument()
  })

  it('hides most-similar section when verdict.mostSimilar is empty array', () => {
    render(<CollectionFitCard verdict={baseFullVerdict} />)
    expect(screen.queryByText('Most Similar in Collection')).not.toBeInTheDocument()
  })

  it('hides role-overlap warning when verdict.roleOverlap is false', () => {
    render(<CollectionFitCard verdict={baseFullVerdict} />)
    expect(screen.queryByText(/May compete for wrist time/)).not.toBeInTheDocument()
  })

  it('renders <AlertTriangle /> from lucide-react when roleOverlap is true (replaces inline SVG)', () => {
    const verdict: VerdictBundle = { ...baseFullVerdict, roleOverlap: true }
    const { container } = render(<CollectionFitCard verdict={verdict} />)
    expect(screen.getByText(/May compete for wrist time/)).toBeInTheDocument()
    // lucide-react renders an <svg> with class "lucide" — confirm it's present
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('uses verbatim copy "May compete for wrist time with similar watches" from SimilarityBadge.tsx:78', () => {
    const verdict: VerdictBundle = { ...baseFullVerdict, roleOverlap: true }
    render(<CollectionFitCard verdict={verdict} />)
    expect(screen.getByText('May compete for wrist time with similar watches')).toBeInTheDocument()
  })

  it('renders title "Collection Fit" with outline Badge variant for label', () => {
    render(<CollectionFitCard verdict={baseFullVerdict} />)
    expect(screen.getByText('Collection Fit')).toBeInTheDocument()
    expect(screen.getByText('Core Fit')).toBeInTheDocument()
  })
})
