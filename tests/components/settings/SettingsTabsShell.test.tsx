import { describe, it } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 22 SET-01 / SET-02 / SET-03 — RED test scaffold for the Settings
// vertical-tabs shell. Implementation lands in a later wave; this file
// reserves test names so 22-VALIDATION.md `-t` references resolve from day 1.
// ---------------------------------------------------------------------------

describe('SettingsTabsShell — Phase 22 SET-01/02/03', () => {
  it.todo('renders 6 tabs in canonical order with vertical orientation')
  it.todo('uses pushState (not router.push) on tab change')
  it.todo('responds to hashchange event for browser back/forward')
  it.todo('default tab is account when hash is empty (D-17 replaceState)')
  it.todo('parses hash with querystring (#account?status=email_changed)')
  it.todo('falls through to account tab on unknown hash value')
})
