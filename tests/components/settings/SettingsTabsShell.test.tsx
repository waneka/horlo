import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserPreferences } from '@/lib/types'
import type { ProfileSettings } from '@/data/profiles'

// ---------------------------------------------------------------------------
// Phase 22 SET-01 / SET-02 / SET-03 — vertical-tabs shell behavior.
// All tests assert against the SettingsTabsShell hash-routing contract:
//   - 6 tabs in canonical order with vertical orientation (SET-01/SET-03)
//   - pushState (NOT router.push) on tab change (SET-02)
//   - hashchange listener responds to back/forward (D-18)
//   - default tab #account on empty hash (D-17)
//   - parseHash supports `#tab?key=value` shape (D-16)
//   - unknown hash falls through to account
// ---------------------------------------------------------------------------

// Suppress next/navigation imports the StatusToastHandler pulls in.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Import AFTER mocks so the shell's downstream Status handler resolves the mocked deps.
import { SettingsTabsShell } from '@/components/settings/SettingsTabsShell'

const stubProps = {
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
  profilePublic: true,
  currentEmail: 'alice@example.com',
  pendingNewEmail: null,
  lastSignInAt: '2026-04-30T12:00:00.000Z',
  settings: {
    userId: 'u',
    profilePublic: true,
    collectionPublic: true,
    wishlistPublic: true,
    notificationsLastSeenAt: new Date(0),
    notifyOnFollow: true,
    notifyOnWatchOverlap: true,
  } satisfies ProfileSettings,
  preferences: {
    preferredStyles: [],
    dislikedStyles: [],
    preferredDesignTraits: [],
    dislikedDesignTraits: [],
    preferredComplications: [],
    complicationExceptions: [],
    preferredDialColors: [],
    dislikedDialColors: [],
    overlapTolerance: 'medium',
  } as UserPreferences,
}

describe('SettingsTabsShell — Phase 22 SET-01/02/03', () => {
  beforeEach(() => {
    // Reset URL state between tests.
    window.history.replaceState(null, '', '/settings')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders 6 tabs in canonical order with vertical orientation', () => {
    render(<SettingsTabsShell {...stubProps} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(6)
    const labels = tabs.map((t) => t.textContent?.trim())
    expect(labels).toEqual([
      'Account',
      'Profile',
      'Preferences',
      'Privacy',
      'Notifications',
      'Appearance',
    ])

    // The Tabs root (data-slot="tabs") carries data-orientation="vertical".
    // Note: the TabsList also has data-orientation set by base-ui internally,
    // but base-ui sometimes inverts the orientation on the list when it
    // renders horizontally on small screens. We assert against the Root
    // directly via its data-slot attribute.
    const root = document.querySelector('[data-slot="tabs"]')
    expect(root?.getAttribute('data-orientation')).toBe('vertical')
  })

  it('uses pushState (not router.push) on tab change', async () => {
    const pushSpy = vi.spyOn(window.history, 'pushState')
    render(<SettingsTabsShell {...stubProps} />)

    const privacyTab = screen.getByRole('tab', { name: /privacy/i })
    const user = userEvent.setup()
    await user.click(privacyTab)

    // Find a call that pushed `#privacy`.
    const pushedHash = pushSpy.mock.calls.some(
      (call) => typeof call[2] === 'string' && call[2] === '#privacy',
    )
    expect(pushedHash).toBe(true)
  })

  it('responds to hashchange event for browser back/forward', () => {
    render(<SettingsTabsShell {...stubProps} />)

    // Simulate browser back/forward by setting hash + dispatching hashchange.
    act(() => {
      window.history.replaceState(null, '', '/settings#privacy')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    const privacyTab = screen.getByRole('tab', { name: /privacy/i })
    expect(privacyTab.getAttribute('data-active')).not.toBeNull()
  })

  it('default tab is account when hash is empty (D-17 replaceState)', () => {
    const replaceSpy = vi.spyOn(window.history, 'replaceState')
    render(<SettingsTabsShell {...stubProps} />)

    const calledWithAccount = replaceSpy.mock.calls.some(
      (call) =>
        typeof call[2] === 'string' && call[2] === '/settings#account',
    )
    expect(calledWithAccount).toBe(true)

    const accountTab = screen.getByRole('tab', { name: /account/i })
    expect(accountTab.getAttribute('data-active')).not.toBeNull()
  })

  it('parses hash with querystring (#account?status=email_changed)', () => {
    window.history.replaceState(
      null,
      '',
      '/settings#account?status=email_changed',
    )
    render(<SettingsTabsShell {...stubProps} />)
    const accountTab = screen.getByRole('tab', { name: /account/i })
    expect(accountTab.getAttribute('data-active')).not.toBeNull()
  })

  it('falls through to account tab on unknown hash value', () => {
    window.history.replaceState(null, '', '/settings#nonsense')
    render(<SettingsTabsShell {...stubProps} />)
    const accountTab = screen.getByRole('tab', { name: /account/i })
    expect(accountTab.getAttribute('data-active')).not.toBeNull()
  })
})
