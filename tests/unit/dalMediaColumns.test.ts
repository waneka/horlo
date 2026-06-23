// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
//
// Stub for DAL media columns (WR-02).
// Verifies every wear-event reader returns mediaType, mediaPath, posterPath
// (nullable) so Wave 2+ surfaces can branch on mediaType without an extra
// fetch. Filled in during Wave 1+ implementation per 77-PATTERNS.md
// §dalMediaColumns.test.ts.

import { describe, it, expect } from 'vitest'

describe('DAL media columns (WR-02)', () => {
  it.todo('WR-02: getWearEventByIdForViewer returns { mediaType, mediaPath, posterPath } (nullable)')
  it.todo('WR-02: getWearEventsForViewer returns { mediaType, mediaPath, posterPath } (nullable)')
  it.todo('WR-02: getWearRailForViewer returns { mediaType, mediaPath, posterPath } (nullable)')
  it.todo('WR-02: getActiveWearsForUser returns { mediaType, mediaPath, posterPath } (nullable)')

  it('stub: vitest module discovery + import resolution', () => {
    expect(true).toBe(true)
  })
})
