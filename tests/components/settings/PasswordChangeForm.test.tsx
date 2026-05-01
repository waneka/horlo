import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Phase 22 SET-05 D-08/D-10 (RECONCILED Option C) — Password change form.
// Fresh-session direct path AND server 401 reopens dialog (defense-in-depth).
// last_sign_in_at is the primary client signal; 401 catch is the safety net.
// ---------------------------------------------------------------------------

const updateUserMock = vi.fn(async () => ({ error: null }))
const signInMock = vi.fn(async () => ({ error: null }))

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      updateUser: updateUserMock,
      signInWithPassword: signInMock,
    },
  })),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { PasswordChangeForm } from '@/components/settings/PasswordChangeForm'

function freshIso() {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString()
}
function staleIso() {
  return new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
}

async function fillFormAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  pw: string,
  conf: string,
) {
  await user.type(screen.getByLabelText('New password'), pw)
  await user.type(screen.getByLabelText('Confirm new password'), conf)
  await user.click(screen.getByRole('button', { name: /Update password/i }))
}

describe('PasswordChangeForm — Phase 22 SET-05 D-08/D-10 (RECONCILED Option C)', () => {
  beforeEach(() => {
    updateUserMock.mockReset()
    updateUserMock.mockResolvedValue({ error: null })
    signInMock.mockReset()
    signInMock.mockResolvedValue({ error: null })
  })

  it('fresh session updates directly (last_sign_in_at < 24h, no dialog)', async () => {
    render(
      <PasswordChangeForm
        currentEmail="alice@example.com"
        lastSignInAt={freshIso()}
      />,
    )
    const user = userEvent.setup()
    await fillFormAndSubmit(user, 'GoodPass123', 'GoodPass123')
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'GoodPass123' })
    // Dialog NOT rendered — base-ui Dialog with open={false} doesn't render
    // the popup content.
    expect(screen.queryByText('Confirm your password')).toBeNull()
  })

  it('stale session opens re-auth dialog (last_sign_in_at > 24h)', async () => {
    render(
      <PasswordChangeForm
        currentEmail="alice@example.com"
        lastSignInAt={staleIso()}
      />,
    )
    const user = userEvent.setup()
    await fillFormAndSubmit(user, 'GoodPass123', 'GoodPass123')
    // Dialog renders with title "Confirm your password" — see Task 1.
    expect(
      await screen.findByText('Confirm your password'),
    ).toBeInTheDocument()
    // updateUser NOT called from the form (the dialog will call it post-reauth).
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it('passwords-do-not-match validation surfaces inline', async () => {
    render(
      <PasswordChangeForm
        currentEmail="alice@example.com"
        lastSignInAt={freshIso()}
      />,
    )
    const user = userEvent.setup()
    await fillFormAndSubmit(user, 'GoodPass123', 'OtherPass456')
    expect(
      await screen.findByText('Passwords do not match.'),
    ).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it('length-too-short validation surfaces inline', async () => {
    render(
      <PasswordChangeForm
        currentEmail="alice@example.com"
        lastSignInAt={freshIso()}
      />,
    )
    const user = userEvent.setup()
    await fillFormAndSubmit(user, 'short7c', 'short7c')
    expect(
      await screen.findByText('Password must be at least 8 characters.'),
    ).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it('server 401 reopens dialog (RECONCILED D-08 Option C defense-in-depth)', async () => {
    // RECONCILED D-08 Option C: client thinks fresh but server returns 401.
    updateUserMock.mockResolvedValueOnce({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: { name: 'AuthError', message: 'reauth required', status: 401 } as any,
    })
    render(
      <PasswordChangeForm
        currentEmail="alice@example.com"
        lastSignInAt={freshIso()}
      />,
    )
    const user = userEvent.setup()
    await fillFormAndSubmit(user, 'GoodPass123', 'GoodPass123')
    // updateUser was called (fresh path attempted).
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'GoodPass123' })
    // Dialog opens with the soft re-open copy.
    expect(
      await screen.findByText('Please confirm your password to continue.'),
    ).toBeInTheDocument()
  })
})
