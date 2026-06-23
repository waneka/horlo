// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
//
// Stub for MediaState discriminated union (VID-06).
// NOTE: the MediaState type is introduced in Plan 02. Importing it here would
// crash file-level resolution today, so the import is intentionally commented
// out. Plan 02's task list includes uncommenting it and replacing the single
// `it.todo` below with the 3 cases from 77-PATTERNS.md §mediaState.test.ts.

import { describe, it, expect } from 'vitest'

// TODO Plan 02: import type { MediaState } from '@/lib/wywtTypes'

describe('MediaState — discriminated union (VID-06)', () => {
  it.todo('VID-06: MediaState discriminated union has kind:none|photo|video — uncomment after Plan 02')

  it('stub: vitest module discovery + import resolution', () => {
    expect(true).toBe(true)
  })
})
