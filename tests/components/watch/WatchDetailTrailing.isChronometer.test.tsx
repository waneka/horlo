// quick-260912-jo6 (WR-01) — migrates the Phase 23 FEAT-08/D-11
// Certification-row coverage from the deleted legacy `WatchDetail.tsx` onto
// `WatchDetailTrailing`, the component `/w/[ref]` actually renders. The old
// file targeted an unrendered island since Phase 64 (WatchDetailHero +
// WatchDetailTrailing replaced it); this file is the live-component
// equivalent.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Watch, UserPreferences } from '@/lib/types'
import { WatchDetailTrailing } from '@/components/watch/WatchDetailTrailing'

const baseWatch: Watch = {
  id: 'w1',
  brand: 'Rolex',
  model: 'Datejust',
  reference: '',
  status: 'owned',
  movement: 'auto',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
  notes: '',
  imageUrl: '',
}

const basePreferences: UserPreferences = {
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
}

describe('<WatchDetailTrailing> — Certification row (FEAT-08 / D-11)', () => {
  it('renders a Certification row with "Chronometer" when watch.isChronometer === true', () => {
    render(
      <WatchDetailTrailing
        watch={{ ...baseWatch, isChronometer: true }}
        collection={[]}
        preferences={basePreferences}
        verdict={null}
      />,
    )
    expect(screen.getByText('Certification')).toBeInTheDocument()
    expect(screen.getByText('Chronometer')).toBeInTheDocument()
  })

  it('does NOT render the Certification row when watch.isChronometer === false', () => {
    render(
      <WatchDetailTrailing
        watch={{ ...baseWatch, isChronometer: false }}
        collection={[]}
        preferences={basePreferences}
        verdict={null}
      />,
    )
    expect(screen.queryByText('Certification')).toBeNull()
    expect(screen.queryByText('Chronometer')).toBeNull()
  })

  it('does NOT render the Certification row when watch.isChronometer is undefined', () => {
    render(
      <WatchDetailTrailing
        watch={baseWatch}
        collection={[]}
        preferences={basePreferences}
        verdict={null}
      />,
    )
    expect(screen.queryByText('Certification')).toBeNull()
  })

  it('does NOT render the Certification row when watch.isChronometer is null (legacy row)', () => {
    render(
      <WatchDetailTrailing
        // null mirrors a DB row written before the column existed; the type
        // declares boolean | undefined, but DB nullability surfaces here at runtime.
        watch={{ ...baseWatch, isChronometer: null as unknown as boolean }}
        collection={[]}
        preferences={basePreferences}
        verdict={null}
      />,
    )
    expect(screen.queryByText('Certification')).toBeNull()
  })
})
