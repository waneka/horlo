// src/data/__tests__/catalog-facets.test.ts
//
// Wave 0 test scaffold for Phase 46 Plan 02 searchCatalogWatches facet extension.
// All assertions are marked it.skip — unskip in Plan 02 once searchCatalogWatches
// accepts brand/era/genre/archetype filters in CatalogSearchFilters.
//
// Coverage (D-11, D-12):
//   1. searchCatalogWatches with { archetype: 'dive' } returns only dive watches
//   2. searchCatalogWatches with { era: ERA_SIGNALS[0] } returns only that era's watches
//   3. searchCatalogWatches with { genre: 'dive' } behaves like { archetype: 'dive' }
//   4. searchCatalogWatches with { brand: <slug> } returns only that brand's watches

import { describe, it } from 'vitest'
import { ERA_SIGNALS } from '@/lib/taste/vocab'

// ERA_SIGNALS[0] is used to avoid hardcoding a value that might change
const _firstEra = ERA_SIGNALS[0] // 'vintage-leaning'

describe('searchCatalogWatches facet extension (Phase 46 Plan 02)', () => {
  // unskip in Plan 02 once searchCatalogWatches accepts brand/era/genre/archetype
  it.skip('archetype filter: returns only watches with primaryArchetype = "dive"', async () => {
    // Plan 02 TODO:
    //   const results = await searchCatalogWatches({ archetype: 'dive' }, '')
    //   expect(results.length).toBeGreaterThan(0)
    //   for (const r of results) { expect(r.primaryArchetype).toBe('dive') }
  })

  it.skip('era filter: returns only watches with eraSignal = ERA_SIGNALS[0]', async () => {
    // Plan 02 TODO:
    //   const results = await searchCatalogWatches({ era: ERA_SIGNALS[0] }, '')
    //   expect(results.length).toBeGreaterThan(0)
    //   for (const r of results) { expect(r.eraSignal).toBe(ERA_SIGNALS[0]) }
  })

  it.skip('genre filter: { genre: "dive" } returns same column as { archetype: "dive" }', async () => {
    // Plan 02 TODO:
    //   const byArchetype = await searchCatalogWatches({ archetype: 'dive' }, '')
    //   const byGenre = await searchCatalogWatches({ genre: 'dive' }, '')
    //   expect(byGenre.length).toBe(byArchetype.length)
    //   for (const r of byGenre) { expect(r.primaryArchetype).toBe('dive') }
  })

  it.skip('brand filter: { brand: <slug> } returns only watches from that brand', async () => {
    // Plan 02 TODO:
    //   const knownSlug = 'rolex' // or derive from getBrowseBrandCounts()[0].slug
    //   const results = await searchCatalogWatches({ brand: knownSlug }, '')
    //   expect(results.length).toBeGreaterThan(0)
    //   for (const r of results) { expect(r.brandSlug).toBe(knownSlug) }
  })
})
