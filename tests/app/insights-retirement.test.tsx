import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const err: any = new Error('NEXT_REDIRECT')
    err.digest = `NEXT_REDIRECT;push;${url};307`
    throw err
  }),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}))

vi.mock('@/data/profiles', () => ({
  getProfileById: vi.fn(),
}))

import InsightsRetirementPage from '@/app/insights/page'
import { getCurrentUser } from '@/lib/auth'
import { getProfileById } from '@/data/profiles'
import { redirect } from 'next/navigation'

describe('/insights retirement (Phase 14 D-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /u/{username}/insights when profile is present', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(getProfileById).mockResolvedValue({
      id: 'u-1',
      username: 'alice',
    } as any)
    await expect(InsightsRetirementPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/u/alice/insights')
  })

  it('redirects to / when profile is missing (edge case: user row w/o profile)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(getProfileById).mockResolvedValue(null)
    await expect(InsightsRetirementPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('module does NOT declare `use cache` (Pitfall P-11 — redirect targets are per-request)', async () => {
    const fs = await import('node:fs')
    const content = fs.readFileSync('src/app/insights/page.tsx', 'utf8')
    expect(content).not.toContain("'use cache'")
    expect(content).not.toContain('"use cache"')
  })
})
