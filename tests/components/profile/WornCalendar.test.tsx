import { render, fireEvent, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

// next/link stub — avoid Next.js router context in unit tests (precedent:
// tests/components/home/WatchPickerDialog.test.tsx).
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

import { WornCalendar } from '@/components/profile/WornCalendar'

describe('WornCalendar', () => {
  it('selects first day with events on mount', () => {
    render(
      <WornCalendar
        events={[
          {
            id: 'e1',
            watchId: 'w1',
            wornDate: '2026-05-03',
            note: 'breakfast wear',
          },
          { id: 'e2', watchId: 'w1', wornDate: '2026-05-10', note: null },
        ]}
        watchMap={{
          w1: {
            id: 'w1',
            brand: 'Rolex',
            model: 'Submariner',
            imageUrl: null,
          },
        }}
      />,
    )
    expect(screen.getByText('breakfast wear')).toBeTruthy()
  })

  it('sets selectedDate on day-with-events click', () => {
    render(
      <WornCalendar
        events={[
          {
            id: 'e1',
            watchId: 'w1',
            wornDate: '2026-05-03',
            note: 'breakfast wear',
          },
          {
            id: 'e2',
            watchId: 'w1',
            wornDate: '2026-05-10',
            note: 'evening wear',
          },
        ]}
        watchMap={{
          w1: {
            id: 'w1',
            brand: 'Rolex',
            model: 'Submariner',
            imageUrl: null,
          },
        }}
      />,
    )
    fireEvent.click(screen.getByLabelText(/View wear events for 2026-05-10/))
    expect(screen.getByText('evening wear')).toBeTruthy()
  })

  it('renders "No wear events on …" caption when an empty day is selected (W1 fix — initialSelectedDate prop)', () => {
    // W1 fix: use the test-only initialSelectedDate prop to drive the
    // empty-day code path. The fixture has events on 2026-05-03 and 2026-05-10,
    // but the initial selection of 2026-05-12 has zero events, so the
    // conditional logic in WornCalendar's wear-detail panel surfaces the
    // empty-day caption.
    render(
      <WornCalendar
        events={[
          {
            id: 'e1',
            watchId: 'w1',
            wornDate: '2026-05-03',
            note: 'breakfast wear',
          },
          {
            id: 'e2',
            watchId: 'w1',
            wornDate: '2026-05-10',
            note: 'evening wear',
          },
        ]}
        watchMap={{
          w1: {
            id: 'w1',
            brand: 'Rolex',
            model: 'Submariner',
            imageUrl: null,
          },
        }}
        initialSelectedDate="2026-05-12"
      />,
    )
    // Assert the rendered text from the conditional empty-day branch.
    // formatDateLabel('2026-05-12') in en-US produces e.g. "Tue, May 12".
    expect(screen.getByText(/No wear events on /)).toBeTruthy()
  })

  it('clicking an empty day cell selects it and surfaces the empty-state caption (260513-m31 — empty-day clickability)', () => {
    // Quick task 260513-m31 — supersedes the dayEvents.length > 0 interactivity
    // gate at WornCalendar.tsx:195. Empty days are now user-reachable via
    // mouse + keyboard; the "No wear events on [date]" caption (existing
    // branch at line 252) now surfaces without the test-only
    // initialSelectedDate prop. Same fixture as test 2; click 2026-05-12
    // (an empty day in May 2026).
    render(
      <WornCalendar
        events={[
          {
            id: 'e1',
            watchId: 'w1',
            wornDate: '2026-05-03',
            note: 'breakfast wear',
          },
          {
            id: 'e2',
            watchId: 'w1',
            wornDate: '2026-05-10',
            note: 'evening wear',
          },
        ]}
        watchMap={{
          w1: {
            id: 'w1',
            brand: 'Rolex',
            model: 'Submariner',
            imageUrl: null,
          },
        }}
      />,
    )
    fireEvent.click(screen.getByLabelText('View wear events for 2026-05-12'))
    expect(screen.getByText(/No wear events on /)).toBeTruthy()
  })
})

describe('WornCalendar — WEAR-01 panel row links (D-15)', () => {
  // Anchor fixture dates to the current month (not a hardcoded month) so the
  // calendar grid — which always opens on the current cursor month — actually
  // renders the day cells these tests click. Hardcoded past months are a
  // pre-existing baseline-flake pattern in this file (see the three
  // "month-dependent" tests above, called out as an acceptable baseline
  // failure in 84-01-PLAN.md's <verification> section); these new tests
  // avoid reintroducing that flake.
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  const day1 = `${y}-${pad(m)}-03`
  const day2 = `${y}-${pad(m)}-10`

  const events = [
    {
      id: 'e1',
      watchId: 'w1',
      wornDate: day1,
      note: 'breakfast wear',
    },
    {
      id: 'e2',
      watchId: 'w1',
      wornDate: day2,
      note: 'evening wear',
    },
  ]
  const watchMap = {
    w1: {
      id: 'w1',
      brand: 'Rolex',
      model: 'Submariner',
      imageUrl: null,
    },
  }

  it('Test A: selected-day panel row links to /wear/[id] and contains the note', () => {
    render(
      <WornCalendar
        events={events}
        watchMap={watchMap}
        initialSelectedDate={day1}
      />,
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/wear/e1')
    expect(link.textContent).toContain('breakfast wear')
    expect(screen.queryByRole('link', { name: /evening wear/ })).toBeNull()
  })

  it('Test B: reselecting a day shows the new link and the old link disappears', () => {
    render(
      <WornCalendar
        events={events}
        watchMap={watchMap}
        initialSelectedDate={day1}
      />,
    )
    fireEvent.click(screen.getByLabelText(new RegExp(`View wear events for ${day2}`)))
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/wear/e2')
    expect(
      screen.queryAllByRole('link').find((l) => l.getAttribute('href') === '/wear/e1'),
    ).toBeUndefined()
  })

  it('Test C: the day cell stays a non-link div[role=button]', () => {
    render(
      <WornCalendar
        events={events}
        watchMap={watchMap}
        initialSelectedDate={day1}
      />,
    )
    const cell = screen.getByLabelText(new RegExp(`View wear events for ${day2}`))
    expect(cell.tagName).toBe('DIV')
    expect(cell.getAttribute('role')).toBe('button')
    expect(cell.hasAttribute('href')).toBe(false)
  })
})
