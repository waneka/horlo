import type { NextConfig } from 'next'
import { ALLOWED_HOSTS } from './src/lib/images'

// Single source of truth: derive next/image remotePatterns from the
// same ALLOWED_HOSTS list that `getSafeImageUrl` enforces. Each entry
// gets both an apex and a wildcard-subdomain pattern so `next/image`
// accepts exactly what `getSafeImageUrl` accepts. `**.example.com`
// does NOT match the apex `example.com`, hence the two entries.
const remotePatterns = ALLOWED_HOSTS.flatMap((host) => [
  { protocol: 'https' as const, hostname: host },
  { protocol: 'https' as const, hostname: `**.${host}` },
])

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
}

export default nextConfig
