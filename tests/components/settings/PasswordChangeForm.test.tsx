import { describe, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 22 SET-05 D-10 — Password change form RED skeleton.
// Fresh-session direct path AND server 401 reopens dialog (RECONCILED D-08
// Option C defense-in-depth — last_sign_in_at is the primary client signal,
// 401 catch is the second line).
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(),
}))

describe('PasswordChangeForm — Phase 22 SET-05 D-10', () => {
  it.todo('fresh session updates directly (last_sign_in_at < 24h, no dialog)')
  it.todo('stale session opens re-auth dialog (last_sign_in_at > 24h)')
  it.todo('passwords-do-not-match validation surfaces inline')
  it.todo('length-too-short validation surfaces inline')
  it.todo(
    'server 401 reopens dialog (RECONCILED D-08 Option C defense-in-depth)',
  )
})
