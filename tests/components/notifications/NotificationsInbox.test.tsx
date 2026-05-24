import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/components/notifications/NotificationRow', () => ({
  NotificationRow: ({
    row,
  }: {
    row: { id: string; type: string; actorDisplayName: string | null; actorCount?: number }
  }) => (
    <div
      data-testid={`notif-row-${row.id}`}
      data-type={row.type}
      data-actor-count={row.actorCount ?? 1}
    >
      {row.actorDisplayName ?? 'actor'}
    </div>
  ),
}))

import { NotificationsInbox } from '@/components/notifications/NotificationsInbox'
import type { NotificationRowData } from '@/components/notifications/NotificationRow'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-22T15:00:00Z')

function makeRow(overrides: Partial<NotificationRowData> & Pick<NotificationRowData, 'id' | 'type'>): NotificationRowData {
  return {
    readAt: null,
    createdAt: new Date('2026-04-22T10:00:00Z'), // today relative to NOW
    actorUsername: 'alice',
    actorDisplayName: 'Alice',
    actorAvatarUrl: null,
    payload: {},
    actorCount: undefined,
    ...overrides,
  } as NotificationRowData
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationsInbox', () => {
  describe('Today / Yesterday / Earlier bucketing (D-02)', () => {
    it('shows Today subheader for rows created today', () => {
      const rows = [makeRow({ id: '1', type: 'follow', createdAt: new Date('2026-04-22T10:00:00Z') })]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      expect(screen.getByText('Today')).toBeTruthy()
    })

    it('shows Yesterday subheader for rows from yesterday', () => {
      const rows = [makeRow({ id: '1', type: 'follow', createdAt: new Date('2026-04-21T10:00:00Z') })]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      expect(screen.getByText('Yesterday')).toBeTruthy()
    })

    it('shows Earlier subheader for older rows', () => {
      const rows = [makeRow({ id: '1', type: 'follow', createdAt: new Date('2026-04-19T10:00:00Z') })]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      expect(screen.getByText('Earlier')).toBeTruthy()
    })

    it('omits empty buckets', () => {
      const rows = [makeRow({ id: '1', type: 'follow', createdAt: new Date('2026-04-22T10:00:00Z') })]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      expect(screen.queryByText('Yesterday')).toBeNull()
      expect(screen.queryByText('Earlier')).toBeNull()
    })

    it('renders rows under correct bucket', () => {
      const rows = [
        makeRow({ id: '1', type: 'follow', createdAt: new Date('2026-04-22T10:00:00Z') }),
        makeRow({ id: '2', type: 'follow', actorDisplayName: 'Bob', actorUsername: 'bob', createdAt: new Date('2026-04-21T10:00:00Z') }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      expect(screen.getByText('Today')).toBeTruthy()
      expect(screen.getByText('Yesterday')).toBeTruthy()
      expect(screen.getByTestId('notif-row-1')).toBeTruthy()
      expect(screen.getByTestId('notif-row-2')).toBeTruthy()
    })
  })

  describe('NOTIF-08 watch_overlap display-time collapse', () => {
    it('collapses 3 watch_overlap rows with same brand/model/day into one row', () => {
      const day = new Date('2026-04-22T10:00:00Z')
      const sharedPayload = {
        watch_brand_normalized: 'omega',
        watch_model_normalized: 'speedmaster',
        watch_model: 'Speedmaster',
      }
      const rows = [
        makeRow({ id: 'w1', type: 'watch_overlap', createdAt: day, actorDisplayName: 'Alice', payload: { ...sharedPayload, watch_id: 'w-1' } }),
        makeRow({ id: 'w2', type: 'watch_overlap', createdAt: day, actorDisplayName: 'Bob', actorUsername: 'bob', payload: { ...sharedPayload, watch_id: 'w-2' } }),
        makeRow({ id: 'w3', type: 'watch_overlap', createdAt: day, actorDisplayName: 'Charlie', actorUsername: 'charlie', payload: { ...sharedPayload, watch_id: 'w-3' } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      // All 3 rows share the same group key — only 1 row should be rendered
      const renderedRows = screen.getAllByTestId(/notif-row-/)
      expect(renderedRows).toHaveLength(1)
    })

    it('sets actorCount=3 on the collapsed row', () => {
      const day = new Date('2026-04-22T10:00:00Z')
      const sharedPayload = {
        watch_brand_normalized: 'omega',
        watch_model_normalized: 'speedmaster',
        watch_model: 'Speedmaster',
      }
      const rows = [
        makeRow({ id: 'w1', type: 'watch_overlap', createdAt: day, payload: { ...sharedPayload } }),
        makeRow({ id: 'w2', type: 'watch_overlap', createdAt: day, actorDisplayName: 'Bob', actorUsername: 'bob', payload: { ...sharedPayload } }),
        makeRow({ id: 'w3', type: 'watch_overlap', createdAt: day, actorDisplayName: 'Charlie', actorUsername: 'charlie', payload: { ...sharedPayload } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      const row = screen.getByTestId('notif-row-w1')
      expect(row.getAttribute('data-actor-count')).toBe('3')
    })

    it('does not collapse watch_overlap rows with different watch models', () => {
      const day = new Date('2026-04-22T10:00:00Z')
      const rows = [
        makeRow({ id: 'w1', type: 'watch_overlap', createdAt: day, payload: { watch_brand_normalized: 'omega', watch_model_normalized: 'speedmaster', watch_model: 'Speedmaster' } }),
        makeRow({ id: 'w2', type: 'watch_overlap', createdAt: day, actorDisplayName: 'Bob', actorUsername: 'bob', payload: { watch_brand_normalized: 'rolex', watch_model_normalized: 'datejust', watch_model: 'Datejust' } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      // Different group keys — 2 separate rows
      expect(screen.getAllByTestId(/notif-row-/)).toHaveLength(2)
    })

    it('does not collapse non-overlap rows', () => {
      const rows = [
        makeRow({ id: 'f1', type: 'follow', createdAt: new Date('2026-04-22T10:00:00Z') }),
        makeRow({ id: 'f2', type: 'follow', actorDisplayName: 'Bob', actorUsername: 'bob', createdAt: new Date('2026-04-22T09:00:00Z') }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      expect(screen.getAllByTestId(/notif-row-/)).toHaveLength(2)
    })
  })

  describe('empty rows', () => {
    it('renders nothing when rows array is empty', () => {
      const { container } = render(<NotificationsInbox rows={[]} now={NOW} />)
      // No group headers should appear
      expect(screen.queryByText('Today')).toBeNull()
      expect(screen.queryByText('Yesterday')).toBeNull()
      expect(screen.queryByText('Earlier')).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // NOTIF-13 watch_like / wear_like display-time collapse (D-04/D-05)
  // ---------------------------------------------------------------------------

  describe('NOTIF-13 watch_like display-time collapse', () => {
    it('collapses watch_like rows with same watch_id + day into one row', () => {
      const day = new Date('2026-04-22T10:00:00Z')
      const rows = [
        makeRow({ id: 'l1', type: 'watch_like', createdAt: day, actorDisplayName: 'Alice', payload: { watch_id: 'w-42', watch_model: 'Submariner' } }),
        makeRow({ id: 'l2', type: 'watch_like', createdAt: day, actorDisplayName: 'Bob', actorUsername: 'bob', payload: { watch_id: 'w-42', watch_model: 'Submariner' } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      expect(screen.getAllByTestId(/notif-row-/)).toHaveLength(1)
    })

    it('sets actorCount=2 on the collapsed watch_like row', () => {
      const day = new Date('2026-04-22T10:00:00Z')
      const rows = [
        makeRow({ id: 'l1', type: 'watch_like', createdAt: day, actorDisplayName: 'Alice', payload: { watch_id: 'w-42', watch_model: 'Submariner' } }),
        makeRow({ id: 'l2', type: 'watch_like', createdAt: day, actorDisplayName: 'Bob', actorUsername: 'bob', payload: { watch_id: 'w-42', watch_model: 'Submariner' } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      const row = screen.getByTestId('notif-row-l1')
      expect(row.getAttribute('data-actor-count')).toBe('2')
    })

    it('most-recent actor wins (first row id shown)', () => {
      // Rows arrive newest-first: l1 is most recent (higher timestamp)
      const rows = [
        makeRow({ id: 'l1', type: 'watch_like', createdAt: new Date('2026-04-22T11:00:00Z'), actorDisplayName: 'Alice', payload: { watch_id: 'w-42', watch_model: 'Submariner' } }),
        makeRow({ id: 'l2', type: 'watch_like', createdAt: new Date('2026-04-22T09:00:00Z'), actorDisplayName: 'Bob', actorUsername: 'bob', payload: { watch_id: 'w-42', watch_model: 'Submariner' } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      // Only 1 row rendered; it should be l1 (most recent)
      expect(screen.getByTestId('notif-row-l1')).toBeTruthy()
      expect(screen.queryByTestId('notif-row-l2')).toBeNull()
    })

    it('does NOT collapse watch_like rows with same watch_id on different UTC days', () => {
      const rows = [
        makeRow({ id: 'l1', type: 'watch_like', createdAt: new Date('2026-04-22T10:00:00Z'), payload: { watch_id: 'w-42', watch_model: 'Submariner' } }),
        makeRow({ id: 'l2', type: 'watch_like', createdAt: new Date('2026-04-21T10:00:00Z'), actorDisplayName: 'Bob', actorUsername: 'bob', payload: { watch_id: 'w-42', watch_model: 'Submariner' } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      expect(screen.getAllByTestId(/notif-row-/)).toHaveLength(2)
    })

    it('does NOT merge watch_like with watch_overlap rows sharing the same watch_id', () => {
      const day = new Date('2026-04-22T10:00:00Z')
      const rows = [
        makeRow({ id: 'l1', type: 'watch_like', createdAt: day, payload: { watch_id: 'w-42', watch_model: 'Submariner' } }),
        makeRow({ id: 'o1', type: 'watch_overlap', createdAt: day, actorDisplayName: 'Bob', actorUsername: 'bob', payload: { watch_id: 'w-42', watch_brand_normalized: 'rolex', watch_model_normalized: 'submariner', watch_model: 'Submariner' } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      // Different types — must stay as 2 separate rows (type-prefixed key prevents collision)
      expect(screen.getAllByTestId(/notif-row-/)).toHaveLength(2)
    })
  })

  describe('NOTIF-13 wear_like display-time collapse', () => {
    it('collapses wear_like rows with same wear_event_id + day into one row', () => {
      const day = new Date('2026-04-22T10:00:00Z')
      const rows = [
        makeRow({ id: 'wl1', type: 'wear_like', createdAt: day, actorDisplayName: 'Alice', payload: { wear_event_id: 'we-99', watch_model: 'Speedmaster' } }),
        makeRow({ id: 'wl2', type: 'wear_like', createdAt: day, actorDisplayName: 'Bob', actorUsername: 'bob', payload: { wear_event_id: 'we-99', watch_model: 'Speedmaster' } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      expect(screen.getAllByTestId(/notif-row-/)).toHaveLength(1)
    })

    it('sets actorCount=2 on the collapsed wear_like row', () => {
      const day = new Date('2026-04-22T10:00:00Z')
      const rows = [
        makeRow({ id: 'wl1', type: 'wear_like', createdAt: day, actorDisplayName: 'Alice', payload: { wear_event_id: 'we-99', watch_model: 'Speedmaster' } }),
        makeRow({ id: 'wl2', type: 'wear_like', createdAt: day, actorDisplayName: 'Bob', actorUsername: 'bob', payload: { wear_event_id: 'we-99', watch_model: 'Speedmaster' } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      const row = screen.getByTestId('notif-row-wl1')
      expect(row.getAttribute('data-actor-count')).toBe('2')
    })
  })

  describe('D-05: comments are never grouped', () => {
    it('watch_comment rows with same watch_id on same day are NOT collapsed', () => {
      const day = new Date('2026-04-22T10:00:00Z')
      const rows = [
        makeRow({ id: 'c1', type: 'watch_comment', createdAt: day, actorDisplayName: 'Alice', payload: { watch_id: 'w-42', watch_model: 'Submariner', comment_id: 'cm-1', comment_preview: 'Nice!' } }),
        makeRow({ id: 'c2', type: 'watch_comment', createdAt: day, actorDisplayName: 'Bob', actorUsername: 'bob', payload: { watch_id: 'w-42', watch_model: 'Submariner', comment_id: 'cm-2', comment_preview: 'Great watch!' } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      expect(screen.getAllByTestId(/notif-row-/)).toHaveLength(2)
    })

    it('wear_comment rows with same wear_event_id on same day are NOT collapsed', () => {
      const day = new Date('2026-04-22T10:00:00Z')
      const rows = [
        makeRow({ id: 'wc1', type: 'wear_comment', createdAt: day, actorDisplayName: 'Alice', payload: { wear_event_id: 'we-99', watch_model: 'Speedmaster', comment_id: 'cm-3', comment_preview: 'Cool!' } }),
        makeRow({ id: 'wc2', type: 'wear_comment', createdAt: day, actorDisplayName: 'Bob', actorUsername: 'bob', payload: { wear_event_id: 'we-99', watch_model: 'Speedmaster', comment_id: 'cm-4', comment_preview: 'Awesome wear!' } }),
      ]
      render(<NotificationsInbox rows={rows} now={NOW} />)
      expect(screen.getAllByTestId(/notif-row-/)).toHaveLength(2)
    })
  })
})
