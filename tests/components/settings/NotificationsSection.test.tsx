import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Phase 22 D-01 — Notifications migration GREEN tests.
// PrivacyToggleRow imports updateProfileSettings from '@/app/actions/profile'.
// Stub it so jsdom dependency graph stays clean and we can assert call args.
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
import { NotificationsSection } from '@/components/settings/NotificationsSection'

const settings = {
  notifyOnFollow: true,
  notifyOnWatchOverlap: true,
  notifyOnLike: true,
  notifyOnComment: true,
}

describe('NotificationsSection — Phase 22 D-01 migration', () => {
  beforeEach(() => {
    updateMock.mockClear()
    updateMock.mockResolvedValue({ success: true, data: undefined })
  })

  it('renders 4 PrivacyToggleRow instances — notifyOnFollow, notifyOnWatchOverlap, notifyOnLike, notifyOnComment', () => {
    render(<NotificationsSection settings={settings} />)
    expect(screen.getByText('New Followers')).toBeInTheDocument()
    expect(screen.getByText('Watch Overlaps')).toBeInTheDocument()
    expect(screen.getByText('Likes')).toBeInTheDocument()
    expect(screen.getByText('Comments')).toBeInTheDocument()
    expect(screen.getAllByRole('switch')).toHaveLength(4)
  })

  it('renders the section title as "Notifications"', () => {
    render(<NotificationsSection settings={settings} />)
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('regression: notifyOnFollow toggle behavior unchanged from SettingsClient', async () => {
    render(<NotificationsSection settings={settings} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: 'New Followers' }))
    expect(updateMock).toHaveBeenCalledWith({
      field: 'notifyOnFollow',
      value: false,
    })
  })

  it('likes toggle calls updateProfileSettings with { field: notifyOnLike, value: false }', async () => {
    render(<NotificationsSection settings={settings} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: 'Likes' }))
    expect(updateMock).toHaveBeenCalledWith({
      field: 'notifyOnLike',
      value: false,
    })
  })

  it('comments toggle calls updateProfileSettings with { field: notifyOnComment, value: false }', async () => {
    render(<NotificationsSection settings={settings} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: 'Comments' }))
    expect(updateMock).toHaveBeenCalledWith({
      field: 'notifyOnComment',
      value: false,
    })
  })

  it('renders inside a SettingsSection card frame', () => {
    const { container } = render(<NotificationsSection settings={settings} />)
    expect(container.querySelector('h2')).toBeInTheDocument()
  })
})
