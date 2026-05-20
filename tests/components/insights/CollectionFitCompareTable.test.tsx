import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CollectionFitCompareTable } from '@/components/insights/CollectionFitCompareTable'
import type { CatalogTasteAttributes } from '@/lib/types'

/**
 * Phase 49.1 Wave 0 — CollectionFitCompareTable renders 5 rows (post-49.1 shape).
 *
 * Analog: `tests/components/insights/ReferenceIdentityCard.test.tsx` (same
 * insights/ folder, same component-test idiom under jsdom).
 *
 * Expected lifecycle:
 *   - Pre Plan 04 (today): FAILS — table renders 6 rows because Row 4 (Archetype)
 *                          still exists in src/components/insights/CollectionFitCompareTable.tsx:158-167.
 *   - Post Plan 04:        PASSES — Row 4 is deleted; Row 5 (Era) and Row 6 (Design Motifs)
 *                          become the new mid + last rows; tableLastClass is rebound.
 *
 * The test file MUST parse and register today; the failing assertions are the
 * Wave 0 contract.
 */

// Both candidate and owned literals deliberately omit `primaryArchetype`
// (the post-49.1 shape). The current `CatalogTasteAttributes` interface still
// declares `primaryArchetype: PrimaryArchetype | null` as required, so we cast
// through `unknown`. After Plan 05 drops the field from the type, the cast
// becomes unnecessary.
const CANDIDATE_TASTE = {
  formality: 0.7,
  sportiness: 0.2,
  heritageScore: 0.8,
  eraSignal: 'modern' as const,
  designMotifs: ['bauhaus'],
  confidence: 0.75,
  extractedFromPhoto: false,
} as unknown as CatalogTasteAttributes

const OWNED_TASTE = {
  formality: 0.6,
  sportiness: 0.3,
  heritageScore: 0.75,
  eraSignal: 'modern' as const,
  designMotifs: ['bauhaus', 'gilt-dial'],
  confidence: 0.8,
  extractedFromPhoto: false,
} as unknown as CatalogTasteAttributes

describe('Phase 49.1 — CollectionFitCompareTable renders 5 rows', () => {
  it('renders 5 rows (Formality, Sportiness, Heritage, Era, Design Motifs)', () => {
    const { container } = render(
      <CollectionFitCompareTable
        candidate={CANDIDATE_TASTE}
        owned={OWNED_TASTE}
        ownedBrand="Test"
        ownedModel="Model"
      />,
    )

    // Count tbody rows exactly.
    const bodyRows = container.querySelectorAll('tbody tr')
    expect(bodyRows.length).toBe(5)

    // Row-header text content, in order. The current 6-row table renders
    // [Formality, Sportiness, Heritage, Archetype, Era, Design Motifs];
    // post-49.1 the Archetype row is gone.
    const rowHeaders = Array.from(
      container.querySelectorAll<HTMLTableCellElement>('tbody tr th[scope="row"]'),
    ).map((th) => th.textContent ?? '')
    expect(rowHeaders).toEqual([
      'Formality',
      'Sportiness',
      'Heritage',
      'Era',
      'Design Motifs',
    ])
    expect(rowHeaders).not.toContain('Archetype')
  })

  it('last row (Design Motifs) uses thRowLastClass / tdLastClass — no border-b', () => {
    const { container } = render(
      <CollectionFitCompareTable
        candidate={CANDIDATE_TASTE}
        owned={OWNED_TASTE}
        ownedBrand="Test"
        ownedModel="Model"
      />,
    )

    const lastTh = container.querySelector('tbody tr:last-child th')
    const lastTd = container.querySelector('tbody tr:last-child td')

    expect(lastTh).toBeTruthy()
    expect(lastTd).toBeTruthy()

    // thRowLastClass / tdLastClass omit `border-b` (vs thRowClass / tdClass which include it).
    expect(lastTh?.className ?? '').not.toContain('border-b')
    expect(lastTd?.className ?? '').not.toContain('border-b')
  })
})
