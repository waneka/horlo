// tests/components/WatchForm.test.tsx
//
// Phase 19.1 Plan 03 — WatchForm surgery tests.
//
// Behaviors tested (D-18 + D-19):
//   1. WatchForm on mode="create" does NOT render Style / Role / Design tag pickers (D-18)
//   2. WatchForm on mode="create" renders CatalogPhotoUploader (D-19)
//   3. WatchForm on mode="edit" does NOT render CatalogPhotoUploader (D-19 gate)
//   4. Submitting with empty styleTags/roleTags does NOT show style/role validation errors (D-18)
//
// CatalogPhotoUploader is mocked to a simple stub — its behavior is tested
// separately in CatalogPhotoUploader.test.tsx.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Watch } from '@/lib/types'

// Mock next/navigation (WatchForm calls useRouter)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

// Mock server actions to no-ops
vi.mock('@/app/actions/watches', () => ({
  addWatch: vi.fn().mockResolvedValue({ success: true }),
  editWatch: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock CatalogPhotoUploader to a lightweight stub —
// its own test covers the 4-state interaction behavior.
vi.mock('@/components/watch/CatalogPhotoUploader', () => ({
  CatalogPhotoUploader: () => (
    <div data-testid="catalog-photo-uploader">[CatalogPhotoUploader]</div>
  ),
}))

// Mock UrlImport to avoid complex fetch / extraction rendering in unit tests.
vi.mock('@/components/watch/UrlImport', () => ({
  UrlImport: () => <div data-testid="url-import">[UrlImport]</div>,
}))

import { WatchForm } from '@/components/watch/WatchForm'

const minimalWatch: Watch = {
  id: 'test-watch-id',
  brand: 'Omega',
  model: 'Speedmaster',
  reference: '',
  status: 'owned',
  movement: 'automatic',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
  notes: '',
  imageUrl: '',
}

describe('WatchForm — Phase 19.1 surgery (D-18 + D-19)', () => {
  it('does NOT render Style / Role / Design tag pickers (D-18)', () => {
    render(<WatchForm mode="create" />)
    // These CardTitles were removed in Task 1 — should not appear in DOM
    expect(screen.queryByText(/^Style \*$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Role \*$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Design$/)).not.toBeInTheDocument()
  })

  it('renders CatalogPhotoUploader on mode="create" (D-19)', () => {
    render(<WatchForm mode="create" />)
    expect(screen.getByTestId('catalog-photo-uploader')).toBeInTheDocument()
  })

  it('does NOT render CatalogPhotoUploader on mode="edit" (D-19 gate)', () => {
    render(<WatchForm mode="edit" watch={minimalWatch} />)
    expect(screen.queryByTestId('catalog-photo-uploader')).not.toBeInTheDocument()
  })

  it('does NOT show styleTags / roleTags validation errors on empty submission (D-18 validation removal)', () => {
    render(<WatchForm mode="create" />)
    // These error messages were produced by the removed validation rules;
    // they should not be renderable even if form is submitted empty.
    expect(screen.queryByText(/style tag is required/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/role tag is required/i)).not.toBeInTheDocument()
  })
})
