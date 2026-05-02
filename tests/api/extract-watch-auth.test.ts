import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn(),
}))
vi.mock('@/lib/extractors', () => ({
  // Phase 25 Plan 04: D-12 post-extract gate flips empty extractions to a
  // structured-data-missing 422 — the success-path tests below need a mock
  // shape with brand+model populated so the route reaches the success branch.
  fetchAndExtract: vi.fn().mockResolvedValue({
    name: 'mock',
    data: { brand: 'Omega', model: 'Speedmaster' },
  }),
}))

import { POST } from '@/app/api/extract-watch/route'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { fetchAndExtract } from '@/lib/extractors'

function mkPost(body: unknown) {
  return new NextRequest('http://localhost/api/extract-watch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/extract-watch auth gate — AUTH-04', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 { error: "Unauthorized" } when session is missing', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    const res = await POST(mkPost({ url: 'https://example.com' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 BEFORE running SSRF validation (auth runs first)', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    // Invalid URL would normally produce 400; auth check must short-circuit.
    const res = await POST(mkPost({ url: 'not-a-valid-url' }))
    expect(res.status).toBe(401)
    expect(fetchAndExtract).not.toHaveBeenCalled()
  })

  it('proceeds past auth check when session is present', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    const res = await POST(mkPost({ url: 'https://example.com' }))
    expect(res.status).toBe(200)
    expect(fetchAndExtract).toHaveBeenCalledWith('https://example.com')
  })

  it('preserves 400 for invalid URL when session is present', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    const res = await POST(mkPost({ url: 'not-a-url' }))
    expect(res.status).toBe(400)
  })
})
