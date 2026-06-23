// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
//
// Stub for ComposeStep — video submit pipeline (VID-01, VID-06).
// Filled in during Wave 1+ implementation per 77-PATTERNS.md §ComposeStep.submit.video.test.tsx.

import { describe, it, expect, vi } from 'vitest'

describe('ComposeStep video submit — pipeline integration (VID-01, VID-06)', () => {
  it.todo('VID-06: submit calls logWearWithVideo (not logWearWithPhoto) when MediaState.kind === "video"')
  it.todo('VID-01: upload ordering = video blob → poster blob → server action (so the action sees both Storage objects)')
  it.todo('VID-01: compensating .remove([videoPath]) fires when the poster upload fails — no orphan video in Storage')

  it('stub: vitest module discovery + import resolution', () => {
    expect(typeof vi.fn).toBe('function')
  })
})
