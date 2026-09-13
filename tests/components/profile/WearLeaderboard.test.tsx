/**
 * Phase 84 Plan 05 — WearLeaderboard RTL suite (WEAR-03 / WEAR-04).
 *
 * Covers: window tablist (D-09) + roving-tabindex keyboard nav (Phase 68
 * pattern), zero-wear-inclusive ranking + re-rank on window change (D-13),
 * top-5 expander (D-11), row links to /w/[id] (D-12), proportional accent
 * bar widths (D-10), and the "No wears in this window." empty state.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'

// next/link stub — avoid Next.js router context in unit tests (precedent:
// tests/components/home/WatchPickerDialog.test.tsx, tests/unit/WornTimeline.test.tsx).
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

// Pin "today" so window-filtering math is deterministic across the suite.
vi.mock('@/lib/wear', async (orig) => {
  const actual = await orig<typeof import('@/lib/wear')>()
  return {
    ...actual,
    todayLocalISO: () => '2026-09-12',
  }
})

import { WearLeaderboard } from '@/components/profile/WearLeaderboard'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface FixtureWatch {
  id: string
  brand: string
  model: string
  imageUrl: string | null
}

const WATCH_A: FixtureWatch = { id: 'watch-a', brand: 'Omega', model: 'Speedmaster', imageUrl: null }
const WATCH_B: FixtureWatch = { id: 'watch-b', brand: 'Rolex', model: 'Datejust', imageUrl: null }
const WATCH_C: FixtureWatch = { id: 'watch-c', brand: 'Tudor', model: 'Black Bay', imageUrl: null }
const WATCH_D: FixtureWatch = { id: 'watch-d', brand: 'Grand Seiko', model: 'SBGA211', imageUrl: null }
const WATCH_E: FixtureWatch = { id: 'watch-e', brand: 'Cartier', model: 'Tank', imageUrl: null }
const WATCH_F: FixtureWatch = { id: 'watch-f', brand: 'Seiko', model: 'SKX007', imageUrl: null }
const WATCH_G: FixtureWatch = { id: 'watch-g', brand: 'Zenith', model: 'El Primero', imageUrl: null }

const ALL_WATCHES = [WATCH_A, WATCH_B, WATCH_C, WATCH_D, WATCH_E, WATCH_F, WATCH_G]

function rowLinks() {
  return within(screen.getByRole('list')).getAllByRole('link')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WearLeaderboard', () => {
  it('L1: renders heading and a 5-tab window control defaulting to 3 mo', () => {
    render(<WearLeaderboard events={[]} watches={ALL_WATCHES} />)

    expect(screen.getByRole('heading', { name: 'Wear leaderboard' })).toBeInTheDocument()

    const tablist = screen.getByRole('tablist')
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    expect(tabs.map((t) => t.textContent)).toEqual(['1 mo', '3 mo', '6 mo', '12 mo', 'All time'])

    tabs.forEach((tab) => {
      if (tab.textContent === '3 mo') {
        expect(tab.getAttribute('aria-selected')).toBe('true')
        expect(tab.tabIndex).toBe(0)
      } else {
        expect(tab.getAttribute('aria-selected')).toBe('false')
        expect(tab.tabIndex).toBe(-1)
      }
    })
  })

  it('L2: ranks owned watches by window count and reranks on window change', () => {
    const events = [
      { watchId: WATCH_A.id, wornDate: '2026-08-01' },
      { watchId: WATCH_A.id, wornDate: '2026-08-02' },
      { watchId: WATCH_B.id, wornDate: '2026-05-01' },
      { watchId: WATCH_B.id, wornDate: '2026-05-02' },
      { watchId: WATCH_B.id, wornDate: '2026-05-03' },
    ]
    render(<WearLeaderboard events={events} watches={ALL_WATCHES} />)

    let links = rowLinks()
    expect(links[0].textContent).toContain('Omega Speedmaster')
    expect(links[0].textContent).toContain('2 wears')
    const bRowDefault = links.find((l) => l.textContent?.includes('Rolex Datejust'))
    expect(bRowDefault?.textContent).toContain('0 wears')

    fireEvent.click(screen.getByRole('tab', { name: '6 mo' }))

    links = rowLinks()
    expect(links[0].textContent).toContain('Rolex Datejust')
    expect(links[0].textContent).toContain('3 wears')
    expect(links[1].textContent).toContain('Omega Speedmaster')
    expect(links[1].textContent).toContain('2 wears')
  })

  it('L3: arrow/Home/End keys move tab selection with wraparound', () => {
    render(<WearLeaderboard events={[]} watches={ALL_WATCHES} />)

    const threeMo = screen.getByRole('tab', { name: '3 mo' })
    threeMo.focus()

    fireEvent.keyDown(threeMo, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: '6 mo' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: '3 mo' }).getAttribute('aria-selected')).toBe('false')

    fireEvent.keyDown(screen.getByRole('tab', { name: '6 mo' }), { key: 'End' })
    expect(screen.getByRole('tab', { name: 'All time' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(screen.getByRole('tab', { name: 'All time' }), { key: 'Home' })
    expect(screen.getByRole('tab', { name: '1 mo' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(screen.getByRole('tab', { name: '1 mo' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'All time' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(screen.getByRole('tab', { name: 'All time' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: '1 mo' }).getAttribute('aria-selected')).toBe('true')
  })

  it('L4: zero-wear rows sort A→Z after ranked rows; singular "1 wear" for a count of 1', () => {
    const events = [{ watchId: WATCH_C.id, wornDate: '2026-07-01' }]
    render(<WearLeaderboard events={events} watches={ALL_WATCHES} />)

    const links = rowLinks()
    expect(links[0].textContent).toContain('Tudor Black Bay')
    expect(links[0].textContent).toContain('1 wear')
    expect(links[0].textContent).not.toContain('1 wears')

    // Remaining top-5 slots are zero-wear rows sorted A→Z by "Brand Model".
    expect(links[1].textContent).toContain('Cartier Tank')
    expect(links[1].textContent).toContain('0 wears')
    expect(links[2].textContent).toContain('Grand Seiko SBGA211')
    expect(links[3].textContent).toContain('Omega Speedmaster')
    expect(links[4].textContent).toContain('Rolex Datejust')
  })

  it('L5: expander shows all rows and toggles "Show all" / "Show less"', () => {
    render(<WearLeaderboard events={[]} watches={ALL_WATCHES} />)

    expect(rowLinks()).toHaveLength(5)
    const expandButton = screen.getByRole('button', { name: 'Show all' })
    expect(expandButton.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(expandButton)
    expect(rowLinks()).toHaveLength(7)
    const collapseButton = screen.getByRole('button', { name: 'Show less' })
    expect(collapseButton.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(collapseButton)
    expect(rowLinks()).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Show less' })).not.toBeInTheDocument()
  })

  it('L6: row link href equals /w/<watch id> for the first row', () => {
    render(<WearLeaderboard events={[]} watches={ALL_WATCHES} />)
    const links = rowLinks()
    // All watches are zero-wear here; A→Z by "Brand Model" puts Cartier Tank first.
    expect(links[0].getAttribute('href')).toBe(`/w/${WATCH_E.id}`)
  })

  it('L6b (WR-04): linkable=false renders plain unlinked rows (private collection, non-owner)', () => {
    render(
      <WearLeaderboard
        events={[{ watchId: WATCH_A.id, wornDate: '2026-09-01' }]}
        watches={ALL_WATCHES}
        linkable={false}
      />,
    )
    const list = screen.getByRole('list')
    expect(within(list).queryAllByRole('link')).toHaveLength(0)
    expect(document.querySelector('a[href^="/w/"]')).toBeNull()
    const rows = document.querySelectorAll('[data-slot="leaderboard-row"]')
    expect(rows).toHaveLength(5)
    expect(rows[0].textContent).toContain('Omega Speedmaster')
    expect(rows[0].textContent).toContain('1 wear')
  })

  it('L7: shows the empty-window note only when every count is zero', () => {
    const { rerender } = render(<WearLeaderboard events={[]} watches={ALL_WATCHES} />)

    expect(screen.getByText('No wears in this window.')).toBeInTheDocument()
    expect(
      screen.getByText('Try a longer window, or log a wear to get started.'),
    ).toBeInTheDocument()
    rowLinks().forEach((l) => expect(l.textContent).toContain('0 wears'))

    rerender(
      <WearLeaderboard
        events={[{ watchId: WATCH_A.id, wornDate: '2026-09-01' }]}
        watches={ALL_WATCHES}
      />,
    )
    expect(screen.queryByText('No wears in this window.')).not.toBeInTheDocument()
  })

  it('L8: bar fill widths are proportional to the top row count', () => {
    const events = [
      { watchId: WATCH_A.id, wornDate: '2026-08-01' },
      { watchId: WATCH_A.id, wornDate: '2026-08-02' },
      { watchId: WATCH_A.id, wornDate: '2026-08-03' },
      { watchId: WATCH_A.id, wornDate: '2026-08-04' },
      { watchId: WATCH_B.id, wornDate: '2026-08-01' },
      { watchId: WATCH_B.id, wornDate: '2026-08-02' },
    ]
    render(<WearLeaderboard events={events} watches={ALL_WATCHES} />)

    const bars = document.querySelectorAll('[data-slot="leaderboard-bar-fill"]')
    expect((bars[0] as HTMLElement).style.width).toBe('100%')
    expect((bars[1] as HTMLElement).style.width).toBe('50%')
    expect((bars[2] as HTMLElement).style.width).toBe('0%')
  })

  it('L9: renders nothing when watches is empty', () => {
    const { container } = render(<WearLeaderboard events={[]} watches={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('L10: rank numbers increment starting at 1', () => {
    render(<WearLeaderboard events={[]} watches={ALL_WATCHES} />)
    const ranks = document.querySelectorAll('[data-slot="leaderboard-rank"]')
    expect(ranks[0].textContent).toBe('1')
    expect(ranks[1].textContent).toBe('2')
  })

  it('L11: ignores events referencing watch ids not present in watches', () => {
    const events = [{ watchId: 'watch-x', wornDate: '2026-08-01' }]
    render(<WearLeaderboard events={events} watches={ALL_WATCHES} />)

    const links = rowLinks()
    expect(links).toHaveLength(5)
    links.forEach((l) => expect(l.textContent).toContain('0 wears'))
    expect(screen.queryByText(/watch-x/)).not.toBeInTheDocument()
  })
})
