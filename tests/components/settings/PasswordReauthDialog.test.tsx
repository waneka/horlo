import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Phase 22 SET-05 D-09 — Re-auth dialog tests. Single field for current
// password (email is known from getCurrentUser); flow is signInWithPassword
// → updateUser({password}); neutral error copy "Password incorrect."
// ---------------------------------------------------------------------------

const signInMock = vi.fn(async () => ({ error: null }))
const updateUserMock = vi.fn(async () => ({ error: null }))

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      signInWithPassword: signInMock,
      updateUser: updateUserMock,
    },
  })),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { PasswordReauthDialog } from '@/components/settings/PasswordReauthDialog'

describe('PasswordReauthDialog — Phase 22 SET-05 D-09', () => {
  beforeEach(() => {
    signInMock.mockReset()
    signInMock.mockResolvedValue({ error: null })
    updateUserMock.mockReset()
    updateUserMock.mockResolvedValue({ error: null })
  })

  it('stale session re-auth flow — signInWithPassword then updateUser({password})', async () => {
    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()
    render(
      <PasswordReauthDialog
        open={true}
        onOpenChange={onOpenChange}
        currentEmail="alice@example.com"
        pendingNewPassword="NewPass123!"
        onSuccess={onSuccess}
      />,
    )
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/current password/i), 'OldPass456')
    await user.click(screen.getByRole('button', { name: /^Confirm$/i }))

    expect(signInMock).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'OldPass456',
    })
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'NewPass123!' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('neutral error on signInWithPassword failure — copy is "Password incorrect."', async () => {
    signInMock.mockResolvedValueOnce({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: { name: 'AuthError', message: 'invalid', status: 400 } as any,
    })
    render(
      <PasswordReauthDialog
        open={true}
        onOpenChange={vi.fn()}
        currentEmail="alice@example.com"
        pendingNewPassword="NewPass123!"
        onSuccess={vi.fn()}
      />,
    )
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/current password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /^Confirm$/i }))
    expect(await screen.findByText('Password incorrect.')).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it('cancel closes dialog and leaves form populated', async () => {
    const onOpenChange = vi.fn()
    render(
      <PasswordReauthDialog
        open={true}
        onOpenChange={onOpenChange}
        currentEmail="alice@example.com"
        pendingNewPassword="NewPass123!"
        onSuccess={vi.fn()}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders single field for current password (D-09 single-field)', () => {
    render(
      <PasswordReauthDialog
        open={true}
        onOpenChange={vi.fn()}
        currentEmail="alice@example.com"
        pendingNewPassword="NewPass123!"
        onSuccess={vi.fn()}
      />,
    )
    const passwordInputs = screen.getAllByLabelText(/current password/i)
    expect(passwordInputs).toHaveLength(1)
    // No email input
    expect(screen.queryByLabelText(/email/i)).toBeNull()
    // No "new password" input in the dialog
    expect(screen.queryByLabelText(/new password/i)).toBeNull()
  })
})
