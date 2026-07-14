/**
 * Phase 82 Plan 03 — WatchForm read-only chips + admin link cluster tests.
 *
 * 8 test cases per VALIDATION.md behavior block:
 *   1. catalogId!=null → read-only chip (div with aria-readonly="true"), not <input> for brand
 *   2. catalogId!=null, canonicalBrand undefined → fallback to watch.brand in chip
 *   3. viewerIsAdmin=false → no admin link cluster in DOM
 *   4. viewerIsAdmin=true + mode='edit' + catalogId!=null → "Edit brand" + "Edit family" links rendered
 *   5. mode='create' + viewerIsAdmin=true → no admin link cluster (mode gate)
 *   6. catalogId=null → editable <input> fields still rendered (legacy fallback)
 *   7. a11y — brand chip carries aria-readonly="true"
 *   8. grep armor — admin URL literals present in source (url-contract enforcement)
 *
 * Mocks: CatalogPhotoUploader (canvas/EXIF), addWatch/editWatch (Server Actions),
 * useFormFeedback (state hook). next/navigation and next/cache are globally mocked
 * via tests/setup.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Watch } from '@/lib/types'

// ── Mocks ────────────────────────────────────────────────────────────────────

// CatalogPhotoUploader renders a canvas + file picker; skip in jsdom.
vi.mock('@/components/watch/CatalogPhotoUploader', () => ({
  CatalogPhotoUploader: () => <div data-testid="catalog-photo-uploader" />,
}))

// Server Actions are server-only — mock so import doesn't throw.
vi.mock('@/app/actions/watches', () => ({
  addWatch: vi.fn(),
  editWatch: vi.fn(),
}))

// useFormFeedback uses useTransition + toast; provide a minimal stub.
vi.mock('@/lib/hooks/useFormFeedback', () => ({
  useFormFeedback: () => ({
    pending: false,
    state: 'idle' as const,
    message: null,
    run: vi.fn(),
  }),
}))

// canonicalize + defaultDestinationForStatus are pure utilities; mock to avoid
// next/navigation coupling in the destinations module.
vi.mock('@/lib/watchFlow/destinations', () => ({
  canonicalize: vi.fn((s: string) => s),
  defaultDestinationForStatus: vi.fn(() => '/'),
  validateReturnTo: vi.fn((s: string) => s),
}))

// next/link renders an <a> tag in jsdom — use the real one.
// (No mock needed; the global setup already stubs next/navigation.)

// ── Fixture ──────────────────────────────────────────────────────────────────

const BRAND_ID = 'b-uuid-0001'
const CATALOG_ID = 'cat-uuid-0001'

function makeWatch(overrides: Partial<Watch & { canonicalBrand?: string; canonicalFamily?: string }> = {}): Watch & { canonicalBrand?: string; canonicalFamily?: string } {
  return {
    id: 'watch-uuid-0001',
    brand: 'Hamilton Watch',       // legacy free-text (non-canonical)
    model: 'Khaki Field',
    reference: 'H70455133',
    status: 'owned',
    movement: 'auto',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
    catalogId: null,
    brandId: BRAND_ID,
    familyId: 'fam-uuid-0001',
    ...overrides,
  }
}

// ── Import component under test ───────────────────────────────────────────────

import { WatchForm } from '@/components/watch/WatchForm'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WatchForm — read-only chips (Phase 82-03 UI-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Test 1: catalogId!=null → read-only chip for brand; no editable <input> for brand', () => {
    const watch = makeWatch({
      catalogId: CATALOG_ID,
      canonicalBrand: 'Hamilton',
      canonicalFamily: 'Khaki Field',
      brand: 'Hamilton Watch',
    })
    render(<WatchForm watch={watch} mode="edit" viewerIsAdmin={false} />)

    // Chip renders the canonical brand name
    expect(screen.getByText('Hamilton')).toBeInTheDocument()

    // No editable input for brand (the textbox with label "Brand" should be absent)
    const brandInput = screen.queryByRole('textbox', { name: /brand/i })
    expect(brandInput).toBeNull()
  })

  it('Test 2: catalogId!=null, canonicalBrand undefined → falls back to watch.brand', () => {
    const watch = makeWatch({
      catalogId: CATALOG_ID,
      canonicalBrand: undefined,
      canonicalFamily: undefined,
      brand: 'Hamilton Watch',
      model: 'Khaki Field',
    })
    render(<WatchForm watch={watch} mode="edit" viewerIsAdmin={false} />)

    // Fallback to watch.brand when canonicalBrand is undefined
    expect(screen.getByText('Hamilton Watch')).toBeInTheDocument()
  })

  it('Test 3: viewerIsAdmin=false → no admin link cluster in DOM', () => {
    const watch = makeWatch({
      catalogId: CATALOG_ID,
      canonicalBrand: 'Hamilton',
      brandId: BRAND_ID,
    })
    render(<WatchForm watch={watch} mode="edit" viewerIsAdmin={false} />)

    expect(screen.queryByText('Edit brand')).toBeNull()
    expect(screen.queryByText('Edit family')).toBeNull()
  })

  it('Test 4: viewerIsAdmin=true + mode=edit + catalogId!=null → admin link cluster rendered with correct hrefs', () => {
    const watch = makeWatch({
      catalogId: CATALOG_ID,
      canonicalBrand: 'Hamilton',
      brandId: BRAND_ID,
      familyId: 'fam-uuid-0001',
    })
    render(<WatchForm watch={watch} mode="edit" viewerIsAdmin={true} />)

    // Button with render={<Link>} renders as <a role="button"> in base-ui.
    // Assert by text content presence and href attribute on the anchor element.
    expect(screen.getByText('Edit brand')).toBeInTheDocument()
    expect(screen.getByText('Edit family')).toBeInTheDocument()

    // Find the anchor elements by searching for elements with the correct href.
    const editBrandEl = document.querySelector(`a[href="/admin/brands#brand-${BRAND_ID}"]`)
    expect(editBrandEl).not.toBeNull()
    expect(editBrandEl!.textContent).toMatch(/edit brand/i)

    const editFamilyEl = document.querySelector(`a[href="/admin/families?brandId=${BRAND_ID}"]`)
    expect(editFamilyEl).not.toBeNull()
    expect(editFamilyEl!.textContent).toMatch(/edit family/i)
  })

  it('Test 5: mode=create + viewerIsAdmin=true → no admin link cluster (mode gate)', () => {
    const watch = makeWatch({
      catalogId: CATALOG_ID,
      canonicalBrand: 'Hamilton',
      brandId: BRAND_ID,
    })
    render(<WatchForm watch={watch} mode="create" viewerIsAdmin={true} />)

    expect(screen.queryByText('Edit brand')).toBeNull()
    expect(screen.queryByText('Edit family')).toBeNull()
  })

  it('Test 6: catalogId=null (legacy) → editable <input> for brand still rendered', () => {
    const watch = makeWatch({
      catalogId: null,
      brand: 'Hamilton Watch',
    })
    render(<WatchForm watch={watch} mode="edit" viewerIsAdmin={true} />)

    // With catalogId=null, we render the editable Input
    // Brand label is "Brand *" — check the input exists
    const brandInput = screen.getByRole('textbox', { name: /brand/i })
    expect(brandInput).toBeInTheDocument()
  })

  it('Test 7 (a11y): brand chip carries aria-readonly="true" when catalogId!=null', () => {
    const watch = makeWatch({
      catalogId: CATALOG_ID,
      canonicalBrand: 'Hamilton',
      brand: 'Hamilton Watch',
    })
    render(<WatchForm watch={watch} mode="edit" viewerIsAdmin={false} />)

    // Both brand and model chips should have aria-readonly="true"
    const readOnlyChips = document.querySelectorAll('[aria-readonly="true"]')
    expect(readOnlyChips.length).toBeGreaterThanOrEqual(2)

    // Specifically the brand chip
    const brandChip = document.getElementById('brand')
    expect(brandChip).not.toBeNull()
    expect(brandChip!.getAttribute('aria-readonly')).toBe('true')
  })

  it('Test 8 (grep armor): admin URL patterns present in WatchForm.tsx source', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/watch/WatchForm.tsx'),
      'utf-8',
    )
    const brandUrlCount = (source.match(/\/admin\/brands#brand-/g) ?? []).length
    const familyUrlCount = (source.match(/\/admin\/families\?brandId=/g) ?? []).length

    // Exactly one occurrence of each URL pattern (D-82-08 link cluster)
    expect(brandUrlCount).toBe(1)
    expect(familyUrlCount).toBe(1)
  })
})
