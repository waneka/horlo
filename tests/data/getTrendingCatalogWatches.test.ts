/**
 * Phase 18 Plan 01 Task 1 — Wave 0 scaffold for getTrendingCatalogWatches.
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

maybe('getTrendingCatalogWatches', () => {
  it.todo('orders rows by (owners_count + 0.5 * wishlist_count) DESC')
  it.todo('tie-breaks by brand_normalized ASC, then model_normalized ASC (D-15)')
  it.todo('excludes rows where score is 0 (no signal)')
  it.todo('respects opts.limit (returns at most N rows)')
  it.todo('returns the denormalized counts populated by Phase 17 cron')
})
