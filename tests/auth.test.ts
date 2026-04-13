import { describe, it, expect, vi } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'

const cookiesMock = vi.fn().mockResolvedValue({
  getAll: vi.fn().mockReturnValue([]),
  set: vi.fn(),
})

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}))

describe('createSupabaseServerClient (src/lib/supabase/server.ts)', () => {
  it('awaits cookies() from next/headers', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    await createSupabaseServerClient()
    expect(cookiesMock).toHaveBeenCalled()
  })
})

describe('getCurrentUser (src/lib/auth.ts) — AUTH-01, AUTH-02', () => {
  it.todo('returns { id, email } when supabase.auth.getUser returns a user')
  it.todo('throws UnauthorizedError when supabase.auth.getUser returns null user')
  it.todo('throws UnauthorizedError when supabase.auth.getUser returns an error')
  it.todo('UnauthorizedError is instanceof Error and has name "UnauthorizedError"')
})
