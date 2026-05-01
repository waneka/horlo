import { describe, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 22 SET-04 D-05/D-06 — Email-change pending banner RED skeleton.
// Banner is `<div role="status" aria-live="polite">` (D-05); single Resend
// action re-fires updateUser({email}) with no Cancel button (D-06).
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: { updateUser: vi.fn(async () => ({ error: null })) },
  })),
}))

describe('EmailChangePendingBanner — Phase 22 SET-04 D-05/D-06', () => {
  it.todo('renders aria-live status region with role="status" aria-live="polite"')
  it.todo('renders locked banner copy with bolded oldEmail and newEmail')
  it.todo(
    'resend re-fires updateUser({ email: pendingEmail }) — D-06 same-call pattern',
  )
  it.todo('does NOT render a Cancel button (D-06 explicit)')
})
