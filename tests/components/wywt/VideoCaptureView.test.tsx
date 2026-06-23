// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
//
// Stub for VideoCaptureView — stream-as-prop video capture (VID-02, VID-03).
// Filled in during Wave 1+ implementation per 77-PATTERNS.md §VideoCaptureView.test.tsx.

import { describe, it, expect, vi } from 'vitest'

describe('VideoCaptureView — stream-as-prop video capture (VID-02, VID-03)', () => {
  it.todo('VID-02 / VID-03: renders Cancel + Record-3s buttons before recording starts')
  it.todo('VID-02: does NOT call navigator.mediaDevices.getUserMedia internally — stream arrives as a prop (cameraOpeningRef guard pattern)')
  it.todo('VID-03: discard after capture returns the view to its pre-recording state (no blob retained)')
  it.todo('VID-02: disabled prop disables the Record button so submit-in-flight cannot trigger a new capture')

  it('stub: vitest module discovery + import resolution', () => {
    expect(typeof vi.fn).toBe('function')
  })
})
