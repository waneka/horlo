// tests/components/watch/AddWatchFlow.test.tsx
//
// Phase 29 FORM-04 Wave 0 test scaffold (CONTEXT D-19, D-14).
//
// Two assertion blocks:
//   1) key-change remount — render <AddWatchFlow key="a" .../>, type into the
//      paste URL input, then rerender with key="b". Paste URL MUST be empty.
//      This test is INTENTIONALLY RED at Plan 29-01 close — the source code
//      that makes it green (per-navigation `key` prop on AddWatchFlow +
//      useLayoutEffect cleanup) lands in Plan 29-04 (Wave 2). At Plan 01,
//      the test exists as the verification surface Plan 04 will turn green.
//
//   2) useLayoutEffect cleanup-on-hide sanity — render, type a URL, then
//      unmount(). Cleanup runs synchronously in jsdom (RESEARCH A1, mirroring
//      Activity-hide). Test asserts unmount() does NOT throw. Plan 04 adds
//      the actual `useLayoutEffect(() => () => { ... }, [])`; this test
//      guards against the cleanup throwing once Plan 04 lands.
//
// Mock scaffold mirrors tests/components/layout/UserMenu.test.tsx (Phase 25)
// and the userEvent + rerender pattern from tests/components/watch/WatchForm.test.tsx
// (Phase 19.1 + TEST-06). All Server Action / sonner / next-navigation surfaces
// are mocked because AddWatchFlow imports `toast` (line 5), `useRouter` (line 4),
// `getVerdictForCatalogWatch` (line 15), and `addWatch` (line 16).
//
// Pitfall 8 (RESEARCH): the `key` prop MUST appear at JSX level — never inside
// an object spread. Tests below pass `key="a"` and `key="b"` literally.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// next/navigation — AddWatchFlow calls useRouter().push and useRouter().refresh.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

// Server Actions — minimal stubs; FORM-04 unit tests don't exercise the
// commit path. Both must be mocked to prevent real network/server calls.
vi.mock('@/app/actions/verdict', () => ({
  getVerdictForCatalogWatch: vi.fn(),
}))
vi.mock('@/app/actions/watches', () => ({
  addWatch: vi.fn(),
}))

// sonner toast — AddWatchFlow imports `toast` for commit-success surface.
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Import AFTER mocks (analog: UserMenu.test.tsx + WatchForm.test.tsx).
import { AddWatchFlow } from '@/components/watch/AddWatchFlow'

// baseProps fixture — collectionRevision: 0 short-circuits the verdict
// compute via the empty-collection edge (CONTEXT D-06; AddWatchFlow.tsx Pitfall 8).
// All other props mirror the page Server Component's null-defaults.
const baseProps = {
  collectionRevision: 0,
  initialCatalogId: null,
  initialIntent: null as 'owned' | null,
  initialCatalogPrefill: null,
  initialManual: false,
  initialStatus: null as 'wishlist' | null,
  initialReturnTo: null,
  viewerUsername: 'tyler',
}

describe('AddWatchFlow — FORM-04 key-change remount (CONTEXT D-19)', () => {
  it('resets paste URL when key prop changes', async () => {
    const user = userEvent.setup()
    // Pitfall 8: key MUST be explicit at JSX level, NOT inside object spread.
    const { rerender } = render(<AddWatchFlow key="a" {...baseProps} />)

    const urlInput = screen.getByPlaceholderText(
      /paste a product page URL/i,
    ) as HTMLInputElement
    await user.type(urlInput, 'https://example.com/watch')
    expect(urlInput.value).toBe('https://example.com/watch')

    // Pitfall 8: key MUST be explicit at JSX level on rerender too.
    rerender(<AddWatchFlow key="b" {...baseProps} />)

    const urlInputAfter = screen.getByPlaceholderText(
      /paste a product page URL/i,
    ) as HTMLInputElement
    expect(urlInputAfter.value).toBe('')
  })
})

describe('AddWatchFlow — FORM-04 useLayoutEffect cleanup-on-hide (CONTEXT D-14)', () => {
  it('cleanup runs on unmount (sanity that no error is thrown)', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<AddWatchFlow key="a" {...baseProps} />)

    // Type into paste URL to make state non-default — exercises cleanup that
    // Plan 04's useLayoutEffect will reset (setState({kind:'idle'}); setUrl('');
    // setRail([])).
    const urlInput = screen.getByPlaceholderText(
      /paste a product page URL/i,
    ) as HTMLInputElement
    await user.type(urlInput, 'https://example.com/watch')

    // Unmount — useLayoutEffect cleanup runs synchronously (RESEARCH A1,
    // mirroring Activity-hide). Plan 01 has no useLayoutEffect yet, so this
    // is a no-op; Plan 04 wires up the cleanup. Either way, MUST NOT throw.
    expect(() => unmount()).not.toThrow()
  })
})
