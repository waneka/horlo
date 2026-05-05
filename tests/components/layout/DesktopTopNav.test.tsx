import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

let mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

// Stub NavWearButton, UserMenu to isolate composition testing
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
    ownedWatches: [] as never[],
    bell: bellStub,
    avatarUrl: null,
    ...extra,
  }
}

describe('DesktopTopNav (Phase 14 D-16 / D-23 — desktop top chrome)', () => {
  beforeEach(() => {
    mockPathname = '/'
  })

  it('Test 9 — renders wordmark, search input, NavWearButton, Add icon, NotificationBell, UserMenu (all present)', () => {
    const { container } = render(<DesktopTopNav {...userProps()} />)
    expect(screen.getByText('Horlo')).toBeInTheDocument()
    expect(
      container.querySelector('input[type="search"]'),
    ).toBeTruthy()
    expect(screen.getByTestId('nav-wear')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add watch/i })).toBeInTheDocument()
    expect(screen.getByTestId('bell')).toBeInTheDocument()
    expect(screen.getByTestId('user-menu')).toBeInTheDocument()
  })

  it('Test 10 — Add icon link points at /watch/new with Phase 28 ?returnTo= capture', () => {
    render(<DesktopTopNav {...userProps()} />)
    const add = screen.getByRole('link', { name: /add watch/i })
    // Phase 28 D-08 — Add link now appends ?returnTo=ENC(pathname). The
    // mocked usePathname() returns '/' (default in this test file), so the
    // returnTo encodes to %2F.
    const href = add.getAttribute('href') ?? ''
    expect(href.startsWith('/watch/new?returnTo=')).toBe(true)
    // Decoded value MUST match a same-origin path that the /watch/new
    // server-side validator accepts (validateReturnTo in destinations.ts).
    const url = new URL(href, 'http://localhost')
    const decoded = url.searchParams.get('returnTo')
    expect(decoded).toBeTruthy()
    expect(decoded!.startsWith('/')).toBe(true)
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
        avatarUrl={null}
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
        avatarUrl={null}
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

describe('Phase 16 polish (D-23 HeaderNav removed; D-24 nav search restyle)', () => {
  beforeEach(() => {
    mockPathname = '/'
  })

  // Test A (D-23): inline Collection / Profile / Settings nav links removed
  // from the header chrome (those live exclusively in UserMenu's dropdown).
  // The wordmark "Horlo" links to / and the Explore link MUST still exist —
  // the assertion is narrowly scoped to the three deleted link names.
  it('Test A (D-23) — does not render Collection/Profile/Settings inline nav links', () => {
    render(<DesktopTopNav {...userProps()} />)
    expect(screen.queryByRole('link', { name: 'Collection' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Profile' })).toBeNull()
    expect(screen.queryByRole('link', { name: /^Settings$/ })).toBeNull()
    // Sanity: Explore link DOES still exist
    expect(screen.getByRole('link', { name: 'Explore' })).toBeInTheDocument()
  })

  // Test B (D-23): No HeaderNav nav element rendered. After D-23 the outer
  // <header> is the only navigation landmark in the chrome; no inner <nav>
  // with role="navigation" remains.
  it('Test B (D-23) — does not render the HeaderNav nav element', () => {
    render(<DesktopTopNav {...userProps()} />)
    const navs = screen.queryAllByRole('navigation')
    expect(navs.length).toBeLessThanOrEqual(1)
  })

  // Test C (D-24): leading magnifier icon inside the search input wrapper.
  // Asserts a sibling/preceding Search icon (lucide-react renders <svg>).
  it('Test C (D-24) — renders a leading Search icon in the persistent search input', () => {
    render(<DesktopTopNav {...userProps()} />)
    const input = screen.getByRole('searchbox')
    const wrapper = input.closest('form') ?? input.parentElement
    expect(wrapper?.querySelector('svg')).not.toBeNull()
  })

  // Test D (D-24): muted-fill background class on the input.
  it('Test D (D-24) — applies muted fill background to the persistent search input', () => {
    render(<DesktopTopNav {...userProps()} />)
    const input = screen.getByRole('searchbox')
    expect(input.className).toMatch(/bg-muted/)
  })

  // Test E (D-25 preserved): submit-only behavior still routes to
  // /search?q={encoded} — locks Phase 14 D-16 against accidental regression
  // when the input shell is restyled.
  it('Test E (D-25 preserved) — submit-only handler navigates to /search?q={encoded}', async () => {
    const setHref = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: {
        href: '',
        set href(v: string) {
          setHref(v)
        },
      },
    })
    try {
      render(<DesktopTopNav {...userProps()} />)
      const input = screen.getByRole('searchbox')
      await userEvent.type(input, 'bob{Enter}')
      expect(setHref).toHaveBeenCalledWith('/search?q=bob')
    } finally {
      Object.defineProperty(window, 'location', {
        writable: true,
        configurable: true,
        value: originalLocation,
      })
    }
  })
})
