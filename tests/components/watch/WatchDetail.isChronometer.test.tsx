// tests/components/watch/WatchDetail.isChronometer.test.tsx
//
// Phase 23 Plan 01 RED scaffold for FEAT-08 detail row (locked copy from UI-SPEC § Copywriting Contract).
// Plan 04 turns this GREEN by adding the only-if-true Certification row to WatchDetail.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Watch, UserPreferences } from '@/lib/types'

// Mock next/navigation (WatchDetail calls useRouter)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))

// Mock server actions (WatchDetail calls them; we never trigger them in these tests)
vi.mock('@/app/actions/watches', () => ({
  removeWatch: vi.fn(),
  editWatch: vi.fn(),
}))
vi.mock('@/app/actions/wearEvents', () => ({
  markAsWorn: vi.fn(),
}))

// Mock CollectionFitCard (verdict prop is null in our fixtures so it never renders, but
// the import exists at the top of the module).
vi.mock('@/components/insights/CollectionFitCard', () => ({
  CollectionFitCard: () => <div data-testid="collection-fit-card" />,
}))

import { WatchDetail } from '@/components/watch/WatchDetail'

const baseWatch: Watch = {
  id: 'w1',
  brand: 'Rolex',
  model: 'Datejust',
  reference: '',
  status: 'owned',
  movement: 'automatic',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
  notes: '',
  imageUrl: '',
}

const stubPrefs: UserPreferences = {
  userId: 'u1',
  preferredStyles: [],
  dislikedStyles: [],
  preferredDesignTraits: [],
  dislikedDesignTraits: [],
  preferredComplications: [],
  complicationExceptions: [],
  preferredDialColors: [],
  dislikedDialColors: [],
  overlapTolerance: 'medium',
  notes: '',
} as unknown as UserPreferences

describe('<WatchDetail> — Certification row (FEAT-08 / D-11)', () => {
  it('renders a Certification row with "Chronometer" when watch.isChronometer === true', () => {
    render(
      <WatchDetail
        watch={{ ...baseWatch, isChronometer: true }}
        collection={[]}
        preferences={stubPrefs}
      />,
    )
    expect(screen.getByText('Certification')).toBeInTheDocument()
    expect(screen.getByText('Chronometer')).toBeInTheDocument()
  })

  it('does NOT render the Certification row when watch.isChronometer === false', () => {
    render(
      <WatchDetail
        watch={{ ...baseWatch, isChronometer: false }}
        collection={[]}
        preferences={stubPrefs}
      />,
    )
    expect(screen.queryByText('Certification')).toBeNull()
    expect(screen.queryByText('Chronometer')).toBeNull()
  })

  it('does NOT render the Certification row when watch.isChronometer is undefined (legacy row)', () => {
    render(
      <WatchDetail
        watch={baseWatch}
        collection={[]}
        preferences={stubPrefs}
      />,
    )
    expect(screen.queryByText('Certification')).toBeNull()
  })

  it('does NOT render the Certification row when watch.isChronometer is null (legacy DB row)', () => {
    // @ts-expect-error — null mirrors a DB row written before the column existed
    render(
      <WatchDetail
        watch={{ ...baseWatch, isChronometer: null }}
        collection={[]}
        preferences={stubPrefs}
      />,
    )
    expect(screen.queryByText('Certification')).toBeNull()
  })
})
