import { SettingsSection } from './SettingsSection'
import { InlineThemeSegmented } from '@/components/layout/InlineThemeSegmented'

/**
 * Phase 23 SET-10 (D-05 / D-07) — the Appearance tab houses the theme
 * switch. <InlineThemeSegmented> is reused byte-identical from UserMenu;
 * both surfaces stay in sync via the horlo-theme cookie + useTheme() context
 * (D-06 — duplicate-by-design).
 *
 * STAYS a Server Component. <InlineThemeSegmented> owns its own 'use client'
 * boundary; mounting a Client child as a JSX node from a Server parent is
 * the canonical Next.js 16 pattern (see node_modules/next/dist/docs/01-app/
 * 01-getting-started/05-server-and-client-components.md). Matches the
 * <PrivacySection> / <NotificationsSection> pattern of Server-renders-
 * <PrivacyToggleRow>-Client-child.
 *
 * No <CardDescription>: D-05 mandates "no extra explanatory copy". The
 * Light/Dark/System icon labels carry the meaning.
 */
export function AppearanceSection() {
  return (
    <SettingsSection title="Theme">
      <InlineThemeSegmented />
    </SettingsSection>
  )
}
