import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Phase 22 SET-06 — /auth/callback route handler.
// 5-type redirect map (signup/recovery/email_change/magiclink/invite) +
// override matrix (next overridable for signup/recovery/magiclink only;
// email_change is ALWAYS /settings#account?status=email_changed regardless
// of any next override per D-12) + same-origin guard + verifyOtp error path.
// ---------------------------------------------------------------------------

const verifyOtpMock = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { verifyOtp: verifyOtpMock },
  })),
}))

// Import AFTER the mock so the route binds the mocked client.
const { GET } = await import('@/app/auth/callback/route')

function makeReq(qs: string): NextRequest {
  return new NextRequest(`https://horlo.app/auth/callback?${qs}`)
}

describe('GET /auth/callback — Phase 22 SET-06 5-type redirect map', () => {
  beforeEach(() => {
    verifyOtpMock.mockReset()
    verifyOtpMock.mockResolvedValue({ error: null })
  })

  it('signup redirect — type=signup → /?status=email_confirmed', async () => {
    const res = await GET(makeReq('token_hash=t&type=signup'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'https://horlo.app/?status=email_confirmed',
    )
  })

  it('recovery redirect — type=recovery → /reset-password', async () => {
    const res = await GET(makeReq('token_hash=t&type=recovery'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://horlo.app/reset-password')
  })

  it('email_change redirect with hash and status — /settings#account?status=email_changed', async () => {
    const res = await GET(makeReq('token_hash=t&type=email_change'))
    expect(res.status).toBe(307)
    // The non-standard #account?status=email_changed shape MUST land at the
    // browser intact (D-16 + D-14: SettingsTabsShell parseHash relies on it).
    expect(res.headers.get('location')).toBe(
      'https://horlo.app/settings#account?status=email_changed',
    )
  })

  it('email_change ignores next override — D-12 NEVER overridable', async () => {
    const res = await GET(
      makeReq('token_hash=t&type=email_change&next=/profile'),
    )
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'https://horlo.app/settings#account?status=email_changed',
    )
  })

  it('signup honors next override — type=signup&next=/profile → /profile', async () => {
    const res = await GET(makeReq('token_hash=t&type=signup&next=/profile'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://horlo.app/profile')
  })

  it('signup rejects offsite next — next=//evil.com → falls back to default', async () => {
    const res = await GET(makeReq('token_hash=t&type=signup&next=//evil.com'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'https://horlo.app/?status=email_confirmed',
    )
  })

  it('magiclink and invite redirects — magiclink → /?status=signed_in; invite → /signup?status=invited', async () => {
    const res1 = await GET(makeReq('token_hash=t&type=magiclink'))
    expect(res1.status).toBe(307)
    expect(res1.headers.get('location')).toBe(
      'https://horlo.app/?status=signed_in',
    )

    const res2 = await GET(makeReq('token_hash=t&type=invite'))
    expect(res2.status).toBe(307)
    expect(res2.headers.get('location')).toBe(
      'https://horlo.app/signup?status=invited',
    )
  })

  it('email alias coerces to signup — type=email → coerced to signup redirect', async () => {
    const res = await GET(makeReq('token_hash=t&type=email'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'https://horlo.app/?status=email_confirmed',
    )
  })

  it('unknown type falls through to error — /login?error=invalid_link', async () => {
    const res = await GET(makeReq('token_hash=t&type=garbage'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'https://horlo.app/login?error=invalid_link',
    )
  })

  it('verifyOtp error falls through — /login?error=invalid_link', async () => {
    verifyOtpMock.mockResolvedValueOnce({
      error: { name: 'AuthError', message: 'bad token', status: 400 },
    } as never)
    const res = await GET(makeReq('token_hash=t&type=signup'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'https://horlo.app/login?error=invalid_link',
    )
  })
})
