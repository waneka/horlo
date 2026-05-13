import { render, fireEvent, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

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
