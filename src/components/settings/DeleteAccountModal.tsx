'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { deleteAccount } from '@/app/actions/account'

interface DeleteAccountModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  currentEmail: string
}

/**
 * Phase 41 SET-13 D-01 — 2-step Delete Account confirmation modal.
 *
 * Flow (D-02):
 *   Step 1: Warn screen — title, warning lead, destroyed-items list (no "what is kept" line — D-01).
 *   Step 2: Combined type-to-confirm (keyword: DELETE) + password re-auth step.
 *
 * Re-auth pattern (D-03): reuses PasswordReauthDialog pattern — signInWithPassword
 * before server action, short-circuit on wrong password. Does NOT import PasswordReauthDialog.
 *
 * D-04: fixed keyword DELETE.
 * D-05: execute button disabled until typed === 'DELETE' AND password is non-empty.
 * D-07: on success, browser client signs out, router navigates to /.
 * D-08: NO notifications.actor_id cascade copy in modal UI.
 * UI-SPEC line 195: NO success toast — user is signed out and redirected, not toasted.
 */
export function DeleteAccountModal({
  open,
  onOpenChange,
  currentEmail,
}: DeleteAccountModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

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
    // No successMessage and no successAction — suppresses the toast (D-07 / UI-SPEC line 195).
    run(async () => {
      const supabase = createSupabaseBrowserClient()

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password,
      })
      if (signInErr) {
        return { success: false as const, error: 'Password incorrect.' }
      }

      const result = await deleteAccount()
      if (!result.success) {
        return {
          success: false as const,
          error: 'Could not delete your account. Try again.',
        }
      }

      // D-07: sign the user out on the browser client, then redirect to /.
      // Do not cache session objects across re-auth -> action -> signOut (RESEARCH Pitfall 8).
      await createSupabaseBrowserClient().auth.signOut()
      router.push('/')
      return { success: true as const, data: undefined }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <>
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                This permanently deletes your Horlo account. It cannot be undone.
              </p>
              <ul className="space-y-2 text-sm text-foreground list-none">
                <li>Your account and login</li>
                <li>Your collection, wishlist, and wear history</li>
                <li>Your profile, follows, and uploaded photos</li>
              </ul>
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
              Type DELETE to confirm, then enter your password.
            </p>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="font-semibold">
                Confirm
              </Label>
              <Input
                id="delete-confirm"
                placeholder="DELETE"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-password" className="font-semibold">
                Current password
              </Label>
              <Input
                id="delete-password"
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
                disabled={pending || typed !== 'DELETE' || !password}
              >
                {pending ? 'Deleting…' : 'Delete Account'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
