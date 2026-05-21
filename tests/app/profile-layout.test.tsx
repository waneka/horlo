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

import ProfileLayout from '@/app/u/[username]/layout'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { ProfileGate } from '@/app/u/[username]/profile-gate'

describe('/u/[username]/layout — viewer plumbing (post-51 tab-UX restoration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // WR-06-equivalent contract (relocated from page-level test 2026-05-21):
  // assert that the layout invokes <ProfileGate> with the resolved viewerId
  // as a prop. Source-grep in tests/profile-route-51.test.ts Test 2 pins
  // the gate's prop signature; this assertion pins that the value flows
  // through the layout's getCurrentUser → <ProfileGate viewerId={...}>
  // chain. If a future refactor switches to context plumbing or drops the
  // prop, this test catches it.
  it('plumbs viewerId to <ProfileGate> for authenticated viewers', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'a@b.co' })

    const result = (await ProfileLayout({
      children: 'TAB_CONTENT_SENTINEL' as unknown as React.ReactNode,
      params: Promise.resolve({ username: 'alice' }),
    })) as any

    // Layout returns <main>...<ProfileGate ...>{children}</ProfileGate></main>
    expect(result.type).toBe('main')
    const gateEl = result.props.children
    expect(gateEl.type).toBe(ProfileGate)
    expect(gateEl.props.username).toBe('alice')
    expect(gateEl.props.viewerId).toBe('user-1')
    expect(gateEl.props.children).toBe('TAB_CONTENT_SENTINEL')
  })

  it('passes viewerId=null when caller is anonymous (UnauthorizedError swallowed)', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())

    const result = (await ProfileLayout({
      children: null as unknown as React.ReactNode,
      params: Promise.resolve({ username: 'alice' }),
    })) as any

    const gateEl = result.props.children
    expect(gateEl.type).toBe(ProfileGate)
    expect(gateEl.props.viewerId).toBe(null)
  })

  it('rethrows non-UnauthorizedError from getCurrentUser', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('boom'))

    await expect(
      ProfileLayout({
        children: null as unknown as React.ReactNode,
        params: Promise.resolve({ username: 'alice' }),
      }),
    ).rejects.toThrow('boom')
  })
})
