'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SettingsSection } from './SettingsSection'
import { ProfileEditForm } from '@/components/profile/ProfileEditForm'

interface ProfileSectionProps {
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  userId: string
}

/**
 * Phase 43 D-19 (GAP-43-05) — Profile tab with live ProfileEditForm.
 *
 * Replaces the Phase 22 read-only stub. Reuses ProfileEditForm (which wires
 * the updateProfile Server Action and AvatarUploader). The form is always
 * visible (no edit-mode toggle); onDone calls router.refresh() so the server
 * component re-fetches fresh profile data after a save.
 *
 * "View public profile" link to /u/{username} is retained per the plan spec.
 */
export function ProfileSection({
  username,
  displayName,
  avatarUrl,
  bio,
  userId,
}: ProfileSectionProps) {
  const router = useRouter()

  return (
    <SettingsSection title="Profile">
      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/u/${username}`} />}
        >
          View public profile
        </Button>
      </div>
      <ProfileEditForm
        initial={{ displayName, avatarUrl, bio }}
        onDone={() => router.refresh()}
        userId={userId}
      />
    </SettingsSection>
  )
}
