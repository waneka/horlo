import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Phase 22 SET-04 — Email change form. Mirrors the Supabase browser-client
// mock pattern used by reset-password / signup tests.
//
// T-22-S4 mitigation: the disabled "Current email" input MUST render
// currentEmail, NEVER pendingNewEmail (verified in Test 2).
// ---------------------------------------------------------------------------

const updateUserMock = vi.fn(async () => ({
  data: { user: null },
  error: null,
}))
const refreshMock = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: { updateUser: updateUserMock },
  })),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { EmailChangeForm } from '@/components/settings/EmailChangeForm'

describe('EmailChangeForm — Phase 22 SET-04', () => {
  beforeEach(() => {
    updateUserMock.mockReset()
    updateUserMock.mockResolvedValue({ data: { user: null }, error: null })
    refreshMock.mockClear()
  })

  it('banner gates on new_email — banner only renders when pendingNewEmail is non-null', () => {
    const { rerender } = render(
      <EmailChangeForm currentEmail="old@example.com" pendingNewEmail={null} />,
    )
    expect(screen.queryByRole('status')).toBeNull()
    rerender(
      <EmailChangeForm
        currentEmail="old@example.com"
        pendingNewEmail="new@example.com"
      />,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('input shows current email pre-confirmation (NOT new_email — T-22-S4 mitigation)', () => {
    render(
      <EmailChangeForm
        currentEmail="old@example.com"
        pendingNewEmail="new@example.com"
      />,
    )
    const currentInput = screen.getByLabelText(
      'Current email',
    ) as HTMLInputElement
    expect(currentInput.value).toBe('old@example.com')
    expect(currentInput.value).not.toBe('new@example.com')
  })

  it('submit calls updateUser({ email: newEmail })', async () => {
    render(
      <EmailChangeForm currentEmail="old@example.com" pendingNewEmail={null} />,
    )
    const user = userEvent.setup()
    const newInput = screen.getByLabelText('New email address')
    await user.type(newInput, 'fresh@example.com')
    await user.click(screen.getByRole('button', { name: /Update email/i }))
    expect(updateUserMock).toHaveBeenCalledTimes(1)
    expect(updateUserMock).toHaveBeenCalledWith({ email: 'fresh@example.com' })
  })

  it('error path surfaces server error fallback copy', async () => {
    updateUserMock.mockResolvedValueOnce({
      data: { user: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: { name: 'AuthError', message: 'rate limit', status: 429 } as any,
    })
    render(
      <EmailChangeForm currentEmail="old@example.com" pendingNewEmail={null} />,
    )
    const user = userEvent.setup()
    await user.type(
      screen.getByLabelText('New email address'),
      'fresh@example.com',
    )
    await user.click(screen.getByRole('button', { name: /Update email/i }))
    expect(
      await screen.findByText('Could not update email. Please try again.'),
    ).toBeInTheDocument()
  })
})
