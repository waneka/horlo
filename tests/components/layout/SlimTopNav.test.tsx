import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

let mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

import { SlimTopNav } from '@/components/layout/SlimTopNav'

const bellStub = <div data-testid="bell" />

describe('SlimTopNav (Phase 14 D-11 / D-23 — mobile top chrome)', () => {
  beforeEach(() => {
    mockPathname = '/'
  })

  it('Test 1 — renders 4 elements in order: wordmark "Horlo", search icon, bell, settings cog', () => {
    const { container } = render(<SlimTopNav hasUser bell={bellStub} />)
    // wordmark
    expect(screen.getByText('Horlo')).toBeInTheDocument()
    // search icon link
    const search = screen.getByRole('link', { name: /^search$/i })
    expect(search).toBeTruthy()
    // bell (stub)
    expect(screen.getByTestId('bell')).toBeTruthy()
    // settings link
    const settings = screen.getByRole('link', { name: /^settings$/i })
    expect(settings).toBeTruthy()

    // Order assertion: walk the nav cluster children
    const headerEl = container.querySelector('header')
    expect(headerEl).toBeTruthy()
    const text = headerEl!.textContent ?? ''
    // Horlo appears first; bell stub and settings follow; no guarantee on icon text so we assert dom order via index lookup
    const all = Array.from(
      headerEl!.querySelectorAll('[data-testid="bell"], a, span'),
    )
    // Find indices of: wordmark span (Horlo text), search link (aria-label Search), bell, settings link
    const idxWordmark = all.findIndex((n) => n.textContent === 'Horlo')
    const idxSearch = all.findIndex(
      (n) => (n as HTMLElement).getAttribute?.('aria-label') === 'Search',
    )
    const idxBell = all.findIndex(
      (n) => (n as HTMLElement).getAttribute?.('data-testid') === 'bell',
    )
    const idxSettings = all.findIndex(
      (n) => (n as HTMLElement).getAttribute?.('aria-label') === 'Settings',
    )
    expect(idxWordmark).toBeGreaterThanOrEqual(0)
    expect(idxSearch).toBeGreaterThan(idxWordmark)
    expect(idxBell).toBeGreaterThan(idxSearch)
    expect(idxSettings).toBeGreaterThan(idxBell)
    // Silences "text" unused lint
    expect(text).toContain('Horlo')
  })

  it('Test 2 — wordmark link has href="/"', () => {
    const { container } = render(<SlimTopNav hasUser bell={bellStub} />)
    // Wordmark link is the anchor containing the Horlo span
    const links = container.querySelectorAll('a')
    const wordmarkLink = Array.from(links).find(
      (a) => a.textContent === 'Horlo',
    )
    expect(wordmarkLink).toBeTruthy()
    expect(wordmarkLink!.getAttribute('href')).toBe('/')
  })

  it('Test 3 — search icon link has href="/search"', () => {
    render(<SlimTopNav hasUser bell={bellStub} />)
    const search = screen.getByRole('link', { name: /^search$/i })
    expect(search.getAttribute('href')).toBe('/search')
  })

  it('Test 4 — settings cog link has href="/settings"', () => {
    render(<SlimTopNav hasUser bell={bellStub} />)
    const settings = screen.getByRole('link', { name: /^settings$/i })
    expect(settings.getAttribute('href')).toBe('/settings')
  })

  it('Test 5 — component renders a <header> with md:hidden class (mobile-only)', () => {
    const { container } = render(<SlimTopNav hasUser bell={bellStub} />)
    const header = container.querySelector('header')
    expect(header).toBeTruthy()
    expect(header!.className).toContain('md:hidden')
  })

  it('Test 6 — component has sticky positioning (sticky top-0 and z-50)', () => {
    const { container } = render(<SlimTopNav hasUser bell={bellStub} />)
    const header = container.querySelector('header')!
    expect(header.className).toContain('sticky')
    expect(header.className).toContain('top-0')
    expect(header.className).toContain('z-50')
  })

  it('Test 7 — when hasUser is false, bell is NOT rendered', () => {
    render(<SlimTopNav hasUser={false} bell={bellStub} />)
    expect(screen.queryByTestId('bell')).toBeNull()
  })

  it('Test 8 — when pathname is /login, component returns null (isPublicPath gate)', () => {
    mockPathname = '/login'
    const { container } = render(<SlimTopNav hasUser bell={bellStub} />)
    expect(container.querySelector('header')).toBeNull()
    expect(container.firstChild).toBeNull()
  })
})
