import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks (declared BEFORE the component import — vitest hoists vi.mock calls).
// ---------------------------------------------------------------------------

vi.mock('@/app/actions/reactions', () => ({
  toggleLikeAction: vi.fn(),
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { LikeButton } from '@/components/shared/LikeButton'
import { toggleLikeAction } from '@/app/actions/reactions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VIEWER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const WATCH_ID = '11111111-2222-4333-8444-555555555555'
const WEAR_ID = '22222222-3333-4444-8555-666666666666'

type RenderProps = Partial<React.ComponentProps<typeof LikeButton>>

function renderButton(overrides: RenderProps = {}) {
  const defaultProps: React.ComponentProps<typeof LikeButton> = {
    viewerId: VIEWER_ID,
    target: { type: 'watch', id: WATCH_ID },
    initialLiked: false,
    initialCount: 0,
  }
  return render(<LikeButton {...defaultProps} {...overrides} />)
}

// Helper: flush microtasks + React state updates so tests can observe post-await state.
async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// 1. A11y — aria-pressed, aria-busy, aria-label
// ---------------------------------------------------------------------------

describe('LikeButton — a11y attributes', () => {
  it('renders with aria-pressed=false and aria-label="Like" when not liked', () => {
    renderButton({ initialLiked: false })
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('aria-label', 'Like')
  })

  it('renders with aria-pressed=true and aria-label="Unlike" when liked', () => {
    renderButton({ initialLiked: true, initialCount: 1 })
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Unlike')
  })

  it('sets aria-busy=true while transition is pending', async () => {
    let resolveAction: (v: unknown) => void = () => {}
    ;(toggleLikeAction as Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve
      }),
    )
    renderButton({ initialLiked: false, initialCount: 3 })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    // During the transition the button should be aria-busy
    expect(btn).toHaveAttribute('aria-busy', 'true')
    resolveAction({ success: true, data: { liked: true, count: 4 } })
    await flush()
  })
})

// ---------------------------------------------------------------------------
// 2. LIKE-01/03 — optimistic flip before action resolves
// ---------------------------------------------------------------------------

describe('LikeButton — optimistic flip (LIKE-01/03)', () => {
  it('flips aria-pressed to true and increments count synchronously before action resolves', async () => {
    let resolveAction: (v: unknown) => void = () => {}
    ;(toggleLikeAction as Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve
      }),
    )
    renderButton({ initialLiked: false, initialCount: 3 })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    // Optimistic: aria-pressed flipped and count incremented BEFORE action resolves
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('4')).toBeTruthy()
    // Now resolve to avoid hanging
    resolveAction({ success: true, data: { liked: true, count: 4 } })
    await flush()
  })

  it('flips aria-pressed to false and decrements count when un-liking', async () => {
    let resolveAction: (v: unknown) => void = () => {}
    ;(toggleLikeAction as Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve
      }),
    )
    renderButton({ initialLiked: true, initialCount: 5 })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    // Optimistic un-like
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('4')).toBeTruthy()
    resolveAction({ success: true, data: { liked: false, count: 4 } })
    await flush()
  })
})

// ---------------------------------------------------------------------------
// 3. LIKE-03 — rollback on Server Action failure
// ---------------------------------------------------------------------------

describe('LikeButton — rollback on failure (LIKE-03, SC#4)', () => {
  it('rolls back to pre-click state on success:false, logs console.error, no alert', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(toggleLikeAction as Mock).mockResolvedValue({ success: false, error: 'server error' })
    renderButton({ initialLiked: false, initialCount: 3 })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    await flush()
    // Rolled back: aria-pressed back to false, count back to 3
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('3')).toBeTruthy()
    // No visible error element
    expect(screen.queryByRole('alert')).toBeNull()
    // toggleLikeAction was called exactly once
    expect(toggleLikeAction).toHaveBeenCalledTimes(1)
    // Error was silently logged
    expect(consoleSpy).toHaveBeenCalledWith(
      '[LikeButton] action failed:',
      'server error',
    )
    consoleSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// 4. LIKE-04 — reconcile to server-confirmed values, NOT optimistic increment
// ---------------------------------------------------------------------------

describe('LikeButton — server reconcile (LIKE-04, Phase 55 D-08)', () => {
  it('reconciles count to result.data.count (9) rather than local optimistic value (4)', async () => {
    ;(toggleLikeAction as Mock).mockResolvedValue({
      success: true,
      data: { liked: true, count: 9 },
    })
    renderButton({ initialLiked: false, initialCount: 3 })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    await flush()
    // After action resolves, count reconciles to server value 9, not optimistic 4
    expect(screen.getByText('9')).toBeTruthy()
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })
})

// ---------------------------------------------------------------------------
// 5. LIKE-04 — count visibility rules
// ---------------------------------------------------------------------------

describe('LikeButton — count visibility (LIKE-04)', () => {
  it('hides count when count===0 and not liked', () => {
    renderButton({ initialLiked: false, initialCount: 0 })
    expect(screen.queryByText('0')).toBeNull()
  })

  it('shows count when count>0 and not liked', () => {
    renderButton({ initialLiked: false, initialCount: 5 })
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('shows count=0 when liked (liked-shows-count rule)', () => {
    // Even at count=0, if liked the count span should be visible
    renderButton({ initialLiked: true, initialCount: 0 })
    expect(screen.getByText('0')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 6. LIKE-02 — anon bounce to /login?next=
// ---------------------------------------------------------------------------

describe('LikeButton — anon bounce (LIKE-02)', () => {
  it('renders button for anon viewer (viewerId null)', () => {
    renderButton({ viewerId: null })
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('click calls router.push with /login?next=... and does NOT call toggleLikeAction', async () => {
    // jsdom default pathname is '/' — window.location.pathname === '/'
    renderButton({ viewerId: null })
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(toggleLikeAction).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledTimes(1)
    const pushArg = (mockPush as Mock).mock.calls[0][0] as string
    expect(pushArg).toContain('/login?next=')
  })
})

// ---------------------------------------------------------------------------
// 7. SC#4 — disabled blocks double-fire during pending transition
// ---------------------------------------------------------------------------

describe('LikeButton — disabled during pending (SC#4)', () => {
  it('a second click while pending does NOT call toggleLikeAction a second time', async () => {
    let resolveAction: (v: unknown) => void = () => {}
    ;(toggleLikeAction as Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve
      }),
    )
    renderButton({ initialLiked: false, initialCount: 0 })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    // Button is disabled during transition
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
    // Second click should be blocked
    fireEvent.click(btn)
    resolveAction({ success: true, data: { liked: true, count: 1 } })
    await flush()
    // toggleLikeAction called only once despite two clicks
    expect(toggleLikeAction).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 8. SC#4 / idempotent re-like — silent rollback, no alert
// ---------------------------------------------------------------------------

describe('LikeButton — idempotent re-like (SC#4)', () => {
  it('when action returns success:false (re-like), rolls back silently without throwing or showing alert', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(toggleLikeAction as Mock).mockResolvedValue({ success: false, error: 'conflict' })
    renderButton({ initialLiked: false, initialCount: 2 })
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    await flush()
    // Rolls back to pre-click state
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('2')).toBeTruthy()
    // No error toast
    expect(screen.queryByRole('alert')).toBeNull()
    consoleSpy.mockRestore()
  })
})
