// Phase 23 Plan 01 — Wave 0 RED scaffold for FEAT-07.
//
// Asserts that <WatchForm> renders a Public/Private pill below the Notes
// Textarea (D-13/D-14): the pill has role="switch", defaults to Public for
// new watches (D-16), toggles between states on click, hydrates from
// `watch.notesPublic` in edit mode, surfaces a state-aware aria-label, and
// submits notesPublic in the addWatch payload.
//
// This file MUST FAIL today: WatchForm has no role="switch" pill in the
// Notes card. Plan 04 makes this GREEN by adding the locked-copy pill.
//
// Deviation from PLAN's literal scaffold: the plan's stub used a fictional
// `onSave` prop; the real component takes `mode` + `watch` and calls
// addWatch/editWatch via Server Action imports. We mock the actions
// (mirroring tests/components/WatchForm.test.tsx's pattern) so the
// scaffold's RED reason is "missing pill", not "wrong props".

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Watch } from '@/lib/types'

// Mock next/navigation — WatchForm calls useRouter().
const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, back: vi.fn() }),
}))

// Mock Server Actions to capture submit payload.
const mockAddWatch = vi.fn(async () => ({ success: true, data: undefined }))
const mockEditWatch = vi.fn(async () => ({ success: true, data: undefined }))
vi.mock('@/app/actions/watches', () => ({
  addWatch: (...args: unknown[]) => mockAddWatch(...args),
  editWatch: (...args: unknown[]) => mockEditWatch(...args),
}))

// Mock CatalogPhotoUploader (rendered in mode="create"); behavior is tested
// separately in CatalogPhotoUploader.test.tsx.
vi.mock('@/components/watch/CatalogPhotoUploader', () => ({
  CatalogPhotoUploader: () => (
    <div data-testid="catalog-photo-uploader">[CatalogPhotoUploader]</div>
  ),
}))

// Mock UrlImport — irrelevant to this scaffold.
vi.mock('@/components/watch/UrlImport', () => ({
  UrlImport: () => <div data-testid="url-import">[UrlImport]</div>,
}))

// Mock Supabase browser client + photo upload helper (create-mode submit path).
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1' } } }),
    },
  })),
}))
vi.mock('@/lib/storage/catalogSourcePhotos', () => ({
  uploadCatalogSourcePhoto: vi.fn().mockResolvedValue({ path: 'u-1/pending/x.jpg' }),
  getCatalogSourcePhotoSignedUrl: vi.fn().mockResolvedValue(null),
}))

// Import AFTER mocks.
import { WatchForm } from '@/components/watch/WatchForm'

beforeEach(() => {
  mockAddWatch.mockClear()
  mockEditWatch.mockClear()
  mockRouterPush.mockClear()
})

describe('<WatchForm> — notesPublic pill (FEAT-07, Wave 0 RED scaffold)', () => {
  it('renders a "Visibility:" caption and a pill below the Notes textarea', () => {
    render(<WatchForm mode="create" />)
    expect(screen.getByText('Visibility:')).toBeInTheDocument()
    // The pill is a button[role="switch"]
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('defaults to Public for a new watch (D-16 — matches DB default true)', () => {
    render(<WatchForm mode="create" />)
    const pill = screen.getByRole('switch')
    expect(pill).toHaveAttribute('aria-checked', 'true')
    expect(pill).toHaveTextContent('Public')
  })

  it('toggles between Public and Private on click', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="create" />)
    const pill = screen.getByRole('switch')
    expect(pill).toHaveTextContent('Public')
    await user.click(pill)
    expect(pill).toHaveTextContent('Private')
    expect(pill).toHaveAttribute('aria-checked', 'false')
  })

  it('submits notesPublic in the addWatch payload', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="create" />)
    // Required fields so submit can succeed.
    await user.type(screen.getByLabelText(/brand/i), 'Rolex')
    await user.type(screen.getByLabelText(/^model/i), 'Submariner')
    // Toggle pill to Private
    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('button', { name: /add watch/i }))
    expect(mockAddWatch).toHaveBeenCalled()
    const submitted = mockAddWatch.mock.calls[0][0] as Record<string, unknown>
    expect(submitted.notesPublic).toBe(false)
  })

  it('hydrates notesPublic from the watch prop in edit mode', () => {
    const existingWatch: Watch = {
      id: 'w1',
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '',
      status: 'owned',
      movement: 'manual',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      notes: '',
      imageUrl: '',
      notesPublic: false,
    }
    render(<WatchForm mode="edit" watch={existingWatch} />)
    const pill = screen.getByRole('switch')
    expect(pill).toHaveTextContent('Private')
    expect(pill).toHaveAttribute('aria-checked', 'false')
  })

  it('aria-label changes between states for screen readers', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="create" />)
    const pill = screen.getByRole('switch')
    expect(pill).toHaveAttribute(
      'aria-label',
      'Note is public, click to make private',
    )
    await user.click(pill)
    expect(pill).toHaveAttribute(
      'aria-label',
      'Note is private, click to make public',
    )
  })
})
