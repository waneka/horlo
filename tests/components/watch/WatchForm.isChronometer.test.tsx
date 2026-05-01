// tests/components/watch/WatchForm.isChronometer.test.tsx
//
// Phase 23 Plan 01 RED scaffold for FEAT-08 form Checkbox (locked copy from UI-SPEC § Copywriting Contract).
// Plan 04 turns these GREEN by adding the Checkbox at the bottom of the Specifications card in WatchForm.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// jsdom does not implement PointerEvent, which base-ui's Checkbox dispatches
// via `new PointerEvent('click', ...)`. Polyfill it to MouseEvent so the
// fireEvent.click path can reach `onCheckedChange` without ReferenceError.
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

const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, back: vi.fn() }),
}))

const mockAddWatch = vi.fn().mockResolvedValue({ success: true })
const mockEditWatch = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/app/actions/watches', () => ({
  addWatch: (...args: unknown[]) => mockAddWatch(...args),
  editWatch: (...args: unknown[]) => mockEditWatch(...args),
}))

vi.mock('@/components/watch/CatalogPhotoUploader', () => ({
  CatalogPhotoUploader: () => (
    <div data-testid="catalog-photo-uploader">[CatalogPhotoUploader]</div>
  ),
}))

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

describe('<WatchForm> — isChronometer Checkbox (FEAT-08)', () => {
  it('renders a Chronometer-certified Checkbox in the Specifications card', () => {
    render(<WatchForm mode="create" />)
    // Locked label copy from UI-SPEC.
    expect(screen.getByText(/Chronometer-certified/)).toBeInTheDocument()
    expect(screen.getByText(/\(COSC or equivalent\)/)).toBeInTheDocument()
  })

  it('defaults to unchecked for a new watch', () => {
    render(<WatchForm mode="create" />)
    const checkbox = screen.getByRole('checkbox', { name: /chronometer-certified/i })
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
    const checkbox = screen.getByRole('checkbox', { name: /chronometer-certified/i })
    expect(checkbox).toBeChecked()
  })

  it('submits isChronometer: true in the addWatch payload after toggling', async () => {
    mockAddWatch.mockClear()
    const user = userEvent.setup()
    render(<WatchForm mode="create" />)
    await user.type(screen.getByLabelText(/brand/i), 'Rolex')
    await user.type(screen.getByLabelText(/^model/i), 'Datejust')
    // base-ui Checkbox uses PointerEvent on click; fireEvent.click is the
    // canonical workaround in this codebase (see PreferencesClient.debt01.test.tsx).
    fireEvent.click(screen.getByRole('checkbox', { name: /chronometer-certified/i }))
    await user.click(screen.getByRole('button', { name: /add watch/i }))
    expect(mockAddWatch).toHaveBeenCalled()
    const submitted = mockAddWatch.mock.calls[0][0]
    expect(submitted.isChronometer).toBe(true)
  })

  it('submits isChronometer: false (or omits it) when not toggled in a new watch', async () => {
    mockAddWatch.mockClear()
    const user = userEvent.setup()
    render(<WatchForm mode="create" />)
    await user.type(screen.getByLabelText(/brand/i), 'Rolex')
    await user.type(screen.getByLabelText(/^model/i), 'Datejust')
    await user.click(screen.getByRole('button', { name: /add watch/i }))
    expect(mockAddWatch).toHaveBeenCalled()
    const submitted = mockAddWatch.mock.calls[0][0]
    expect(submitted.isChronometer).not.toBe(true)
  })
})
