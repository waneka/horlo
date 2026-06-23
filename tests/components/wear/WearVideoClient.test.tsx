// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
//
// Stub for WearVideoClient — autoplay attrs + error fallback (VID-14).
// Filled in during Wave 1+ implementation per 77-PATTERNS.md §WearVideoClient.test.tsx.

import { describe, it, expect, vi } from 'vitest'

describe('WearVideoClient — autoplay attrs + error fallback (VID-14)', () => {
  it.todo('VID-14: <video> element has autoplay, muted, loop, and playsInline attributes set (iOS Safari inline-playback contract)')
  it.todo('VID-14: onError swaps the broken <video> for the poster <img> + "Video unavailable" label (graceful fallback)')
  it.todo('VID-14 / D-06: tap toggles between .pause() and .play() (user-controllable, no native browser controls UI)')

  it('stub: vitest module discovery + import resolution', () => {
    expect(typeof vi.fn).toBe('function')
  })
})
