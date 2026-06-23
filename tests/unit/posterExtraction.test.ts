// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
//
// Stub for extractPosterBlob — canvas seek + toBlob (VID-05).
// Filled in during Wave 1+ implementation per 77-PATTERNS.md §posterExtraction.test.ts.

import { describe, it, expect, vi } from 'vitest'

describe('extractPosterBlob — canvas seek + toBlob (VID-05)', () => {
  it.todo('VID-05: seeks to video.currentTime = duration * 0.75 before invoking canvas.toBlob')
  it.todo('VID-05: rejects when canvas.toBlob returns null (browser-side allocation failure)')
  it.todo('VID-05: revokes the object URL on success so the blob is not leaked')

  it('stub: vitest module discovery + import resolution', () => {
    expect(typeof vi.fn).toBe('function')
  })
})
