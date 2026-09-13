// tests/components/profile/LogTodaysWearButton.test.tsx
//
// Phase 84 Plan 04 (WEAR-02 client half) — the unified "Log a wear" form.
//
// Covers T1-T11 from 84-04-PLAN.md: trigger + dialog title, date field
// defaults/max/no-min, date-aware preflight disabling (D-05), Public default
// visibility (D-04), submit contract to logBackfillWear (D-02/D-06), server
// error surfacing (D-05 backstop), note progressive disclosure + counter,
// reset-on-reopen, selection-clearing on a newly-logged watch, and the
// zero-watches empty state.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { LogTodaysWearButton } from '@/components/profile/LogTodaysWearButton'

const mockLog = vi.fn()
const mockPreflight = vi.fn()
vi.mock('@/app/actions/wearEvents', () => ({
  logBackfillWear: (...a: unknown[]) => mockLog(...a),
  getWornTodayIdsForUserAction: (...a: unknown[]) => mockPreflight(...a),
}))

vi.mock('@/lib/wear', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/wear')>()
  return { ...orig, todayLocalISO: () => '2026-09-12' }
})

const W1 = 'watch-1'
const W2 = 'watch-2'
const VIEWER = '11111111-1111-1111-1111-111111111111'

const WATCHES = [
  { id: W1, brand: 'Omega', model: 'Speedmaster' },
  { id: W2, brand: 'Tudor', model: 'Black Bay' },
]

function renderButton() {
  return render(<LogTodaysWearButton watches={WATCHES} viewerId={VIEWER} />)
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Log a wear' }))
}

beforeEach(() => {
  mockLog.mockReset()
  mockPreflight.mockReset()
  mockPreflight.mockResolvedValue([])
})

