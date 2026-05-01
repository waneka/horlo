import { redirect } from 'next/navigation'

/**
 * Phase 22 D-15 — server-side redirect to /settings#preferences.
 *
 * Next.js 16's redirect() preserves the URL fragment in the Location header
 * (verified via 22-RESEARCH.md Pattern 7 / code-read of
 * node_modules/next/dist/shared/lib/router/utils/add-path-prefix.js — the
 * helper explicitly preserves `hash`). RFC 7231 §7.1.2 mandates browsers
 * honor the fragment. No Client Component fallback required.
 *
 * The `<SettingsTabsShell>` mount-time hash parser activates the Preferences
 * tab on landing.
 */
export default function PreferencesPage(): never {
  redirect('/settings#preferences')
}
