import { describe, it, expect } from 'vitest'
import { catalogEntryToSimilarityInput } from './shims'
import { analyzeSimilarity } from '@/lib/similarity'
import type { CatalogEntry, Watch, UserPreferences } from '@/lib/types'

/**
 * Phase 20 D-09 — caller shim catalogEntryToSimilarityInput preserves engine inputs.
 *
 * Round-trip property: shim'd Watch produces same SimilarityResult as a
 * real Watch with identical fields when fed into analyzeSimilarity.
 */

function buildCatalogEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'catalog-uuid-xyz',
    brand: 'Rolex',
    model: 'Submariner',
    reference: '124060',
    source: 'admin_curated',
    imageUrl: 'https://example.com/sub.jpg',
    imageSourceUrl: null,
    imageSourceQuality: null,
    movement: 'automatic',
    caseSizeMm: 41,
    lugToLugMm: 48,
    waterResistanceM: 300,
    crystalType: 'sapphire',
    dialColor: 'black',
    isChronometer: true,
    productionYear: 2020,
    productionYearIsEstimate: false,
    styleTags: ['dressy', 'tool'],
    designTraits: ['rotating-bezel'],
    roleTags: ['daily-driver'],
    complications: ['date'],
    ownersCount: 1,
    wishlistCount: 0,
    formality: 0.5,
    sportiness: 0.7,
    heritageScore: 0.8,
    primaryArchetype: 'dive',
    eraSignal: 'modern',
    designMotifs: ['onyx-dial'],
    confidence: 0.9,
    extractedFromPhoto: false,
    createdAt: '2026-04-29T00:00:00Z',
    updatedAt: '2026-04-29T00:00:00Z',
    ...overrides,
  }
}

function defaultPrefs(): UserPreferences {
  return {
    preferredStyles: [],
    dislikedStyles: [],
    preferredDesignTraits: [],
    dislikedDesignTraits: [],
    preferredComplications: [],
    complicationExceptions: [],
    preferredDialColors: [],
    dislikedDialColors: [],
    overlapTolerance: 'medium',
  }
}

function buildOwnedWatch(id: string, overrides: Partial<Watch> = {}): Watch {
  return {
    id,
    brand: 'Omega',
    model: 'Seamaster',
    status: 'owned',
    movement: 'automatic',
    complications: ['date'],
    styleTags: ['tool'],
    designTraits: ['rotating-bezel'],
    roleTags: ['daily-driver'],
    caseSizeMm: 42,
    waterResistanceM: 300,
    dialColor: 'black',
    crystalType: 'sapphire',
    ...overrides,
  }
}

describe('D-09 catalogEntryToSimilarityInput shim (Plan 02)', () => {
  it("round-trip: shim'd Watch produces same SimilarityResult as a real Watch with identical fields", () => {
    const entry = buildCatalogEntry()
    const shimmed = catalogEntryToSimilarityInput(entry)

    // Build a parallel Watch by hand with identical fields (shim'd shape).
    const parallel: Watch = {
      id: entry.id,
      brand: entry.brand,
      model: entry.model,
      reference: entry.reference ?? undefined,
      status: 'wishlist',
      movement: 'automatic',
      complications: entry.complications,
      caseSizeMm: entry.caseSizeMm ?? undefined,
      lugToLugMm: entry.lugToLugMm ?? undefined,
      waterResistanceM: entry.waterResistanceM ?? undefined,
      crystalType: 'sapphire',
      dialColor: entry.dialColor ?? undefined,
      styleTags: entry.styleTags,
      designTraits: entry.designTraits,
      roleTags: entry.roleTags,
      isChronometer: entry.isChronometer ?? undefined,
      productionYear: entry.productionYear ?? undefined,
      imageUrl: entry.imageUrl ?? undefined,
    }

    const collection: Watch[] = [
      buildOwnedWatch('owned-1'),
      buildOwnedWatch('owned-2', { brand: 'Tudor', model: 'Black Bay' }),
    ]
    const prefs = defaultPrefs()

    const a = analyzeSimilarity(shimmed, collection, prefs)
    const b = analyzeSimilarity(parallel, collection, prefs)

    expect(a).toEqual(b)
  })

  it('coerces unknown movement string to "other" (closed union safety)', () => {
    const entry = buildCatalogEntry({ movement: 'rotor-driven' })
    const shimmed = catalogEntryToSimilarityInput(entry)
    expect(shimmed.movement).toBe('other')
  })

  it('coerces unknown crystalType to undefined (Watch optional)', () => {
    const entry = buildCatalogEntry({ crystalType: 'titanium-glass' })
    const shimmed = catalogEntryToSimilarityInput(entry)
    expect(shimmed.crystalType).toBeUndefined()
  })

  it('preserves styleTags / designTraits / roleTags / complications arrays verbatim', () => {
    const entry = buildCatalogEntry({
      styleTags: ['dressy', 'tool'],
      designTraits: ['rotating-bezel', 'cyclops'],
      roleTags: ['dive', 'daily'],
      complications: ['date', 'gmt'],
    })
    const shimmed = catalogEntryToSimilarityInput(entry)
    expect(shimmed.styleTags).toEqual(['dressy', 'tool'])
    expect(shimmed.designTraits).toEqual(['rotating-bezel', 'cyclops'])
    expect(shimmed.roleTags).toEqual(['dive', 'daily'])
    expect(shimmed.complications).toEqual(['date', 'gmt'])
  })

  it('sets candidate.status = "wishlist" with comment referencing engine line 225 (Pitfall 7)', () => {
    const entry = buildCatalogEntry()
    const shimmed = catalogEntryToSimilarityInput(entry)
    expect(shimmed.status).toBe('wishlist')
  })

  it('threads catalog UUID through to id slot — does not collide with viewer collection ids (A1)', () => {
    const entry = buildCatalogEntry({ id: 'catalog-uuid-xyz' })
    const shimmed = catalogEntryToSimilarityInput(entry)
    expect(shimmed.id).toBe('catalog-uuid-xyz')

    // Sanity: also ensure no collision with a sample collection id.
    const collection = [buildOwnedWatch('viewer-watch-id-1')]
    expect(collection.some((w) => w.id === shimmed.id)).toBe(false)
  })
})
