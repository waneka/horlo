// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
//
// Stub for useMediaCapability — capability probe hook (VID-01, VID-04).
// Filled in during Wave 1+ implementation per 77-PATTERNS.md §useMediaCapability.test.ts.
// Until then, every case is `it.todo` so the file parses + reports as todo (not failure).

import { describe, it, expect } from 'vitest'

describe('useMediaCapability — capability probe hook (VID-01, VID-04)', () => {
  it.todo('VID-01: returns supportsVideoCapture=false before probe runs')
  it.todo('VID-01 / VID-04: returns supportsVideoCapture=true + mimeType="video/mp4;codecs=avc1" when mp4 is supported')
  it.todo('VID-04: falls back to mimeType="video/webm" when mp4 is unsupported but webm is supported')
  it.todo('VID-01: returns supportsVideoCapture=false when navigator.mediaDevices.getUserMedia is unavailable')

  // Sanity placeholder so the file always has at least one runnable assertion
  // (vitest reports `1 passed` and the 4 todos above as `↓ todo`).
  it('stub: vitest module discovery + import resolution', () => {
    expect(true).toBe(true)
  })
})
