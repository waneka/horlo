import { describe, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 22 SET-04 — Email change form RED skeleton. Mirrors the Supabase
// browser-client mock pattern used by reset-password / signup tests.
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      updateUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  })),
}))

describe('EmailChangeForm — Phase 22 SET-04', () => {
  it.todo(
    'banner gates on new_email — banner only renders when pendingNewEmail is non-null',
  )
  it.todo(
    'input shows current email pre-confirmation (NOT new_email — T-22-S4 mitigation)',
  )
  it.todo('submit calls updateUser({ email: newEmail })')
  it.todo('error path surfaces server error fallback copy')
})
