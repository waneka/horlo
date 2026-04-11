import type { NextConfig } from 'next'

// Watch image URLs come from arbitrary retailer product pages. Rather
// than maintain a host allow-list, we serve images unoptimized — the
// browser fetches directly from the source, so Next.js never performs
// a server-side fetch and there is no SSRF surface via /_next/image.
// getSafeImageUrl() still enforces https: at the client boundary.
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
}

export default nextConfig
