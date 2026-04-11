// Watch image URLs come from arbitrary retailer product pages. Maintaining
// a host allow-list is infeasible. We enforce https: at the boundary and
// rely on `images.unoptimized: true` in next.config.ts so the browser
// fetches directly — avoiding SSRF via next/image's server-side optimizer.
// http: URLs are auto-upgraded because retailer CDNs virtually always
// serve https on the same path, and mixed content would block anyway.
export function getSafeImageUrl(
  url: string | undefined | null,
): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') return url
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:'
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}
