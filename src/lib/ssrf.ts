import { promises as dns } from 'node:dns'
import * as net from 'node:net'
import { Agent } from 'undici'

// Private, loopback, link-local, and reserved ranges
const PRIVATE_RANGES_V4 = [
  { start: '10.0.0.0', bits: 8 }, // RFC1918
  { start: '172.16.0.0', bits: 12 }, // RFC1918
  { start: '192.168.0.0', bits: 16 }, // RFC1918
  { start: '127.0.0.0', bits: 8 }, // Loopback
  { start: '169.254.0.0', bits: 16 }, // Link-local
  { start: '100.64.0.0', bits: 10 }, // Shared address space (RFC6598)
  { start: '0.0.0.0', bits: 8 }, // "This" network
  { start: '192.0.0.0', bits: 24 }, // IETF Protocol Assignments
  { start: '198.18.0.0', bits: 15 }, // Benchmarking
  { start: '240.0.0.0', bits: 4 }, // Reserved
  { start: '224.0.0.0', bits: 4 }, // Multicast
]

const PRIVATE_IPV6_PREFIXES = ['::1', 'fc', 'fd', 'fe80', 'ff']

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

function isPrivateIpv4(ip: string): boolean {
  const ipNum = ipToNumber(ip)
  return PRIVATE_RANGES_V4.some(({ start, bits }) => {
    const startNum = ipToNumber(start)
    const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0
    return (ipNum & mask) === (startNum & mask)
  })
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::' || lower === '::1') return true
  // IPv4-mapped IPv6: ::ffff:a.b.c.d
  const v4mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (v4mapped) return isPrivateIpv4(v4mapped[1])
  // IPv4-compatible IPv6: ::a.b.c.d
  const v4compat = lower.match(/^::(\d+\.\d+\.\d+\.\d+)$/)
  if (v4compat) return isPrivateIpv4(v4compat[1])
  return PRIVATE_IPV6_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip)
  if (net.isIPv6(ip)) return isPrivateIpv6(ip)
  return true // Treat unknown format as private (fail closed)
}

export class SsrfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfError'
  }
}

/**
 * Resolves hostname to IPs and rejects if any resolved IP is private.
 * Returns the first resolved address for pinning.
 */
export async function resolveAndValidate(hostname: string): Promise<string> {
  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await dns.lookup(hostname, { all: true })
  } catch {
    throw new SsrfError('DNS resolution failed')
  }
  if (!addresses.length) throw new SsrfError('No DNS records found')
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new SsrfError('URL resolves to a private address')
    }
  }
  return addresses[0].address
}

/**
 * Builds an undici Agent whose connect hook performs DNS resolution
 * through `resolveAndValidate`, pinning the dialed address to one that
 * was just validated against the private-IP allowlist. This closes the
 * TOCTOU / DNS-rebinding gap between validation and the actual socket
 * connect — fetch's internal resolver is never consulted, because we
 * hand it the validated IP via the lookup callback.
 */
export function createSsrfSafeDispatcher(): Agent {
  return new Agent({
    connect: {
      lookup: (
        hostname: string,
        _opts: unknown,
        cb: (err: Error | null, address: string, family: number) => void
      ) => {
        resolveAndValidate(hostname)
          .then((ip) => {
            const family = net.isIPv4(ip) ? 4 : net.isIPv6(ip) ? 6 : 0
            cb(null, ip, family)
          })
          .catch((err) => {
            cb(err instanceof Error ? err : new Error(String(err)), '', 0)
          })
      },
    },
  })
}

/**
 * Fetch with SSRF protection:
 * - Resolves and validates the initial URL (rejects private IPs early)
 * - Pins the validated IP into the socket via an undici dispatcher so
 *   the address `fetch` dials is the exact IP that was validated
 * - Follows redirects manually, re-validating each hop
 * - Throws SsrfError for any private-range redirect
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  maxRedirects = 5
): Promise<Response> {
  let currentUrl = url
  let redirectsLeft = maxRedirects
  const dispatcher = createSsrfSafeDispatcher()

  while (true) {
    const parsed = new URL(currentUrl)
    // Early validation: fail fast with SsrfError before involving fetch.
    // The dispatcher below also validates at connect time — this is
    // intentional defense in depth and ensures a consistent error type.
    await resolveAndValidate(parsed.hostname)

    const response = await fetch(currentUrl, {
      ...options,
      redirect: 'manual',
      // @ts-expect-error - Node's global fetch accepts an undici dispatcher,
      // but the DOM RequestInit type does not declare it.
      dispatcher,
    })

    if (response.status >= 300 && response.status < 400) {
      if (redirectsLeft <= 0) throw new SsrfError('Too many redirects')
      const location = response.headers.get('location')
      if (!location) throw new SsrfError('Redirect with no Location header')
      currentUrl = new URL(location, currentUrl).toString()
      redirectsLeft--
      continue
    }

    return response
  }
}
