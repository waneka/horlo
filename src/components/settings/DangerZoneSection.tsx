'use client'

import { useState } from 'react'
import { Trash2, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WipeCollectionModal } from './WipeCollectionModal'
import { DeleteAccountModal } from './DeleteAccountModal'

interface DangerZoneSectionProps {
  currentEmail: string
}

/**
 * Phase 41 SET-13 D-01 — Danger Zone client island composing the two
 * destructive modals + their trigger buttons.
 *
 * Card styling: border-destructive/30 rounded-lg p-6 (UI-SPEC Destructive
 * treatment — diverges from SettingsSection's neutral rounded-xl border).
 * Section title: text-destructive font-semibold text-lg.
 *
 * D-01: composes WipeCollectionModal and DeleteAccountModal as two separate
 * components — no shared parametrized modal.
 */
export function DangerZoneSection({ currentEmail }: DangerZoneSectionProps) {
  const [wipeOpen, setWipeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <div className="border border-destructive/30 rounded-lg p-6">
      <h2 className="text-destructive font-semibold text-lg mb-4">Danger Zone</h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="destructive"
          className="gap-1"
          onClick={() => setWipeOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Wipe Collection
        </Button>
        <Button
          variant="destructive"
          className="gap-1"
          onClick={() => setDeleteOpen(true)}
        >
          <UserX className="h-4 w-4" />
          Delete Account
        </Button>
      </div>
      <WipeCollectionModal
        open={wipeOpen}
        onOpenChange={setWipeOpen}
        currentEmail={currentEmail}
      />
      <DeleteAccountModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        currentEmail={currentEmail}
      />
    </div>
  )
}
