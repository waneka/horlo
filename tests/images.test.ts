import { describe, it, expect } from 'vitest'
import { getSafeImageUrl } from '@/lib/images'

describe('getSafeImageUrl', () => {
  it('returns null for undefined/null/empty', () => {
    expect(getSafeImageUrl(undefined)).toBeNull()
    expect(getSafeImageUrl(null)).toBeNull()
    expect(getSafeImageUrl('')).toBeNull()
  })

  it('returns null for malformed URLs', () => {
    expect(getSafeImageUrl('not-a-url')).toBeNull()
  })

  it('auto-upgrades http: URLs to https:', () => {
    expect(getSafeImageUrl('http://hodinkee.com/foo.jpg')).toBe(
      'https://hodinkee.com/foo.jpg',
    )
    expect(
      getSafeImageUrl(
        'http://teddybaldassarre.com/cdn/shop/products/L38124636_clipped_rev_1.jpg?v=1647892798',
      ),
    ).toBe(
      'https://teddybaldassarre.com/cdn/shop/products/L38124636_clipped_rev_1.jpg?v=1647892798',
    )
  })

  it('returns null for non-http(s) protocols (WR-02 regression)', () => {
    expect(getSafeImageUrl('ftp://hodinkee.com/foo.jpg')).toBeNull()
    expect(getSafeImageUrl('javascript:alert(1)')).toBeNull()
    expect(getSafeImageUrl('file:///etc/passwd')).toBeNull()
  })

  it('passes through any https: URL', () => {
    expect(getSafeImageUrl('https://hodinkee.com/foo.jpg')).toBe(
      'https://hodinkee.com/foo.jpg',
    )
    expect(getSafeImageUrl('https://cdn.shopify.com/s/foo.jpg')).toBe(
      'https://cdn.shopify.com/s/foo.jpg',
    )
    expect(
      getSafeImageUrl(
        'https://timex.com/cdn/shop/files/T2N647_c501daf4.png?v=1773814334&width=480',
      ),
    ).toBe(
      'https://timex.com/cdn/shop/files/T2N647_c501daf4.png?v=1773814334&width=480',
    )
  })
})
