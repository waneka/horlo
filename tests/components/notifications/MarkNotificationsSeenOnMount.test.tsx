import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks
//
// MarkNotificationsSeenOnMount has two outbound dependencies we must lock
// down: the Server Action `markNotificationsSeen` and the Next.js
// `useRouter().refresh()` hint. The regression this suite guards against
// (Phase 13 debug session notifications-revalidate-tag-in-render):
//   - the SA MUST be awaited before refresh, so the Header's persistent
//     NotificationBell re-fetches after touchLastSeenAt has committed, and
//   - router.refresh() MUST be called afterward (not called == bell dot
//     sticks on subsequent nav because the client router cache holds the
//     stale Header RSC payload).
// ---------------------------------------------------------------------------

const markNotificationsSeenMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('@/app/actions/notifications', () => ({
  markNotificationsSeen: (...args: unknown[]) => markNotificationsSeenMock(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

import { MarkNotificationsSeenOnMount } from '@/components/notifications/MarkNotificationsSeenOnMount'

beforeEach(() => {
  markNotificationsSeenMock.mockReset()
  refreshMock.mockReset()
})

describe('MarkNotificationsSeenOnMount', () => {
  it('calls the Server Action on mount', async () => {
    markNotificationsSeenMock.mockResolvedValueOnce({ success: true, data: undefined })
    render(<MarkNotificationsSeenOnMount />)
    await waitFor(() => {
      expect(markNotificationsSeenMock).toHaveBeenCalledTimes(1)
    })
  })

  it('calls router.refresh() AFTER the Server Action resolves (client-cache-busts Header)', async () => {
    // Resolve order: SA returns first, THEN refresh fires. This is the
    // read-your-own-writes sequence that clears the bell dot on next nav.
    let saResolvedAt = 0
    let refreshCalledAt = 0
    let counter = 0
    markNotificationsSeenMock.mockImplementationOnce(async () => {
      saResolvedAt = ++counter
      return { success: true, data: undefined }
    })
    refreshMock.mockImplementationOnce(() => {
      refreshCalledAt = ++counter
    })

    render(<MarkNotificationsSeenOnMount />)

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1)
    })
    expect(saResolvedAt).toBeGreaterThan(0)
    expect(refreshCalledAt).toBeGreaterThan(saResolvedAt) // strict ordering
  })

  it('does NOT call router.refresh() when the Server Action throws (avoids masking errors with a spurious refetch)', async () => {
    markNotificationsSeenMock.mockRejectedValueOnce(new Error('network drop'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<MarkNotificationsSeenOnMount />)

    await waitFor(() => {
      expect(markNotificationsSeenMock).toHaveBeenCalledTimes(1)
    })
    // Give any trailing microtasks a chance to flush before asserting.
    await new Promise((r) => setTimeout(r, 0))
    expect(refreshMock).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
