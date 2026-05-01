// Phase 23 Plan 01 — Wave 0 RED scaffold for SET-07/08 (D-02 + D-04).
//
// Asserts that <PreferencesClient embedded={true}>:
//   1. Suppresses the page-chrome <h1>Preferences</h1>
//   2. Suppresses the page subtitle
//   3. Drops the "Collection Settings" Card (D-02 — Selects lifted to top Cards)
//   4. Drops both "Overlap Tolerance" and "Collection Goal" Labels (D-02)
//   5. Still renders the taste-tag pickers (Style Preferences card)
//
// This file MUST FAIL today: PreferencesClient does not yet accept an
// `embedded` prop, and the "Collection Settings" Card with both Selects is
// still rendered. Plan 02 makes this GREEN by adding the prop and lifting
// the Selects to the new top Cards in PreferencesSection.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock savePreferences so the rendered Selects do not attempt a real
// network call on mount (they don't, but defensive — PreferencesClient
// imports it at module top).
vi.mock('@/app/actions/preferences', () => ({
  savePreferences: vi.fn(async () => ({ success: true, data: undefined })),
}))

import { PreferencesClient } from '@/components/preferences/PreferencesClient'
import type { UserPreferences } from '@/lib/types'

// Match the real UserPreferences shape from src/lib/types.ts (no userId field).
const stubPrefs: UserPreferences = {
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

describe('<PreferencesClient embedded> — Phase 23 D-02 / D-04 (Wave 0 RED scaffold)', () => {
  it('does NOT render the page <h1>Preferences</h1> chrome when embedded={true}', () => {
    // @ts-expect-error — `embedded` prop does not exist yet (Plan 02 adds it).
    render(<PreferencesClient preferences={stubPrefs} embedded />)
    expect(
      screen.queryByRole('heading', { level: 1, name: /preferences/i }),
    ).toBeNull()
  })

  it('does NOT render the page subtitle when embedded={true}', () => {
    // @ts-expect-error — `embedded` prop does not exist yet.
    render(<PreferencesClient preferences={stubPrefs} embedded />)
    expect(
      screen.queryByText(
        /configure your collecting taste to get personalized insights/i,
      ),
    ).toBeNull()
  })

  it('does NOT render a "Collection Settings" Card title (D-02 — Selects lifted to top Cards)', () => {
    // @ts-expect-error — `embedded` prop does not exist yet.
    render(<PreferencesClient preferences={stubPrefs} embedded />)
    expect(screen.queryByText('Collection Settings')).toBeNull()
  })

  it('does NOT render an "Overlap Tolerance" or "Collection Goal" Label (D-02 — moved out)', () => {
    // @ts-expect-error — `embedded` prop does not exist yet.
    render(<PreferencesClient preferences={stubPrefs} embedded />)
    expect(screen.queryByText(/overlap tolerance/i)).toBeNull()
    expect(screen.queryByText(/collection goal/i)).toBeNull()
  })

  it('STILL renders the taste-tag pickers (Style Preferences card remains)', () => {
    // @ts-expect-error — `embedded` prop does not exist yet.
    render(<PreferencesClient preferences={stubPrefs} embedded />)
    expect(screen.getByText(/style preferences/i)).toBeInTheDocument()
  })
})
