import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks (declared BEFORE the component import — vitest hoists vi.mock calls).
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

import { FollowButton } from '@/components/profile/FollowButton'
import { followUser, unfollowUser } from '@/app/actions/follows'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VIEWER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const TARGET_ID = '11111111-2222-4333-8444-555555555555'

type RenderProps = Partial<React.ComponentProps<typeof FollowButton>>

function renderButton(overrides: RenderProps = {}) {
  const defaultProps: React.ComponentProps<typeof FollowButton> = {
    viewerId: VIEWER_ID,
    targetUserId: TARGET_ID,
    targetDisplayName: 'Tyler',
    initialIsFollowing: false,
    variant: 'primary',
  }
  return render(<FollowButton {...defaultProps} {...overrides} />)
}

// jsdom doesn't evaluate CSS group-hover, but we CAN force desktop (non-mobile)
// behavior by stubbing window.matchMedia so the mobile two-tap path is skipped
// in the default desktop tests.
function stubDesktopViewport() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false, // NOT mobile — (max-width: 639px) evaluates to false
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

function stubMobileViewport() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('max-width: 639px'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// Helper: flush microtasks + React state updates so tests can observe post-await state.
async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubDesktopViewport()
})

// ---------------------------------------------------------------------------
// Primary variant — label, aria, click wiring
// ---------------------------------------------------------------------------

