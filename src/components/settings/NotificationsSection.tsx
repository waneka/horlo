import { SettingsSection } from './SettingsSection'
import { PrivacyToggleRow } from './PrivacyToggleRow'
import type { ProfileSettings } from '@/data/profiles'

interface NotificationsSectionProps {
  settings: Pick<ProfileSettings, 'notifyOnFollow' | 'notifyOnWatchOverlap'>
}

/**
 * Phase 22 D-01 migration — the 2 PrivacyToggleRow instances for follow +
 * watch-overlap notifications move verbatim from the legacy
 * SettingsClient.tsx. Phase 23 SET-09 owns the visual restyle pass.
 */
export function NotificationsSection({
  settings,
}: NotificationsSectionProps) {
  return (
    <SettingsSection title="Email notifications">
      <div className="divide-y divide-border">
        <PrivacyToggleRow
          label="New Followers"
          description="Get notified when someone starts following you."
          field="notifyOnFollow"
          initialValue={settings.notifyOnFollow}
        />
        <PrivacyToggleRow
          label="Watch Overlaps"
          description="Get notified when another collector owns a watch you own."
          field="notifyOnWatchOverlap"
          initialValue={settings.notifyOnWatchOverlap}
        />
      </div>
    </SettingsSection>
  )
}
