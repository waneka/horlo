/**
 * Phase 18 Plan 01 Task 1 — Wave 0 scaffold for getMostFollowedCollectors.
 *
 * Filled in Plan 01 Task 2 with full integration test bodies. The scaffold
 * exists so downstream Plan 02 component tests can rely on the DAL behavior
 * being asserted before they run.
 *
 * Gating mirrors the canonical pattern (Phase 17 / Phase 16):
 *   const maybe = process.env.DATABASE_URL ? describe : describe.skip
 */
import { describe, it } from 'vitest'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('getMostFollowedCollectors', () => {
  it.todo('excludes the viewer (self-exclusion)')
  it.todo('excludes profiles the viewer already follows')
  it.todo('filters profile_public = true (two-layer privacy mirrors searchProfiles)')
  it.todo('orders by followersCount DESC then username ASC (D-15 tie-break)')
  it.todo('respects opts.limit (returns at most N)')
  it.todo('returns [] when only the viewer exists')
})