describe('FollowButton — primary variant', () => {
  it('renders "Follow" label when initialIsFollowing=false', () => {
    renderButton({ initialIsFollowing: false })
    expect(screen.getByRole('button')).toHaveTextContent('Follow')
  })

  it('renders "Following" label when initialIsFollowing=true', () => {
    renderButton({ initialIsFollowing: true })
    expect(screen.getByRole('button')).toHaveTextContent('Following')
  })

  it('aria-pressed="false" when not following', () => {
    renderButton({ initialIsFollowing: false })
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('aria-pressed="true" when following', () => {
    renderButton({ initialIsFollowing: true })
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('aria-label is "Follow Tyler" when not following', () => {
    renderButton({ targetDisplayName: 'Tyler', initialIsFollowing: false })
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Follow Tyler')
  })

  it('aria-label is "Unfollow Tyler" when following', () => {
    renderButton({ targetDisplayName: 'Tyler', initialIsFollowing: true })
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Unfollow Tyler')
  })

  it('click when not-following calls followUser with { userId: targetUserId }', async () => {
    ;(followUser as Mock).mockResolvedValue({ success: true, data: undefined })
    renderButton({ initialIsFollowing: false })
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(followUser).toHaveBeenCalledWith({ userId: TARGET_ID })
  })

  it('click when following calls unfollowUser (desktop — no two-tap)', async () => {
    ;(unfollowUser as Mock).mockResolvedValue({ success: true, data: undefined })
    renderButton({ initialIsFollowing: true })
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(unfollowUser).toHaveBeenCalledWith({ userId: TARGET_ID })
  })
})

// ---------------------------------------------------------------------------
// Optimistic + rollback (D-06)
// ---------------------------------------------------------------------------

describe('FollowButton — optimistic + rollback', () => {
  it('after successful follow, isFollowing flips to true and router.refresh() is called', async () => {
    ;(followUser as Mock).mockResolvedValue({ success: true, data: undefined })
    renderButton({ initialIsFollowing: false })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    await flush()
    // State flipped: button now shows Following and aria-pressed=true.
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('on Server Action failure, state rolls back (success: false branch)', async () => {
    ;(followUser as Mock).mockResolvedValue({ success: false, error: 'boom' })
    renderButton({ initialIsFollowing: false })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    await flush()
    // Rollback: isFollowing back to false.
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('optimistically bumps local isFollowing BEFORE the action resolves', async () => {
    // Leave the action unresolved so we can observe the optimistic state.
    let resolveAction: (v: unknown) => void = () => {}
    ;(followUser as Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve
      }),
    )
    renderButton({ initialIsFollowing: false })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    // Immediately after click, before the pending Promise resolves, the
    // optimistic state has already flipped.
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    // Now let the action resolve to avoid hanging the test.
    resolveAction({ success: true, data: undefined })
    await flush()
  })

  it('sets aria-busy="true" while the transition is pending', async () => {
    let resolveAction: (v: unknown) => void = () => {}
    ;(followUser as Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve
      }),
    )
    renderButton({ initialIsFollowing: false })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    // During the transition the button is aria-busy.
    expect(btn).toHaveAttribute('aria-busy', 'true')
    resolveAction({ success: true, data: undefined })
    await flush()
  })
})

// ---------------------------------------------------------------------------
// Hover-swap DOM structure (D-09 desktop)
// ---------------------------------------------------------------------------

describe('FollowButton — hover-swap DOM structure', () => {
  it('when following, both "Following" and "Unfollow" spans are rendered (CSS controls visibility)', () => {
    renderButton({ initialIsFollowing: true })
    // jsdom does NOT apply group-hover CSS, so we assert DOM presence of both
    // labels — visibility is controlled by CSS classes that desktop browsers
    // will honor.
    const btn = screen.getByRole('button')
    expect(btn.textContent).toMatch(/Following/)
    expect(btn.textContent).toMatch(/Unfollow/)
  })

  it('hover-swap span pair is absent when NOT following (only "Follow" is shown)', () => {
    renderButton({ initialIsFollowing: false })
    const btn = screen.getByRole('button')
    expect(btn.textContent).toMatch(/^Follow$/)
    expect(btn.textContent).not.toMatch(/Unfollow/)
  })
})

// ---------------------------------------------------------------------------
// Mobile two-tap flow (D-09)
// ---------------------------------------------------------------------------

describe('FollowButton — mobile two-tap', () => {
  beforeEach(() => {
    stubMobileViewport()
  })

  it('first tap on "Following" reveals "Unfollow" without calling unfollowUser', async () => {
    renderButton({ initialIsFollowing: true })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    await flush()
    expect(unfollowUser).not.toHaveBeenCalled()
    // After first tap on mobile, visible label is "Unfollow" (revealed state).
    expect(btn.textContent).toMatch(/Unfollow/)
  })

  it('second tap commits the unfollow', async () => {
    ;(unfollowUser as Mock).mockResolvedValue({ success: true, data: undefined })
    renderButton({ initialIsFollowing: true })
    const btn = screen.getByRole('button')
    // Tap 1 — reveals
    fireEvent.click(btn)
    await flush()
    expect(unfollowUser).not.toHaveBeenCalled()
    // Tap 2 — commits
    fireEvent.click(btn)
    await flush()
    expect(unfollowUser).toHaveBeenCalledWith({ userId: TARGET_ID })
  })
})

// ---------------------------------------------------------------------------
// Variants — visual class contract
// ---------------------------------------------------------------------------

describe('FollowButton — variants', () => {
  it('variant="primary" renders bg-accent text-accent-foreground when not-following', () => {
    renderButton({ variant: 'primary', initialIsFollowing: false })
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-accent')
    expect(btn.className).toContain('text-accent-foreground')
  })

  it('variant="locked" is visually identical to primary (solid accent fill)', () => {
    renderButton({ variant: 'locked', initialIsFollowing: false })
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-accent')
    expect(btn.className).toContain('text-accent-foreground')
  })

  it('variant="inline" renders border border-border text-foreground (no accent fill)', () => {
    renderButton({ variant: 'inline', initialIsFollowing: false })
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('border')
    expect(btn.className).toContain('border-border')
    expect(btn.className).toContain('text-foreground')
    // Must NOT carry accent fill on the inline variant.
    expect(btn.className).not.toContain('bg-accent')
  })

  it('following state (primary) uses bg-muted text-muted-foreground with destructive hover', () => {
    renderButton({ variant: 'primary', initialIsFollowing: true })
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-muted')
    expect(btn.className).toContain('text-muted-foreground')
    // Hover-swap token present (destructive hover/focus color).
    expect(btn.className).toMatch(/hover:text-destructive|focus:text-destructive/)
  })
})

// ---------------------------------------------------------------------------
// Self guard + unauth
// ---------------------------------------------------------------------------

describe('FollowButton — self guard + unauth', () => {
  it('returns null when viewerId === targetUserId (own row, self-hidden)', () => {
    const { container } = renderButton({
      viewerId: TARGET_ID,
      targetUserId: TARGET_ID,
    })
    // Component returns null — container is empty.
    expect(container.firstChild).toBeNull()
  })

  it('renders the button when viewerId is null (unauth viewer still sees the CTA)', () => {
    renderButton({ viewerId: null })
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('unauth click does NOT call followUser; instead router.push("/login?next=...") is called', async () => {
    // Set the pathname so the component can encodeURIComponent it.
    Object.defineProperty(window, 'location', {
      value: { pathname: '/u/tyler' },
      writable: true,
      configurable: true,
    })
    renderButton({ viewerId: null })
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(followUser).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith(
      '/login?next=' + encodeURIComponent('/u/tyler'),
    )
  })
})
