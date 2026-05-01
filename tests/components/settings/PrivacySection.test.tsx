import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Phase 22 D-01 — Privacy migration GREEN tests.
// PrivacyToggleRow imports updateProfileSettings from '@/app/actions/profile'
// (a Server Action). Stub it so jsdom dependency graph stays clean and we
// can assert call args.
// ---------------------------------------------------------------------------

// vi.mock factories are hoisted to the top of the file; bare const refs from
// the module scope would not be initialized in time. Use vi.hoisted to lift
// the spy alongside the mock factory.
const { updateMock } = vi.hoisted(() => ({
  updateMock: vi.fn(async () => ({ success: true, data: undefined })),
}))
vi.mock('@/app/actions/profile', () => ({
  updateProfileSettings: updateMock,
}))

// Import AFTER mock.
import { PrivacySection } from '@/components/settings/PrivacySection'

const settings = {
  profilePublic: true,
  collectionPublic: true,
  wishlistPublic: true,
}

describe('PrivacySection — Phase 22 D-01 migration', () => {
  beforeEach(() => {
    updateMock.mockClear()
    updateMock.mockResolvedValue({ success: true, data: undefined })
  })

  it('renders 3 PrivacyToggleRow instances — profilePublic, collectionPublic, wishlistPublic', () => {
    render(<PrivacySection settings={settings} />)
    expect(screen.getByText('Profile Visibility')).toBeInTheDocument()
    expect(screen.getByText('Collection')).toBeInTheDocument()
    expect(screen.getByText('Wishlist')).toBeInTheDocument()
    // 3 switches total — one per row.
    expect(screen.getAllByRole('switch')).toHaveLength(3)
  })

  it('regression: profilePublic toggle behavior unchanged from SettingsClient', async () => {
    render(<PrivacySection settings={settings} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: 'Profile Visibility' }))
    expect(updateMock).toHaveBeenCalledWith({
      field: 'profilePublic',
      value: false,
    })
  })

  it('renders inside a SettingsSection card frame', () => {
    const { container } = render(<PrivacySection settings={settings} />)
    // SettingsSection renders title in <h2>.
    expect(container.querySelector('h2')).toBeInTheDocument()
  })
})
