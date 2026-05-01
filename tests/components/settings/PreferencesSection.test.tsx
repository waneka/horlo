import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { UserPreferences } from '@/lib/types'

// ---------------------------------------------------------------------------
// Phase 22 D-01 — PreferencesSection embeds existing PreferencesClient
// unchanged inside the Preferences tab. Mock PreferencesClient so the test
// can capture its props and assert prop pass-through without rendering
// the full preferences surface.
// ---------------------------------------------------------------------------

let capturedProps: { preferences: UserPreferences } | null = null
vi.mock('@/components/preferences/PreferencesClient', () => ({
  PreferencesClient: (props: { preferences: UserPreferences }) => {
    capturedProps = props
    return <div data-testid="prefs-client">PreferencesClient stub</div>
  },
}))

// Import AFTER mock.
import { PreferencesSection } from '@/components/settings/PreferencesSection'

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
} as unknown as UserPreferences

describe('PreferencesSection — Phase 22 D-01 embed', () => {
  beforeEach(() => {
    capturedProps = null
  })

  it('embeds PreferencesClient unchanged — preferences prop passes through', () => {
    render(<PreferencesSection preferences={stubPrefs} />)
    expect(screen.getByTestId('prefs-client')).toBeInTheDocument()
    expect(capturedProps?.preferences).toBe(stubPrefs)
  })

  it('does not double-wrap PreferencesClient in an outer card', () => {
    const { container } = render(<PreferencesSection preferences={stubPrefs} />)
    // First child is the mocked PreferencesClient div directly — no wrapper
    // div with bg-card / border classes around it.
    const wrapper = container.firstChild as HTMLElement | null
    if (wrapper) {
      expect(wrapper.className ?? '').not.toMatch(/\bbg-card\b/)
      expect(wrapper.className ?? '').not.toMatch(/\bborder\b/)
    }
  })
})
