// Phase 23 Plan 01 — Wave 0 RED scaffold for FEAT-08 (D-11).
//
// Asserts that <WatchDetail> renders a Certification row inside the
// Specifications <dl> only when watch.isChronometer === true. The row
// MUST be hidden when the field is false, undefined, or null (legacy rows).
//
// This file MUST FAIL today: WatchDetail does not render a Certification
// row regardless of the field value. Plan 04 makes this GREEN by adding
// the only-if-true row after the productionYear entry in the spec list.
//
// Deviation from PLAN's literal scaffold: WatchDetail's real signature
// requires `collection`, `preferences`, `lastWornDate`, `viewerCanEdit`,
// and `verdict`. We provide minimal defaults so the component mounts
// without crashing — the scaffold's RED reason should be "no Certification
// row" not "missing required prop".

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Watch, UserPreferences } from '@/lib/types'

// Mock next/navigation — WatchDetail calls useRouter().
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}))

// Mock Server Actions (delete + flag-deal + mark-as-worn).
vi.mock('@/app/actions/watches', () => ({
  removeWatch: vi.fn(async () => ({ success: true, data: undefined })),
  editWatch: vi.fn(async () => ({ success: true, data: undefined })),
}))
vi.mock('@/app/actions/wearEvents', () => ({
  markAsWorn: vi.fn(async () => ({ success: true, data: undefined })),
}))

// Mock CollectionFitCard so we don't pull the verdict renderer's tree
// (irrelevant to the Certification-row assertion).
vi.mock('@/components/insights/CollectionFitCard', () => ({
  CollectionFitCard: () => null,
}))

// Import AFTER mocks.
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

describe('<WatchDetail> — Certification row (FEAT-08 / D-11, Wave 0 RED scaffold)', () => {
  it('renders a Certification row with "Chronometer" when watch.isChronometer === true', () => {
    render(
      <WatchDetail
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
      <WatchDetail
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
      <WatchDetail
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
      <WatchDetail
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
