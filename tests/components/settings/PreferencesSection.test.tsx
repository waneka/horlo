import { describe, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 22 D-01 — PreferencesSection embeds existing PreferencesClient
// unchanged inside the Preferences tab. Stub savePreferences so the embed
// does not fire real Server Actions during render.
// ---------------------------------------------------------------------------

vi.mock('@/app/actions/preferences', () => ({
  savePreferences: vi.fn(async () => ({ success: true, data: {} })),
}))

describe('PreferencesSection — Phase 22 D-01 embed', () => {
  it.todo('embeds PreferencesClient unchanged — preferences prop passes through')
  it.todo('does not double-wrap PreferencesClient in an outer card')
})
