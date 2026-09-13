/**
 * 84-REVIEW WR-04 / WR-05 — WornTabContent wiring of WearLeaderboard.
 *
 * - WR-04: leaderboard rows link to /w/{id} only when the viewer can open
 *   the watch page (isOwner || collectionPublic).
 * - WR-05: the leaderboard is not mounted when there are no wears at all
 *   (the empty card covers that state), and the owner-only "log a wear"
 *   copy is gated on isOwner.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

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

vi.mock('@/lib/wear', async (orig) => {
  const actual = await orig<typeof import('@/lib/wear')>()
  return { ...actual, todayLocalISO: () => '2026-09-12' }
})

// Isolate from the timeline/calendar/form/select internals — only the
// leaderboard wiring is under test here.
vi.mock('@/components/profile/WornTimeline', () => ({
  WornTimeline: () => <div data-testid="worn-timeline" />,
}))
vi.mock('@/components/profile/WornCalendar', () => ({
  WornCalendar: () => <div data-testid="worn-calendar" />,
}))
vi.mock('@/components/profile/LogTodaysWearButton', () => ({
  LogTodaysWearButton: () => <button type="button">Log a wear</button>,
}))
vi.mock('@/components/profile/ViewTogglePill', () => ({
  ViewTogglePill: () => null,
}))
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}))

import { WornTabContent } from '@/components/profile/WornTabContent'

const WATCH = { id: 'watch-a', brand: 'Omega', model: 'Speedmaster', imageUrl: null }
const EVENTS = [
  { id: 'e1', watchId: WATCH.id, wornDate: '2026-09-01', note: null, photoUrl: null },
]
const VIEWER = '11111111-1111-1111-1111-111111111111'

function renderContent(overrides: Partial<React.ComponentProps<typeof WornTabContent>> = {}) {
  return render(
    <WornTabContent
      events={EVENTS}
      watchMap={{ [WATCH.id]: WATCH }}
      isOwner={false}
      username="alice"
      viewerId={VIEWER}
      ownedWatches={[WATCH]}
      collectionPublic={false}
      {...overrides}
    />,
  )
}

describe('WornTabContent leaderboard wiring', () => {
  it('WR-04: non-owner of a private collection gets unlinked leaderboard rows', () => {
    renderContent({ isOwner: false, collectionPublic: false })

    expect(screen.getByRole('heading', { name: 'Wear leaderboard' })).toBeInTheDocument()
    expect(document.querySelector('a[href^="/w/"]')).toBeNull()
    expect(document.querySelectorAll('[data-slot="leaderboard-row"]')).toHaveLength(1)
  })

  it('WR-04: non-owner of a public collection gets linked rows', () => {
    renderContent({ isOwner: false, collectionPublic: true })
    expect(document.querySelector(`a[href="/w/${WATCH.id}"]`)).not.toBeNull()
  })

  it('WR-04: owner of a private collection gets linked rows', () => {
    renderContent({ isOwner: true, collectionPublic: false })
    expect(document.querySelector(`a[href="/w/${WATCH.id}"]`)).not.toBeNull()
  })

  it('WR-05: zero wears (owner) shows only the empty card — no leaderboard', () => {
    renderContent({ events: [], isOwner: true, collectionPublic: true })

    expect(screen.getByText('No wears logged yet.')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Wear leaderboard' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('No wears in this window.')).not.toBeInTheDocument()
    expect(screen.queryByText(/0 wears/)).not.toBeInTheDocument()
  })

  it('WR-05: zero wears (non-owner) shows only the empty card — no leaderboard', () => {
    renderContent({ events: [], isOwner: false, collectionPublic: true })

    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Wear leaderboard' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/log a wear/i)).not.toBeInTheDocument()
  })
})
