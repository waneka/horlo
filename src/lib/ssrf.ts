import { promises as dns } from 'node:dns'
import * as net from 'node:net'

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
  if (lower === '::1') return true
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
 * Fetch with SSRF protection:
 * - Resolves and validates the initial URL
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

  while (true) {
    const parsed = new URL(currentUrl)
    await resolveAndValidate(parsed.hostname)

    const response = await fetch(currentUrl, {
      ...options,
      redirect: 'manual',
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
