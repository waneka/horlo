import { CollectionGoalCard } from './preferences/CollectionGoalCard'
import { OverlapToleranceCard } from './preferences/OverlapToleranceCard'
import { PreferencesClient } from '@/components/preferences/PreferencesClient'
import type { UserPreferences } from '@/lib/types'

interface PreferencesSectionProps {
  preferences: UserPreferences
}

/**
 * Phase 23 SET-07 / SET-08 — Preferences tab structure (D-01..D-04).
 *
 * Renders two new top Cards (Collection goal, Overlap tolerance) lifted
 * from PreferencesClient's now-deleted Collection Settings Card, then a
 * "Taste preferences" divider, then the embedded PreferencesClient with
 * its taste-tag pickers (Style/Design/Complication/Dial Color/Case Size/Notes).
 *
 * Server Component — only the two top Cards are Client Components; the
 * divider is static; PreferencesClient is itself a Client Component but
 * mounts via JSX as a child (Next.js 16 § Server-Client interleaving).
 */
export function PreferencesSection({ preferences }: PreferencesSectionProps) {
  return (
    <div className="space-y-6">
      <CollectionGoalCard initialGoal={preferences.collectionGoal} />
      <OverlapToleranceCard initialTolerance={preferences.overlapTolerance} />
      <div className="border-t border-border pt-6">
        <p className="mb-4 text-xs font-normal uppercase tracking-wide text-muted-foreground">
          Taste preferences
        </p>
        <PreferencesClient embedded preferences={preferences} />
      </div>
    </div>
  )
}
