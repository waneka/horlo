import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('@/app/actions/feed', () => ({
  loadMoreFeed: vi.fn(),
}))

import { LoadMoreButton } from '@/components/home/LoadMoreButton'
import { loadMoreFeed } from '@/app/actions/feed'
import type { FeedCursor, RawFeedRow } from '@/lib/feedTypes'

const INITIAL_CURSOR: FeedCursor = {
  createdAt: '2026-04-21T12:00:00.000Z',
  id: '00000000-0000-4000-8000-000000000001',
}

function rawRow(overrides: Partial<RawFeedRow> = {}): RawFeedRow {
  return {
    kind: 'raw',
    id: overrides.id ?? 'row-appended-1',
    type: 'watch_worn',
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    watchId: 'watch-100',
    metadata: { brand: 'Omega', model: 'Speedmaster', imageUrl: null },
    userId: 'u2',
    username: 'carol',
    displayName: 'Carol',
    avatarUrl: null,
    ...overrides,
  }
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoadMoreButton', () => {
  it('Test 1 — idle state: button label "Load more", not disabled', () => {
    render(<LoadMoreButton initialCursor={INITIAL_CURSOR} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent(/Load more/)
    expect(btn).not.toBeDisabled()
  })

  it('Test 2 — loading state: after click, button is disabled with spinner + aria-label "Loading more activity"', async () => {
    let resolveAction: (v: unknown) => void = () => {}
    ;(loadMoreFeed as Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve
      }),
    )
    render(<LoadMoreButton initialCursor={INITIAL_CURSOR} />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    // While the action is pending, the button is disabled and aria-label swaps.
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-label', 'Loading more activity')
    // Spinner has animate-spin class.
    const spinner = btn.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
    // Let it resolve to clean up.
    resolveAction({ success: true, data: { rows: [], nextCursor: null } })
    await flush()
  })

  it('Test 3 — success with nextCursor null: appended row renders, button unmounts', async () => {
    ;(loadMoreFeed as Mock).mockResolvedValue({
      success: true,
      data: {
        rows: [rawRow({ id: 'r1', username: 'carol', type: 'watch_worn' })],
        nextCursor: null,
      },
    })
    const { container } = render(<LoadMoreButton initialCursor={INITIAL_CURSOR} />)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    // Appended ActivityRow renders.
    expect(container.textContent).toMatch(/carol\s+wore\s+Omega\s+Speedmaster/)
    // Button unmounts (cursor became null).
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('Test 4 — success with nextCursor non-null: button stays mounted with new cursor', async () => {
    const nextCursor: FeedCursor = {
      createdAt: '2026-04-21T11:00:00.000Z',
      id: '00000000-0000-4000-8000-000000000002',
    }
    ;(loadMoreFeed as Mock).mockResolvedValue({
      success: true,
      data: {
        rows: [rawRow({ id: 'r2' })],
        nextCursor,
      },
    })
    render(<LoadMoreButton initialCursor={INITIAL_CURSOR} />)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    // Button still rendered — ready for another click.
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('Test 5 — error: label swaps to "Couldn\'t load more. Tap to retry."', async () => {
    ;(loadMoreFeed as Mock).mockResolvedValue({
      success: false,
      error: "Couldn't load more.",
    })
    render(<LoadMoreButton initialCursor={INITIAL_CURSOR} />)
    fireEvent.click(screen.getByRole('button'))
    await flush()
    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent("Couldn't load more. Tap to retry.")
  })

  it('Test 6 — retry after error: subsequent success clears the error message and appends rows', async () => {
    ;(loadMoreFeed as Mock).mockResolvedValueOnce({
      success: false,
      error: "Couldn't load more.",
    })
    const nextCursor: FeedCursor = {
      createdAt: '2026-04-21T11:00:00.000Z',
      id: '00000000-0000-4000-8000-000000000003',
    }
    ;(loadMoreFeed as Mock).mockResolvedValueOnce({
      success: true,
      data: {
        rows: [rawRow({ id: 'r-retry', username: 'carol', type: 'watch_added' })],
        nextCursor,
      },
    })
    const { container } = render(<LoadMoreButton initialCursor={INITIAL_CURSOR} />)
    // First click → fails
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(screen.getByRole('button')).toHaveTextContent(
      "Couldn't load more. Tap to retry.",
    )
    // Second click → succeeds
    fireEvent.click(screen.getByRole('button'))
    await flush()
    // Error text is gone, label back to "Load more"
    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent(/Load more/)
    expect(btn.textContent).not.toMatch(/Couldn't load more/)
    // Row was appended.
    expect(container.textContent).toMatch(/carol\s+added\s+Omega\s+Speedmaster/)
  })
})
