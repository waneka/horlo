// tests/components/watch/WatchForm.lifecycle.test.tsx
//
// Phase 85 Plan 10 — LIFE-02/03 edit-form lifecycle behavior.
//
// D-07: the status dropdown never offers "Previously owned" unless the watch
// being edited is already previously owned.
// D-04: editing a previously-owned watch shows its disposal fields
// (Reason/Disposal date/Amount received), editable, and changing status away
// from previously_owned shows the undo helper text and disables those fields.
// LIFE-02: saving an edited previously-owned watch persists the changed
// disposal fields and sends the browser-local "today" alongside the payload.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Watch } from '@/lib/types'

const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, back: vi.fn() }),
}))

const mockAddWatch = vi.fn().mockResolvedValue({ success: true, data: { id: 'new-id' } })
const mockEditWatch = vi.fn()
vi.mock('@/app/actions/watches', () => ({
  addWatch: (...args: unknown[]) => mockAddWatch(...args),
  editWatch: (...args: unknown[]) => mockEditWatch(...args),
}))

vi.mock('@/components/watch/CatalogPhotoUploader', () => ({
  CatalogPhotoUploader: () => null,
}))

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc-123' } } }),
    },
  })),
}))
vi.mock('@/lib/storage/catalogSourcePhotos', () => ({
  uploadCatalogSourcePhoto: vi.fn(),
  getCatalogSourcePhotoSignedUrl: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/celebrate', () => ({
  celebratePromotion: vi.fn(),
}))

// Client-owned "today" — pin to a fixed date so disposal-date max/validation
// assertions are deterministic (matches the 85-08 MarkPreviouslyOwnedDialog
// test's own mocking approach for the same module).
vi.mock('@/lib/wear', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/wear')>()
  return { ...orig, todayLocalISO: () => '2026-09-13' }
})

// Import AFTER mocks.
import { WatchForm } from '@/components/watch/WatchForm'

const ownedWatch: Watch = {
  id: 'owned-id',
  brand: 'Omega',
  model: 'Speedmaster',
  reference: '',
  status: 'owned',
  movement: 'auto',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
  notes: '',
  imageUrl: '',
}

const previouslyOwnedWatch: Watch = {
  ...ownedWatch,
  id: 'prev-id',
  status: 'previously_owned',
  disposalReason: 'traded',
  sellPrice: 1500,
  disposalDate: '2026-03-02',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEditWatch.mockResolvedValue({
    success: true,
    data: { watch: { ...previouslyOwnedWatch }, promoted: false, promotedFrom: null },
  })
})

describe('WatchForm — lifecycle (D-04/D-07/LIFE-02)', () => {
  it('create mode: status Select offers Owned/Wishlist/Grail, not Previously owned', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="create" />)

    const trigger = screen.getAllByRole('combobox')[0]
    await user.click(trigger)

    expect(await screen.findByRole('option', { name: 'Owned' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Wishlist' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Grail' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Previously owned' })).not.toBeInTheDocument()
  })

  it('edit mode, owned watch: no Previously owned option; no Reason radiogroup rendered', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="edit" watch={ownedWatch} />)

    // No disposal fields at all for a currently-owned watch.
    expect(screen.queryByRole('radiogroup', { name: 'Reason' })).not.toBeInTheDocument()

    const trigger = screen.getAllByRole('combobox')[0]
    await user.click(trigger)

    expect(await screen.findByRole('option', { name: 'Owned' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Previously owned' })).not.toBeInTheDocument()
  })

  it('edit mode, previously-owned watch: status trigger shows label, disposal fields hydrate, no undo helper text', () => {
    render(<WatchForm mode="edit" watch={previouslyOwnedWatch} />)

    const trigger = screen.getAllByRole('combobox')[0]
    expect(trigger).toHaveTextContent('Previously owned')

    const tradedRadio = screen.getByRole('radio', { name: 'Traded' })
    expect(tradedRadio).toHaveAttribute('aria-checked', 'true')

    expect((screen.getByLabelText('Amount received') as HTMLInputElement).value).toBe('1500')
    expect((screen.getByLabelText('Disposal date') as HTMLInputElement).value).toBe('2026-03-02')

    expect(
      screen.queryByText('Changing status will clear the disposal details recorded above.'),
    ).not.toBeInTheDocument()
  })

  it('editing Amount received and saving sends the updated disposal fields plus a client-local "today"', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="edit" watch={previouslyOwnedWatch} />)

    const amountInput = screen.getByLabelText('Amount received')
    await user.clear(amountInput)
    await user.type(amountInput, '1800')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(mockEditWatch).toHaveBeenCalledOnce())
    const [watchId, payload] = mockEditWatch.mock.calls[0] as [string, Record<string, unknown>]
    expect(watchId).toBe('prev-id')
    expect(payload.status).toBe('previously_owned')
    expect(payload.sellPrice).toBe(1800)
    expect(payload.disposalReason).toBe('traded')
    expect(payload.disposalDate).toBe('2026-03-02')
    expect(typeof payload.today).toBe('string')
    expect(payload.today as string).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('changing status away from previously_owned shows the undo helper text, disables disposal fields, and submits the new status', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="edit" watch={previouslyOwnedWatch} />)

    const trigger = screen.getAllByRole('combobox')[0]
    await user.click(trigger)
    await user.click(await screen.findByRole('option', { name: 'Owned' }))

    expect(
      screen.getByText('Changing status will clear the disposal details recorded above.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Traded' })).toBeDisabled()
    expect(screen.getByLabelText('Disposal date')).toBeDisabled()
    expect(screen.getByLabelText('Amount received')).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(mockEditWatch).toHaveBeenCalledOnce())
    const [, payload] = mockEditWatch.mock.calls[0] as [string, Record<string, unknown>]
    expect(payload.status).toBe('owned')
  })

  it('the Disposal date input carries a max attribute equal to the client-local "today" after mount', async () => {
    render(<WatchForm mode="edit" watch={previouslyOwnedWatch} />)

    await waitFor(() => {
      expect(screen.getByLabelText('Disposal date')).toHaveAttribute('max', '2026-09-13')
    })
  })

  it('rejects a future disposal date client-side without calling editWatch', async () => {
    const user = userEvent.setup()
    render(<WatchForm mode="edit" watch={previouslyOwnedWatch} />)

    const dateInput = screen.getByLabelText('Disposal date')
    fireEvent.change(dateInput, { target: { value: '2026-09-20' } })

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Disposal date can't be in the future.",
    )
    expect(mockEditWatch).not.toHaveBeenCalled()
  })
})
