'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useFormFeedback } from '@/lib/hooks/useFormFeedback'
import { wipeCollection } from '@/app/actions/account'

interface WipeCollectionModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  currentEmail: string
}

/**
 * Phase 41 SET-13 D-01 — 2-step Wipe Collection confirmation modal.
 *
 * Flow (D-02):
 *   Step 1: Warn screen — title, warning lead, destroyed-items list, "what is kept" line.
 *   Step 2: Combined type-to-confirm (keyword: WIPE) + password re-auth step.
 *
 * Re-auth pattern (D-03): reuses PasswordReauthDialog pattern — signInWithPassword
 * before server action, short-circuit on wrong password. Does NOT import PasswordReauthDialog.
 *
 * D-04: fixed keyword WIPE.
 * D-05: execute button disabled until typed === 'WIPE' AND password is non-empty.
 * D-06: success fires Sonner 'Collection wiped' toast and stays on /settings.
 */
export function WipeCollectionModal({
  open,
  onOpenChange,
  currentEmail,
}: WipeCollectionModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')

  const { pending, message, run, reset: resetFeedback } = useFormFeedback({
    dialogMode: true,
  })

  function resetFields() {
    setStep(1)
    setTyped('')
    setPassword('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      resetFields()
      resetFeedback()
    }
    onOpenChange(next)
  }

  async function handleExecute(e: React.FormEvent) {
    e.preventDefault()
    run(async () => {
      const supabase = createSupabaseBrowserClient()

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password,
      })
      if (signInErr) {
        return { success: false as const, error: 'Password incorrect.' }
      }

      const result = await wipeCollection()
      if (!result.success) {
        return {
          success: false as const,
          error: 'Could not wipe your collection. Try again.',
        }
      }

      resetFields()
      onOpenChange(false)
      return { success: true as const, data: undefined }
    }, { successMessage: 'Collection wiped' })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wipe your collection</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <>
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                This permanently deletes your entire collection. It cannot be undone.
              </p>
              <ul className="space-y-2 text-sm text-foreground list-none">
                <li>Every watch in your collection and wishlist</li>
                <li>All wear history and worn-with-this entries</li>
                <li>All photos you&apos;ve uploaded for wear entries</li>
              </ul>
              <p className="text-sm text-foreground">
                Your account, profile, and the people you follow are kept.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleExecute} className="space-y-4">
            <p className="text-sm text-foreground">
              Type WIPE to confirm, then enter your password.
            </p>
            <div className="space-y-2">
              <Label htmlFor="wipe-confirm" className="font-semibold">
                Confirm
              </Label>
              <Input
                id="wipe-confirm"
                placeholder="WIPE"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wipe-password" className="font-semibold">
                Current password
              </Label>
              <Input
                id="wipe-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {message && !pending && (
              <p className="text-sm text-destructive">{message}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={pending}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || typed !== 'WIPE' || !password}
              >
                {pending ? 'Wiping…' : 'Wipe Collection'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
