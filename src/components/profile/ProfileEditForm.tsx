'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateProfile } from '@/app/actions/profile'
import { useFormFeedback } from '@/lib/hooks/useFormFeedback'

interface ProfileEditFormProps {
  initial: {
    displayName: string | null
    avatarUrl: string | null
    bio: string | null
  }
  onDone: () => void
}

export function ProfileEditForm({ initial, onDone }: ProfileEditFormProps) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? '')
  const [bio, setBio] = useState(initial.bio ?? '')
  // Phase 25 / UX-08 (D-21) — toast-only feedback via hook in dialogMode:true
  // (D-19). The dialog dismounts on success so no inline banner is rendered;
  // the toast IS the user-visible confirmation. Errors still surface via the
  // hook's `message` field rendered as the existing inline alert paragraph,
  // because toast.error auto-dismisses and the user may still need to read it.
  const { pending, message, run } = useFormFeedback({ dialogMode: true })

  function handleSave() {
    run(async () => {
      // Send only the fields the Server Action's strict schema accepts.
      // Empty trimmed values become null (clears the field).
      const trimmedAvatar = avatarUrl.trim()
      const result = await updateProfile({
        displayName: displayName.trim() || null,
        avatarUrl: trimmedAvatar === '' ? null : trimmedAvatar,
        bio: bio.trim() || null,
      })
      if (result.success) {
        // Close the dialog — toast.success('Profile updated') fires from the
        // hook and persists across the dialog dismount via Sonner's portal.
        onDone()
      }
      return result
    }, { successMessage: 'Profile updated' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="profile-display-name">Display name</Label>
        <Input
          id="profile-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          placeholder="Your name"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="profile-avatar-url">Avatar URL</Label>
        <Input
          id="profile-avatar-url"
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          maxLength={500}
          placeholder="https://..."
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="profile-bio">Bio</Label>
        <Textarea
          id="profile-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Tell collectors about your taste."
        />
        <span className="text-xs text-muted-foreground">{bio.length}/500</span>
      </div>
      {/* D-19 dialogMode carve-out: NO inline banner. Errors still need a
          surface (toast.error auto-dismisses), so render the hook's message
          when not pending. */}
      {message && !pending && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={pending}>
          Discard Changes
        </Button>
        <Button onClick={handleSave} disabled={pending}>
          {pending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
