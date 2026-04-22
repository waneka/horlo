import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// next/link stub
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

// next/image stub
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string
    alt: string
    className?: string
  }) => <img src={src} alt={alt} className={className} />,
}))

// Stub FollowButton — we only need to assert it's rendered with variant="inline"
// and initialIsFollowing=false, not re-test Phase 9 behavior.
vi.mock('@/components/profile/FollowButton', () => ({
  FollowButton: ({
    viewerId,
    targetUserId,
    targetDisplayName,
    initialIsFollowing,
    variant,
  }: {
    viewerId: string | null
    targetUserId: string
    targetDisplayName: string
    initialIsFollowing: boolean
    variant?: string
  }) => (
    <button
      data-testid="follow-button"
      data-viewer-id={viewerId ?? 'null'}
      data-target-user-id={targetUserId}
      data-target-display-name={targetDisplayName}
      data-initial-is-following={String(initialIsFollowing)}
      data-variant={variant ?? 'primary'}
    >
      Follow
    </button>
  ),
}))

import { SuggestedCollectorRow } from '@/components/home/SuggestedCollectorRow'
import type { SuggestedCollector } from '@/lib/discoveryTypes'

function makeCollector(
  overrides: Partial<SuggestedCollector> = {},
): SuggestedCollector {
  return {
    userId: 'u-abc',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    overlap: 0.68,
    sharedCount: 5,
    sharedWatches: [
      { watchId: 'w-1', brand: 'Rolex', model: 'Submariner', imageUrl: null },
      { watchId: 'w-2', brand: 'Omega', model: 'Speedy', imageUrl: null },
      { watchId: 'w-3', brand: 'Seiko', model: 'SKX', imageUrl: null },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SuggestedCollectorRow', () => {
  it('Test 1 — renders displayName when present, username otherwise', () => {
    const { container, rerender } = render(
      <SuggestedCollectorRow
        collector={makeCollector({ displayName: 'Alice' })}
        viewerId="v1"
      />,
    )
    expect(screen.getByText('Alice')).toBeTruthy()

    rerender(
      <SuggestedCollectorRow
        collector={makeCollector({ displayName: null })}
        viewerId="v1"
      />,
    )
    expect(screen.getByText('alice')).toBeTruthy()
    // avoid unused var
    expect(container).toBeTruthy()
  })

  it('Test 2 — renders "68% taste overlap" when overlap is 0.68', () => {
    render(
      <SuggestedCollectorRow
        collector={makeCollector({ overlap: 0.68 })}
        viewerId="v1"
      />,
    )
    expect(screen.getByText('68% taste overlap')).toBeTruthy()
  })

  it('Test 3 — renders 3 mini-thumb slots for sharedWatches.length === 3', () => {
    const { container } = render(
      <SuggestedCollectorRow
        collector={makeCollector({ sharedCount: 3 })}
        viewerId="v1"
      />,
    )
    // 3 mini-thumb wrappers present.
    const thumbs = container.querySelectorAll('.ring-card')
    expect(thumbs.length).toBe(3)
  })

  it('Test 4 — renders "5 shared" when sharedCount=5', () => {
    render(
      <SuggestedCollectorRow
        collector={makeCollector({ sharedCount: 5 })}
        viewerId="v1"
      />,
    )
    expect(screen.getByText('5 shared')).toBeTruthy()
  })

  it('Test 5 — FollowButton present with variant="inline" + initialIsFollowing=false', () => {
    render(
      <SuggestedCollectorRow
        collector={makeCollector()}
        viewerId="v1"
      />,
    )
    const btn = screen.getByTestId('follow-button')
    expect(btn.getAttribute('data-variant')).toBe('inline')
    expect(btn.getAttribute('data-initial-is-following')).toBe('false')
    expect(btn.getAttribute('data-target-user-id')).toBe('u-abc')
    expect(btn.getAttribute('data-viewer-id')).toBe('v1')
  })

  it('Test 6 — row link href is /u/{username}/collection', () => {
    const { container } = render(
      <SuggestedCollectorRow
        collector={makeCollector({ username: 'alice' })}
        viewerId="v1"
      />,
    )
    const link = container.querySelector('a[href="/u/alice/collection"]')
    expect(link).toBeTruthy()
  })

  it('Test 7 — renders AvatarDisplay at size 40 (size-10 utility class)', () => {
    const { container } = render(
      <SuggestedCollectorRow
        collector={makeCollector({ avatarUrl: null, username: 'alice', displayName: 'Alice' })}
        viewerId="v1"
      />,
    )
    // AvatarDisplay with size=40 renders a .size-10 wrapper.
    const avatar = container.querySelector('.size-10')
    expect(avatar).toBeTruthy()
  })
})
