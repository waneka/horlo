import { describe, it, expect, vi, beforeEach } from 'vitest'

// next/navigation notFound throws a detectable error so we can assert on it.
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = 'Not authenticated') {
      super(message)
      this.name = 'UnauthorizedError'
    }
  },
}))

// ProfileGate is server-only; stub it so we can assert on its props
// without pulling in its data dependencies.
vi.mock('@/app/u/[username]/profile-gate', () => ({
  ProfileGate: vi.fn(() => null),
}))

// Phase 52 D-52-16 restructure: ProfileLayout is now SYNC (returns
// <Suspense><ProfileChrome/></Suspense>); the viewerId plumbing logic
// moved into ProfileChrome (the async runtime-API consumer). Tests call
// ProfileChrome directly to exercise the cookie → <ProfileGate> chain
// that the layout-level test previously pinned. The structural pieces
// (sync layout + Suspense + <main> wrapper) are covered by
// tests/profile-route-51.test.ts Test 1 (REQ-52-03a / REQ-52-03b).
import { ProfileChrome } from '@/app/u/[username]/profile-chrome'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { ProfileGate } from '@/app/u/[username]/profile-gate'

describe('/u/[username]/profile-chrome — viewer plumbing (Phase 52 D-52-CF-02 / D-52-16)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // WR-06-equivalent contract: assert that ProfileChrome (the async
  // runtime-API consumer the sync layout wraps in <Suspense>) invokes
  // <ProfileGate> with the resolved viewerId as a prop. Source-grep in
  // tests/profile-route-51.test.ts Test 2 pins the gate's prop signature;
  // this assertion pins that the value flows through
  // getCurrentUser() → <ProfileGate viewerId={...}>. If a future
  // refactor switches to context plumbing or drops the prop, this
  // catches it.
  it('plumbs viewerId to <ProfileGate> for authenticated viewers', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'a@b.co' })

    const result = (await ProfileChrome({
      children: 'TAB_CONTENT_SENTINEL' as unknown as React.ReactNode,
      paramsPromise: Promise.resolve({ username: 'alice' }),
    })) as any

    // ProfileChrome returns <ProfileGate ...>{children}</ProfileGate>.
    // The <main> wrapper lives in the sync layout (covered by
    // profile-route-51.test.ts Test 1).
    expect(result.type).toBe(ProfileGate)
    expect(result.props.username).toBe('alice')
    expect(result.props.viewerId).toBe('user-1')
    expect(result.props.children).toBe('TAB_CONTENT_SENTINEL')
  })

  it('passes viewerId=null when caller is anonymous (UnauthorizedError swallowed)', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())

    const result = (await ProfileChrome({
      children: null as unknown as React.ReactNode,
      paramsPromise: Promise.resolve({ username: 'alice' }),
    })) as any

    expect(result.type).toBe(ProfileGate)
    expect(result.props.viewerId).toBe(null)
  })

  it('rethrows non-UnauthorizedError from getCurrentUser', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('boom'))

    await expect(
      ProfileChrome({
        children: null as unknown as React.ReactNode,
        paramsPromise: Promise.resolve({ username: 'alice' }),
      }),
    ).rejects.toThrow('boom')
  })
})
