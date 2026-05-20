import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
import type { CatalogTasteAttributes } from '@/lib/types'

/**
 * Phase 39b D-39b-03 / D-39b-04 — ReferenceIdentityCard render contract.
 *
 * Phase 49.1 Plan 04 (D-SCOPE-01a): archetype side of the headline is removed.
 * The fixture below omits `primaryArchetype` (post-Plan-06 CatalogTasteAttributes
 * shape — the field is still declared on the type in this plan, so we cast
 * through `unknown` for now).
 * TODO Phase 49.1 Plan 06 — drop cast when CatalogTasteAttributes loses primaryArchetype.
 *
 * Six scenarios per UI-SPEC §Test Coverage Contract (post-49.1):
 *  1. Renders all sections when confidence >= 0.5 (era-only headline)
 *  2. Returns null when taste === null
 *  3. Returns null when confidence < 0.5 (D-39b-03 gate)
 *  4. Returns null when confidence === null
 *  5. Omits headline when eraSignal is null
 *  6. Omits a scale bar when its value is null
 */

const FULL_TASTE = {
  formality: 0.7,
  sportiness: 0.3,
  heritageScore: 0.85,
  eraSignal: 'modern' as const,
  designMotifs: ['bauhaus', 'gilt-dial'],
  confidence: 0.75,
  extractedFromPhoto: false,
} as unknown as CatalogTasteAttributes

describe('ReferenceIdentityCard', () => {
  it('renders all sections when confidence >= 0.5 (era-only headline)', () => {
    const { getByText, queryByText } = render(<ReferenceIdentityCard taste={FULL_TASTE} />)
    expect(getByText('Inferred taste signature')).toBeTruthy()
    expect(getByText('Modern era')).toBeTruthy()
    expect(getByText('bauhaus')).toBeTruthy()
    // D-SCOPE-01a: archetype side of headline is gone — no archetype label renders.
    expect(queryByText('Dress')).toBeNull()
    expect(queryByText('Dive')).toBeNull()
  })

  it('returns null when taste === null', () => {
    const { container } = render(<ReferenceIdentityCard taste={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when confidence < 0.5 (D-39b-03 gate)', () => {
    const { container } = render(
      <ReferenceIdentityCard taste={{ ...FULL_TASTE, confidence: 0.3 }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when confidence === null', () => {
    const { container } = render(
      <ReferenceIdentityCard taste={{ ...FULL_TASTE, confidence: null }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('omits headline when eraSignal is null (post-49.1: archetype side is already removed)', () => {
    const { queryByText } = render(
      <ReferenceIdentityCard
        taste={{ ...FULL_TASTE, eraSignal: null }}
      />,
    )
    expect(queryByText('Modern era')).toBeNull()
  })

  it('omits a scale bar when its value is null', () => {
    const { queryByText } = render(
      <ReferenceIdentityCard taste={{ ...FULL_TASTE, formality: null }} />,
    )
    expect(queryByText('Formality')).toBeNull()
    // Sportiness + Heritage still render
    expect(queryByText('Sportiness')).toBeTruthy()
    expect(queryByText('Heritage')).toBeTruthy()
  })
})
