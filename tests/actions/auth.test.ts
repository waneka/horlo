import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabaseServerClient } from '../helpers/mock-supabase'

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT /login')
  }),
}))

import { logout } from '@/app/actions/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

describe('logout Server Action — AUTH-01', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls supabase.auth.signOut and redirects to /login', async () => {
    const mock = mockSupabaseServerClient({ user: { id: 'u-1', email: 'a@b.co' } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)

    await expect(logout()).rejects.toThrow('NEXT_REDIRECT /login')

    expect(mock.auth.signOut).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith('/login')
    // signOut runs BEFORE redirect
    expect(vi.mocked(mock.auth.signOut).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(redirect).mock.invocationCallOrder[0],
    )
  })
})
