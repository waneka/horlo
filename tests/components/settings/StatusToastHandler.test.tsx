import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Phase 22 D-13/D-14/D-16 — StatusToastHandler.
// D-13: Sonner toast on status=email_changed (read from hash-internal query).
// D-14: When stripping status= from the hash, MUST preserve the active tab
// portion (e.g., #account) — naive router.replace(pathname) drops the
// fragment and kicks the user back to the default tab.
// D-16: status= lives INSIDE the hash (`#account?status=email_changed`), not
// in location.search, because the SET-06 callback redirect uses the
// non-standard hash-with-querystring shape. The handler parses the hash
// directly: `hash.slice(1).split('?', 2)` then `URLSearchParams(query)`.
// ---------------------------------------------------------------------------

const toastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: vi.fn(),
  },
}))

let routerReplaceMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
  usePathname: () => '/settings',
}))

// Import AFTER mocks.
import { StatusToastHandler } from '@/components/settings/StatusToastHandler'

function setHash(hash: string, pathname = '/settings') {
  // jsdom does not parse query inside the fragment — the hash IS the entire
  // post-`#` string, including any internal `?key=value`. Set hash + pathname
  // deliberately so the handler's `window.location.hash` read returns the
  // exact D-16 shape produced by the SET-06 callback.
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...window.location, hash, pathname },
  })
}

describe('StatusToastHandler — Phase 22 D-13/D-14/D-16', () => {
  beforeEach(() => {
    toastSuccess.mockReset()
    routerReplaceMock = vi.fn()
    setHash('', '/settings')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fires toast.success on #account?status=email_changed (D-16 hash-internal query)', () => {
    setHash('#account?status=email_changed')

    render(<StatusToastHandler />)

    expect(toastSuccess).toHaveBeenCalledTimes(1)
    expect(toastSuccess).toHaveBeenCalledWith('Email changed successfully')
  })

  it('strips status from the hash preserving the active tab (D-14 — replace target = /settings#account)', () => {
    setHash('#account?status=email_changed')

    render(<StatusToastHandler />)

    expect(routerReplaceMock).toHaveBeenCalledTimes(1)
    const target = routerReplaceMock.mock.calls[0][0]
    expect(target).toBe('/settings#account')
    // Critical: target MUST end with #account (the tab) and MUST NOT
    // contain status=email_changed.
    expect(target).not.toContain('status=email_changed')
  })

  it('does not fire toast on unknown status value', () => {
    setHash('#account?status=unknown_value')
    render(<StatusToastHandler />)
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(routerReplaceMock).not.toHaveBeenCalled()
  })

  it('does not fire toast when hash has no status param', () => {
    setHash('#account')
    render(<StatusToastHandler />)
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(routerReplaceMock).not.toHaveBeenCalled()
  })

  it('does not fire toast when hash is empty', () => {
    setHash('')
    render(<StatusToastHandler />)
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(routerReplaceMock).not.toHaveBeenCalled()
  })

  it('uses ref guard to prevent Strict-Mode double-fire (FG-5)', () => {
    setHash('#account?status=email_changed')

    const { rerender } = render(<StatusToastHandler />)
    expect(toastSuccess).toHaveBeenCalledTimes(1)

    // Re-render with the same props — the ref guard MUST prevent a second toast.
    rerender(<StatusToastHandler />)
    expect(toastSuccess).toHaveBeenCalledTimes(1)
  })

  it('preserves additional hash-query params when stripping status', () => {
    setHash('#preferences?status=email_changed&other=keep')

    render(<StatusToastHandler />)

    expect(toastSuccess).toHaveBeenCalledTimes(1)
    expect(routerReplaceMock).toHaveBeenCalledTimes(1)
    const target = routerReplaceMock.mock.calls[0][0]
    expect(target).toBe('/settings#preferences?other=keep')
  })
})
