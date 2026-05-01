import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Phase 22 D-13/D-14 — StatusToastHandler.
// D-13: Sonner toast on ?status=email_changed (and other status values).
// D-14: When stripping ?status= via router.replace, MUST preserve the hash
// (e.g., #account) — naive router.replace(pathname) drops the fragment and
// kicks the user back to the default tab.
// ---------------------------------------------------------------------------

const toastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: vi.fn(),
  },
}))

let routerReplaceMock = vi.fn()
let mockSearchParams = new URLSearchParams('')
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
  usePathname: () => '/settings',
  useSearchParams: () => mockSearchParams,
}))

// Import AFTER mocks.
import { StatusToastHandler } from '@/components/settings/StatusToastHandler'

describe('StatusToastHandler — Phase 22 D-13/D-14', () => {
  beforeEach(() => {
    toastSuccess.mockReset()
    routerReplaceMock = vi.fn()
    mockSearchParams = new URLSearchParams('')
    window.history.replaceState(null, '', '/settings')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fires toast.success on ?status=email_changed', () => {
    mockSearchParams = new URLSearchParams('status=email_changed')
    window.history.replaceState(null, '', '/settings#account?status=email_changed')

    render(<StatusToastHandler />)

    expect(toastSuccess).toHaveBeenCalledTimes(1)
    expect(toastSuccess).toHaveBeenCalledWith('Email changed successfully')
  })

  it('strips status param preserving hash (D-14 — router.replace(pathname + hash) NOT router.replace(pathname))', () => {
    mockSearchParams = new URLSearchParams('status=email_changed')
    // Set the hash on the test environment so the handler's
    // window.location.hash read returns #account.
    window.history.replaceState(
      null,
      '',
      '/settings#account?status=email_changed',
    )
    // jsdom does not treat the part after `#` as a query — the hash is the
    // entire fragment. We need to set the hash deliberately.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, hash: '#account', pathname: '/settings' },
    })

    render(<StatusToastHandler />)

    expect(routerReplaceMock).toHaveBeenCalledTimes(1)
    const target = routerReplaceMock.mock.calls[0][0]
    expect(target).toBe('/settings#account')
    // Critical: target MUST end with #account (the hash) and MUST NOT
    // contain status=email_changed.
    expect(target).not.toContain('status=email_changed')
  })

  it('does not fire toast on unknown status value', () => {
    mockSearchParams = new URLSearchParams('status=unknown_value')
    render(<StatusToastHandler />)
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('uses ref guard to prevent Strict-Mode double-fire (FG-5)', () => {
    mockSearchParams = new URLSearchParams('status=email_changed')

    const { rerender } = render(<StatusToastHandler />)
    expect(toastSuccess).toHaveBeenCalledTimes(1)

    // Re-render with the same props — the ref guard MUST prevent a second toast.
    rerender(<StatusToastHandler />)
    expect(toastSuccess).toHaveBeenCalledTimes(1)
  })
})
