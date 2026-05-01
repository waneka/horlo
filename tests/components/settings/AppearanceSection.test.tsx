// Phase 23 Plan 01 — Wave 0 RED scaffold for SET-10 (D-05 + D-07).
//
// Asserts that <AppearanceSection> renders:
//   1. A SettingsSection with heading "Theme" (NOT the legacy "Appearance" heading)
//   2. The legacy "coming in the next update" stub copy is GONE
//   3. The Light / Dark / System segmented control (InlineThemeSegmented) is mounted
//   4. No explanatory <p> sibling under the h2 (D-05 — no extra copy)
//
// This file MUST FAIL today: AppearanceSection currently renders heading
// "Appearance" + the Palette stub copy. Plan 03 makes this GREEN by replacing
// the stub with <SettingsSection title="Theme"><InlineThemeSegmented /></...>.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AppearanceSection } from '@/components/settings/AppearanceSection'

describe('<AppearanceSection> — Phase 23 SET-10 (Wave 0 RED scaffold)', () => {
  it('renders SettingsSection with heading "Theme"', () => {
    render(<AppearanceSection />)
    expect(screen.getByRole('heading', { name: 'Theme' })).toBeInTheDocument()
  })

  it('does NOT render the legacy "coming in the next update" stub copy', () => {
    render(<AppearanceSection />)
    expect(
      screen.queryByText(
        /theme and visual preferences are coming in the next update/i,
      ),
    ).toBeNull()
  })

  it('renders the Light/Dark/System segmented control (InlineThemeSegmented)', () => {
    render(<AppearanceSection />)
    // InlineThemeSegmented exposes three <button>s with aria-label set to
    // "Light" / "Dark" / "System" (see src/components/layout/InlineThemeSegmented.tsx:44).
    // aria-label is the accessible name, so getByRole('button', { name }) resolves it.
    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'System' })).toBeInTheDocument()
  })

  it('does NOT render any explanatory <CardDescription> under "Theme" (D-05 — no extra copy)', () => {
    const { container } = render(<AppearanceSection />)
    // SettingsSection h2 has no description sibling; assert no descendant <p>
    // sits as the immediate next sibling of the h2.
    expect(container.querySelector('h2 + p')).toBeNull()
  })
})
