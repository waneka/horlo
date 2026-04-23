import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — declared before component import so vitest hoists them.
// PrivacyToggleRow imports updateProfileSettings from '@/app/actions/profile'
// (a Server Action). The module is a client-safe reference but in unit tests
// we stub it so the dependency graph stays jsdom-compatible.
// ---------------------------------------------------------------------------
vi.mock('@/app/actions/profile', () => ({
  updateProfileSettings: vi.fn(async () => ({ success: true, data: undefined })),
}))

import { SettingsClient } from '@/components/settings/SettingsClient'

const defaults = {
  username: 'alice',
  settings: {
    profilePublic: true,
    collectionPublic: true,
    wishlistPublic: true,
    notifyOnFollow: true,
    notifyOnWatchOverlap: true,
  },
}

// Helper: the only SettingsSection that renders its title as an <h2> is the
// section heading itself (PrivacyToggleRow uses <p>). Using the heading role
// disambiguates "Collection" (section title) from "Collection" (privacy row
// label for collectionPublic).
function getSectionTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('h2')).map(
    (h) => h.textContent?.trim() ?? '',
  )
}

describe('SettingsClient — Collection section (Phase 14 D-12 NAV-11)', () => {
  it('renders the Collection section title', () => {
    render(<SettingsClient {...defaults} />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Collection' }),
    ).toBeInTheDocument()
  })

  it('renders the Taste Preferences row label', () => {
    render(<SettingsClient {...defaults} />)
    expect(screen.getByText('Taste Preferences')).toBeInTheDocument()
  })

  it('links Taste Preferences to /preferences', () => {
    render(<SettingsClient {...defaults} />)
    const link = screen.getByText('Taste Preferences').closest('a')
    expect(link).toHaveAttribute('href', '/preferences')
  })

  it('Collection section sits between Notifications and Appearance', () => {
    const { container } = render(<SettingsClient {...defaults} />)
    const titles = getSectionTitles(container)
    const notifIdx = titles.indexOf('Notifications')
    const collIdx = titles.indexOf('Collection')
    const apprIdx = titles.indexOf('Appearance')
    expect(notifIdx).toBeGreaterThan(-1)
    expect(collIdx).toBeGreaterThan(notifIdx)
    expect(apprIdx).toBeGreaterThan(collIdx)
  })

  it('regression: existing sections all render', () => {
    const { container } = render(<SettingsClient {...defaults} />)
    const titles = getSectionTitles(container)
    expect(titles).toContain('Privacy Controls')
    expect(titles).toContain('Notifications')
    expect(titles).toContain('Appearance')
    expect(titles).toContain('Data Preferences')
    expect(titles).toContain('Account')
  })

  it('Taste Preferences row has descriptive helper copy', () => {
    render(<SettingsClient {...defaults} />)
    const link = screen.getByText('Taste Preferences').closest('a')
    expect(link?.textContent ?? '').toMatch(/taste|preferences/i)
  })
})
