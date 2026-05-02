import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

let mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

// Stub UserMenu so we can assert it mounts in place of the legacy Settings cog
// (Phase 25 NAV-15 / D-03). UserMenu's own dual-affordance behavior is tested
// in tests/components/layout/UserMenu.test.tsx.
vi.mock('@/components/layout/UserMenu', () => ({
  UserMenu: ({
    username,
    avatarUrl,
  }: {
    username?: string | null
    avatarUrl?: string | null
  }) => (
    <div
      data-testid="user-menu"
      data-username={username ?? ''}
      data-avatar-url={avatarUrl ?? ''}
    />
  ),
}))

import { SlimTopNav } from '@/components/layout/SlimTopNav'

const bellStub = <div data-testid="bell" />

const userArg = { id: 'u1', email: 'alice@example.com' }

function defaultProps(extra: Record<string, unknown> = {}) {
  return {
    hasUser: true as const,
    bell: bellStub,
    user: userArg,
    username: 'alice',
    avatarUrl: null,
    ...extra,
  }
}

describe('SlimTopNav (Phase 14 D-11 / D-23 + Phase 25 NAV-15 / D-03 — mobile top chrome)', () => {
  beforeEach(() => {
    mockPathname = '/'
  })

  it('Test 1 — renders 4 elements in order: wordmark "Horlo", search icon, bell, UserMenu (Phase 25 D-03 — Settings cog replaced)', () => {
    const { container } = render(<SlimTopNav {...defaultProps()} />)
    // wordmark
    expect(screen.getByText('Horlo')).toBeInTheDocument()
    // search icon link
    const search = screen.getByRole('link', { name: /^search$/i })
    expect(search).toBeTruthy()
    // bell (stub)
    expect(screen.getByTestId('bell')).toBeTruthy()
    // UserMenu (replaces Settings cog per Phase 25 D-03)
    expect(screen.getByTestId('user-menu')).toBeTruthy()

    // Order assertion: walk the nav cluster children
    const headerEl = container.querySelector('header')
    expect(headerEl).toBeTruthy()
    const text = headerEl!.textContent ?? ''
    const all = Array.from(
      headerEl!.querySelectorAll(
        '[data-testid="bell"], [data-testid="user-menu"], a, span',
      ),
    )
    const idxWordmark = all.findIndex((n) => n.textContent === 'Horlo')
    const idxSearch = all.findIndex(
      (n) => (n as HTMLElement).getAttribute?.('aria-label') === 'Search',
    )
    const idxBell = all.findIndex(
      (n) => (n as HTMLElement).getAttribute?.('data-testid') === 'bell',
    )
    const idxUserMenu = all.findIndex(
      (n) => (n as HTMLElement).getAttribute?.('data-testid') === 'user-menu',
    )
    expect(idxWordmark).toBeGreaterThanOrEqual(0)
    expect(idxSearch).toBeGreaterThan(idxWordmark)
    expect(idxBell).toBeGreaterThan(idxSearch)
    expect(idxUserMenu).toBeGreaterThan(idxBell)
    // Silences "text" unused lint
    expect(text).toContain('Horlo')
  })

  it('Test 2 — wordmark link has href="/"', () => {
    const { container } = render(<SlimTopNav {...defaultProps()} />)
    // Wordmark link is the anchor containing the Horlo span
    const links = container.querySelectorAll('a')
    const wordmarkLink = Array.from(links).find(
      (a) => a.textContent === 'Horlo',
    )
    expect(wordmarkLink).toBeTruthy()
    expect(wordmarkLink!.getAttribute('href')).toBe('/')
  })

  it('Test 3 — search icon link has href="/search"', () => {
    render(<SlimTopNav {...defaultProps()} />)
    const search = screen.getByRole('link', { name: /^search$/i })
    expect(search.getAttribute('href')).toBe('/search')
  })

  it('Test 4 (Phase 25 NAV-15 / D-03) — Settings cog Link is REMOVED; UserMenu mounts in its place', () => {
    render(<SlimTopNav {...defaultProps()} />)
    // No standalone Settings link survives — Settings is reachable via UserMenu's dropdown
    expect(screen.queryByRole('link', { name: /^settings$/i })).toBeNull()
    // UserMenu mounts (with username + avatarUrl plumbed through)
    const userMenu = screen.getByTestId('user-menu')
    expect(userMenu).toBeTruthy()
    expect(userMenu.getAttribute('data-username')).toBe('alice')
  })

  it('Test 5 — component renders a <header> with md:hidden class (mobile-only)', () => {
    const { container } = render(<SlimTopNav {...defaultProps()} />)
    const header = container.querySelector('header')
    expect(header).toBeTruthy()
    expect(header!.className).toContain('md:hidden')
  })

  it('Test 6 — component has sticky positioning (sticky top-0 and z-50)', () => {
    const { container } = render(<SlimTopNav {...defaultProps()} />)
    const header = container.querySelector('header')!
    expect(header.className).toContain('sticky')
    expect(header.className).toContain('top-0')
    expect(header.className).toContain('z-50')
  })

  it('Test 7 — when hasUser is false, bell is NOT rendered', () => {
    render(
      <SlimTopNav
        hasUser={false}
        bell={bellStub}
        user={null}
        username={null}
        avatarUrl={null}
      />,
    )
    expect(screen.queryByTestId('bell')).toBeNull()
  })

  it('Test 8 — when pathname is /login, component returns null (isPublicPath gate)', () => {
    mockPathname = '/login'
    const { container } = render(<SlimTopNav {...defaultProps()} />)
    expect(container.querySelector('header')).toBeNull()
    expect(container.firstChild).toBeNull()
  })

  it('Test 9 (Phase 25 NAV-15) — avatarUrl is plumbed through to UserMenu', () => {
    render(
      <SlimTopNav
        hasUser
        bell={bellStub}
        user={userArg}
        username="alice"
        avatarUrl="https://cdn.example.com/avatar.png"
      />,
    )
    const userMenu = screen.getByTestId('user-menu')
    expect(userMenu.getAttribute('data-avatar-url')).toBe(
      'https://cdn.example.com/avatar.png',
    )
  })
})
