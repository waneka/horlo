import { describe, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 22 SET-05 D-09 — Re-auth dialog RED skeleton. Single field for
// current password (email is known from getCurrentUser); flow is
// signInWithPassword → updateUser({password}); neutral error copy.
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(),
}))

describe('PasswordReauthDialog — Phase 22 SET-05 D-09', () => {
  it.todo(
    'stale session re-auth flow — signInWithPassword then updateUser({password})',
  )
  it.todo(
    'neutral error on signInWithPassword failure — copy is "Password incorrect."',
  )
  it.todo('cancel closes dialog and leaves form populated')
  it.todo('renders single field for current password (D-09 single-field)')
})
