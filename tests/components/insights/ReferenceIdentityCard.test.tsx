import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
import type { CatalogTasteAttributes } from '@/lib/types'

/**
 * Phase 39b D-39b-03 / D-39b-04 — ReferenceIdentityCard render contract.
 *
 * Six scenarios per UI-SPEC §Test Coverage Contract:
 *  1. Renders all sections when confidence >= 0.5
 *  2. Returns null when taste === null
 *  3. Returns null when confidence < 0.5 (D-39b-03 gate)
 *  4. Returns null when confidence === null
 *  5. Omits headline when both era and archetype are null
 *  6. Omits a scale bar when its value is null
 */

const FULL_TASTE: CatalogTasteAttributes = {
  formality: 0.7,
  sportiness: 0.3,
  heritageScore: 0.85,
  primaryArchetype: 'dress',
  eraSignal: 'modern',
  designMotifs: ['bauhaus', 'gilt-dial'],
  confidence: 0.75,
  extractedFromPhoto: false,
}

describe('ReferenceIdentityCard', () => {
  it('renders all sections when confidence >= 0.5', () => {
    const { getByText } = render(<ReferenceIdentityCard taste={FULL_TASTE} />)
    expect(getByText('Inferred taste signature')).toBeTruthy()
    expect(getByText('Modern era')).toBeTruthy()
    expect(getByText('Dress')).toBeTruthy()
    expect(getByText('bauhaus')).toBeTruthy()
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

  it('omits headline when both era and archetype are null', () => {
    const { queryByText } = render(
      <ReferenceIdentityCard
        taste={{ ...FULL_TASTE, eraSignal: null, primaryArchetype: null }}
      />,
    )
    expect(queryByText('Modern era')).toBeNull()
    expect(queryByText('Dress')).toBeNull()
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
