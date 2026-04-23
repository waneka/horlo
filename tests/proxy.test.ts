import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/proxy', () => ({
  updateSession: vi.fn(),
}))

import proxy from '@/proxy'
import { updateSession } from '@/lib/supabase/proxy'
import { PUBLIC_PATHS } from '@/lib/constants/public-paths'

function mkRequest(pathname: string, search = '') {
  const url = `http://localhost:3000${pathname}${search}`
  return new NextRequest(url)
}

function mkUpdateSession(user: { id: string; email: string } | null) {
  return {
    supabase: {} as any,
    user,
    response: { status: 200, headers: new Headers(), cookies: new Map() } as any,
  }
}

describe('proxy.ts — AUTH-02', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects unauth request on / to /login?next=%2F', async () => {
    vi.mocked(updateSession).mockResolvedValue(mkUpdateSession(null) as any)
    const res = await proxy(mkRequest('/'))
    expect(res.status).toBe(307) // NextResponse.redirect default
    expect(res.headers.get('location')).toContain('/login')
    expect(res.headers.get('location')).toContain('next=%2F')
  })

  it('preserves search params in next query', async () => {
    vi.mocked(updateSession).mockResolvedValue(mkUpdateSession(null) as any)
    const res = await proxy(mkRequest('/watch/abc', '?edit=1'))
    expect(res.headers.get('location')).toMatch(/next=%2Fwatch%2Fabc%3Fedit%3D1/)
  })

  it.each([
    ['/login'],
    ['/signup'],
    ['/forgot-password'],
    ['/reset-password'],
    ['/auth/callback?token_hash=abc&type=recovery'],
  ])('allows unauth request on public path %s', async (path) => {
    vi.mocked(updateSession).mockResolvedValue(mkUpdateSession(null) as any)
    const [pathname, search] = path.split('?')
    const res = await proxy(mkRequest(pathname, search ? `?${search}` : ''))
    // Not a redirect — the response from updateSession is returned verbatim
    expect(res.status).not.toBe(307)
  })

  it('lets authenticated request through with refreshed response', async () => {
    vi.mocked(updateSession).mockResolvedValue(
      mkUpdateSession({ id: 'u-1', email: 'a@b.co' }) as any,
    )
    const res = await proxy(mkRequest('/'))
    expect(res.status).not.toBe(307) // not a redirect
  })

  it('config.matcher uses negative-lookahead excluding static assets', async () => {
    const { config } = await import('@/proxy')
    expect(config.matcher[0]).toContain('_next/static')
    expect(config.matcher[0]).toContain('favicon.ico')
  })
})

describe('proxy.ts — PUBLIC_PATHS parity (NAV-05 D-21)', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(PUBLIC_PATHS)('does not redirect unauth on %s', async (path) => {
    vi.mocked(updateSession).mockResolvedValue(mkUpdateSession(null) as any)
    const res = await proxy(mkRequest(path))
    // Proxy imports the same PUBLIC_PATHS tuple the client nav components
    // consume (Plans 03/04). If this test ever fails, the proxy and the
    // client render gate have drifted — auth chrome would leak on public
    // routes (T-14-01-03).
    expect(res.status).not.toBe(307)
  })
})
