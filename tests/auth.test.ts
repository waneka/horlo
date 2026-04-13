import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabaseServerClient } from './helpers/mock-supabase'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'

const cookiesMock = vi.fn().mockResolvedValue({
  getAll: vi.fn().mockReturnValue([]),
  set: vi.fn(),
})

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

describe('createSupabaseServerClient (src/lib/supabase/server.ts)', () => {
  it('awaits cookies() from next/headers', async () => {
    // Re-import the real module — bypass the mock above by requiring directly.
    vi.resetModules()
    const actual = await vi.importActual<
      typeof import('@/lib/supabase/server')
    >('@/lib/supabase/server')
    cookiesMock.mockClear()
    await actual.createSupabaseServerClient()
    expect(cookiesMock).toHaveBeenCalled()
  })
})

describe('getCurrentUser (src/lib/auth.ts) — AUTH-01, AUTH-02', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns { id, email } when supabase.auth.getUser returns a user', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSupabaseServerClient({ user: { id: 'u-1', email: 'a@b.co' } }) as any,
    )
    await expect(getCurrentUser()).resolves.toEqual({ id: 'u-1', email: 'a@b.co' })
  })

  it('throws UnauthorizedError when supabase.auth.getUser returns null user', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSupabaseServerClient({ user: null }) as any,
    )
    await expect(getCurrentUser()).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('throws UnauthorizedError when supabase.auth.getUser returns an error', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabaseServerClient({
        user: null,
        error: new Error('jwt tampered'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    )
    await expect(getCurrentUser()).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('UnauthorizedError extends Error with correct name', () => {
    const err = new UnauthorizedError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('UnauthorizedError')
    expect(err.message).toBe('Not authenticated')
  })

  it('UnauthorizedError preserves custom message', () => {
    expect(new UnauthorizedError('custom').message).toBe('custom')
  })
})
