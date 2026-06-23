// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
//
// Stub for WearCard — video branch + VID-15 regression.
// Filled in during Wave 1+ implementation per 77-PATTERNS.md §WearCard.video.test.tsx.
// VID-15 invariant: the existing photo branch (no mediaType) must not change.

import { describe, it, expect, vi } from 'vitest'

describe('WearCard video — branch + VID-15 regression', () => {
  it.todo('VID-13: renders WearVideoClient (containing <video>) when mediaType === "video"')
  it.todo('VID-15: renders zero <video> elements when mediaType is null/undefined — photo branch is byte-identical to pre-Phase 77')

  it('stub: vitest module discovery + import resolution', () => {
    expect(typeof vi.fn).toBe('function')
  })
})
