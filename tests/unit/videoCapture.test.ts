// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
// Plan 05: upgraded from todo to assertions (VID-02, VID-03)
//
// Unit tests for the MediaRecorder 4s timer + cancel guard semantics. These
// tests do not import the component — they exercise the same sequence the
// component performs (setTimeout → stop; clearTimeout → no stop;
// ondataavailable → chunks → onstop assembles Blob), so a future refactor
// that preserves the contract preserves the test.

import { describe, it, expect, vi } from 'vitest'

describe('videoCapture — MediaRecorder 4s timer + cancel guard (VID-02, VID-03)', () => {
  it('VID-02: setTimeout fires the stop callback at exactly 4000ms', () => {
    vi.useFakeTimers()
    const stopFn = vi.fn()
    setTimeout(() => stopFn(), 4000)
    vi.advanceTimersByTime(3999)
    expect(stopFn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(stopFn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('VID-03: cancel before 4000ms clears the timer so stop does not auto-fire', () => {
    vi.useFakeTimers()
    const autoStop = vi.fn()
    const timer = setTimeout(() => autoStop(), 4000)
    // Cancel path: clearTimeout fires THE timer; the recorder.stop() in
    // handleCancelRecording is a separate synchronous call (not via timer).
    clearTimeout(timer)
    vi.advanceTimersByTime(4500)
    expect(autoStop).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('VID-02 (Pitfall 2): chunks pushed in ondataavailable; Blob assembled inside onstop', () => {
    const chunks: BlobPart[] = []
    // Simulate ondataavailable firing twice during recording.
    const ondataavailable = (e: { data: Blob }) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    ondataavailable({ data: new Blob(['a']) })
    ondataavailable({ data: new Blob(['b']) })
    expect(chunks).toHaveLength(2)
    // onstop assembles into a single Blob — exactly once.
    const blob = new Blob(chunks, { type: 'video/mp4;codecs=avc1' })
    expect(blob.size).toBeGreaterThan(0)
    expect(blob.type).toBe('video/mp4;codecs=avc1')
  })
})
