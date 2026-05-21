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
  experimental: {
    cacheComponents: true, // Phase 10: enables `'use cache'` directive (Pitfall 12). Required by src/components/home/CollectorsLikeYou.tsx.
  },
  // Phase 51: bare-username → /collection redirect is a build-time config
  // rule, NOT a page-level redirect(). The page-level redirect was being
  // prerendered as a cached 200 (x-vercel-cache: PRERENDER) because the
  // meta-tag redirect inserted by Next's redirect() in streaming context
  // was baked into the prerender. Config-level redirects are evaluated
  // before routing and bypass Cache Components / PPR entirely.
  // See .planning/debug/profile-page-404-top-nav.md and Phase 51 RESEARCH.md.
  async redirects() {
    return [
      {
        source: '/u/:username',
        destination: '/u/:username/collection',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
