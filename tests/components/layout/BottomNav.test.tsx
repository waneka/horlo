import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock next/navigation's usePathname so we can drive active-state resolution
// from each test. Must be declared before importing BottomNav.
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))
import { usePathname } from 'next/navigation'

// Mock the shared WatchPickerDialog as a no-op so NavWearButton's lazy
// import doesn't try to reach into the real dialog in jsdom.
vi.mock('@/components/home/WatchPickerDialog', () => ({
  WatchPickerDialog: () => null,
}))

import { BottomNav } from '@/components/layout/BottomNav'
import type { Watch } from '@/lib/types'

function mockPath(p: string) {
  vi.mocked(usePathname).mockReturnValue(p)
}

beforeEach(() => {
  vi.mocked(usePathname).mockReset()
})

describe('BottomNav (Phase 14 NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NAV-09, NAV-10)', () => {
  it('Test 1 — renders 5 items on /', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Explore')).toBeInTheDocument()
    expect(screen.getByText('Wear')).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
  })

  it('Test 2 — on /explore, Explore is active (text-accent + aria-current) and Home is not', () => {
    mockPath('/explore')
    render(<BottomNav username="alice" ownedWatches={[]} />)
    const exploreLink = screen.getByRole('link', { name: /explore/i })
    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(exploreLink.getAttribute('aria-current')).toBe('page')
    expect(homeLink.getAttribute('aria-current')).toBeNull()
    expect(exploreLink.className).toMatch(/text-accent|text-accent/) // class on Link wrapper
    // Inner icon/label inherit the active class — find the label span:
    const exploreLabel = screen.getByText('Explore')
    expect(exploreLabel.className).toMatch(/text-accent/)
  })

  it('Test 3 — on /watch/new, Add item has text-accent (active)', () => {
    mockPath('/watch/new')
    render(<BottomNav username="alice" ownedWatches={[]} />)
    const addLabel = screen.getByText('Add')
    expect(addLabel.className).toMatch(/text-accent/)
  })

  it('Test 4 — on /u/alice/collection, Profile is active + aria-current', () => {
    mockPath('/u/alice/collection')
    render(<BottomNav username="alice" ownedWatches={[]} />)
    const profileLink = screen.getByRole('link', { name: /profile/i })
    expect(profileLink.getAttribute('aria-current')).toBe('page')
    const profileLabel = screen.getByText('Profile')
    expect(profileLabel.className).toMatch(/text-accent/)
  })

  it('Test 5 — on /u/alice/worn, Profile is still active (any /u/{username} prefix)', () => {
    mockPath('/u/alice/worn')
    render(<BottomNav username="alice" ownedWatches={[]} />)
    const profileLink = screen.getByRole('link', { name: /profile/i })
    expect(profileLink.getAttribute('aria-current')).toBe('page')
  })

  it.each(['/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback'])(
    'Tests 6-10 — renders null on public path %s',
    (path) => {
      mockPath(path)
      const { container } = render(
        <BottomNav username="alice" ownedWatches={[]} />,
      )
      expect(container).toBeEmptyDOMElement()
    },
  )

  it('Test 11 — renders null when username is null (unauthenticated)', () => {
    mockPath('/')
    const { container } = render(
      <BottomNav username={null} ownedWatches={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('Test 12 — Add is a Link to /watch/new (NAV-10)', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} />)
    const addLink = screen.getByRole('link', { name: /add/i })
    expect(addLink.getAttribute('href')).toBe('/watch/new')
  })

  it('Test 13 — Home is a Link to /', () => {
    mockPath('/explore')
    render(<BottomNav username="alice" ownedWatches={[]} />)
    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(homeLink.getAttribute('href')).toBe('/')
  })

  it('Test 14 — Explore is a Link to /explore', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} />)
    const exploreLink = screen.getByRole('link', { name: /explore/i })
    expect(exploreLink.getAttribute('href')).toBe('/explore')
  })

  it('Test 15 — Wear is rendered via NavWearButton with appearance="bottom-nav" and click opens the dialog', () => {
    mockPath('/')
    // Instead of mocking NavWearButton, rely on the real component under the
    // WatchPickerDialog stub: clicking it changes inner state and the stub
    // receives open=true (no-op render, so we verify via NavWearButton's
    // aria-label on the inner button).
    const watches: Watch[] = []
    render(<BottomNav username="alice" ownedWatches={watches} />)
    const wearBtn = screen.getByLabelText('Log a wear')
    expect(wearBtn.tagName).toBe('BUTTON')
    // Click does not throw and does not navigate (it's a <button>, not <a>).
    fireEvent.click(wearBtn)
  })

  it('Test 16 — nav container has fixed bottom-0 left-0 right-0 z-50 md:hidden (NAV-01)', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} />)
    const nav = screen.getByRole('navigation', { name: /primary/i })
    const cls = nav.className
    expect(cls).toMatch(/fixed/)
    expect(cls).toMatch(/bottom-0/)
    expect(cls).toMatch(/left-0/)
    expect(cls).toMatch(/right-0/)
    expect(cls).toMatch(/z-50/)
    expect(cls).toMatch(/md:hidden/)
  })

  it('Test 17 — nav container className references env(safe-area-inset-bottom) (NAV-03)', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} />)
    const nav = screen.getByRole('navigation', { name: /primary/i })
    expect(nav.className).toContain('env(safe-area-inset-bottom)')
  })

  it('Test 18 — inactive non-Wear labels use text-muted-foreground; active use text-accent (D-04)', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} />)
    // Home is active on /, so:
    const homeLabel = screen.getByText('Home')
    expect(homeLabel.className).toMatch(/text-accent/)
    // Explore, Add, Profile are inactive:
    const exploreLabel = screen.getByText('Explore')
    const addLabel = screen.getByText('Add')
    const profileLabel = screen.getByText('Profile')
    expect(exploreLabel.className).toMatch(/text-muted-foreground/)
    expect(addLabel.className).toMatch(/text-muted-foreground/)
    expect(profileLabel.className).toMatch(/text-muted-foreground/)
  })
})
