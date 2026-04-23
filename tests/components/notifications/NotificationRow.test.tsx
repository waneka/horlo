import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — declared before component import so vitest hoists them.
// ---------------------------------------------------------------------------

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'aria-label': ariaLabel,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    'aria-label'?: string
  }) => (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

// AvatarDisplay renders a simple div with username initial in tests.
vi.mock('@/components/profile/AvatarDisplay', () => ({
  AvatarDisplay: ({ username, size }: { username: string; size: number }) => (
    <div data-testid="avatar" data-username={username} data-size={size} />
  ),
}))

// timeAgo returns a fixed string in tests for predictability.
vi.mock('@/lib/timeAgo', () => ({
  timeAgo: () => '2h',
}))

import { NotificationRow } from '@/components/notifications/NotificationRow'
import type { NotificationRowData } from '@/components/notifications/NotificationRow'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE = {
  id: 'notif-1',
  readAt: null,
  createdAt: new Date('2026-04-22T10:00:00Z'),
  actorUsername: 'alice',
  actorDisplayName: 'Alice',
  actorAvatarUrl: null,
} satisfies Partial<NotificationRowData>

function makeRow(overrides: Partial<NotificationRowData>): NotificationRowData {
  return {
    ...BASE,
    type: 'follow',
    payload: {},
    ...overrides,
  } as NotificationRowData
}

// Helper: get the full text content of the notification copy area (excluding time)
function getNotifCopyText(container: HTMLElement): string {
  // The copy div contains all the spans; we get its full textContent
  const copyDiv = container.querySelector('.flex-1')
  return copyDiv?.textContent ?? ''
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationRow', () => {
  describe('follow type', () => {
    it('renders actor name and follow copy', () => {
      const { container } = render(<NotificationRow row={makeRow({ type: 'follow', payload: {} })} />)
      const text = getNotifCopyText(container)
      expect(text).toContain('Alice')
      expect(text).toContain('started following you')
    })

    it('applies font-semibold actor class when unread', () => {
      render(
        <NotificationRow row={makeRow({ type: 'follow', payload: {}, readAt: null })} />,
      )
      const actorSpan = screen.getByText('Alice')
      expect(actorSpan.className).toContain('font-semibold')
    })

    it('applies font-normal actor class when read', () => {
      render(
        <NotificationRow
          row={makeRow({ type: 'follow', payload: {}, readAt: new Date() })}
        />,
      )
      const actorSpan = screen.getByText('Alice')
      expect(actorSpan.className).toContain('font-normal')
    })

    it('link routes to /u/[username]', () => {
      render(
        <NotificationRow
          row={makeRow({ type: 'follow', actorUsername: 'alice', payload: {} })}
        />,
      )
      const link = screen.getByRole('link')
      expect(link.getAttribute('href')).toBe('/u/alice')
    })
  })

  describe('watch_overlap type — single actor', () => {
    it('renders "also owns your" copy', () => {
      const { container } = render(
        <NotificationRow
          row={makeRow({
            type: 'watch_overlap',
            payload: { watch_model: 'Speedmaster' },
          })}
        />,
      )
      const text = getNotifCopyText(container)
      expect(text).toContain('also owns your')
      expect(text).toContain('Speedmaster')
    })

    it('link routes to /u/[username]?focusWatch=[id]', () => {
      render(
        <NotificationRow
          row={makeRow({
            type: 'watch_overlap',
            actorUsername: 'alice',
            payload: { watch_id: 'w-123', watch_model: 'Speedmaster' },
          })}
        />,
      )
      const link = screen.getByRole('link')
      expect(link.getAttribute('href')).toBe('/u/alice?focusWatch=w-123')
    })
  })

  describe('watch_overlap type — grouped (actorCount > 1)', () => {
    it('renders "+ N others also own your" grouped copy', () => {
      const { container } = render(
        <NotificationRow
          row={makeRow({
            type: 'watch_overlap',
            payload: { watch_model: 'Speedmaster' },
            actorCount: 3,
          })}
        />,
      )
      const text = getNotifCopyText(container)
      expect(text).toContain('+ 2 others also own your')
      expect(text).toContain('Speedmaster')
    })
  })

  describe('price_drop type', () => {
    it('renders price drop stub copy', () => {
      const { container } = render(
        <NotificationRow
          row={makeRow({
            type: 'price_drop',
            payload: { watchModel: 'Aqua Terra', newPrice: '$4,200' },
            actorUsername: null,
            actorDisplayName: null,
          })}
        />,
      )
      const text = getNotifCopyText(container)
      expect(text).toContain('Aqua Terra')
      expect(text).toContain('wishlist watch dropped to')
      expect(text).toContain('$4,200')
    })
  })

  describe('trending_collector type', () => {
    it('renders trending stub copy', () => {
      const { container } = render(
        <NotificationRow
          row={makeRow({
            type: 'trending_collector',
            payload: { watchModel: 'Datejust', actorCount: 5 },
            actorUsername: null,
            actorDisplayName: null,
          })}
        />,
      )
      const text = getNotifCopyText(container)
      expect(text).toContain('5 collectors')
      expect(text).toContain('in your taste cluster added a')
      expect(text).toContain('Datejust')
    })
  })

  describe('unknown type (B-8 guard)', () => {
    it('renders null for unknown type', () => {
      const { container } = render(
        <NotificationRow
          row={
            {
              ...makeRow({}),
              type: 'unknown_future_type',
            } as unknown as NotificationRowData
          }
        />,
      )
      expect(container.firstChild).toBeNull()
    })
  })

  describe('unread visual (D-14)', () => {
    it('adds border-l-accent class when unread', () => {
      render(
        <NotificationRow row={makeRow({ type: 'follow', payload: {}, readAt: null })} />,
      )
      const link = screen.getByRole('link')
      expect(link.className).toContain('border-l-accent')
    })

    it('does NOT add border-l-accent when read', () => {
      render(
        <NotificationRow
          row={makeRow({ type: 'follow', payload: {}, readAt: new Date() })}
        />,
      )
      const link = screen.getByRole('link')
      expect(link.className).not.toContain('border-l-accent')
    })
  })

  describe('AvatarDisplay', () => {
    it('renders AvatarDisplay with size=40', () => {
      render(<NotificationRow row={makeRow({ type: 'follow', payload: {} })} />)
      const avatar = screen.getByTestId('avatar')
      expect(avatar.getAttribute('data-size')).toBe('40')
    })
  })

  describe('time display', () => {
    it('renders the relative time from timeAgo()', () => {
      const { container } = render(<NotificationRow row={makeRow({ type: 'follow', payload: {} })} />)
      const text = getNotifCopyText(container)
      expect(text).toContain('2h')
    })
  })
})
