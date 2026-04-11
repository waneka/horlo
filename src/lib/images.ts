export const ALLOWED_HOSTS = [
  'hodinkee.com',
  'chrono24.com',
  'watchuseek.com',
  'rolex.com',
  'omega-watches.com',
  'tudorwatch.com',
  'seikowatches.com',
  'grand-seiko.com',
  'wornandwound.com',
  'teddybaldassarre.com',
  'watchesofmayfair.com',
  'cdn.shopify.com',
  'squarespace-cdn.com',
  'images.squarespace-cdn.com',
] as const

export function getSafeImageUrl(
  url: string | undefined | null,
): string | null {
  if (!url) return null
  try {
    const { hostname } = new URL(url)
    const isAllowed = ALLOWED_HOSTS.some(
      (h) => hostname === h || hostname.endsWith('.' + h),
    )
    return isAllowed ? url : null
  } catch {
    return null
  }
}
