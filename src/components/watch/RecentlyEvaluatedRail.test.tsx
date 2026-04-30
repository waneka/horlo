/**
 * Phase 20.1 Plan 01 (Wave 0) — RED test scaffold for RecentlyEvaluatedRail.
 *
 * Covers D-14 — session-only chips (FIFO, max 5), click-to-reopen, hidden when
 * empty, exact aria-label format "{brand} {model} — re-evaluate".
 *
 * RED until Plan 03 ships `@/components/watch/RecentlyEvaluatedRail`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))

// IMPORT UNDER TEST — Plan 03 ships this.
import { RecentlyEvaluatedRail } from '@/components/watch/RecentlyEvaluatedRail'
import type { ExtractedWatchData } from '@/lib/extractors/types'

interface RailEntry {
  catalogId: string
  brand: string
  model: string
  imageUrl: string | null
  extracted: ExtractedWatchData
}

const sampleEntries: RailEntry[] = [
  {
    catalogId: 'cat-1',
    brand: 'Omega',
    model: 'Speedmaster',
    imageUrl: 'https://example.com/spd.jpg',
    extracted: { brand: 'Omega', model: 'Speedmaster' },
  },
  {
    catalogId: 'cat-2',
    brand: 'Rolex',
    model: 'Submariner',
    imageUrl: null,
    extracted: { brand: 'Rolex', model: 'Submariner' },
  },
  {
    catalogId: 'cat-3',
    brand: 'Seiko',
    model: 'SKX007',
    imageUrl: null,
    extracted: { brand: 'Seiko', model: 'SKX007' },
  },
]

describe('Phase 20.1 Plan 03 — RecentlyEvaluatedRail (D-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the "Recently evaluated" heading and one chip per entry', () => {
    render(<RecentlyEvaluatedRail entries={sampleEntries} onSelect={() => {}} />)
    expect(screen.getByText('Recently evaluated')).toBeInTheDocument()
    // Each chip is a list item per UI-SPEC accessibility contract: role="list" parent.
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
  })

  it('clicking a chip invokes onSelect with that entry', () => {
    const onSelect = vi.fn()
    render(<RecentlyEvaluatedRail entries={sampleEntries} onSelect={onSelect} />)
    // Click first chip — Omega Speedmaster.
    fireEvent.click(
      screen.getByRole('button', { name: 'Omega Speedmaster — re-evaluate' }),
    )
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(sampleEntries[0])
  })

  it('rail is hidden when entries is empty', () => {
    render(<RecentlyEvaluatedRail entries={[]} onSelect={() => {}} />)
    expect(screen.queryByText('Recently evaluated')).toBeNull()
  })

  it('every chip button has aria-label exactly "{brand} {model} — re-evaluate"', () => {
    render(<RecentlyEvaluatedRail entries={sampleEntries} onSelect={() => {}} />)
    expect(
      screen.getByRole('button', { name: 'Omega Speedmaster — re-evaluate' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Rolex Submariner — re-evaluate' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Seiko SKX007 — re-evaluate' }),
    ).toBeInTheDocument()
  })
})
