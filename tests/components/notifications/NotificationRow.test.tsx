import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — declared before component import so vitest hoists them.
// ---------------------------------------------------------------------------

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

// D-08: next/navigation + markNotificationRead mocks for the optimistic read
// flow. Declared before component import so vi.mock calls hoist.
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

vi.mock('@/app/actions/notifications', () => ({
  markNotificationRead: vi.fn(async () => ({ success: true, data: undefined })),
}))

import { NotificationRow } from '@/components/notifications/NotificationRow'
import type { NotificationRowData } from '@/components/notifications/NotificationRow'
import { markNotificationRead } from '@/app/actions/notifications'

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

    it('link aria-label includes actor name and routes via click (see D-08 suite)', () => {
      render(
        <NotificationRow
          row={makeRow({ type: 'follow', actorUsername: 'alice', payload: {} })}
        />,
      )
      const link = screen.getByRole('link')
      // Href is no longer an anchor attribute — navigation runs via router.push
      // in the click handler. The aria-label carries the actor name instead.
      expect(link.getAttribute('aria-label')).toBe('Alice notification')
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

    it('click navigates to /u/[username]?focusWatch=[id] via router.push', async () => {
      mockPush.mockClear()
      ;(markNotificationRead as Mock).mockResolvedValue({ success: true, data: undefined })
      render(
        <NotificationRow
          row={makeRow({
            type: 'watch_overlap',
            actorUsername: 'alice',
            payload: { watch_id: 'w-123', watch_model: 'Speedmaster', actor_username: 'alice' },
          })}
        />,
      )
      const link = screen.getByRole('link')
      await act(async () => {
        fireEvent.click(link)
      })
      expect(mockPush).toHaveBeenCalledWith('/u/alice?focusWatch=w-123')
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

  // ---------------------------------------------------------------------------
  // D-08: per-row optimistic read-then-navigate flow
  // ---------------------------------------------------------------------------
  describe('NotificationRow — D-08 per-row optimistic read', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      ;(markNotificationRead as Mock).mockResolvedValue({ success: true, data: undefined })
    })

    it('click on unread follow row calls markNotificationRead with the row id', async () => {
      const row = makeRow({ type: 'follow', readAt: null, id: 'abc-1' })
      render(<NotificationRow row={row} />)
      const link = screen.getByRole('link', { name: /notification/i })
      await act(async () => {
        fireEvent.click(link)
      })
      expect(markNotificationRead).toHaveBeenCalledWith({ notificationId: 'abc-1' })
    })

    it('click on unread row navigates via router.push to the resolved href', async () => {
      const row = makeRow({
        type: 'follow',
        readAt: null,
        id: 'abc-2',
        actorUsername: 'alice',
        payload: { actor_username: 'alice' },
      })
      render(<NotificationRow row={row} />)
      const link = screen.getByRole('link', { name: /notification/i })
      await act(async () => {
        fireEvent.click(link)
      })
      expect(mockPush).toHaveBeenCalledWith('/u/alice')
    })

    it('click on unread row optimistically drops border-l-accent immediately', async () => {
      // Slow the SA so we can catch the optimistic state before it resolves.
      ;(markNotificationRead as Mock).mockImplementationOnce(
        () =>
          new Promise((r) => setTimeout(() => r({ success: true, data: undefined }), 50)),
      )
      const row = makeRow({ type: 'follow', readAt: null, id: 'abc-3' })
      const { container } = render(<NotificationRow row={row} />)
      const link = container.querySelector('[role="link"]') as HTMLElement
      expect(link.className).toContain('border-l-accent') // unread before click
      await act(async () => {
        fireEvent.click(link)
      })
      // After the click, optimistic state flips immediately — the border class is gone
      // even though the SA promise may still be pending.
      expect(link.className).not.toContain('border-l-accent')
    })

    it('click on already-read row navigates but does NOT call markNotificationRead', async () => {
      const row = makeRow({ type: 'follow', readAt: new Date(), id: 'abc-4' })
      render(<NotificationRow row={row} />)
      const link = screen.getByRole('link', { name: /notification/i })
      await act(async () => {
        fireEvent.click(link)
      })
      expect(markNotificationRead).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalled()
    })

    it('Enter key on focused row triggers the same flow as click', async () => {
      const row = makeRow({ type: 'follow', readAt: null, id: 'abc-5' })
      render(<NotificationRow row={row} />)
      const link = screen.getByRole('link', { name: /notification/i })
      await act(async () => {
        fireEvent.keyDown(link, { key: 'Enter' })
      })
      expect(markNotificationRead).toHaveBeenCalledWith({ notificationId: 'abc-5' })
      expect(mockPush).toHaveBeenCalled()
    })

    it('price_drop row click does NOT call markNotificationRead (stub type)', async () => {
      const row = makeRow({
        type: 'price_drop',
        readAt: null,
        id: 'abc-6',
        payload: { watchModel: 'Speedmaster', newPrice: '$5,000' },
      })
      render(<NotificationRow row={row} />)
      const link = screen.getByRole('link', { name: /notification/i })
      await act(async () => {
        fireEvent.click(link)
      })
      expect(markNotificationRead).not.toHaveBeenCalled()
      // Navigation still happens (to '#'); that's fine.
    })
  })
})
