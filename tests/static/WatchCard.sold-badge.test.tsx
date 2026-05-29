// @vitest-environment node
/**
 * Phase 37 — static guard for WatchCard.tsx sold-badge variant (V-13).
 *
 * Asserts the one-line variant ternary is present and the old hardcoded
 * variant="outline" usage on the status badge is removed.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('WatchCard sold badge (Phase 37)', () => {
  const source = readFileSync('src/components/watch/WatchCard.tsx', 'utf8')

  it('uses ternary variant for sold status: secondary vs outline (V-13; D-14)', () => {
    expect(source).toContain(`watch.status === 'sold' ? 'secondary' : 'outline'`)
  })

  it('does NOT use hardcoded variant="outline" on {watch.status} badge', () => {
    expect(source).not.toContain('variant="outline">{watch.status}')
  })
})
