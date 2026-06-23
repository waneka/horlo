// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
// Plan 02: upgraded from todo to assertions (VID-06)

import { describe, it, expect } from 'vitest'
import type { MediaState } from '@/lib/wywtTypes'

describe('MediaState — discriminated union (VID-06)', () => {
  it('kind:none has no blob fields', () => {
    const s: MediaState = { kind: 'none' }
    expect(s.kind).toBe('none')
  })

  it('kind:photo carries a blob', () => {
    const blob = new Blob(['x'])
    const s: MediaState = { kind: 'photo', blob }
    expect(s.kind).toBe('photo')
    if (s.kind === 'photo') expect(s.blob).toBeInstanceOf(Blob)
  })

  it('kind:video carries videoBlob + posterBlob', () => {
    const vb = new Blob(['v'])
    const pb = new Blob(['p'])
    const s: MediaState = { kind: 'video', videoBlob: vb, posterBlob: pb }
    expect(s.kind).toBe('video')
    if (s.kind === 'video') {
      expect(s.videoBlob).toBeInstanceOf(Blob)
      expect(s.posterBlob).toBeInstanceOf(Blob)
    }
  })
})
