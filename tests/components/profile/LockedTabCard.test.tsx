import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// LockedTabCard's logged-in branch renders FollowButton which calls useRouter().
// Mock next/navigation per the established FollowButton.test.tsx pattern.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
// FollowButton's onClick path (not exercised in these tests) reaches the
// follow Server Actions — stub them defensively to avoid import-time chain.
vi.mock('@/app/actions/follows', () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}))

import { LockedTabCard } from '@/components/profile/LockedTabCard'

// Default D-39b-12 props used by the pre-existing 8 tests. These tests
// pre-date Phase 39b and only exercised the lock-icon + private-copy
// rendering — passing viewerId={null} keeps them on the unauthenticated
// branch, which still renders the lock icon + private copy unchanged.
const baseProps = {
  viewerId: null,
  targetUserId: 'tyler-uuid',
  initialIsFollowing: false,
  currentPath: '/u/tyler/collection',
} as const

describe('LockedTabCard', () => {
  it('renders a lucide Lock icon (svg with aria-hidden)', () => {
    const { container } = render(
      <LockedTabCard
        {...baseProps}
        tab="collection"
        displayName="Tyler"
        username="tyler"
      />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders "Tyler keeps their collection private." for tab=collection', () => {
    const { getByText } = render(
      <LockedTabCard
        {...baseProps}
        tab="collection"
        displayName="Tyler"
        username="tyler"
      />,
    )
    expect(getByText('Tyler keeps their collection private.')).toBeTruthy()
  })

  it('falls back to @username when displayName is null (wishlist)', () => {
    const { getByText } = render(
      <LockedTabCard
        {...baseProps}
        tab="wishlist"
        displayName={null}
        username="tyler"
      />,
    )
    expect(getByText('@tyler keeps their wishlist private.')).toBeTruthy()
  })

  it('remaps tab=worn to "worn history" in the copy', () => {
    const { getByText } = render(
      <LockedTabCard
        {...baseProps}
        tab="worn"
        displayName={null}
        username="tyler"
      />,
    )
    expect(getByText('@tyler keeps their worn history private.')).toBeTruthy()
  })

  it('renders "Tyler keeps their notes private." for tab=notes', () => {
    const { getByText } = render(
      <LockedTabCard
        {...baseProps}
        tab="notes"
        displayName="Tyler"
        username="tyler"
      />,
    )
    expect(getByText('Tyler keeps their notes private.')).toBeTruthy()
  })

  it('renders "Tyler keeps their stats private." for tab=stats', () => {
    const { getByText } = render(
      <LockedTabCard
        {...baseProps}
        tab="stats"
        displayName="Tyler"
        username="tyler"
      />,
    )
    expect(getByText('Tyler keeps their stats private.')).toBeTruthy()
  })

  it('returns null for tab=common-ground (tab is never locked)', () => {
    const { container } = render(
      <LockedTabCard
        {...baseProps}
        tab="common-ground"
        displayName="Tyler"
        username="tyler"
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('applies bg-card rounded-xl border py-16 classes to the section', () => {
    const { container } = render(
      <LockedTabCard
        {...baseProps}
        tab="collection"
        displayName="Tyler"
        username="tyler"
      />,
    )
    const section = container.querySelector('section')
    expect(section).toBeTruthy()
    expect(section?.className).toContain('bg-card')
    expect(section?.className).toContain('rounded-xl')
    expect(section?.className).toContain('border')
    expect(section?.className).toContain('py-16')
  })

  // --- Phase 39b D-39b-12 — new branches ---

  it('renders FollowButton + caption for logged-in not-following viewer (D-39b-12)', () => {
    const { getByText, getByRole } = render(
      <LockedTabCard
        tab="collection"
        displayName="Tyler"
        username="tyler"
        viewerId="viewer-uuid"
        targetUserId="tyler-uuid"
        initialIsFollowing={false}
        currentPath="/u/tyler/collection"
      />,
    )
    expect(getByRole('button', { name: /Follow Tyler/i })).toBeTruthy()
    expect(getByText('Follow @tyler to see their collection.')).toBeTruthy()
  })

  it('renders sign-in Link for unauthenticated viewer (D-39b-12)', () => {
    const { getByText, getByRole } = render(
      <LockedTabCard
        tab="collection"
        displayName="Tyler"
        username="tyler"
        viewerId={null}
        targetUserId="tyler-uuid"
        initialIsFollowing={false}
        currentPath="/u/tyler/collection"
      />,
    )
    const link = getByRole('link', { name: /Sign in to follow/i })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/signin?returnTo=%2Fu%2Ftyler%2Fcollection')
    expect(getByText(`Sign in to see @tyler's collection.`)).toBeTruthy()
  })

  it('still returns null for tab=common-ground regardless of viewerId (D-39 D-09 regression guard)', () => {
    const { container } = render(
      <LockedTabCard
        tab="common-ground"
        displayName="Tyler"
        username="tyler"
        viewerId="viewer-uuid"
        targetUserId="tyler-uuid"
        initialIsFollowing={false}
        currentPath="/u/tyler/common-ground"
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})