describe('LogTodaysWearButton', () => {
  it('T1: trigger reads "Log a wear"; dialog heading appears only after click', async () => {
    renderButton()
    expect(
      screen.queryByRole('heading', { name: 'Log a wear' }),
    ).not.toBeInTheDocument()

    openDialog()

    expect(
      await screen.findByRole('heading', { name: 'Log a wear' }),
    ).toBeInTheDocument()
  })

  it('T2: date input defaults to today, max=today, no min', async () => {
    renderButton()
    openDialog()

    const dateInput = (await screen.findByLabelText('Date')) as HTMLInputElement
    expect(dateInput.value).toBe('2026-09-12')
    expect(dateInput).toHaveAttribute('max', '2026-09-12')
    expect(dateInput).not.toHaveAttribute('min')
  })

  it('T3: preflight runs on open; already-logged watch renders disabled with "Worn today"', async () => {
    mockPreflight.mockResolvedValue([W1])
    renderButton()
    openDialog()

    await waitFor(() =>
      expect(mockPreflight).toHaveBeenCalledWith({
        userId: VIEWER,
        today: '2026-09-12',
      }),
    )

    const w1Option = await screen.findByRole('option', {
      name: /Omega Speedmaster/,
    })
    expect(w1Option).toHaveAttribute('aria-disabled', 'true')
    expect(w1Option).toHaveTextContent('Worn today')

    const w2Option = screen.getByRole('option', { name: /Tudor Black Bay/ })
    expect(w2Option).toHaveAttribute('aria-disabled', 'false')
  })

  it('T4: changing the date re-runs preflight and disappearance of stale "Worn today" label', async () => {
    mockPreflight.mockResolvedValueOnce([W1])
    renderButton()
    openDialog()

    await screen.findByText('Worn today')

    mockPreflight.mockResolvedValueOnce([W2])
    const dateInput = screen.getByLabelText('Date')
    fireEvent.change(dateInput, { target: { value: '2026-09-01' } })

    await waitFor(() =>
      expect(mockPreflight).toHaveBeenCalledWith({
        userId: VIEWER,
        today: '2026-09-01',
      }),
    )

    const w2Option = await screen.findByRole('option', {
      name: /Tudor Black Bay/,
    })
    await waitFor(() =>
      expect(w2Option).toHaveAttribute('aria-disabled', 'true'),
    )
    expect(w2Option).toHaveTextContent('Already logged')

    const w1Option = screen.getByRole('option', { name: /Omega Speedmaster/ })
    expect(w1Option).toHaveAttribute('aria-disabled', 'false')

    expect(screen.queryByText('Worn today')).not.toBeInTheDocument()
  })

  it('T5: visibility defaults to Public', async () => {
    renderButton()
    openDialog()

    const publicButton = await screen.findByRole('button', {
      name: 'Public — anyone on Horlo',
    })
    expect(publicButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('T6: submit disabled until a watch is selected; submits with selected watch + date', async () => {
    renderButton()
    openDialog()

    const submitButton = await screen.findByRole('button', { name: 'Log wear' })
    expect(submitButton).toBeDisabled()

    const w2Option = screen.getByRole('option', { name: /Tudor Black Bay/ })
    fireEvent.click(w2Option)

    const dateInput = screen.getByLabelText('Date')
    fireEvent.change(dateInput, { target: { value: '2026-08-20' } })

    await waitFor(() => expect(submitButton).not.toBeDisabled())

    mockLog.mockResolvedValueOnce({ success: true, data: { wearEventId: 'x' } })
    fireEvent.click(submitButton)

    await waitFor(() =>
      expect(mockLog).toHaveBeenCalledWith({
        watchId: W2,
        wornDate: '2026-08-20',
        today: '2026-09-12',
        note: null,
        visibility: 'public',
      }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Log a wear' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('T7: server error renders in role=alert and dialog stays open', async () => {
    renderButton()
    openDialog()

    const w1Option = await screen.findByRole('option', {
      name: /Omega Speedmaster/,
    })
    fireEvent.click(w1Option)

    const submitButton = screen.getByRole('button', { name: 'Log wear' })
    await waitFor(() => expect(submitButton).not.toBeDisabled())

    mockLog.mockResolvedValueOnce({
      success: false,
      error: 'Already logged this watch on that date.',
    })
    fireEvent.click(submitButton)

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Already logged this watch on that date.')
    expect(
      screen.getByRole('heading', { name: 'Log a wear' }),
    ).toBeInTheDocument()
  })

  it('T8: note progressive disclosure, counter, and trimmed submit value', async () => {
    renderButton()
    openDialog()

    const w1Option = await screen.findByRole('option', {
      name: /Omega Speedmaster/,
    })
    fireEvent.click(w1Option)

    const addNoteButton = screen.getByRole('button', { name: '+ Add a note' })
    fireEvent.click(addNoteButton)

    const textarea = screen.getByPlaceholderText('Add a note…')
    expect(screen.getByText('0/200')).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: '  lume shot  ' } })
    expect(screen.getByText('13/200')).toBeInTheDocument()

    const submitButton = screen.getByRole('button', { name: 'Log wear' })
    await waitFor(() => expect(submitButton).not.toBeDisabled())

    mockLog.mockResolvedValueOnce({ success: true, data: { wearEventId: 'x' } })
    fireEvent.click(submitButton)

    await waitFor(() =>
      expect(mockLog).toHaveBeenCalledWith(
        expect.objectContaining({ note: 'lume shot' }),
      ),
    )
  })

  it('T9: state resets on reopen after Cancel', async () => {
    renderButton()
    openDialog()

    const dateInput = screen.getByLabelText('Date')
    fireEvent.change(dateInput, { target: { value: '2026-09-01' } })

    fireEvent.click(screen.getByRole('button', { name: '+ Add a note' }))
    fireEvent.change(screen.getByPlaceholderText('Add a note…'), {
      target: { value: 'x' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Log a wear' }),
      ).not.toBeInTheDocument(),
    )

    openDialog()

    const reopenedDate = (await screen.findByLabelText('Date')) as HTMLInputElement
    expect(reopenedDate.value).toBe('2026-09-12')
    expect(screen.queryByPlaceholderText('Add a note…')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add a note' })).toBeInTheDocument()
  })

  it('T10: selecting a watch that the next preflight reports as logged clears the selection', async () => {
    renderButton()
    openDialog()

    const w1Option = await screen.findByRole('option', {
      name: /Omega Speedmaster/,
    })
    fireEvent.click(w1Option)

    const submitButton = screen.getByRole('button', { name: 'Log wear' })
    await waitFor(() => expect(submitButton).not.toBeDisabled())

    mockPreflight.mockResolvedValueOnce([W1])
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-09-01' },
    })

    await waitFor(() => expect(submitButton).toBeDisabled())
  })

  it('T12 (WR-02): submit blocked and stale labels hidden while the new date preflight is in flight', async () => {
    mockPreflight.mockResolvedValueOnce([W1])
    renderButton()
    openDialog()

    await screen.findByText('Worn today')
    const w2Option = screen.getByRole('option', { name: /Tudor Black Bay/ })
    fireEvent.click(w2Option)
    const submitButton = screen.getByRole('button', { name: 'Log wear' })
    await waitFor(() => expect(submitButton).not.toBeDisabled())

    // Hold the next preflight open.
    let resolveNext: (ids: string[]) => void = () => {}
    mockPreflight.mockImplementationOnce(
      () => new Promise<string[]>((r) => (resolveNext = r)),
    )
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-09-01' },
    })

    // In flight: submit blocked, the old date's "Worn today" row is not
    // shown as disabled for the new date.
    expect(submitButton).toBeDisabled()
    expect(screen.queryByText('Worn today')).not.toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /Omega Speedmaster/ }),
    ).toHaveAttribute('aria-disabled', 'false')

    resolveNext([])
    await waitFor(() => expect(submitButton).not.toBeDisabled())
  })

  it('T13 (WR-02): reopening does not carry the previous session preflight over', async () => {
    mockPreflight.mockResolvedValueOnce([W1])
    renderButton()
    openDialog()
    await screen.findByText('Worn today')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Log a wear' }),
      ).not.toBeInTheDocument(),
    )

    let resolveNext: (ids: string[]) => void = () => {}
    mockPreflight.mockImplementationOnce(
      () => new Promise<string[]>((r) => (resolveNext = r)),
    )
    openDialog()

    await screen.findByRole('heading', { name: 'Log a wear' })
    expect(screen.queryByText('Worn today')).not.toBeInTheDocument()

    resolveNext([])
    const w1Option = await screen.findByRole('option', {
      name: /Omega Speedmaster/,
    })
    fireEvent.click(w1Option)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Log wear' })).not.toBeDisabled(),
    )
  })

  it('T11: empty watches array shows "Add a watch first" and no date input', async () => {
    render(<LogTodaysWearButton watches={[]} viewerId={VIEWER} />)
    openDialog()

    expect(await screen.findByText('Add a watch first')).toBeInTheDocument()
    expect(screen.queryByLabelText('Date')).not.toBeInTheDocument()
  })
})
