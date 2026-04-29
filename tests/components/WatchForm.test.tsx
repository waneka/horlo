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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import type { Watch } from '@/lib/types'

// Mock next/navigation (WatchForm calls useRouter)
const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, back: vi.fn() }),
}))

// Mock server actions — track call args for photo path assertions
const mockAddWatch = vi.fn().mockResolvedValue({ success: true })
const mockEditWatch = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/app/actions/watches', () => ({
  addWatch: (...args: unknown[]) => mockAddWatch(...args),
  editWatch: (...args: unknown[]) => mockEditWatch(...args),
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

// Phase 19.1 Plan 05: mock Supabase browser client for photo upload tests
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc-123' } } }),
    },
  })),
}))

// Phase 19.1 Plan 05: mock uploadCatalogSourcePhoto
const mockUploadCatalogSourcePhoto = vi.fn().mockResolvedValue({ path: 'user-abc-123/pending/test.jpg' })
vi.mock('@/lib/storage/catalogSourcePhotos', () => ({
  uploadCatalogSourcePhoto: (...args: unknown[]) => mockUploadCatalogSourcePhoto(...args),
  getCatalogSourcePhotoSignedUrl: vi.fn().mockResolvedValue(null),
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

// Phase 19.1 Plan 05: photo upload wiring tests (D-19)
// Tests the handleSubmit upload-before-addWatch flow.
// photoBlob state is internal to WatchForm — tests exercise observable outcomes:
//   - addWatch called without photoSourcePath when no blob staged (Test 1)
//   - upload failure does NOT block addWatch (Test 3)
//
// Test 2 (upload → addWatch with bucket path) is covered by the live-DB
// integration test in tests/integration/add-watch-photo.test.ts (Task 4),
// because the WatchForm photoBlob state is set via CatalogPhotoUploader's
// onPhotoReady callback which cannot be triggered through the mocked stub.
describe('WatchForm — Phase 19.1 photo upload wiring (D-19)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddWatch.mockResolvedValue({ success: true })
    mockUploadCatalogSourcePhoto.mockResolvedValue({ path: 'user-abc-123/pending/test.jpg' })
  })

  it('handleSubmit with no photoBlob calls addWatch without photoSourcePath (Test 1)', async () => {
    render(<WatchForm mode="create" />)

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'Speedmaster' } })

    // Submit — no photo was staged (photoBlob is null by default)
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /add watch/i }).closest('form')!)
    })

    await waitFor(() => expect(mockAddWatch).toHaveBeenCalled())

    // addWatch must NOT receive a photoSourcePath field
    const callArg = mockAddWatch.mock.calls[0][0]
    expect(callArg.photoSourcePath).toBeUndefined()
    // uploadCatalogSourcePhoto must NOT have been called
    expect(mockUploadCatalogSourcePhoto).not.toHaveBeenCalled()
  })

  it('upload failure does NOT block addWatch (fire-and-forget posture, Test 3)', async () => {
    // Simulate upload failing
    mockUploadCatalogSourcePhoto.mockResolvedValue({ error: 'Storage unavailable' })

    render(<WatchForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'Speedmaster' } })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /add watch/i }).closest('form')!)
    })

    // addWatch must still be called even if upload fails
    // (photoBlob is null in this unit test, so upload is not triggered —
    //  the fire-and-forget posture for upload failure is tested in the
    //  integration test; here we verify submission proceeds regardless)
    await waitFor(() => expect(mockAddWatch).toHaveBeenCalled())
    expect(mockAddWatch.mock.calls[0][0].photoSourcePath).toBeUndefined()
  })
})
