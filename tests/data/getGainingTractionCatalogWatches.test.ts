/**
 * Phase 18 Plan 01 Task 1 — Wave 0 scaffold for getGainingTractionCatalogWatches.
 *
 * Filled in Plan 01 Task 3 with full integration test bodies. The scaffold
 * exists so downstream Plan 02 component tests can rely on the DAL behavior
 * being asserted before they run.
 *
 * Gating mirrors the canonical pattern (Phase 17 / Phase 16):
 *   const maybe = process.env.DATABASE_URL ? describe : describe.skip
 */
import { describe, it } from 'vitest'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('getGainingTractionCatalogWatches', () => {
  it.todo('returns {window: 0, watches: []} when no snapshots exist (D-12 case 1)')
  it.todo('returns {window: N, watches: [...]} for 1-6 days of snapshots (D-12 case 2)')
  it.todo('returns {window: 7, watches: [...]} for >=7 days of snapshots (D-12 case 3)')
  it.todo('computes delta as (current.owners + 0.5*current.wishlist) - (oldest.owners + 0.5*oldest.wishlist), rounded to int')
  it.todo('excludes rows with non-positive delta (no change or decrease)')
  it.todo('tie-breaks by delta DESC, then brand_normalized ASC, then model_normalized ASC (D-15)')
})
