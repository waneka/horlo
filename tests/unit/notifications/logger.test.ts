/**
 * Unit tests for src/lib/notifications/logger.ts
 *
 * Created by Plan 13-02 (parallel execution pattern — Plan 01 creates schema/types,
 * Plan 02 creates implementation and test files simultaneously).
 *
 * Tests verify:
 *  - D-24 self-guard: actor === recipient short-circuits before any DB call
 *  - D-18 opt-out: reads profile_settings BEFORE insert; skips when off
 *  - Missing profile_settings row → safe default (both on)
 *  - watch_overlap uses raw SQL execute (ON CONFLICT DO NOTHING path)
 *  - follow uses Drizzle insert
 *  - D-27: all errors swallowed (fire-and-forget never throws)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// Mock server-only so the import doesn't throw in Vitest
vi.mock('server-only', () => ({}))

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    execute: vi.fn(),
  },
}))

vi.mock('@/db/schema', () => ({
  notifications: { userId: 'user_id', actorId: 'actor_id', type: 'type', payload: 'payload' },
  profileSettings: { userId: 'user_id', notifyOnFollow: 'notify_on_follow', notifyOnWatchOverlap: 'notify_on_watch_overlap' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ _tag: 'eq', _col, _val })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ _tag: 'sql', strings, values }),
    { empty: { _tag: 'sql_empty' } }
  ),
}))

import { db } from '@/db'
import { logNotification } from '@/lib/notifications/logger'

const recipientUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const actorUserId = '11111111-2222-4333-8444-555555555555'

const followPayload = {
  actor_username: 'testactor',
  actor_display_name: 'Test Actor',
}

const watchOverlapPayload = {
  actor_username: 'testactor',
  actor_display_name: 'Test Actor',
  watch_id: '22222222-3333-4444-8555-666666666666',
  watch_brand: 'Rolex',
  watch_model: 'Submariner',
  watch_brand_normalized: 'rolex',
  watch_model_normalized: 'submariner',
}

// Helper to set up the db.select() chain
function setupSelectChain(result: unknown[]) {
  const limitMock = vi.fn().mockResolvedValue(result)
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  ;(db.select as Mock).mockReturnValue({ from: fromMock })
  return { limitMock, whereMock, fromMock }
}

// Helper to set up db.insert() chain
function setupInsertChain() {
  const valuesMock = vi.fn().mockResolvedValue(undefined)
  ;(db.insert as Mock).mockReturnValue({ values: valuesMock })
  return { valuesMock }
}

describe('logNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('D-24 self-guard', () => {
    it('returns immediately when actor === recipient without any DB call', async () => {
      await logNotification({
        type: 'follow',
        recipientUserId,
        actorUserId: recipientUserId, // same as recipient
        payload: followPayload,
      })

      expect(db.select).not.toHaveBeenCalled()
      expect(db.insert).not.toHaveBeenCalled()
      expect(db.execute).not.toHaveBeenCalled()
    })
  })

  describe('D-18 opt-out checks', () => {
    it('skips follow insert when notifyOnFollow is false', async () => {
      setupSelectChain([{ notifyOnFollow: false, notifyOnWatchOverlap: true }])

      await logNotification({
        type: 'follow',
        recipientUserId,
        actorUserId,
        payload: followPayload,
      })

      expect(db.select).toHaveBeenCalledTimes(1)
      expect(db.insert).not.toHaveBeenCalled()
      expect(db.execute).not.toHaveBeenCalled()
    })

    it('skips watch_overlap insert when notifyOnWatchOverlap is false', async () => {
      setupSelectChain([{ notifyOnFollow: true, notifyOnWatchOverlap: false }])

      await logNotification({
        type: 'watch_overlap',
        recipientUserId,
        actorUserId,
        payload: watchOverlapPayload,
      })

      expect(db.select).toHaveBeenCalledTimes(1)
      expect(db.insert).not.toHaveBeenCalled()
      expect(db.execute).not.toHaveBeenCalled()
    })

    it('uses safe default (notify on) when profile_settings row is missing', async () => {
      setupSelectChain([]) // empty result — no row
      const { valuesMock } = setupInsertChain()

      await logNotification({
        type: 'follow',
        recipientUserId,
        actorUserId,
        payload: followPayload,
      })

      // Should proceed to insert because default is true
      expect(valuesMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('follow insert path', () => {
    it('calls db.insert with correct fields when notifyOnFollow is true', async () => {
      setupSelectChain([{ notifyOnFollow: true, notifyOnWatchOverlap: true }])
      const { valuesMock } = setupInsertChain()

      await logNotification({
        type: 'follow',
        recipientUserId,
        actorUserId,
        payload: followPayload,
      })

      expect(db.insert).toHaveBeenCalledTimes(1)
      expect(valuesMock).toHaveBeenCalledWith({
        userId: recipientUserId,
        actorId: actorUserId,
        type: 'follow',
        payload: followPayload,
      })
      expect(db.execute).not.toHaveBeenCalled()
    })
  })

  describe('watch_overlap insert path', () => {
    it('uses db.execute (raw SQL) with ON CONFLICT DO NOTHING, not db.insert', async () => {
      setupSelectChain([{ notifyOnFollow: true, notifyOnWatchOverlap: true }])
      ;(db.execute as Mock).mockResolvedValue(undefined)

      await logNotification({
        type: 'watch_overlap',
        recipientUserId,
        actorUserId,
        payload: watchOverlapPayload,
      })

      expect(db.execute).toHaveBeenCalledTimes(1)
      expect(db.insert).not.toHaveBeenCalled()
    })
  })

  describe('D-27 fire-and-forget error handling', () => {
    it('swallows DB errors and resolves without throwing', async () => {
      setupSelectChain([{ notifyOnFollow: true, notifyOnWatchOverlap: true }])
      ;(db.insert as Mock).mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('DB exploded')),
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Must not throw
      await expect(
        logNotification({
          type: 'follow',
          recipientUserId,
          actorUserId,
          payload: followPayload,
        })
      ).resolves.toBeUndefined()

      expect(consoleSpy).toHaveBeenCalledWith(
        '[logNotification] failed (non-fatal):',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('swallows errors from profile_settings query and resolves', async () => {
      ;(db.select as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('settings query failed')),
          }),
        }),
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        logNotification({
          type: 'follow',
          recipientUserId,
          actorUserId,
          payload: followPayload,
        })
      ).resolves.toBeUndefined()

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
