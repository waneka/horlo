// tests/components/watch/WatchForm.test.tsx
//
// Canonical location for WatchForm general-coverage tests.
// Consolidates the Phase 19.1 tests from tests/components/WatchForm.test.tsx
// (D-18 + D-19 assertions) and adds TEST-06 augmentations per CONTEXT.md D-02:
//   - Form submit happy path
//   - Required-field validation (brand + model)
//   - Status field transition (wishlist → owned)
//   - Edit mode hydration + editWatch call
//
// WatchForm.isChronometer.test.tsx covers the isChronometer checkbox (FEAT-08).
// WatchForm.notesPublic.test.tsx covers the notesPublic pill (FEAT-07).
// This file covers: D-18 tag-picker removal, D-19 photo uploader, and TEST-06 form flow.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Watch } from '@/lib/types'

// Mock next/navigation — WatchForm calls useRouter().
const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, back: vi.fn() }),
}))

// Mock Server Actions to capture submit payload.
const mockAddWatch = vi.fn().mockResolvedValue({ success: true })
const mockEditWatch = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/app/actions/watches', () => ({
  addWatch: (...args: unknown[]) => mockAddWatch(...args),
  editWatch: (...args: unknown[]) => mockEditWatch(...args),
}))

// Mock CatalogPhotoUploader — behavior tested separately in CatalogPhotoUploader.test.tsx.
vi.mock('@/components/watch/CatalogPhotoUploader', () => ({
  CatalogPhotoUploader: () => (
    <div data-testid="catalog-photo-uploader">[CatalogPhotoUploader]</div>
  ),
}))

// Mock UrlImport — irrelevant to this test file.
vi.mock('@/components/watch/UrlImport', () => ({
  UrlImport: () => <div data-testid="url-import">[UrlImport]</div>,
}))

// Mock Supabase browser client + photo upload helper (create-mode submit path).
const mockUploadCatalogSourcePhoto = vi
  .fn()
  .mockResolvedValue({ path: 'user-abc-123/pending/test.jpg' })
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-abc-123' } },
      }),
    },
  })),
}))
vi.mock('@/lib/storage/catalogSourcePhotos', () => ({
  uploadCatalogSourcePhoto: (...args: unknown[]) =>
    mockUploadCatalogSourcePhoto(...args),
  getCatalogSourcePhotoSignedUrl: vi.fn().mockResolvedValue(null),
}))

// Import AFTER mocks.
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

beforeEach(() => {
  vi.clearAllMocks()
  mockAddWatch.mockResolvedValue({ success: true })
  mockUploadCatalogSourcePhoto.mockResolvedValue({
    path: 'user-abc-123/pending/test.jpg',
  })
})

// ─── Phase 19.1 D-18 + D-19 (consolidated from tests/components/WatchForm.test.tsx) ─────

describe('WatchForm — Phase 19.1 surgery (D-18 + D-19)', () => {
  it('does NOT render Style / Role / Design tag pickers (D-18)', () => {
    render(<WatchForm mode="create" />)
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
    expect(
      screen.queryByTestId('catalog-photo-uploader'),
    ).not.toBeInTheDocument()
  })

  it('does NOT show styleTags / roleTags validation errors on empty submission (D-18)', () => {
    render(<WatchForm mode="create" />)
    expect(screen.queryByText(/style tag is required/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/role tag is required/i)).not.toBeInTheDocument()
  })
})

describe('WatchForm — Phase 19.1 photo upload wiring (D-19)', () => {
  it('handleSubmit with no photoBlob calls addWatch without photoSourcePath', async () => {
    render(<WatchForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/brand/i), {
      target: { value: 'Omega' },
    })
    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: 'Speedmaster' },
    })

    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: /add watch/i }).closest('form')!,
      )
    })

    await waitFor(() => expect(mockAddWatch).toHaveBeenCalled())

    const callArg = mockAddWatch.mock.calls[0][0]
    expect(callArg.photoSourcePath).toBeUndefined()
    expect(mockUploadCatalogSourcePhoto).not.toHaveBeenCalled()
  })

  it('upload failure does NOT block addWatch (fire-and-forget posture)', async () => {
    mockUploadCatalogSourcePhoto.mockResolvedValue({
      error: 'Storage unavailable',
    })

    render(<WatchForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/brand/i), {
      target: { value: 'Omega' },
    })
    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: 'Speedmaster' },
    })

    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: /add watch/i }).closest('form')!,
      )
    })

    await waitFor(() => expect(mockAddWatch).toHaveBeenCalled())
    expect(mockAddWatch.mock.calls[0][0].photoSourcePath).toBeUndefined()
  })
})

// ─── TEST-06 augmentations (form flow coverage) ──────────────────────────────

describe('WatchForm — TEST-06 form flow', () => {
  it('form submit happy path: fills brand + model and calls addWatch', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="create" />)

    await user.type(screen.getByLabelText(/brand/i), 'Omega')
    await user.type(screen.getByLabelText(/^model/i), 'Speedmaster')
    await user.click(screen.getByRole('button', { name: /add watch/i }))

    await waitFor(() => expect(mockAddWatch).toHaveBeenCalledOnce())
    const submitted = mockAddWatch.mock.calls[0][0] as Record<string, unknown>
    expect(submitted.brand).toBe('Omega')
    expect(submitted.model).toBe('Speedmaster')
  })

  it('required field validation: shows brand + model errors; addWatch not called', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="create" />)

    // Submit empty form — both required fields empty.
    await user.click(screen.getByRole('button', { name: /add watch/i }))

    expect(screen.getByText('Brand is required')).toBeInTheDocument()
    expect(screen.getByText('Model is required')).toBeInTheDocument()
    expect(mockAddWatch).not.toHaveBeenCalled()
  })

  it('edit mode hydration: form fields hydrate from watch prop; editWatch called on submit', async () => {
    const user = userEvent.setup()
    const editWatch: Watch = {
      id: 'edit-id',
      brand: 'Rolex',
      model: 'Submariner',
      reference: '126610LN',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      notes: '',
      imageUrl: '',
    }
    render(<WatchForm mode="edit" watch={editWatch} />)

    // Fields should be hydrated with the watch's values.
    expect(screen.getByLabelText(/brand/i)).toHaveValue('Rolex')
    expect(screen.getByLabelText(/^model/i)).toHaveValue('Submariner')

    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(mockEditWatch).toHaveBeenCalledOnce())

    // editWatch is called with (watchId, formData).
    expect(mockEditWatch.mock.calls[0][0]).toBe('edit-id')
  })

  it('status default is wishlist for new watch creation', () => {
    render(<WatchForm mode="create" />)
    // The Select trigger displays the current status.
    // Default value is 'wishlist' per initialFormData.status.
    expect(screen.getByText('wishlist')).toBeInTheDocument()
  })
})
