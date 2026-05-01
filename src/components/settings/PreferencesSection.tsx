import { PreferencesClient } from '@/components/preferences/PreferencesClient'
import type { UserPreferences } from '@/lib/types'

interface PreferencesSectionProps {
  preferences: UserPreferences
}

/**
 * Phase 22 D-01 + D-15 — the Preferences tab is the primary surface for
 * taste preferences. /preferences is a server-side redirect to
 * /settings#preferences (Plan 02). PreferencesClient is embedded unchanged
 * to preserve the D-01 "no functional regression" guarantee.
 *
 * UI-SPEC FG-2: PreferencesClient owns its own outer
 * `container mx-auto px-4 py-8 max-w-3xl` wrapper. Phase 22 keeps it
 * byte-identical; the inner padding currently coexists with the tab frame
 * and reads as intentional breathing room. If the UI checker flags
 * double-padding in production, address with a follow-up commit.
 *
 * No outer card wrapper here — PreferencesClient already renders its own
 * Card primitives per section, and double-wrapping would create a
 * card-inside-card visual.
 */
export function PreferencesSection({ preferences }: PreferencesSectionProps) {
  return <PreferencesClient preferences={preferences} />
}
