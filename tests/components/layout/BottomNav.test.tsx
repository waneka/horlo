import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next/navigation's usePathname so we can drive active-state resolution
// from each test. Must be declared before importing BottomNav.
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))
import { usePathname } from 'next/navigation'

// Mock NavWearButton to avoid pulling in its Phase 15 dialog dependencies
// (WywtPostDialog → WatchPickerDialog → ComposeStep → PhotoUploader → heic
// worker chunk) into this BottomNav unit test. The Wear cradle is unchanged
// in Phase 18 D-01..D-04, so a stub renderer is sufficient — the rail
// integrity is exercised by the NavWearButton test itself.
vi.mock('@/components/layout/NavWearButton', () => ({
  NavWearButton: ({ appearance }: { appearance: string }) => (
    <div data-testid="wear-button" data-appearance={appearance}>
      Wear
    </div>
  ),
}))

import { BottomNav } from '@/components/layout/BottomNav'

function mockPath(p: string) {
  vi.mocked(usePathname).mockReturnValue(p)
}

beforeEach(() => {
  vi.mocked(usePathname).mockReset()
})

describe('BottomNav (Phase 18 D-01..D-04 — final v4.0 5-slot shape)', () => {
  it('Test 1 — renders 5 slots in correct order: Home / Search / Wear / Explore / Profile', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} viewerId="u1" />)
    // All 5 slot labels must be visible in DOM document order.
    const expected = ['Home', 'Search', 'Wear', 'Explore', 'Profile']
    for (const label of expected) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // Verify document order: query the nav and walk its visible text.
    const nav = screen.getByRole('navigation', { name: /primary/i })
    const text = nav.textContent ?? ''
    let lastIndex = -1
    for (const label of expected) {
      const idx = text.indexOf(label)
      expect(idx).toBeGreaterThan(lastIndex)
      lastIndex = idx
    }
  })

  it('Test 2 — Search slot routes to /search', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} viewerId="u1" />)
    const searchLink = screen.getByRole('link', { name: /search/i })
    expect(searchLink.getAttribute('href')).toBe('/search')
  })

  it('Test 3 — Explore slot routes to /explore', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} viewerId="u1" />)
    const exploreLink = screen.getByRole('link', { name: /explore/i })
    expect(exploreLink.getAttribute('href')).toBe('/explore')
  })

  it('Test 4 — Profile slot routes to /u/alice/collection', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} viewerId="u1" />)
    const profileLink = screen.getByRole('link', { name: /profile/i })
    expect(profileLink.getAttribute('href')).toBe('/u/alice/collection')
  })

  it('Test 5 — no Add slot (D-02 — Add slot dropped)', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} viewerId="u1" />)
    expect(screen.queryByText('Add')).toBeNull()
    expect(screen.queryByRole('link', { name: /^Add$/i })).toBeNull()
    // No <Plus /> icon should ship in BottomNav anymore — verify no link
    // points at the legacy /watch/new bottom-tap target.
    const watchNewLink = screen.queryByRole('link', { name: /watch\/new/i })
    expect(watchNewLink).toBeNull()
  })

  it('Test 6 — Search active when pathname=/search; Explore is not', () => {
    mockPath('/search')
    render(<BottomNav username="alice" ownedWatches={[]} viewerId="u1" />)
    const searchLink = screen.getByRole('link', { name: /search/i })
    const exploreLink = screen.getByRole('link', { name: /explore/i })
    expect(searchLink.getAttribute('aria-current')).toBe('page')
    expect(exploreLink.getAttribute('aria-current')).toBeNull()
  })

  it('Test 7 — Explore active when pathname=/explore; Search is not', () => {
    mockPath('/explore')
    render(<BottomNav username="alice" ownedWatches={[]} viewerId="u1" />)
    const exploreLink = screen.getByRole('link', { name: /explore/i })
    const searchLink = screen.getByRole('link', { name: /search/i })
    expect(exploreLink.getAttribute('aria-current')).toBe('page')
    expect(searchLink.getAttribute('aria-current')).toBeNull()
  })

  it('Test 8 — Search active for nested /search/people (startsWith match)', () => {
    mockPath('/search/people')
    render(<BottomNav username="alice" ownedWatches={[]} viewerId="u1" />)
    const searchLink = screen.getByRole('link', { name: /search/i })
    expect(searchLink.getAttribute('aria-current')).toBe('page')
  })

  it('Test 9 — returns null on PUBLIC_PATH (e.g. /login)', () => {
    mockPath('/login')
    const { container } = render(
      <BottomNav username="alice" ownedWatches={[]} viewerId="u1" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('Test 10 — returns null when username is null (unauthenticated)', () => {
    mockPath('/')
    const { container } = render(
      <BottomNav username={null} ownedWatches={[]} viewerId="u1" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('Test 11 — Wear cradle (NavWearButton) present with appearance="bottom-nav"', () => {
    mockPath('/')
    render(<BottomNav username="alice" ownedWatches={[]} viewerId="u1" />)
    const wearStub = screen.getByTestId('wear-button')
    expect(wearStub).toBeInTheDocument()
    expect(wearStub.getAttribute('data-appearance')).toBe('bottom-nav')
  })
})
