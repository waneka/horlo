import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks (declared BEFORE the component import — vitest hoists vi.mock calls).
// Mirrors the pattern locked in tests/components/profile/FollowButton.test.tsx
// so FollowerListCard can render its inner FollowButton under jsdom.
// ---------------------------------------------------------------------------

vi.mock('@/app/actions/follows', () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}))

const mockRefresh = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
}))

import { FollowerListCard } from '@/components/profile/FollowerListCard'
import type { FollowerListEntry } from '@/data/follows'

// ---------------------------------------------------------------------------
// Fixture + helpers
// ---------------------------------------------------------------------------

const VIEWER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const TARGET_ID = '11111111-2222-4333-8444-555555555555'

// FollowerListCardProps shape (contract pinned by these tests):
//   entry: FollowerListEntry { userId, username, displayName|null, bio|null,
//     avatarUrl|null, profilePublic, watchCount, wishlistCount, followedAt }
//   viewerId: string | null
//   viewerIsFollowing: boolean
//   isOwnRow: boolean
//   showFollowedAt: boolean
function makeEntry(overrides: Partial<FollowerListEntry> = {}): FollowerListEntry {
  return {
    userId: TARGET_ID,
    username: 'tyler',
    displayName: 'Tyler W',
    bio: 'Collector of vintage divers',
    avatarUrl: null,
    profilePublic: true,
    watchCount: 5,
    wishlistCount: 3,
    followedAt: new Date().toISOString(),
    ...overrides,
  }
}

type RenderProps = Partial<React.ComponentProps<typeof FollowerListCard>>

