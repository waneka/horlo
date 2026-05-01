// tests/components/watch/WatchForm.notesPublic.test.tsx
//
// Phase 23 Plan 01 RED scaffold for FEAT-07 (locked copy from UI-SPEC § Copywriting Contract).
// Plan 04 turns these GREEN by adding the pill below the Notes Textarea in WatchForm.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/navigation (WatchForm calls useRouter)
const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, back: vi.fn() }),
}))

// Mock server actions — track call args for payload assertions
const mockAddWatch = vi.fn().mockResolvedValue({ success: true })
const mockEditWatch = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/app/actions/watches', () => ({
  addWatch: (...args: unknown[]) => mockAddWatch(...args),
  editWatch: (...args: unknown[]) => mockEditWatch(...args),
}))

// Mock CatalogPhotoUploader to a lightweight stub
vi.mock('@/components/watch/CatalogPhotoUploader', () => ({
  CatalogPhotoUploader: () => (
    <div data-testid="catalog-photo-uploader">[CatalogPhotoUploader]</div>
  ),
}))

// Mock Supabase browser client (referenced lazily in submit; not exercised here)
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc-123' } } }),
    },
  })),
}))

vi.mock('@/lib/storage/catalogSourcePhotos', () => ({
  uploadCatalogSourcePhoto: vi.fn().mockResolvedValue({ path: 'pending/x.jpg' }),
  getCatalogSourcePhotoSignedUrl: vi.fn().mockResolvedValue(null),
}))

import { WatchForm } from '@/components/watch/WatchForm'
import type { Watch } from '@/lib/types'

describe('<WatchForm> — notesPublic pill (FEAT-07)', () => {
  it('renders a "Visibility:" caption and a pill below the Notes textarea', () => {
    render(<WatchForm mode="create" />)
    expect(screen.getByText('Visibility:')).toBeInTheDocument()
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
    mockAddWatch.mockClear()
    const user = userEvent.setup()
    render(<WatchForm mode="create" />)
    // Fill required fields
    await user.type(screen.getByLabelText(/brand/i), 'Rolex')
    await user.type(screen.getByLabelText(/^model/i), 'Submariner')
    // Toggle pill to Private
    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('button', { name: /add watch/i }))
    expect(mockAddWatch).toHaveBeenCalled()
    const submitted = mockAddWatch.mock.calls[0][0]
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
    expect(pill).toHaveAttribute('aria-label', 'Note is public, click to make private')
    await user.click(pill)
    expect(pill).toHaveAttribute('aria-label', 'Note is private, click to make public')
  })

  it('hydrates as Public when an edit-mode watch has notesPublic undefined (legacy row, ?? true default per D-13)', () => {
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
      // notesPublic intentionally omitted — legacy row
    }
    render(<WatchForm mode="edit" watch={existingWatch} />)
    const pill = screen.getByRole('switch')
    expect(pill).toHaveTextContent('Public')
    expect(pill).toHaveAttribute('aria-checked', 'true')
  })
})
