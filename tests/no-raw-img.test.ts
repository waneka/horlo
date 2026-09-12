import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('no raw <img tags in watch components', () => {
  it('WatchCard, WatchDetailHero, and WatchPhotoSection have no raw <img', () => {
    const files = [
      'src/components/watch/WatchCard.tsx',
      'src/components/watch/WatchDetailHero.tsx',
      'src/components/watch/WatchPhotoSection.tsx',
    ]
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      // Allow "Image" (capital I) from next/image; forbid raw <img
      expect(src).not.toMatch(/<img\s/)
    }
  })

  it('next/image Image component is imported in WatchCard, WatchDetailHero, and WatchPhotoSection', () => {
    for (const f of [
      'src/components/watch/WatchCard.tsx',
      'src/components/watch/WatchDetailHero.tsx',
      'src/components/watch/WatchPhotoSection.tsx',
    ]) {
      const src = readFileSync(f, 'utf8')
      expect(src).toMatch(/from ['"]next\/image['"]/)
    }
  })
})
