import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// The LockedProfileState now renders a live FollowButton — mock the Server
// Action module and next/navigation so the Client Component mounts under jsdom.
vi.mock('@/app/actions/follows', () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

import { LockedProfileState } from '@/components/profile/LockedProfileState'

describe('LockedProfileState', () => {
  const baseProps = {
    username: 'tyler',
    displayName: 'Tyler W',
    bio: 'A bio',
    avatarUrl: null,
    followerCount: 5,
    followingCount: 7,
    viewerId: 'viewer-uuid',
    targetUserId: 'target-uuid',
    initialIsFollowing: false,
  }

  it('renders the lock copy', () => {
    render(<LockedProfileState {...baseProps} />)
    expect(screen.getByText('This profile is private.')).toBeTruthy()
  })

  it('shows follower and following counts', () => {
    render(<LockedProfileState {...baseProps} />)
    expect(screen.getByText(/5 followers/)).toBeTruthy()
    expect(screen.getByText(/7 following/)).toBeTruthy()
  })

  it('renders a live Follow button (not disabled, wired to the action)', () => {
    render(<LockedProfileState {...baseProps} />)
    const btn = screen.getByRole('button', { name: /Follow Tyler W/ })
    expect(btn.hasAttribute('disabled')).toBe(false)
  })

  it('renders the Following state when viewer already follows', () => {
    render(<LockedProfileState {...baseProps} initialIsFollowing={true} />)
    expect(
      screen.getByRole('button', { name: /Unfollow Tyler W/ }),
    ).toBeTruthy()
  })

  it('falls back to @username aria-label when displayName is null', () => {
    render(<LockedProfileState {...baseProps} displayName={null} />)
    // Follow aria-label uses "@tyler" when displayName is null (matches
    // FollowButton's targetDisplayName fallback from LockedProfileState).
    expect(screen.getByRole('button', { name: /Follow @tyler/ })).toBeTruthy()
  })
})
