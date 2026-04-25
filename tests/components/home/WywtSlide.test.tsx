import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { WywtSlide } from '@/components/home/WywtSlide'
import type { WywtTile } from '@/lib/wywtTypes'

// `next/image` under jsdom does not emit a real <img>; stub it so we can
// assert DOM shape (mirrors WywtTile.test.tsx + WywtOverlay.test.tsx).
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, ...rest } = props
    delete (rest as Record<string, unknown>).fill
    delete (rest as Record<string, unknown>).unoptimized
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt as string} />
  },
}))

// next/link stub — slide uses <Link> for the watch model link.
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

// Mock the Server Action so slide tests don't hit network/DB.
const mockAddToWishlistFromWearEvent = vi.fn()
vi.mock('@/app/actions/wishlist', () => ({
  addToWishlistFromWearEvent: (...args: unknown[]) =>
    mockAddToWishlistFromWearEvent(...args),
}))

function makeTile(overrides: Partial<WywtTile> = {}): WywtTile {
  return {
    wearEventId: 'evt-1',
    userId: 'user-alice',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    watchId: 'watch-1',
    brand: 'Rolex',
    model: 'Submariner',
    imageUrl: 'https://catalog.example/sub.jpg',
    photoUrl: null,
    wornDate: '2026-04-21',
    note: null,
    visibility: 'public',
    isSelf: false,
    ...overrides,
  }
}

describe('WywtSlide — Phase 15 UAT photo fallback', () => {
  beforeEach(() => {
    mockAddToWishlistFromWearEvent.mockReset()
  })

  it('renders signed photoUrl when present (wrist shot wins over catalog imageUrl)', () => {
    render(
      <WywtSlide
        tile={makeTile({
          photoUrl: 'https://signed.example/wrist.jpg',
          imageUrl: 'https://catalog.example/sub.jpg',
        })}
      />,
    )
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toBe('https://signed.example/wrist.jpg')
  })

  it('falls back to imageUrl when photoUrl is null', () => {
    render(
      <WywtSlide
        tile={makeTile({
          photoUrl: null,
          imageUrl: 'https://catalog.example/sub.jpg',
        })}
      />,
    )
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toBe('https://catalog.example/sub.jpg')
  })

  it('renders WatchIcon placeholder when both photoUrl and imageUrl are null', () => {
    render(
      <WywtSlide tile={makeTile({ photoUrl: null, imageUrl: null })} />,
    )
    // No <img> means the placeholder branch ran.
    expect(screen.queryByRole('img')).toBeNull()
  })
})
