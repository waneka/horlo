import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.hodinkee.com' },
      { protocol: 'https', hostname: 'hodinkee.com' },
      { protocol: 'https', hostname: '**.chrono24.com' },
      { protocol: 'https', hostname: '**.watchuseek.com' },
      { protocol: 'https', hostname: '**.rolex.com' },
      { protocol: 'https', hostname: '**.omega-watches.com' },
      { protocol: 'https', hostname: '**.tudorwatch.com' },
      { protocol: 'https', hostname: '**.seikowatches.com' },
      { protocol: 'https', hostname: '**.grand-seiko.com' },
      { protocol: 'https', hostname: '**.wornandwound.com' },
      { protocol: 'https', hostname: '**.teddybaldassarre.com' },
      { protocol: 'https', hostname: '**.watchesofmayfair.com' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: '**.squarespace-cdn.com' },
      { protocol: 'https', hostname: 'images.squarespace-cdn.com' },
    ],
  },
}

export default nextConfig
