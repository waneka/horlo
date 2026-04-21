'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateProfile } from '@/app/actions/profile'

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
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      // Send only the fields the Server Action's strict schema accepts.
      // Empty trimmed values become null (clears the field).
      const trimmedAvatar = avatarUrl.trim()
      const result = await updateProfile({
        displayName: displayName.trim() || null,
        avatarUrl: trimmedAvatar === '' ? null : trimmedAvatar,
        bio: bio.trim() || null,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      onDone()
    })
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
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
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
