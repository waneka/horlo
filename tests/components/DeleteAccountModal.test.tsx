/**
 * Phase 41 — Track A (SET-13) component test: DeleteAccountModal.
 *
 * RED scaffold — DeleteAccountModal does not exist yet (ships in plan 41-03).
 * This file is RED because the import resolves to a missing module.
 *
 * Contracts asserted (UI-SPEC §Modal Interaction Contract + §Copywriting Contract):
 *   - Step 1: warning text renders ("permanently deletes" / "cannot be undone")
 *   - Clicking Continue advances from step 1 to step 2
 *   - Execute button is disabled until: typed text === 'DELETE' AND password is non-empty (D-04, D-05)
 *   - No success toast is configured (UI-SPEC line 195 — redirect to '/', not a toast)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal'

// REQUIRED: mock the server-action module so the component test never invokes
// the real DB-backed deleteAccount (a 'use server' module cannot run in jsdom).
vi.mock('@/app/actions/account', () => ({
  wipeCollection: vi.fn(),
  deleteAccount: vi.fn(),
}))

// Stub the Supabase browser client so signInWithPassword is controllable.
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn().mockReturnValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

// Mock next/navigation (router redirect after delete D-07)
vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: vi.fn().mockReturnValue('/settings'),
}))

// Mock sonner — DeleteAccountModal must NOT call toast.success (UI-SPEC line 195)
// vi.hoisted() runs before Vitest hoists vi.mock() calls, so the refs are
// available to both the factory closure and the test body (same fix as 41-02).
const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  currentEmail: 'collector@example.com',
}

describe('DeleteAccountModal — step flow + type-to-confirm gate (SET-13 D-04, D-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders step-1 warning text when modal is open', () => {
    render(<DeleteAccountModal {...defaultProps} />)
    // Step-1 must show a destructive warning.
    expect(
      screen.getByText(/permanently deletes|cannot be undone|permanently/i)
    ).toBeInTheDocument()
  })

  it('clicking Continue advances to step 2 (type-to-confirm + password fields visible)', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountModal {...defaultProps} />)

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    // Step 2 must show the DELETE confirmation field (placeholder DELETE).
    expect(screen.getByPlaceholderText(/DELETE/i)).toBeInTheDocument()
  })

  it('execute button is disabled when confirmation field is empty (D-05)', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountModal {...defaultProps} />)

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    // Execute button starts disabled.
    const executeBtn = screen.getByRole('button', { name: /delete account/i })
    expect(executeBtn).toBeDisabled()
  })

  it('execute button is disabled when confirmation is DELETE but password is empty (D-05)', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountModal {...defaultProps} />)

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    const confirmInput = screen.getByPlaceholderText(/DELETE/i)
    await user.type(confirmInput, 'DELETE')

    // Password still empty → execute stays disabled.
    const executeBtn = screen.getByRole('button', { name: /delete account/i })
    expect(executeBtn).toBeDisabled()
  })

  it('execute button is disabled when password is non-empty but confirmation is not DELETE (D-05)', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountModal {...defaultProps} />)

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    const confirmInput = screen.getByPlaceholderText(/DELETE/i)
    await user.type(confirmInput, 'delete') // lowercase — must not match

    const passwordInput = screen.getByLabelText(/current password/i)
    await user.type(passwordInput, 'mypassword')

    const executeBtn = screen.getByRole('button', { name: /delete account/i })
    expect(executeBtn).toBeDisabled()
  })

  it('execute button is enabled when confirmation === DELETE and password is non-empty (D-04, D-05)', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountModal {...defaultProps} />)

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    const confirmInput = screen.getByPlaceholderText(/DELETE/i)
    await user.type(confirmInput, 'DELETE')

    const passwordInput = screen.getByLabelText(/current password/i)
    await user.type(passwordInput, 'mypassword')

    const executeBtn = screen.getByRole('button', { name: /delete account/i })
    expect(executeBtn).not.toBeDisabled()
  })

  it('does NOT call toast.success on successful delete (UI-SPEC line 195 — redirect only)', async () => {
    const user = userEvent.setup()
    const { deleteAccount } = await import('@/app/actions/account')
    vi.mocked(deleteAccount).mockResolvedValueOnce({ success: true, data: undefined })

    render(<DeleteAccountModal {...defaultProps} />)

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    const confirmInput = screen.getByPlaceholderText(/DELETE/i)
    await user.type(confirmInput, 'DELETE')

    const passwordInput = screen.getByLabelText(/current password/i)
    await user.type(passwordInput, 'mypassword')

    const executeBtn = screen.getByRole('button', { name: /delete account/i })
    await user.click(executeBtn)

    // D-07: no success toast — user is signed out and redirected, not toasted.
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})
