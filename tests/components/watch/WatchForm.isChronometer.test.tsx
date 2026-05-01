// Phase 23 Plan 01 — Wave 0 RED scaffold for FEAT-08 (now GREEN post-Plan 04).
//
// Asserts that <WatchForm> renders a Chronometer-certified Checkbox at the
// bottom of the Specifications card (D-09/D-10): defaults unchecked,
// hydrates from `watch.isChronometer === true` in edit mode, and submits
// isChronometer in the addWatch payload.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Watch } from '@/lib/types'

// jsdom does not implement PointerEvent, which base-ui's Checkbox dispatches
// via `new PointerEvent('click', ...)` on internal click. Polyfill it to
// MouseEvent so the userEvent.click path can reach `onCheckedChange` without
// throwing a ReferenceError. Mirrors tests/components/preferences/PreferencesClient.debt01.test.tsx.
if (typeof globalThis.PointerEvent === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).PointerEvent = class extends MouseEvent {
    pointerId: number
    pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
}

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

describe('<WatchForm> — isChronometer Checkbox (FEAT-08, Wave 0 RED scaffold)', () => {
  it('renders a Chronometer-certified Checkbox in the Specifications card', () => {
    render(<WatchForm mode="create" />)
    // Locked label copy from UI-SPEC § Copywriting Contract.
    expect(screen.getByText(/Chronometer-certified/)).toBeInTheDocument()
    // The qualifier is in muted text.
    expect(screen.getByText(/\(COSC or equivalent\)/)).toBeInTheDocument()
  })

  it('defaults to unchecked for a new watch', () => {
    render(<WatchForm mode="create" />)
    const checkbox = screen.getByRole('checkbox', {
      name: /chronometer-certified/i,
    })
    expect(checkbox).not.toBeChecked()
  })

  it('hydrates from watch.isChronometer === true in edit mode', () => {
    const existingWatch: Watch = {
      id: 'w1',
      brand: 'Rolex',
      model: 'Datejust',
      reference: '',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      notes: '',
      imageUrl: '',
      isChronometer: true,
    }
    render(<WatchForm mode="edit" watch={existingWatch} />)
    const checkbox = screen.getByRole('checkbox', {
      name: /chronometer-certified/i,
    })
    expect(checkbox).toBeChecked()
  })

  it('submits isChronometer: true in the addWatch payload after toggling', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="create" />)
    await user.type(screen.getByLabelText(/brand/i), 'Rolex')
    await user.type(screen.getByLabelText(/^model/i), 'Datejust')
    await user.click(
      screen.getByRole('checkbox', { name: /chronometer-certified/i }),
    )
    await user.click(screen.getByRole('button', { name: /add watch/i }))
    expect(mockAddWatch).toHaveBeenCalled()
    const submitted = mockAddWatch.mock.calls[0][0] as Record<string, unknown>
    expect(submitted.isChronometer).toBe(true)
  })

  it('submits isChronometer NOT-true (false or undefined) when not toggled in a new watch', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="create" />)
    await user.type(screen.getByLabelText(/brand/i), 'Rolex')
    await user.type(screen.getByLabelText(/^model/i), 'Datejust')
    await user.click(screen.getByRole('button', { name: /add watch/i }))
    expect(mockAddWatch).toHaveBeenCalled()
    const submitted = mockAddWatch.mock.calls[0][0] as Record<string, unknown>
    // Either explicitly false OR undefined is acceptable; the assertion is "not true".
    expect(submitted.isChronometer).not.toBe(true)
  })
})
