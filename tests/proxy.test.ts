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

describe('proxy.ts — profile route ungating (profile-page-404-top-nav)', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['/u/twwaneka/collection'],
    ['/u/twwaneka/wishlist'],
    ['/u/twwaneka/worn'],
    ['/u/twwaneka/stats'],
    ['/u/twwaneka'],
    ['/u/someuser/collection', '?_rsc=abc123'],
  ])(
    'does not redirect unauth request on profile path %s%s',
    async (pathname, search = '') => {
      vi.mocked(updateSession).mockResolvedValue(mkUpdateSession(null) as any)
      const res = await proxy(mkRequest(pathname, search))
      // Profile routes are ungated — page-level ProfileGate handles viewer
      // identity. A 307 here would poison the Next 16 Router Cache and
      // cause 404s on soft-nav (debug session profile-page-404-top-nav).
      expect(res.status).not.toBe(307)
    },
  )

  it('still redirects unauth requests on non-profile protected routes', async () => {
    vi.mocked(updateSession).mockResolvedValue(mkUpdateSession(null) as any)
    const res = await proxy(mkRequest('/settings'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
})

describe('proxy.ts — SC#4 ARCH-02 regression guard (no /catalog/ redirect logic)', () => {
  it('no catalog redirect — src/proxy.ts must not contain /catalog/ handling (feedback_proxy_router_cache_poisoning memory)', async () => {
    const fs = await import('node:fs')
    const content = fs.readFileSync('src/proxy.ts', 'utf8')
    // A NextResponse.redirect from proxy.ts on an RSC prefetch poisons Next 16's Router Cache
    // → 404 on soft-nav. The canonical path for the ARCH-02 redirect is the page layer
    // (src/app/catalog/[catalogId]/page.tsx per Plan 01). See
    // .planning/debug/profile-page-404-top-nav.md for the live /u/* precedent.
    expect(content).not.toContain('/catalog/')
  })
})
