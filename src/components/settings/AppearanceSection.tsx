import { Palette } from 'lucide-react'
import { SettingsSection } from './SettingsSection'

/**
 * Phase 22 — Coming-soon stub per UI-SPEC visual spec (lines 432-440).
 * SET-10 (theme switch lifted from <InlineThemeSegmented>) ships in Phase 23.
 *
 * Server Component — no client logic required for the static stub.
 */
export function AppearanceSection() {
  return (
    <SettingsSection title="Appearance">
      <div className="flex items-center gap-3 py-2">
        <Palette className="size-4 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Theme and visual preferences are coming in the next update.
        </p>
      </div>
    </SettingsSection>
  )
}
