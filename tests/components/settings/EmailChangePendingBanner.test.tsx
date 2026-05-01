import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Phase 22 SET-04 D-05/D-06 — Email-change pending banner.
// Banner is `<div role="status" aria-live="polite">` (D-05); single Resend
// action re-fires updateUser({email}) with no Cancel button (D-06).
// ---------------------------------------------------------------------------

const updateUserMock = vi.fn(async () => ({ error: null }))

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: { updateUser: updateUserMock },
  })),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { EmailChangePendingBanner } from '@/components/settings/EmailChangePendingBanner'

describe('EmailChangePendingBanner — Phase 22 SET-04 D-05/D-06', () => {
  beforeEach(() => {
    updateUserMock.mockClear()
  })

  it('renders aria-live status region with role="status" aria-live="polite"', () => {
    render(
      <EmailChangePendingBanner
        oldEmail="old@example.com"
        newEmail="new@example.com"
      />,
    )
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('renders locked banner copy with bolded oldEmail and newEmail', () => {
    const { container } = render(
      <EmailChangePendingBanner
        oldEmail="old@example.com"
        newEmail="new@example.com"
      />,
    )
    expect(container.textContent).toMatch(
      /Confirmation sent to old@example\.com and new@example\.com\. Click both links to complete the change\./,
    )
    // Both addresses are bolded
    const strongs = Array.from(container.querySelectorAll('strong')).map(
      (s) => s.textContent,
    )
    expect(strongs).toContain('old@example.com')
    expect(strongs).toContain('new@example.com')
  })

  it('resend re-fires updateUser({ email: pendingEmail }) — D-06 same-call pattern', async () => {
    render(
      <EmailChangePendingBanner
        oldEmail="old@example.com"
        newEmail="new@example.com"
      />,
    )
    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: /Resend confirmation/i }),
    )
    expect(updateUserMock).toHaveBeenCalledTimes(1)
    expect(updateUserMock).toHaveBeenCalledWith({ email: 'new@example.com' })
  })

  it('does NOT render a Cancel button (D-06 explicit)', () => {
    render(
      <EmailChangePendingBanner
        oldEmail="old@example.com"
        newEmail="new@example.com"
      />,
    )
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull()
  })
})
