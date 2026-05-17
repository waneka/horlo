import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Phase 43 GAP-43-05 — ProfileSection now renders the real ProfileEditForm
// instead of the Phase 22 read-only stub.
//
// Strategy: mock ProfileEditForm (and its dependencies that fail under jsdom:
// AvatarUploader / react-easy-crop / Server Actions) so the test focuses on
// ProfileSection's own composition — the "View public profile" link, the
// ProfileEditForm mount, and the absence of the old stub footer note.
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock ProfileEditForm with a minimal stub that exposes the Display name and
// Bio labels so tests can assert they are rendered by the composition.
vi.mock('@/components/profile/ProfileEditForm', () => ({
  ProfileEditForm: ({
    initial,
    userId,
  }: {
    initial: { displayName: string | null; avatarUrl: string | null; bio: string | null }
    userId: string
    onDone: () => void
  }) => (
    <div data-testid="profile-edit-form" data-user-id={userId}>
      <label htmlFor="profile-display-name">Display name</label>
      <input
        id="profile-display-name"
        defaultValue={initial.displayName ?? ''}
      />
      <label htmlFor="profile-bio">Bio</label>
      <textarea id="profile-bio" defaultValue={initial.bio ?? ''} />
    </div>
  ),
}))

// Import AFTER mocks.
import { ProfileSection } from '@/components/settings/ProfileSection'

const DEFAULT_PROPS = {
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
  bio: 'Vintage enthusiast.',
  userId: 'user-abc-123',
}

describe('ProfileSection — GAP-43-05 live ProfileEditForm', () => {
  it('renders the View public profile link to /u/{username}', () => {
    render(<ProfileSection {...DEFAULT_PROPS} />)
    const link = screen.getByRole('link', { name: 'View public profile' })
    expect(link).toHaveAttribute('href', '/u/alice')
  })

  it('does NOT render the old stub footer note', () => {
    render(<ProfileSection {...DEFAULT_PROPS} />)
    expect(
      screen.queryByText('Profile editing coming in the next update.'),
    ).toBeNull()
  })

  it('renders ProfileEditForm (Display name field present)', () => {
    render(<ProfileSection {...DEFAULT_PROPS} />)
    expect(screen.getByTestId('profile-edit-form')).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toBeInTheDocument()
  })

  it('renders ProfileEditForm (Bio field present)', () => {
    render(<ProfileSection {...DEFAULT_PROPS} />)
    expect(screen.getByLabelText('Bio')).toBeInTheDocument()
  })

  it('passes userId to ProfileEditForm', () => {
    render(<ProfileSection {...DEFAULT_PROPS} />)
    expect(screen.getByTestId('profile-edit-form')).toHaveAttribute(
      'data-user-id',
      'user-abc-123',
    )
  })

  it('renders with null bio and null displayName without crashing', () => {
    render(
      <ProfileSection
        username="bob"
        displayName={null}
        avatarUrl={null}
        bio={null}
        userId="user-bob-456"
      />,
    )
    expect(screen.getByTestId('profile-edit-form')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'View public profile' })
    expect(link).toHaveAttribute('href', '/u/bob')
  })
})
