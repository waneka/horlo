import { describe, it, expect } from 'vitest'
import { getSafeImageUrl, ALLOWED_HOSTS } from '@/lib/images'

describe('getSafeImageUrl', () => {
  it('returns null for undefined/null/empty', () => {
    expect(getSafeImageUrl(undefined)).toBeNull()
    expect(getSafeImageUrl(null)).toBeNull()
    expect(getSafeImageUrl('')).toBeNull()
  })

  it('returns null for malformed URLs', () => {
    expect(getSafeImageUrl('not-a-url')).toBeNull()
  })

  it('returns null for disallowed hosts', () => {
    expect(getSafeImageUrl('https://evil.example.com/foo.jpg')).toBeNull()
    expect(getSafeImageUrl('http://localhost/foo')).toBeNull()
    expect(getSafeImageUrl('https://pinterest.com/pin/123')).toBeNull()
  })

  it('returns the URL for exact-host matches', () => {
    expect(getSafeImageUrl('https://hodinkee.com/foo.jpg')).toBe(
      'https://hodinkee.com/foo.jpg',
    )
    expect(getSafeImageUrl('https://cdn.shopify.com/s/foo.jpg')).toBe(
      'https://cdn.shopify.com/s/foo.jpg',
    )
  })

  it('returns the URL for subdomain matches', () => {
    expect(
      getSafeImageUrl('https://cdn.hodinkee.imgix.net.hodinkee.com/foo.jpg'),
    ).toMatch(/hodinkee/)
    expect(getSafeImageUrl('https://www.rolex.com/watches/foo.jpg')).toBe(
      'https://www.rolex.com/watches/foo.jpg',
    )
    expect(getSafeImageUrl('https://images.squarespace-cdn.com/foo.jpg')).toBe(
      'https://images.squarespace-cdn.com/foo.jpg',
    )
  })

  it('ALLOWED_HOSTS includes required retailer set', () => {
    const required = [
      'hodinkee.com',
      'chrono24.com',
      'rolex.com',
      'omega-watches.com',
      'tudorwatch.com',
      'seikowatches.com',
      'cdn.shopify.com',
    ]
    for (const host of required) {
      expect(ALLOWED_HOSTS).toContain(host)
    }
  })
})
