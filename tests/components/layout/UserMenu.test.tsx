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

const aliceProps = {
  user: { id: 'u1', email: 'alice@example.com' },
  username: 'alice',
  avatarUrl: null,
}

describe('UserMenu (Phase 14 NAV-08 D-17 + Phase 25 NAV-13 dual-affordance)', () => {
  it('Test 1 — when user is null, renders a /login link with "Sign in"', () => {
    render(<UserMenu user={null} username={null} avatarUrl={null} />)
    const signIn = screen.getByRole('link', { name: /sign in/i })
    expect(signIn.getAttribute('href')).toBe('/login')
    expect(screen.getByText(/sign in/i)).toBeInTheDocument()
  })

  it('Test 2 (Phase 25) — trigger renders avatar Link + chevron Button (dual-affordance)', () => {
    render(<UserMenu {...aliceProps} />)
    // Avatar Link with aria-label "Go to alice's profile"
    const avatarLink = screen.getByRole('link', {
      name: /go to alice.s profile/i,
    })
    expect(avatarLink).toBeInTheDocument()
    expect(avatarLink.getAttribute('href')).toBe('/u/alice/collection')
    // Chevron Button with aria-label "Open account menu"
    const chevronButton = screen.getByRole('button', {
      name: /open account menu/i,
    })
    expect(chevronButton).toBeInTheDocument()
  })

  it('Test 3 — dropdown contains all sections in order: Email / Profile / Settings / Theme / Sign out', () => {
    render(<UserMenu {...aliceProps} />)
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

  it('Test 4 — Profile dropdown item links to /u/${username}/collection', () => {
    render(<UserMenu {...aliceProps} />)
    // Two links named ~"profile" exist now: the avatar Link
    // (aria-label "Go to alice's profile") AND the dropdown's Profile item.
    // Filter by accessible name === "Profile" exactly.
    const profile = screen.getByRole('link', { name: /^profile$/i })
    expect(profile.getAttribute('href')).toBe('/u/alice/collection')
  })

  it('Test 5 — Settings item links to /settings', () => {
    render(<UserMenu {...aliceProps} />)
    const settings = screen.getByRole('link', { name: /settings/i })
    expect(settings.getAttribute('href')).toBe('/settings')
  })

  it('Test 6 — Theme section contains a "Theme" label', () => {
    render(<UserMenu {...aliceProps} />)
    expect(screen.getByText('Theme')).toBeInTheDocument()
  })

  it('Test 7 — Theme section contains InlineThemeSegmented', () => {
    render(<UserMenu {...aliceProps} />)
    expect(screen.getByTestId('inline-theme')).toBeInTheDocument()
  })

  it('Test 8 — Sign out is a form-submit button labeled "Sign out" with text-destructive', () => {
    render(<UserMenu {...aliceProps} />)
    const signOut = screen.getByRole('button', { name: 'Sign out' })
    expect(signOut.getAttribute('type')).toBe('submit')
    const cls = signOut.getAttribute('class') ?? ''
    expect(cls).toMatch(/text-destructive/)
    // The button must live inside a <form> (logout Server Action invocation)
    expect(signOut.closest('form')).not.toBeNull()
  })

  it('Test 9 — when username is null, the avatar Link is NOT rendered (chevron-only fallback)', () => {
    render(
      <UserMenu
        user={{ id: 'u1', email: 'alice@example.com' }}
        username={null}
        avatarUrl={null}
      />,
    )
    // No avatar Link (would have aria-label /go to .* profile/)
    expect(
      screen.queryByRole('link', { name: /go to .* profile/i }),
    ).toBeNull()
    // Profile dropdown item is also NOT rendered when username is null
    expect(screen.queryByRole('link', { name: /^profile$/i })).toBeNull()
    // Chevron-only fallback Button exists with aria-label "Account menu"
    expect(
      screen.getByRole('button', { name: /^account menu$/i }),
    ).toBeInTheDocument()
    // Settings and Sign out are still present
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('Test 10 (Phase 25 D-02) — avatar Link href uses /u/{username}/collection', () => {
    render(<UserMenu {...aliceProps} />)
    const avatarLink = screen.getByRole('link', {
      name: /go to alice.s profile/i,
    })
    expect(avatarLink.getAttribute('href')).toBe('/u/alice/collection')
  })

  it('Test 11 (Phase 25 §Spacing Scale) — dual-affordance container uses gap-1 (NOT gap-2)', () => {
    const { container } = render(<UserMenu {...aliceProps} />)
    // Wrapper div sits at the trigger position. It must have className with
    // "gap-1" (4px) and MUST NOT contain "gap-2".
    const wrapper = container.querySelector(
      'div.flex.items-center.gap-1',
    ) as HTMLElement | null
    expect(wrapper).not.toBeNull()
    expect(wrapper!.className).toContain('gap-1')
    expect(wrapper!.className).not.toContain('gap-2')
  })

  it('Test 12 (Phase 25 §Spacing Scale) — avatar Link uses size-11 hit target (44×44)', () => {
    render(<UserMenu {...aliceProps} />)
    const avatarLink = screen.getByRole('link', {
      name: /go to alice.s profile/i,
    })
    expect(avatarLink.className).toContain('size-11')
    expect(avatarLink.className).toContain('rounded-full')
  })

  it('Test 13 (Phase 25 D-04) — does not render the legacy email-derived initials Button', () => {
    render(<UserMenu {...aliceProps} />)
    // Legacy "AL" two-letter initials Button MUST be gone — AvatarDisplay
    // derives the initial from username instead.
    expect(screen.queryByRole('button', { name: 'AL' })).toBeNull()
  })
})
