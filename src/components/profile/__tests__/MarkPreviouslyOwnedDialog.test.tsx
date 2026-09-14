// Phase 85 Plan 08 Task 1 — MarkPreviouslyOwnedDialog (LIFE-03, D-06/D-07/D-08).
//
// Every presence assertion pairs with the matching disappearance/absence
// assertion where applicable (memory: feedback_test_assert_disappearance_too).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Mock } from 'vitest'

const mockMark = vi.fn()
vi.mock('@/app/actions/watches', () => ({
  markWatchPreviouslyOwned: (...a: unknown[]) => mockMark(...a),
}))

const mockToastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => mockToastSuccess(...a) },
}))

vi.mock('@/lib/wear', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/wear')>()
  return { ...orig, todayLocalISO: () => '2026-09-13' }
})

import { MarkPreviouslyOwnedDialog } from '@/components/profile/MarkPreviouslyOwnedDialog'

const WATCH = { id: 'w1', brand: 'Omega', model: 'Speedmaster' }

function renderDialog(overrides: { open?: boolean; onOpenChange?: (v: boolean) => void } = {}) {
  const onOpenChange = overrides.onOpenChange ?? vi.fn()
  const utils = render(
    <MarkPreviouslyOwnedDialog
      open={overrides.open ?? true}
      onOpenChange={onOpenChange}
      watch={WATCH}
    />,
  )
  return { ...utils, onOpenChange }
}

function selectReason(name: string) {
  fireEvent.click(screen.getByRole('radio', { name }))
}

beforeEach(() => {
  mockMark.mockReset()
  mockToastSuccess.mockReset()
})

describe('MarkPreviouslyOwnedDialog', () => {
  it('renders title, description, radiogroup order, date default+max, amount placeholder', () => {
    renderDialog()

    expect(screen.getByRole('heading', { name: 'Mark as previously owned' })).toBeInTheDocument()
    expect(
      screen.getByText((_, node) =>
        node?.textContent === 'Record how Omega Speedmaster left your collection. You can undo this later from the edit page.',
      ),
    ).toBeInTheDocument()

    const group = screen.getByRole('radiogroup', { name: 'Reason' })
    const radios = screen.getAllByRole('radio')
    expect(group).toBeInTheDocument()
    expect(radios.map((r) => r.textContent)).toEqual(['Sold', 'Traded', 'Gifted', 'Lost', 'Stolen'])

    const dateInput = screen.getByLabelText('Disposal date') as HTMLInputElement
    expect(dateInput.value).toBe('2026-09-13')
    expect(dateInput).toHaveAttribute('max', '2026-09-13')

    const amountInput = screen.getByLabelText('Amount received') as HTMLInputElement
    expect(amountInput).toHaveAttribute('type', 'number')
    expect(amountInput).toHaveAttribute('placeholder', '$')
  })

  it('submit is disabled until a reason is chosen', () => {
    renderDialog()
    const submit = screen.getByRole('button', { name: 'Mark as previously owned' })
    expect(submit).toBeDisabled()

    selectReason('Sold')
    expect(submit).not.toBeDisabled()
  })

  it('keyboard: Sold + ArrowRight -> Traded; End -> Stolen; Home -> Sold', () => {
    renderDialog()
    const sold = screen.getByRole('radio', { name: 'Sold' })
    sold.focus()

    const group = screen.getByRole('radiogroup', { name: 'Reason' })
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Traded' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Sold' })).toHaveAttribute('aria-checked', 'false')

    fireEvent.keyDown(group, { key: 'End' })
    expect(screen.getByRole('radio', { name: 'Stolen' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.keyDown(group, { key: 'Home' })
    expect(screen.getByRole('radio', { name: 'Sold' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Stolen' })).toHaveAttribute('aria-checked', 'false')
  })

  it('a future disposal date is rejected client-side and the action is never called', async () => {
    renderDialog()
    selectReason('Sold')
    fireEvent.change(screen.getByLabelText('Disposal date'), { target: { value: '2026-09-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mark as previously owned' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Disposal date can't be in the future.",
    )
    expect(mockMark).not.toHaveBeenCalled()
  })

  it('submits Traded + amount + date; on success closes and toasts', async () => {
    mockMark.mockResolvedValueOnce({ success: true, data: {} })
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange })

    selectReason('Traded')
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '1500' } })
    fireEvent.change(screen.getByLabelText('Disposal date'), { target: { value: '2026-03-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mark as previously owned' }))

    await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1))
    expect(mockMark).toHaveBeenCalledWith({
      watchId: 'w1',
      disposalReason: 'traded',
      sellPrice: 1500,
      disposalDate: '2026-03-02',
      today: '2026-09-13',
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(mockToastSuccess).toHaveBeenCalledWith('Moved to previously owned')
  })

  it('Lost + cleared amount/date submits with sellPrice and disposalDate undefined', async () => {
    mockMark.mockResolvedValueOnce({ success: true, data: {} })
    renderDialog()

    selectReason('Lost')
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Disposal date'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mark as previously owned' }))

    await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1))
    expect(mockMark).toHaveBeenCalledWith({
      watchId: 'w1',
      disposalReason: 'lost',
      sellPrice: undefined,
      disposalDate: undefined,
      today: '2026-09-13',
    })
  })

  it('generic server failure shows the fallback error message', async () => {
    mockMark.mockResolvedValueOnce({ success: false, error: 'boom' })
    renderDialog()

    selectReason('Sold')
    fireEvent.click(screen.getByRole('button', { name: 'Mark as previously owned' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't update this watch.")
  })

  it('server future-date rejection surfaces its exact message', async () => {
    mockMark.mockResolvedValueOnce({
      success: false,
      error: "Disposal date can't be in the future.",
    })
    renderDialog()

    selectReason('Sold')
    fireEvent.click(screen.getByRole('button', { name: 'Mark as previously owned' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Disposal date can't be in the future.",
    )
  })

  it('while pending the submit label reads "Saving…" and is disabled', async () => {
    let resolveFn: (v: { success: true; data: unknown }) => void
    ;(mockMark as Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFn = resolve
      }),
    )
    renderDialog()

    selectReason('Sold')
    fireEvent.click(screen.getByRole('button', { name: 'Mark as previously owned' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    })
    expect(screen.queryByRole('button', { name: 'Mark as previously owned' })).not.toBeInTheDocument()

    resolveFn!({ success: true, data: {} })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Saving…' })).not.toBeInTheDocument()
    })
  })
})
