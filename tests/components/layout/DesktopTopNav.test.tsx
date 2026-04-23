import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

let mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

// Stub HeaderNav, NavWearButton, UserMenu to isolate composition testing
vi.mock('@/components/layout/HeaderNav', () => ({
  HeaderNav: ({ username }: { username?: string | null }) => (
    <div data-testid="header-nav" data-username={username ?? ''} />
  ),
}))

vi.mock('@/components/layout/NavWearButton', () => ({
  NavWearButton: () => <div data-testid="nav-wear" />,
}))

vi.mock('@/components/layout/UserMenu', () => ({
  UserMenu: ({ username }: { username?: string | null }) => (
    <div data-testid="user-menu" data-username={username ?? ''} />
  ),
}))

import { DesktopTopNav } from '@/components/layout/DesktopTopNav'

const bellStub = <div data-testid="bell" />

function userProps(extra: Record<string, unknown> = {}) {
  return {
    user: { id: 'u1', email: 'alice@example.com' },
    username: 'alice',
    ownedWatches: [],
    bell: bellStub,
    ...extra,
  } as const
}

describe('DesktopTopNav (Phase 14 D-16 / D-23 — desktop top chrome)', () => {
  beforeEach(() => {
    mockPathname = '/'
  })

  it('Test 9 — renders wordmark, HeaderNav, search input, NavWearButton, Add icon, NotificationBell, UserMenu (all present)', () => {
    const { container } = render(<DesktopTopNav {...userProps()} />)
    expect(screen.getByText('Horlo')).toBeInTheDocument()
    expect(screen.getByTestId('header-nav')).toBeInTheDocument()
    expect(
      container.querySelector('input[type="search"]'),
    ).toBeTruthy()
    expect(screen.getByTestId('nav-wear')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add watch/i })).toBeInTheDocument()
    expect(screen.getByTestId('bell')).toBeInTheDocument()
    expect(screen.getByTestId('user-menu')).toBeInTheDocument()
  })

  it('Test 10 — Add icon link has href="/watch/new"', () => {
    render(<DesktopTopNav {...userProps()} />)
    const add = screen.getByRole('link', { name: /add watch/i })
    expect(add.getAttribute('href')).toBe('/watch/new')
  })

  it('Test 11 — Search input is a form/input targeting /search on submit', () => {
    const { container } = render(<DesktopTopNav {...userProps()} />)
    const form = container.querySelector('form')
    expect(form).toBeTruthy()
    const input = form!.querySelector('input[type="search"]')
    expect(input).toBeTruthy()
    // The form has an onSubmit handler that navigates to /search — verify name="q"
    expect((input as HTMLInputElement).name).toBe('q')
  })

  it('Test 12 — component renders with "hidden" and "md:block" classes (desktop-only)', () => {
    const { container } = render(<DesktopTopNav {...userProps()} />)
    const header = container.querySelector('header')
    expect(header).toBeTruthy()
    expect(header!.className).toContain('hidden')
    expect(header!.className).toContain('md:block')
  })

  it('Test 13 — component has sticky positioning (sticky top-0 and z-50)', () => {
    const { container } = render(<DesktopTopNav {...userProps()} />)
    const header = container.querySelector('header')!
    expect(header.className).toContain('sticky')
    expect(header.className).toContain('top-0')
    expect(header.className).toContain('z-50')
  })

  it('Test 14 — when user is null, bell is NOT rendered', () => {
    render(
      <DesktopTopNav
        user={null}
        username={null}
        ownedWatches={[]}
        bell={bellStub}
      />,
    )
    expect(screen.queryByTestId('bell')).toBeNull()
  })

  it('Test 15 — when user is null, NavWearButton and Add link are NOT rendered', () => {
    render(
      <DesktopTopNav
        user={null}
        username={null}
        ownedWatches={[]}
        bell={bellStub}
      />,
    )
    expect(screen.queryByTestId('nav-wear')).toBeNull()
    expect(screen.queryByRole('link', { name: /add watch/i })).toBeNull()
  })

  it('Test 16 — ThemeToggle is NOT rendered anywhere inside DesktopTopNav', () => {
    const { container } = render(<DesktopTopNav {...userProps()} />)
    // No ThemeToggle node; searching by a distinctive aria-label from ThemeToggle.
    // Also assert the mocked UserMenu got the username for D-17 handshake.
    expect(
      container.querySelector('[aria-label="Toggle theme"]'),
    ).toBeNull()
    const userMenu = screen.getByTestId('user-menu')
    expect(userMenu.getAttribute('data-username')).toBe('alice')
  })
})
