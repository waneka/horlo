import { describe, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 22 D-01 — Notifications migration RED skeleton.
// PrivacyToggleRow imports updateProfileSettings from '@/app/actions/profile'.
// Stub it so jsdom dependency graph stays clean.
// ---------------------------------------------------------------------------

vi.mock('@/app/actions/profile', () => ({
  updateProfileSettings: vi.fn(async () => ({ success: true, data: undefined })),
}))

describe('NotificationsSection — Phase 22 D-01 migration', () => {
  it.todo(
    'renders 2 PrivacyToggleRow instances — notifyOnFollow, notifyOnWatchOverlap',
  )
  it.todo(
    'regression: notifyOnFollow toggle behavior unchanged from SettingsClient',
  )
  it.todo('renders inside a SettingsSection card frame')
})
