import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { UserPreferences } from '@/lib/types'

// jsdom does not implement PointerEvent, which base-ui's Checkbox dispatches
// via `new PointerEvent('click', ...)` on internal click. Polyfill it to
// MouseEvent so the fireEvent.click path can reach `onCheckedChange` without
// throwing a ReferenceError and crashing the test. Scoped to this test file
// so the shim stays close to the symptom; no project-wide test-setup change.
if (typeof globalThis.PointerEvent === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).PointerEvent = class extends MouseEvent {
    // Minimal shape — base-ui only reads it as a click-like Event.
    pointerId: number
    pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
}

// Declared before component import so vitest hoists the mock.
vi.mock('@/app/actions/preferences', () => ({
  savePreferences: vi.fn(),
}))

import { PreferencesClient } from '@/components/preferences/PreferencesClient'
import { savePreferences } from '@/app/actions/preferences'

// Minimal UserPreferences shape matching src/lib/types.ts (verified by
// reading the type definition — no extra fields). The test only needs a
// renderable prefs object so PreferencesClient can mount and expose the
// Preferred Styles checkbox grid as the interactive trigger surface.
const basePrefs: UserPreferences = {
  preferredStyles: [],
  dislikedStyles: [],
  preferredDesignTraits: [],
  dislikedDesignTraits: [],
  preferredComplications: [],
  complicationExceptions: [],
  preferredDialColors: [],
  dislikedDialColors: [],
  preferredCaseSizeRange: { min: 36, max: 42 },
  overlapTolerance: 'low',
  collectionGoal: 'balanced',
  notes: '',
}

/**
 * Helper: locate the first Preferred-Styles Checkbox rendered by
 * PreferencesClient. Uses a TARGETED selector (STYLE_TAGS value "diver")
 * so a future refactor that reorders cards or swaps the Checkbox for a
 * different control fails LOUDLY with a descriptive error rather than
 * silently timing out on a missing role="alert" element.
 *
 * Resolution strategy (in order):
 *   1. Role=checkbox with an accessible name matching STYLE_TAGS "diver".
 *      Most stable — the tag list lives in src/lib/constants.ts.
 *   2. Any role=checkbox (fallback — still in the Preferred Styles card).
 *   3. Hard failure with descriptive guidance.
 */
function findFirstPrefCheckbox(): HTMLElement {
  // Strategy 1: named checkbox
  const byName = screen.queryAllByRole('checkbox', { name: /diver/i })
  if (byName.length > 0) return byName[0]

  // Strategy 2: any checkbox
  const anyCheckbox = screen.queryAllByRole('checkbox')
  if (anyCheckbox.length > 0) return anyCheckbox[0]

  // Strategy 3: loud failure with actionable guidance
  throw new Error(
    'DEBT-01 regression test: could not locate a Checkbox trigger in PreferencesClient. ' +
      'The "Preferred Styles" card no longer renders STYLE_TAGS as checkboxes. ' +
      'Update this test to target whatever interactive element replaced it, ' +
      'OR confirm the DEBT-01 fix still engages the savePreferences path.',
  )
}

describe('PreferencesClient — DEBT-01 regression lock (Phase 14 D-25)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('selector-resolution lock: a known-interactive element is reachable', () => {
    vi.mocked(savePreferences).mockResolvedValue({ success: true, data: undefined })
    render(<PreferencesClient preferences={basePrefs} />)
    // Throws a descriptive error BEFORE the save-failure path runs if
    // PreferencesClient's interactive surface has moved.
    const trigger = findFirstPrefCheckbox()
    expect(trigger).toBeInTheDocument()
  })

  it('shows role="alert" banner when savePreferences returns { success: false }', async () => {
    vi.mocked(savePreferences).mockResolvedValue({
      success: false,
      error: 'Database unavailable',
    })
    render(<PreferencesClient preferences={basePrefs} />)

    const trigger = findFirstPrefCheckbox()
    fireEvent.click(trigger)

    // Phase 25 / UX-06 (D-16/D-17): error banner now renders via the shared
    // <FormStatusBanner> component driven by useFormFeedback. The banner has
    // role="alert" and contains the bare error message (the hook surfaces
    // result.error verbatim — no "Couldn't save preferences:" prefix).
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert.textContent).toContain('Database unavailable')
    })
  })

  it('shows destructive styling on the alert banner', async () => {
    vi.mocked(savePreferences).mockResolvedValue({
      success: false,
      error: 'oops',
    })
    render(<PreferencesClient preferences={basePrefs} />)
    fireEvent.click(findFirstPrefCheckbox())

    // Phase 25 / UX-06: <FormStatusBanner state="error"> renders
    // border-l-destructive + text-destructive (per UI-SPEC §FormStatusBanner
    // Component Contract). DEBT-01's destructive-styling lock continues to
    // hold via the new component path.
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain('text-destructive')
    })
  })

  it('does NOT show alert banner when savePreferences returns success', async () => {
    vi.mocked(savePreferences).mockResolvedValue({
      success: true,
      data: undefined,
    })
    render(<PreferencesClient preferences={basePrefs} />)
    fireEvent.click(findFirstPrefCheckbox())

    // Wait for the transition to settle without asserting the absence of
    // an element that has never been inserted (avoids false-positive
    // passes on unrelated test timing).
    await new Promise((resolve) => setTimeout(resolve, 0))
    // Phase 25: success path renders <FormStatusBanner state="success"> with
    // role="status" — NOT role="alert". The DEBT-01 lock that no
    // role="alert" element appears on success continues to hold.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the shared <FormStatusBanner> primitive (Phase 25 hybrid pattern lock)', () => {
    // DEBT-01's original "rendered JSX contains aria-live=polite" lock was a
    // structural guard against refactors that delete the polite-live caption.
    // Phase 25 / UX-06 (D-17) generalizes that caption into the shared
    // FormStatusBanner + useFormFeedback hook, so the structural assertion
    // moves: PreferencesClient must still IMPORT and RENDER FormStatusBanner.
    // The banner's own implementation (src/components/ui/FormStatusBanner.tsx)
    // owns the aria-live="polite" attribute and is regression-locked by
    // src/lib/hooks/useFormFeedback.test.tsx Test 5.
    const fs = require('node:fs')
    const source = fs.readFileSync(
      'src/components/preferences/PreferencesClient.tsx',
      'utf8',
    )
    expect(source).toContain("from '@/components/ui/FormStatusBanner'")
    expect(source).toContain('<FormStatusBanner')
    expect(source).toContain('useFormFeedback')
  })
})
