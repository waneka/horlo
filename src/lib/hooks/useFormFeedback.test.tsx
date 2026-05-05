/**
 * Phase 25 Plan 01 — useFormFeedback + FormStatusBanner test suite (TDD).
 *
 * Covers Tests 1-15 from PLAN.md Tasks 1+2 behavior blocks:
 *   - Tests 1-5: <FormStatusBanner> render branches (idle/pending/success/error + override copy + locked Tailwind classes).
 *   - Tests 6-10: useFormFeedback() initial + run-success + custom message + dialogMode + run-error.
 *   - Tests 11-12: hybrid timing — success auto-clears at 5s; error PERSISTS (D-16).
 *   - Tests 13-14: re-run during success window resets first; reset() clears state + timeout.
 *   - Test 15: unmount mid-pending does not warn (no setState-on-unmounted).
 *
 * Sonner is mocked so toast.success/error calls are observable without rendering <Toaster />.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

import { toast } from 'sonner'
import { FormStatusBanner } from '@/components/ui/FormStatusBanner'
import { useFormFeedback } from '@/lib/hooks/useFormFeedback'

describe('FormStatusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Test 1: state="idle" renders nothing', () => {
    const { container } = render(<FormStatusBanner state="idle" />)
    // The component returns null on idle, so the wrapper div is empty.
    expect(container.firstChild).toBeNull()
  })

  it('Test 2: state="success" renders role=status with locked classes + default "Saved" copy', () => {
    render(<FormStatusBanner state="success" />)
    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
    expect(banner).toHaveTextContent('Saved')
    // Locked Tailwind classes per UI-SPEC §FormStatusBanner Component Contract.
    expect(banner).toHaveClass('border-l-2')
    expect(banner).toHaveClass('border-l-accent')
    expect(banner).toHaveClass('bg-muted/40')
    expect(banner).toHaveClass('p-3')
    expect(banner).toHaveClass('text-sm')
    expect(banner).toHaveClass('text-foreground')
  })

  it('Test 3: state="success" with message override renders the override copy verbatim', () => {
    render(<FormStatusBanner state="success" message="Profile updated" />)
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Profile updated')
    expect(banner).not.toHaveTextContent(/^Saved$/)
  })

  it('Test 4: state="error" renders role=alert with destructive border + default copy', () => {
    render(<FormStatusBanner state="error" />)
    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('aria-live', 'polite')
    expect(banner).toHaveTextContent('Could not save. Please try again.')
    expect(banner).toHaveClass('border-l-2')
    expect(banner).toHaveClass('border-l-destructive')
    expect(banner).toHaveClass('bg-muted/40')
    expect(banner).toHaveClass('p-3')
    expect(banner).toHaveClass('text-sm')
    expect(banner).toHaveClass('text-destructive')
  })

  it('Test 5: state="pending" renders muted caption with default "Saving…" copy + aria-live polite', () => {
    const { container } = render(<FormStatusBanner state="pending" />)
    const node = container.querySelector('[aria-live="polite"]')
    expect(node).not.toBeNull()
    expect(node).toHaveTextContent('Saving…')
    expect(node).toHaveClass('text-xs')
    expect(node).toHaveClass('text-muted-foreground')
  })
})

describe('useFormFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    pushMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const okAction = () =>
    Promise.resolve({ success: true as const, data: undefined })
  const failAction = () =>
    Promise.resolve({ success: false as const, error: 'Bad input' })

  it('Test 6: initial state is { pending: false, state: "idle", message: null }', () => {
    const { result } = renderHook(() => useFormFeedback())
    expect(result.current.pending).toBe(false)
    expect(result.current.state).toBe('idle')
    expect(result.current.message).toBeNull()
    expect(typeof result.current.run).toBe('function')
    expect(typeof result.current.reset).toBe('function')
    expect(result.current.dialogMode).toBe(false)
  })

  it('Test 7: run(okAction) transitions to success and fires toast.success("Saved")', async () => {
    const { result } = renderHook(() => useFormFeedback())
    await act(async () => {
      await result.current.run(okAction, { successMessage: 'Saved' })
    })
    expect(result.current.state).toBe('success')
    expect(result.current.message).toBe('Saved')
    expect(toast.success).toHaveBeenCalledWith('Saved', undefined)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('Test 8: successMessage option fires toast.success(custom) and stores custom message', async () => {
    const { result } = renderHook(() => useFormFeedback())
    await act(async () => {
      await result.current.run(okAction, { successMessage: 'Profile updated' })
    })
    expect(result.current.state).toBe('success')
    expect(result.current.message).toBe('Profile updated')
    expect(toast.success).toHaveBeenCalledWith('Profile updated', undefined)
  })

  it('Test 9: dialogMode: true exposes dialogMode flag (consumer suppresses banner)', async () => {
    const { result } = renderHook(() => useFormFeedback({ dialogMode: true }))
    expect(result.current.dialogMode).toBe(true)
    // dialogMode does NOT change state transitions — toast still fires, state still goes to success.
    await act(async () => {
      await result.current.run(okAction, { successMessage: 'Saved' })
    })
    expect(result.current.state).toBe('success')
    expect(toast.success).toHaveBeenCalledWith('Saved', undefined)
  })

  it('Test 10: run(failAction) transitions to error, message=server error, fires toast.error', async () => {
    const { result } = renderHook(() => useFormFeedback())
    await act(async () => {
      await result.current.run(failAction)
    })
    expect(result.current.state).toBe('error')
    expect(result.current.message).toBe('Bad input')
    expect(toast.error).toHaveBeenCalledWith('Bad input')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('Test 11: success state auto-clears to idle after 5000ms (D-16)', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useFormFeedback())
    await act(async () => {
      await result.current.run(okAction, { successMessage: 'Saved' })
    })
    expect(result.current.state).toBe('success')
    act(() => {
      vi.advanceTimersByTime(5001)
    })
    expect(result.current.state).toBe('idle')
    expect(result.current.message).toBeNull()
  })

  it('Test 12: error state PERSISTS — does not auto-clear after 10s (D-16)', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useFormFeedback())
    await act(async () => {
      await result.current.run(failAction)
    })
    expect(result.current.state).toBe('error')
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.state).toBe('error')
    expect(result.current.message).toBe('Bad input')
  })

  it('Test 13: re-running during success window resets first then transitions back to success', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useFormFeedback())
    await act(async () => {
      await result.current.run(okAction, { successMessage: 'Saved' })
    })
    expect(result.current.state).toBe('success')
    // Mid-success-window, fire run() again. reset() should clear the prior timeout
    // so the success window restarts cleanly.
    await act(async () => {
      await result.current.run(okAction, { successMessage: 'Saved' })
    })
    expect(result.current.state).toBe('success')
    // Advance partial-window — should still be success (NOT idle) because reset
    // cleared the original timer.
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(result.current.state).toBe('success')
    // Advance past the second 5s window total (4s + 2s = 6s after second run).
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.state).toBe('idle')
  })

  it('Test 14: reset() returns state to idle and clears any pending timeout', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useFormFeedback())
    await act(async () => {
      await result.current.run(okAction, { successMessage: 'Saved' })
    })
    expect(result.current.state).toBe('success')
    act(() => {
      result.current.reset()
    })
    expect(result.current.state).toBe('idle')
    expect(result.current.message).toBeNull()
    // Advance past the 5s window — state must remain idle (reset must have cleared timer).
    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(result.current.state).toBe('idle')
  })

  it('Test 15: unmount mid-pending does not log a setState-on-unmounted warning', async () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let resolveAction: (v: { success: true; data: undefined }) => void = () => {}
    const slowAction = () =>
      new Promise<{ success: true; data: undefined }>((resolve) => {
        resolveAction = resolve
      })

    const { result, unmount } = renderHook(() => useFormFeedback())
    // Fire run but DO NOT await — leave it in flight.
    act(() => {
      void result.current.run(slowAction)
    })
    // Unmount while the promise is still pending.
    unmount()
    // Now resolve the promise after unmount — any setState on unmounted hook would warn.
    await act(async () => {
      resolveAction({ success: true as const, data: undefined })
      // Give microtasks a chance to flush.
      await Promise.resolve()
    })
    // Advance past the 5s timer just in case it was scheduled.
    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('Test 16: successAction option wires Sonner action slot and onClick fires router.push(href)', async () => {
    const { result } = renderHook(() => useFormFeedback())
    await act(async () => {
      await result.current.run(okAction, {
        successMessage: 'Saved to your wishlist',
        successAction: { label: 'View', href: '/u/twwaneka/wishlist' },
      })
    })
    expect(toast.success).toHaveBeenCalledWith(
      'Saved to your wishlist',
      expect.objectContaining({
        action: expect.objectContaining({
          label: 'View',
          onClick: expect.any(Function),
        }),
      }),
    )
    // Fire the action onClick — should call router.push with the href.
    const call = (toast.success as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    const sonnerOpts = call[1] as { action: { onClick: () => void } }
    sonnerOpts.action.onClick()
    expect(pushMock).toHaveBeenCalledWith('/u/twwaneka/wishlist')
  })

  it('Test 17: omitting successAction produces toast.success(msg, undefined) — second arg undefined', async () => {
    const { result } = renderHook(() => useFormFeedback())
    await act(async () => {
      await result.current.run(okAction, { successMessage: 'Watch added' })
    })
    expect(toast.success).toHaveBeenCalledWith('Watch added', undefined)
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('Test 18: when neither successMessage nor successAction is set, toast.success is NOT called (D-05 suppress)', async () => {
    const { result } = renderHook(() => useFormFeedback())
    await act(async () => {
      await result.current.run(okAction) // both opts omitted
    })
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(result.current.state).toBe('success')
    expect(result.current.message).toBe('Saved')
  })
})
