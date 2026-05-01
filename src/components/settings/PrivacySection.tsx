import { SettingsSection } from './SettingsSection'
import { PrivacyToggleRow } from './PrivacyToggleRow'
import type { ProfileSettings } from '@/data/profiles'

interface PrivacySectionProps {
  settings: Pick<
    ProfileSettings,
    'profilePublic' | 'collectionPublic' | 'wishlistPublic'
  >
}

/**
 * Phase 22 D-01 migration — the 3 PrivacyToggleRow instances move verbatim
 * from the legacy SettingsClient.tsx into the new tabs frame. Behavior
 * unchanged (PrivacyToggleRow itself is untouched). Phase 23 SET-11 owns
 * the visual restyle pass.
 */
export function PrivacySection({ settings }: PrivacySectionProps) {
  return (
    <SettingsSection title="Visibility">
      <div className="divide-y divide-border">
        <PrivacyToggleRow
          label="Profile Visibility"
          description="When off, only you can see your profile."
          field="profilePublic"
          initialValue={settings.profilePublic}
        />
        <PrivacyToggleRow
          label="Collection"
          description="Hide your watch collection from other users."
          field="collectionPublic"
          initialValue={settings.collectionPublic}
        />
        <PrivacyToggleRow
          label="Wishlist"
          description="Hide your wishlist from other users."
          field="wishlistPublic"
          initialValue={settings.wishlistPublic}
        />
      </div>
    </SettingsSection>
  )
}
