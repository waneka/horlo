// tests/components/wear/WearDeleteButton.test.tsx — quick task 260913-cae.
//
// Covers every behavior bullet from 260913-cae-PLAN.md Task 3:
//   - renders 'Delete wear'; dialog content not in the document until clicked
//   - clicking opens the dialog with title + explanatory copy
//   - Cancel closes the dialog; deleteWearEvent not called
//   - Confirm calls deleteWearEvent({ wearEventId }) once; disabled while pending
//   - success -> router.replace to the Worn tab; toast; no push/back
//   - failure -> dialog stays open, inline role="alert" error, no navigation
//   - reopening after a failure shows no stale error
//   - disappearance assertions after Cancel and after success (memory:
//     feedback_test_assert_disappearance_too)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/actions/wearEvents', () => ({
  deleteWearEvent: vi.fn(),
}))

const mockReplace = vi.fn()
const mockPush = vi.fn()
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }),
}))

vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

import { WearDeleteButton } from '@/components/wear/WearDeleteButton'
import { deleteWearEvent } from '@/app/actions/wearEvents'
import { toast } from 'sonner'

const wearEventId = '11111111-2222-4333-8444-555555555555'
const ownerUsername = 'alice'

function renderButton() {
  return render(
    <WearDeleteButton wearEventId={wearEventId} ownerUsername={ownerUsername} />,
  )
}

async function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: /delete wear/i }))
  return screen.findByRole('dialog')
}

describe('WearDeleteButton (260913-cae)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders a 'Delete wear' button; dialog content is not in the document until clicked", () => {
    renderButton()
    expect(screen.getByRole('button', { name: /delete wear/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(/delete this wear\?/i)).not.toBeInTheDocument()
  })

  it("clicking opens a dialog with title 'Delete this wear?' and explanatory copy", async () => {
    renderButton()
    await openDialog()

    expect(screen.getByText(/delete this wear\?/i)).toBeInTheDocument()
    expect(screen.getByText(/photo or video/i)).toBeInTheDocument()
    expect(screen.getByText(/likes and comments/i)).toBeInTheDocument()
  })

  it("'Cancel' closes the dialog and deleteWearEvent is not called", async () => {
    renderButton()
    await openDialog()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByText(/delete this wear\?/i)).not.toBeInTheDocument()
    })
    expect(deleteWearEvent).not.toHaveBeenCalled()
  })

  it('Confirm calls deleteWearEvent({ wearEventId }) once; confirm button is disabled while pending', async () => {
    let resolveFn: (value: { success: true; data: { username: string } }) => void
    ;(deleteWearEvent as Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFn = resolve
      }),
    )
    renderButton()
    await openDialog()

    const confirmButton = screen.getByRole('button', { name: /^delete$/i })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled()
    })
    expect(deleteWearEvent).toHaveBeenCalledTimes(1)
    expect(deleteWearEvent).toHaveBeenCalledWith({ wearEventId })

    resolveFn!({ success: true, data: { username: ownerUsername } })
    await waitFor(() => {
      expect(screen.queryByText(/delete this wear\?/i)).not.toBeInTheDocument()
    })
  })

  it("on success: router.replace('/u/<username>/worn'); toast('Wear deleted'); router.push/back never called", async () => {
    ;(deleteWearEvent as Mock).mockResolvedValueOnce({
      success: true,
      data: { username: ownerUsername },
    })
    renderButton()
    await openDialog()

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(`/u/${ownerUsername}/worn`)
    })
    expect(toast).toHaveBeenCalledWith('Wear deleted')
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
    // Disappearance: the dialog is gone after success.
    expect(screen.queryByText(/delete this wear\?/i)).not.toBeInTheDocument()
  })

  it('on failure: dialog stays open and shows the returned error inline (role="alert"); no navigation', async () => {
    ;(deleteWearEvent as Mock).mockResolvedValueOnce({
      success: false,
      error: 'Wear not found',
    })
    renderButton()
    await openDialog()

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Wear not found')
    expect(screen.getByText(/delete this wear\?/i)).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })

  it('reopening after a failure shows no stale error', async () => {
    ;(deleteWearEvent as Mock).mockResolvedValueOnce({
      success: false,
      error: 'Wear not found',
    })
    renderButton()
    await openDialog()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await screen.findByRole('alert')

    // Cancel closes the dialog (error persists in state but must reset on reopen).
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByText(/delete this wear\?/i)).not.toBeInTheDocument()
    })

    // Reopen — no stale error should render.
    await openDialog()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
