import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LockedProfileState } from '@/components/profile/LockedProfileState'

describe('LockedProfileState', () => {
  const baseProps = {
    username: 'tyler',
    displayName: 'Tyler W',
    bio: 'A bio',
    avatarUrl: null,
    followerCount: 5,
    followingCount: 7,
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

  it('renders a disabled Follow button', () => {
    render(<LockedProfileState {...baseProps} />)
    const btn = screen.getByRole('button', { name: /Follow/ })
    expect(btn.hasAttribute('disabled')).toBe(true)
  })
})
