import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isPrivateIp, SsrfError } from '@/lib/ssrf'

// Mock node:dns for resolveAndValidate + safeFetch tests
vi.mock('node:dns', () => {
  const promises = { lookup: vi.fn() }
  return { promises, default: { promises } }
})

import { promises as dns } from 'node:dns'
import { resolveAndValidate, safeFetch } from '@/lib/ssrf'

const lookup = dns.lookup as unknown as ReturnType<typeof vi.fn>

describe('isPrivateIp - IPv4', () => {
  it.each([
    ['10.0.0.1', true],
    ['10.255.255.255', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['172.32.0.1', false],
    ['192.168.1.1', true],
    ['127.0.0.1', true],
    ['169.254.169.254', true],
    ['100.64.0.1', true],
    ['100.127.255.255', true],
    ['224.0.0.1', true],
    ['240.0.0.1', true],
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['93.184.216.34', false],
  ])('isPrivateIp(%s) -> %s', (ip, expected) => {
    expect(isPrivateIp(ip as string)).toBe(expected)
  })
})

describe('isPrivateIp - IPv6', () => {
  it.each([
    ['::1', true],
    ['fc00::1', true],
    ['fd00::1', true],
    ['fe80::1', true],
    ['ff00::1', true],
    ['2001:4860:4860::8888', false],
    ['2606:4700:4700::1111', false],
    ['::', true],
    ['::ffff:127.0.0.1', true],
    ['::ffff:169.254.169.254', true],
    ['::ffff:10.0.0.1', true],
    ['::ffff:192.168.1.1', true],
    ['::ffff:8.8.8.8', false],
    ['::127.0.0.1', true],
  ])('isPrivateIp(%s) -> %s', (ip, expected) => {
    expect(isPrivateIp(ip as string)).toBe(expected)
  })
})

describe('isPrivateIp - unknown format', () => {
  it('treats non-IP strings as private (fail closed)', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true)
  })
})

describe('resolveAndValidate', () => {
  beforeEach(() => lookup.mockReset())

  it('resolves public hostname to pinned IP', async () => {
    lookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
    await expect(resolveAndValidate('example.com')).resolves.toBe('93.184.216.34')
  })

  it('rejects when any resolved address is private', async () => {
    lookup.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ])
    await expect(resolveAndValidate('example.com')).rejects.toThrow(SsrfError)
  })

  it('rejects loopback-only DNS result', async () => {
    lookup.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }])
    await expect(resolveAndValidate('localhost-alias')).rejects.toThrow(/private/)
  })

  it('rejects AWS metadata IP', async () => {
    lookup.mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }])
    await expect(resolveAndValidate('metadata.invalid')).rejects.toThrow(SsrfError)
  })

  it('wraps DNS failures in SsrfError', async () => {
    lookup.mockRejectedValueOnce(new Error('ENOTFOUND'))
    await expect(resolveAndValidate('nonexistent.invalid')).rejects.toThrow(SsrfError)
  })

  it('rejects empty DNS result', async () => {
    lookup.mockResolvedValueOnce([])
    await expect(resolveAndValidate('void.invalid')).rejects.toThrow(SsrfError)
  })
})

describe('safeFetch', () => {
  beforeEach(() => {
    lookup.mockReset()
    vi.restoreAllMocks()
  })

  it('fetches when resolution is public', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const res = await safeFetch('https://example.com/page')
    expect(res.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/page',
      expect.objectContaining({ redirect: 'manual' })
    )
  })

  it('blocks redirect to private IP', async () => {
    lookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }])
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://internal.invalid/secret' } })
    )
    await expect(safeFetch('https://example.com/')).rejects.toThrow(SsrfError)
  })

  it('throws on redirect with no Location header', async () => {
    lookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 302 })
    )
    await expect(safeFetch('https://example.com/')).rejects.toThrow(/Location/)
  })

  it('caps redirect chain at maxRedirects', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    for (let i = 0; i < 10; i++) {
      fetchSpy.mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: `https://example.com/hop${i}` } })
      )
    }
    await expect(safeFetch('https://example.com/', {}, 3)).rejects.toThrow(/Too many redirects/)
  })
})
