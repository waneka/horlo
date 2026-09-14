// Phase 85 Plan 09 — celebratePromotion (LIFE-04 / D-09 / D-10 / D-11 / D-12).
//
// Coverage:
//   1. Non-reduced-motion: confetti fires once with the documented options, toast fires
//      the wishlist copy.
//   2. Grail promotion: toast copy switches to 'Grail acquired!'; confetti still fires.
//   3. Reduced motion: confetti is skipped, toast still fires.
//   4. null promotedFrom: falls back to the wishlist copy.
//   5. toast.success is called with only the message (no second options argument).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const confettiMock = vi.fn()
const toastSuccessMock = vi.fn()

vi.mock('canvas-confetti', () => ({ default: confettiMock }))
vi.mock('sonner', () => ({ toast: { success: toastSuccessMock } }))

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

describe('celebratePromotion', () => {
  beforeEach(() => {
    confettiMock.mockClear()
    toastSuccessMock.mockClear()
    setReducedMotion(false)
  })

  it('fires confetti with the documented options and the wishlist toast copy', async () => {
    const { celebratePromotion } = await import('@/lib/celebrate')
    await celebratePromotion('wishlist')

    expect(confettiMock).toHaveBeenCalledTimes(1)
    expect(confettiMock).toHaveBeenCalledWith({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    })
    expect(toastSuccessMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith('Added to your collection!')
  })

  it("uses 'Grail acquired!' copy for a grail promotion and still fires confetti", async () => {
    const { celebratePromotion } = await import('@/lib/celebrate')
    await celebratePromotion('grail')

    expect(confettiMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith('Grail acquired!')
  })

  it('skips confetti under prefers-reduced-motion but still shows the toast', async () => {
    setReducedMotion(true)
    const { celebratePromotion } = await import('@/lib/celebrate')
    await celebratePromotion('wishlist')

    expect(confettiMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith('Added to your collection!')
  })

  it('falls back to the wishlist copy when promotedFrom is null', async () => {
    const { celebratePromotion } = await import('@/lib/celebrate')
    await celebratePromotion(null)

    expect(toastSuccessMock).toHaveBeenCalledWith('Added to your collection!')
  })

  it('calls toast.success with only the message, no options argument', async () => {
    const { celebratePromotion } = await import('@/lib/celebrate')
    await celebratePromotion('wishlist')

    expect(toastSuccessMock.mock.calls[0]).toHaveLength(1)
  })
})
