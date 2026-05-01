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
import { toast } from 'sonner'

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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function reset() {
    setPassword('')
    setError(null)
    setLoading(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password,
    })
    if (signInErr) {
      // D-09 neutral copy — locked. The email is the user's own, so user
      // enumeration concern is moot, but neutral copy preserves consistency
      // with the login-form pattern.
      setError('Password incorrect.')
      setLoading(false)
      return
    }

    const { error: updErr } = await supabase.auth.updateUser({
      password: pendingNewPassword,
    })
    if (updErr) {
      // UI-SPEC server error fallback copy.
      setError('Could not update password.')
      setLoading(false)
      return
    }

    toast.success('Password updated')
    reset()
    onOpenChange(false)
    onSuccess()
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
          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={loading || !password}>
              {loading ? 'Confirming…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
