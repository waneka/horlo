import { describe, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 22 D-01 — Privacy migration RED skeleton.
// PrivacyToggleRow imports updateProfileSettings from '@/app/actions/profile'
// (a Server Action). Stub it so jsdom dependency graph stays clean.
// ---------------------------------------------------------------------------

vi.mock('@/app/actions/profile', () => ({
  updateProfileSettings: vi.fn(async () => ({ success: true, data: undefined })),
}))

describe('PrivacySection — Phase 22 D-01 migration', () => {
  it.todo(
    'renders 3 PrivacyToggleRow instances — profilePublic, collectionPublic, wishlistPublic',
  )
  it.todo('regression: profilePublic toggle behavior unchanged from SettingsClient')
  it.todo('renders inside a SettingsSection card frame')
})
