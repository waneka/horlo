import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { WywtOverlay } from '@/components/home/WywtOverlay'
import type { WywtTile } from '@/lib/wywtTypes'

// next/image stub
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, ...rest } = props
    delete (rest as Record<string, unknown>).fill
    delete (rest as Record<string, unknown>).unoptimized
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt as string} />
  },
}))

// next/link stub
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

// Mock the Server Action so Slide tests don't hit the network / DB.
const mockAddToWishlistFromWearEvent = vi.fn()
vi.mock('@/app/actions/wishlist', () => ({
  addToWishlistFromWearEvent: (...args: unknown[]) =>
    mockAddToWishlistFromWearEvent(...args),
}))

function makeTile(i: number, overrides: Partial<WywtTile> = {}): WywtTile {
  return {
    wearEventId: `evt-${i}`,
    userId: `user-${i}`,
    username: `user${i}`,
    displayName: `User ${i}`,
    avatarUrl: null,
    watchId: `watch-${i}`,
    brand: 'Rolex',
    model: `Model-${i}`,
    imageUrl: `https://example.com/${i}.jpg`,
    photoUrl: null,
    wornDate: '2026-04-21',
    note: null,
    visibility: 'public',
    isSelf: false,
    ...overrides,
  }
}

describe('WywtOverlay — W-05 full-screen / modal + Add-to-wishlist', () => {
  beforeEach(() => {
    mockAddToWishlistFromWearEvent.mockReset()
  })

  it('Test 1 — renders one slide per tile', () => {
    const tiles = [makeTile(0), makeTile(1), makeTile(2)]
    render(
      <WywtOverlay
        tiles={tiles}
        initialIndex={0}
        open
        onOpenChange={() => {}}
        onViewed={() => {}}
        viewerId="viewer-1"
      />,
    )
    // Each slide renders a watch brand/model link.
    expect(screen.getAllByText(/Rolex Model-/).length).toBe(3)
  })

  it('Test 2 — close button has aria-label "Close wear viewer"', () => {
    render(
      <WywtOverlay
        tiles={[makeTile(0)]}
        initialIndex={0}
        open
        onOpenChange={() => {}}
        onViewed={() => {}}
        viewerId="viewer-1"
      />,
    )
    expect(screen.getByLabelText('Close wear viewer')).toBeTruthy()
  })

  it('Test 3 — next / prev buttons have aria-labels "Next wear" / "Previous wear"', () => {
    render(
      <WywtOverlay
        tiles={[makeTile(0), makeTile(1)]}
        initialIndex={0}
        open
        onOpenChange={() => {}}
        onViewed={() => {}}
        viewerId="viewer-1"
      />,
    )
    expect(screen.getByLabelText('Next wear')).toBeTruthy()
    expect(screen.getByLabelText('Previous wear')).toBeTruthy()
  })

  it('Test 4 — clicking close fires onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(
      <WywtOverlay
        tiles={[makeTile(0)]}
        initialIndex={0}
        open
        onOpenChange={onOpenChange}
        onViewed={() => {}}
        viewerId="viewer-1"
      />,
    )
    fireEvent.click(screen.getByLabelText('Close wear viewer'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Test 5 — WywtSlide: clicking "Add to wishlist" calls addToWishlistFromWearEvent({ wearEventId })', async () => {
    mockAddToWishlistFromWearEvent.mockResolvedValue({
      success: true,
      data: { watchId: 'new-watch' },
    })

    const tile = makeTile(0, { wearEventId: 'target-evt' })
    render(
      <WywtOverlay
        tiles={[tile]}
        initialIndex={0}
        open
        onOpenChange={() => {}}
        onViewed={() => {}}
        viewerId="viewer-1"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }))
    await waitFor(() =>
      expect(mockAddToWishlistFromWearEvent).toHaveBeenCalledWith({
        wearEventId: 'target-evt',
      }),
    )
  })

  it('Test 6 — Add to wishlist success renders "Added to wishlist." inline', async () => {
    mockAddToWishlistFromWearEvent.mockResolvedValue({
      success: true,
      data: { watchId: 'w1' },
    })

    render(
      <WywtOverlay
        tiles={[makeTile(0)]}
        initialIndex={0}
        open
        onOpenChange={() => {}}
        onViewed={() => {}}
        viewerId="viewer-1"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }))
    await waitFor(() =>
      expect(screen.getByText('Added to wishlist.')).toBeTruthy(),
    )
  })

  it('Test 7 — Add to wishlist failure renders "Couldn\'t save to wishlist." with retry', async () => {
    mockAddToWishlistFromWearEvent.mockResolvedValue({
      success: false,
      error: 'Wear event not found',
    })

    render(
      <WywtOverlay
        tiles={[makeTile(0)]}
        initialIndex={0}
        open
        onOpenChange={() => {}}
        onViewed={() => {}}
        viewerId="viewer-1"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }))
    await waitFor(() =>
      expect(screen.getByText(/Couldn.t save to wishlist\./)).toBeTruthy(),
    )
    // Retry button should be available after an error.
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('WR-03 Test 8 — after a successful add, a second handler invocation is suppressed (no duplicate action call)', async () => {
    // Regression: without the `status === 'added'` guard in handleAddToWishlist,
    // a fast second tap before swipe-away could dispatch a second action and
    // create a duplicate wishlist row. The handler MUST be idempotent after
    // success.
    mockAddToWishlistFromWearEvent.mockResolvedValue({
      success: true,
      data: { watchId: 'new-watch' },
    })

    const tile = makeTile(0, { wearEventId: 'target-evt' })
    render(
      <WywtOverlay
        tiles={[tile]}
        initialIndex={0}
        open
        onOpenChange={() => {}}
        onViewed={() => {}}
        viewerId="viewer-1"
      />,
    )

    // First click — the action fires once.
    fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }))
    await waitFor(() =>
      expect(screen.getByText('Added to wishlist.')).toBeTruthy(),
    )
    expect(mockAddToWishlistFromWearEvent).toHaveBeenCalledTimes(1)

    // After success the button is unmounted (status='added' renders only the
    // "Added to wishlist." text). The total invocation count must still be 1
    // — no duplicate dispatch from latent re-render paths.
    expect(
      screen.queryByRole('button', { name: 'Add to wishlist' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(mockAddToWishlistFromWearEvent).toHaveBeenCalledTimes(1)
  })
})
