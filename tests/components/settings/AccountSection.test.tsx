import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Phase 22 SET-04 + SET-05 — top-level integration test that AccountSection
// composes EmailChangeForm + PasswordChangeForm. Mocks the two child
// components so we can assert composition without dragging in the Supabase
// client / sonner / next/navigation surface those components require.
// ---------------------------------------------------------------------------

vi.mock('@/components/settings/EmailChangeForm', () => ({
  EmailChangeForm: ({ currentEmail }: { currentEmail: string }) => (
    <div data-testid="email-form">EmailChangeForm: {currentEmail}</div>
  ),
}))
vi.mock('@/components/settings/PasswordChangeForm', () => ({
  PasswordChangeForm: ({ currentEmail }: { currentEmail: string }) => (
    <div data-testid="password-form">PasswordChangeForm: {currentEmail}</div>
  ),
}))

// Import AFTER mocks.
import { AccountSection } from '@/components/settings/AccountSection'

describe('AccountSection — Phase 22 SET-04 + SET-05 composition', () => {
  it('renders Email card with EmailChangeForm', () => {
    render(
      <AccountSection
        currentEmail="a@example.com"
        pendingNewEmail={null}
        lastSignInAt={null}
      />,
    )
    expect(screen.getByTestId('email-form')).toBeInTheDocument()
    expect(screen.getByText('EmailChangeForm: a@example.com')).toBeInTheDocument()
  })

  it('renders Password card with PasswordChangeForm', () => {
    render(
      <AccountSection
        currentEmail="a@example.com"
        pendingNewEmail={null}
        lastSignInAt={null}
      />,
    )
    expect(screen.getByTestId('password-form')).toBeInTheDocument()
    expect(
      screen.getByText('PasswordChangeForm: a@example.com'),
    ).toBeInTheDocument()
  })

  it('email and password sections are separated by space-y-8', () => {
    const { container } = render(
      <AccountSection
        currentEmail="a@example.com"
        pendingNewEmail={null}
        lastSignInAt={null}
      />,
    )
    // UI-SPEC line 448: outermost wrapper div has space-y-8 (32px between
    // Email and Password subsections).
    expect(container.firstChild).toHaveClass('space-y-8')
  })
})
