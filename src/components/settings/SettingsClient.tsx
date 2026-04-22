'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingsSection } from './SettingsSection'
import { PrivacyToggleRow } from './PrivacyToggleRow'

interface SettingsClientProps {
  username: string
  settings: {
    profilePublic: boolean
    collectionPublic: boolean
    wishlistPublic: boolean
  }
}

const NOTE_DEFAULT_KEY = 'horlo:noteVisibilityDefault'
type NoteDefault = 'public' | 'private'

export function SettingsClient({ settings }: SettingsClientProps) {
  // WR-02: The New Note Visibility dropdown previously persisted to localStorage
  // under NOTE_DEFAULT_KEY, but no write path (addWatch / editWatch /
  // insertWatchSchema) consumed the stored value, so flipping to "private" still
  // produced public notes — a privacy footgun. Until the default is wired
  // through the watch-creation flow, the control is disabled with a
  // "Coming soon" badge so users are not misled. The state + handler are
  // preserved so re-enabling just means removing `disabled` and wiring the
  // default into `insertWatchSchema` + the new-watch / edit-watch forms.
  // SSR safety: initial state is the static default 'public' so server-rendered
  // markup matches first client render. Hydrate from localStorage in useEffect.
  const [noteDefault, setNoteDefault] = useState<NoteDefault>('public')
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Hydrate the dropdown from localStorage on mount so the value is visible
  // when the control is re-enabled.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NOTE_DEFAULT_KEY)
      // T-08-15a mitigation: validate against the enum before applying.
      if (stored === 'public' || stored === 'private') {
        setNoteDefault(stored)
      }
    } catch {
      // localStorage may be unavailable (privacy mode); fall back to default.
    }
  }, [])

  function handleNoteDefaultChange(v: string | null) {
    const next: NoteDefault = v === 'private' ? 'private' : 'public'
    setNoteDefault(next)
    try {
      window.localStorage.setItem(NOTE_DEFAULT_KEY, next)
    } catch {
      // Persistence unavailable — UI still reflects the change in-session.
    }
  }

  return (
    <>
      <SettingsSection title="Privacy Controls">
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
          <div className="flex min-h-12 items-center justify-between gap-4 py-2">
            <div className="flex-1">
              <p className="text-sm font-normal text-foreground">
                New Note Visibility
              </p>
              <p className="text-xs text-muted-foreground">
                Default visibility applied to new notes you write.
              </p>
            </div>
            {/* WR-02: control is disabled until the default is wired through
                insertWatchSchema and the new-watch / edit-watch forms. */}
            <div className="flex items-center gap-2">
              <Badge variant="outline">Coming soon</Badge>
              <Select
                value={noteDefault}
                onValueChange={handleNoteDefaultChange}
                disabled
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <div className="flex min-h-12 items-center justify-between">
          <p className="text-sm">Theme</p>
          <Badge variant="outline">Coming soon</Badge>
        </div>
      </SettingsSection>

      <SettingsSection title="Notifications">
        <div className="flex min-h-12 items-center justify-between">
          <p className="text-sm">Email notifications</p>
          <Badge variant="outline">Coming soon</Badge>
        </div>
      </SettingsSection>

      <SettingsSection title="Data Preferences">
        <div className="flex min-h-12 items-center justify-between">
          <p className="text-sm">Download Data</p>
          <Badge variant="outline">Coming soon</Badge>
        </div>
        <div className="flex min-h-12 items-center justify-between">
          <p className="text-sm">Export Collection</p>
          <Badge variant="outline">Coming soon</Badge>
        </div>
      </SettingsSection>

      <SettingsSection title="Account">
        <div className="flex min-h-12 items-center justify-between">
          <p className="text-sm opacity-60">Change Password</p>
          <Badge variant="outline">Coming soon</Badge>
        </div>
        <div className="flex min-h-12 items-center justify-between">
          <p className="text-sm opacity-60">Blocked Users</p>
          <Badge variant="outline">Coming soon</Badge>
        </div>
        <div className="flex min-h-12 items-center justify-between">
          <p className="text-sm">Delete Account</p>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger
              render={
                <Button variant="ghost" className="text-destructive">
                  Delete Account
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  This permanently deletes your profile, collection, and all
                  data. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                Coming soon — account deletion is not yet implemented.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteOpen(false)}
                >
                  Keep Account
                </Button>
                <Button variant="destructive" disabled>
                  Delete Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SettingsSection>
    </>
  )
}
