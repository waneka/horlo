'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useFormFeedback } from '@/lib/hooks/useFormFeedback'

interface PasswordReauthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentEmail: string
  /**
   * The new password the user typed in the parent PasswordChangeForm. Held in
   * parent state so the post-reauth updateUser({password}) call applies it.
   */
  pendingNewPassword: string
  /**
   * Optional initial copy override. RECONCILED D-08 Option C defense-in-depth
   * re-open uses softer copy ("Please confirm your password to continue.").
   * Default is the locked stale-session copy.
   */
  initialDescription?: string
  onSuccess: () => void
}

/**
 * SET-05 / D-09 — single-field current-password re-auth challenge.
 *
 * Flow per CONTEXT D-09:
 *   1. User types current password (single field — email is implicit).
 *   2. signInWithPassword({email: currentEmail, password}) — refreshes session.
 *   3. On success, immediately updateUser({password: pendingNewPassword}).
 *   4. On either failure, surface inline neutral error.
 *
 * Single field minimizes friction. Email is bound to user.id by Supabase;
 * passing it explicitly to signInWithPassword is required by the API.
 *
 * RECONCILED D-08 Option C: this dialog is also opened by the parent
 * PasswordChangeForm in the defense-in-depth path when a fresh-session
 * updateUser returns 401. In that case the parent passes a softer
 * `initialDescription` ("Please confirm your password to continue.").
 *
 * UI-SPEC Pitfall 5 / Anti-Pattern #7: DO NOT preemptively patch the dialog
 * with pointer-event halting handlers. Tabs is not Floating UI; the dialog
 * content is portaled outside Tabs. Verify with a smoke test if click-swallow
 * symptoms ever appear; mitigation is the InlineThemeSegmented.tsx pattern.
 */
export function PasswordReauthDialog({
  open,
  onOpenChange,
  currentEmail,
  pendingNewPassword,
  initialDescription,
  onSuccess,
}: PasswordReauthDialogProps) {
  const [password, setPassword] = useState('')
  // Phase 25 / UX-06 — hybrid hook in dialogMode:true (D-19). Dialog
  // dismounts on success so no inline banner is rendered; toast.success
  // ('Password updated') fires from the hook and persists across the
  // dismount via Sonner's portal. The hook's `message` carries the error
  // string when either supabase call fails — surfaced via the inline alert
  // paragraph (errors need to remain readable; toast.error auto-dismisses).
  const { pending, message, run, reset: resetFeedback } = useFormFeedback({
    dialogMode: true,
  })

  function resetField() {
    setPassword('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      resetField()
      resetFeedback()
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    run(async () => {
      const supabase = createSupabaseBrowserClient()

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password,
      })
      if (signInErr) {
        // D-09 neutral copy — locked. The email is the user's own, so user
        // enumeration concern is moot, but neutral copy preserves consistency
        // with the login-form pattern.
        return { success: false as const, error: 'Password incorrect.' }
      }

      const { error: updErr } = await supabase.auth.updateUser({
        password: pendingNewPassword,
      })
      if (updErr) {
        // UI-SPEC server error fallback copy.
        return { success: false as const, error: 'Could not update password.' }
      }

      // On success: clear the password field, close the dialog, and let the
      // parent know. The hook fires toast.success('Password updated') after
      // the action resolves; Sonner's portal keeps it visible across the
      // dialog dismount (D-19 carve-out).
      resetField()
      onOpenChange(false)
      onSuccess()
      return { success: true as const, data: undefined }
    }, { successMessage: 'Password updated' })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm your password</DialogTitle>
          <DialogDescription>
            {initialDescription ?? 'Re-enter your current password to continue.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reauth-password">Current password</Label>
            <Input
              id="reauth-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {/* D-19 dialogMode carve-out: NO inline banner. The hook's message
              still carries the error string after a failed supabase call, so
              render it as the prior inline alert paragraph (toast.error
              auto-dismisses too quickly to be the sole error surface). */}
          {message && !pending && (
            <p className="text-sm text-destructive">{message}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={pending || !password}>
              {pending ? 'Confirming…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
