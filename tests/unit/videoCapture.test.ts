// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
//
// Stub for videoCapture — MediaRecorder 3s timer + cancel guard (VID-02, VID-03).
// Filled in during Wave 1+ implementation per 77-PATTERNS.md §videoCapture.test.ts.

import { describe, it, expect, vi } from 'vitest'

describe('videoCapture — MediaRecorder 3s timer + cancel guard (VID-02, VID-03)', () => {
  it.todo('VID-02: MediaRecorder.stop() fires at exactly 3000ms after start()')
  it.todo('VID-03: cancel before 3000ms stops the recorder and emits no blob to the caller')
  it.todo('VID-02 / iOS Pitfall 2: chunks assembled inside onstop (not in dataavailable) so iOS Safari delivers the full buffer')

  it('stub: vitest module discovery + import resolution', () => {
    expect(typeof vi.fn).toBe('function')
  })
})