function renderCard(overrides: RenderProps = {}) {
  const defaultProps: React.ComponentProps<typeof FollowerListCard> = {
    entry: makeEntry(),
    viewerId: VIEWER_ID,
    viewerIsFollowing: false,
    isOwnRow: false,
    showFollowedAt: false,
  }
  return render(<FollowerListCard {...defaultProps} {...overrides} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

// ---------------------------------------------------------------------------
// Row rendering — primary label / bio / stats
// ---------------------------------------------------------------------------

describe('FollowerListCard — row rendering', () => {
  it('renders displayName when present (never with @username alongside)', () => {
    renderCard({ entry: makeEntry({ displayName: 'Tyler W', username: 'tyler' }) })
    expect(screen.getByText('Tyler W')).toBeTruthy()
    // @tyler must NOT be rendered alongside displayName (D-12 — fallback, not both).
    expect(screen.queryByText('@tyler')).toBeNull()
  })

  it('renders @username when displayName is null', () => {
    renderCard({ entry: makeEntry({ displayName: null, username: 'tyler' }) })
    expect(screen.getByText('@tyler')).toBeTruthy()
  })

  it('renders bio truncated (via truncate class) when present', () => {
    renderCard({ entry: makeEntry({ bio: 'Collector of vintage divers' }) })
    const bio = screen.getByText('Collector of vintage divers')
    expect(bio.className).toMatch(/truncate/)
  })

  it('omits bio element when null', () => {
    renderCard({ entry: makeEntry({ bio: null }) })
    expect(screen.queryByText(/Collector of vintage divers/)).toBeNull()
  })

  it('renders stat strip "N watches · M wishlist"', () => {
    renderCard({ entry: makeEntry({ watchCount: 7, wishlistCount: 2 }) })
    // Look for the composite string — implementation may split into nodes, so match flexibly.
    expect(
      screen.getByText((content, element) => {
        if (!element) return false
        const text = element.textContent ?? ''
        return /7 watches\s*·\s*2 wishlist/.test(text)
      }),
    ).toBeTruthy()
  })

  it('wraps whole row in a Link to /u/{username}/collection', () => {
    renderCard({ entry: makeEntry({ username: 'tyler' }) })
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/u/tyler/collection')
  })

  it('Link overlay aria-label contains "View {name}\'s profile"', () => {
    renderCard({
      entry: makeEntry({ displayName: 'Tyler W', username: 'tyler' }),
    })
    const link = screen.getByRole('link')
    expect(link.getAttribute('aria-label')).toMatch(/View Tyler W's profile/)
  })
})

// ---------------------------------------------------------------------------
// Inline FollowButton integration
// ---------------------------------------------------------------------------

describe('FollowerListCard — inline FollowButton', () => {
  it('renders FollowButton with variant="inline" (outline border, no accent fill)', () => {
    renderCard({
      entry: makeEntry({ userId: TARGET_ID }),
      viewerId: VIEWER_ID,
      isOwnRow: false,
    })
    const btn = screen.getByRole('button', { name: /Follow|Unfollow/ })
    // Inline variant carries border-border (outline-only). Should NOT carry bg-accent.
    expect(btn.className).toContain('border-border')
    expect(btn.className).not.toContain('bg-accent')
  })

  it('hides FollowButton when isOwnRow is true (no Follow on own row)', () => {
    renderCard({ isOwnRow: true })
    // With isOwnRow the button is not rendered at all.
    expect(screen.queryByRole('button', { name: /Follow|Unfollow/ })).toBeNull()
  })

  it('clicking FollowButton does NOT bubble up (stopPropagation per D-14)', () => {
    const parentOnClick = vi.fn()
    const { container } = renderCard({
      entry: makeEntry({ userId: TARGET_ID }),
      viewerId: VIEWER_ID,
      isOwnRow: false,
    })
    // Attach a spy to a wrapping div around the card's rendered subtree.
    // container.firstChild is the card's outer element; its own click parent
    // is the DOM container — attach the spy to container and bubble through.
    container.addEventListener('click', parentOnClick)
    const btn = screen.getByRole('button', { name: /Follow|Unfollow/ })
    fireEvent.click(btn)
    // stopPropagation prevents the click from bubbling to the container.
    expect(parentOnClick).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Private profile masking (T-09-15 / T-09-06 mitigation)
// ---------------------------------------------------------------------------

describe('FollowerListCard — private profile masking', () => {
  it('hides bio and stat strip when entry.profilePublic is false (T-09-15)', () => {
    renderCard({
      entry: makeEntry({
        profilePublic: false,
        bio: 'This bio should be hidden',
        watchCount: 5,
        wishlistCount: 2,
      }),
    })
    // Bio is masked.
    expect(screen.queryByText(/This bio should be hidden/)).toBeNull()
    // Stat strip is masked — "watches" / "wishlist" substrings must not appear.
    expect(screen.queryByText(/watches/)).toBeNull()
    expect(screen.queryByText(/wishlist/)).toBeNull()
  })

  it('still renders username + avatar on private profiles (link still works)', () => {
    renderCard({
      entry: makeEntry({
        profilePublic: false,
        displayName: null,
        username: 'private_collector',
      }),
    })
    expect(screen.getByText('@private_collector')).toBeTruthy()
    // Link still points to /u/{username}/collection even for private profiles —
    // the target route enforces the lock via LockedProfileState.
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/u/private_collector/collection')
  })
})

// ---------------------------------------------------------------------------
// Relative-time rendering (/followers only)
// ---------------------------------------------------------------------------

describe('FollowerListCard — relative time', () => {
  it('renders "3 days ago" when showFollowedAt=true and followedAt is 3 days back', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    renderCard({
      entry: makeEntry({ followedAt: threeDaysAgo }),
      showFollowedAt: true,
    })
    expect(
      screen.getByText((_, element) => {
        if (!element) return false
        return /3 days ago/.test(element.textContent ?? '')
      }),
    ).toBeTruthy()
  })

  it('does NOT render relative time when showFollowedAt=false (/following variant)', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    renderCard({
      entry: makeEntry({ followedAt: threeDaysAgo }),
      showFollowedAt: false,
    })
    // No "days ago" / "today" / "month(s) ago" fragment should appear.
    expect(screen.queryByText(/days ago/)).toBeNull()
    expect(screen.queryByText(/^today$/)).toBeNull()
    expect(screen.queryByText(/month(s)? ago/)).toBeNull()
  })
})
