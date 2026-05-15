/**
 * Phase 41 — Track A (SET-13) component test: WipeCollectionModal.
 *
 * RED scaffold — WipeCollectionModal does not exist yet (ships in plan 41-03).
 * This file is RED because the import resolves to a missing module.
 *
 * Contracts asserted (UI-SPEC §Modal Interaction Contract + §Copywriting Contract):
 *   - Step 1: warning text renders ("permanently deletes" / "cannot be undone")
 *   - Clicking Continue advances from step 1 to step 2
 *   - Execute button is disabled until: typed text === 'WIPE' AND password is non-empty (D-05)
 *   - Modal renders with correct props shape (open, onOpenChange, currentEmail)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WipeCollectionModal } from '@/components/settings/WipeCollectionModal'

// REQUIRED: mock the server-action module so the component test never invokes
// the real DB-backed wipeCollection (a 'use server' module cannot run in jsdom).
vi.mock('@/app/actions/account', () => ({
  wipeCollection: vi.fn(),
  deleteAccount: vi.fn(),
}))

// Stub the Supabase browser client so signInWithPassword is controllable.
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn().mockReturnValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

// Mock next/navigation (some component trees import useRouter)
vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: vi.fn().mockReturnValue('/settings'),
}))

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  currentEmail: 'collector@example.com',
}

describe('WipeCollectionModal — step flow + type-to-confirm gate (SET-13 D-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders step-1 warning text when modal is open', () => {
    render(<WipeCollectionModal {...defaultProps} />)
    // Step-1 must show a warning about permanence.
    expect(
      screen.getByText(/permanently deletes|cannot be undone|permanently/i)
    ).toBeInTheDocument()
  })

  it('clicking Continue advances to step 2 (type-to-confirm + password fields visible)', async () => {
    const user = userEvent.setup()
    render(<WipeCollectionModal {...defaultProps} />)

    // Step 1 should have a Continue button.
    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    // Step 2 should now show the type-to-confirm input (placeholder WIPE).
    expect(screen.getByPlaceholderText(/WIPE/i)).toBeInTheDocument()
  })

  it('execute button is disabled when confirmation field is empty (D-05)', async () => {
    const user = userEvent.setup()
    render(<WipeCollectionModal {...defaultProps} />)

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    // The execute button must be disabled when no keyword typed.
    const executeBtn = screen.getByRole('button', { name: /wipe collection/i })
    expect(executeBtn).toBeDisabled()
  })

  it('execute button is disabled when confirmation is WIPE but password is empty (D-05)', async () => {
    const user = userEvent.setup()
    render(<WipeCollectionModal {...defaultProps} />)

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    const confirmInput = screen.getByPlaceholderText(/WIPE/i)
    await user.type(confirmInput, 'WIPE')

    // Password still empty → execute stays disabled.
    const executeBtn = screen.getByRole('button', { name: /wipe collection/i })
    expect(executeBtn).toBeDisabled()
  })

  it('execute button is disabled when password is non-empty but confirmation is not WIPE (D-05)', async () => {
    const user = userEvent.setup()
    render(<WipeCollectionModal {...defaultProps} />)

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    const confirmInput = screen.getByPlaceholderText(/WIPE/i)
    await user.type(confirmInput, 'wipe') // lowercase — must not match

    const passwordInput = screen.getByLabelText(/current password/i)
    await user.type(passwordInput, 'mypassword')

    const executeBtn = screen.getByRole('button', { name: /wipe collection/i })
    expect(executeBtn).toBeDisabled()
  })

  it('execute button is enabled when confirmation === WIPE and password is non-empty (D-05)', async () => {
    const user = userEvent.setup()
    render(<WipeCollectionModal {...defaultProps} />)

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    const confirmInput = screen.getByPlaceholderText(/WIPE/i)
    await user.type(confirmInput, 'WIPE')

    const passwordInput = screen.getByLabelText(/current password/i)
    await user.type(passwordInput, 'mypassword')

    const executeBtn = screen.getByRole('button', { name: /wipe collection/i })
    expect(executeBtn).not.toBeDisabled()
  })
})
