import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserMenu } from '@/components/layout/UserMenu'

// Base-ui Menu primitives rely on a real portal + positioning — mock them as
// transparent pass-throughs so unit tests can assert on dropdown children
// without needing click/open state. `render` prop (base-ui's slot pattern)
// is treated as "the real child" — this mirrors how UserMenu composes Link,
// form, and button children into the DropdownMenu primitives.
vi.mock('@/components/ui/dropdown-menu', () => {
  const passthrough = ({
    children,
  }: {
    children?: React.ReactNode
  }) => <div>{children}</div>
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: ({ render: r }: { render?: React.ReactNode }) =>
      r ?? null,
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="dropdown-content">{children}</div>
    ),
    DropdownMenuGroup: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuItem: ({
      render: r,
      children,
    }: {
      render?: React.ReactNode
      children?: React.ReactNode
    }) => <div data-testid="dropdown-item">{r ?? children}</div>,
    DropdownMenuLabel: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuSeparator: () => <hr />,
  }
})

vi.mock('@/app/actions/auth', () => ({ logout: vi.fn() }))

vi.mock('@/components/layout/InlineThemeSegmented', () => ({
  InlineThemeSegmented: () => <div data-testid="inline-theme" />,
}))

describe('UserMenu (Phase 14 NAV-08 D-17)', () => {
  it('Test 1 — when user is null, renders a /login link with "Sign in"', () => {
    render(<UserMenu user={null} username={null} avatarUrl={null} />)
    const signIn = screen.getByRole('link', { name: /sign in/i })
    expect(signIn.getAttribute('href')).toBe('/login')
    expect(screen.getByText(/sign in/i)).toBeInTheDocument()
  })

  it('Test 2 — when user is present, trigger shows 2-letter initials from email local', () => {
    render(
      <UserMenu
        user={{ id: 'u1', email: 'alice@example.com' }}
        username="alice"
        avatarUrl={null}
      />,
    )
    expect(screen.getByRole('button', { name: 'AL' })).toBeInTheDocument()
  })

  it('Test 3 — dropdown contains all sections in order: Email / Profile / Settings / Theme / Sign out', () => {
    render(
      <UserMenu
        user={{ id: 'u1', email: 'alice@example.com' }}
        username="alice"
        avatarUrl={null}
      />,
    )
    const content = screen.getByTestId('dropdown-content')
    const text = content.textContent ?? ''
    const emailIdx = text.indexOf('alice@example.com')
    const profileIdx = text.indexOf('Profile')
    const settingsIdx = text.indexOf('Settings')
    const themeIdx = text.indexOf('Theme')
    const signOutIdx = text.indexOf('Sign out')
    expect(emailIdx).toBeGreaterThanOrEqual(0)
    expect(profileIdx).toBeGreaterThan(emailIdx)
    expect(settingsIdx).toBeGreaterThan(profileIdx)
    expect(themeIdx).toBeGreaterThan(settingsIdx)
    expect(signOutIdx).toBeGreaterThan(themeIdx)
  })

  it('Test 4 — Profile item links to /u/${username}/collection', () => {
    render(
      <UserMenu
        user={{ id: 'u1', email: 'alice@example.com' }}
        username="alice"
        avatarUrl={null}
      />,
    )
    const profile = screen.getByRole('link', { name: /profile/i })
    expect(profile.getAttribute('href')).toBe('/u/alice/collection')
  })

  it('Test 5 — Settings item links to /settings', () => {
    render(
      <UserMenu
        user={{ id: 'u1', email: 'alice@example.com' }}
        username="alice"
        avatarUrl={null}
      />,
    )
    const settings = screen.getByRole('link', { name: /settings/i })
    expect(settings.getAttribute('href')).toBe('/settings')
  })

  it('Test 6 — Theme section contains a "Theme" label', () => {
    render(
      <UserMenu
        user={{ id: 'u1', email: 'alice@example.com' }}
        username="alice"
        avatarUrl={null}
      />,
    )
    expect(screen.getByText('Theme')).toBeInTheDocument()
  })

  it('Test 7 — Theme section contains InlineThemeSegmented', () => {
    render(
      <UserMenu
        user={{ id: 'u1', email: 'alice@example.com' }}
        username="alice"
        avatarUrl={null}
      />,
    )
    expect(screen.getByTestId('inline-theme')).toBeInTheDocument()
  })

  it('Test 8 — Sign out is a form-submit button labeled "Sign out" with text-destructive', () => {
    render(
      <UserMenu
        user={{ id: 'u1', email: 'alice@example.com' }}
        username="alice"
        avatarUrl={null}
      />,
    )
    const signOut = screen.getByRole('button', { name: 'Sign out' })
    expect(signOut.getAttribute('type')).toBe('submit')
    const cls = signOut.getAttribute('class') ?? ''
    expect(cls).toMatch(/text-destructive/)
    // The button must live inside a <form> (logout Server Action invocation)
    expect(signOut.closest('form')).not.toBeNull()
  })

  it('Test 9 — when username is null, the Profile item is NOT rendered', () => {
    render(
      <UserMenu
        user={{ id: 'u1', email: 'alice@example.com' }}
        username={null}
        avatarUrl={null}
      />,
    )
    expect(screen.queryByRole('link', { name: /profile/i })).toBeNull()
    // Settings and Sign out are still present
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})
