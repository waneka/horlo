'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { SettingsSection } from './SettingsSection'
import { PasswordReauthDialog } from './PasswordReauthDialog'
import { isSessionStale } from '@/lib/auth/lastSignInAt'

interface PasswordChangeFormProps {
  currentEmail: string
  /**
   * ISO timestamp of last fresh sign-in; null when unknown. RECONCILED D-08
   * Option C: this is the primary client-side freshness signal, mirroring
   * Supabase's server-side `session.created_at + 24h` reauth check.
   */
  lastSignInAt: string | null
}

type ReauthState =
  | { open: false }
  | { open: true; pendingNewPassword: string; description?: string }

/**
 * SET-05 + RECONCILED D-08 + D-10 (Option C) — password change with two paths
 * gated by `last_sign_in_at`:
 *
 * - FRESH (< 24h): direct supabase.auth.updateUser({password}). On a 401
 *   response (Supabase server-side enforces against session.created_at, which
 *   the client cannot read directly; client uses last_sign_in_at as a proxy
 *   that matches server semantics in all observed cases — but the 401 catch
 *   is defense-in-depth for any timing edge), re-open the re-auth dialog with
 *   the soft "Please confirm your password to continue." copy.
 *
 * - STALE (>= 24h, null, malformed): open re-auth dialog before any
 *   updateUser call.
 *
 * Why last_sign_in_at and not the access-token issued-at claim: that claim
 * rotates on every silent token refresh, so a 7-day-old session with a
 * 30-second-old refreshed token would pass the client-side check but be
 * rejected by Supabase's server-side check (session.CreatedAt + 24h > now,
 * verified via supabase/auth source code read in 22-RESEARCH.md).
 * last_sign_in_at updates only on fresh signInWithPassword (and OAuth/OTP),
 * matching server semantics.
 */
export function PasswordChangeForm({
  currentEmail,
  lastSignInAt,
}: PasswordChangeFormProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [reauth, setReauth] = useState<ReauthState>({ open: false })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validation — locked copy from UI-SPEC.
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    // RECONCILED D-08: stale-session check via last_sign_in_at proxy.
    if (isSessionStale(lastSignInAt)) {
      // Stale — open dialog with the new password held in dialog parent state.
      setReauth({ open: true, pendingNewPassword: password })
      return
    }

    // D-10: fresh session — apply directly.
    setSubmitting(true)
    const supabase = createSupabaseBrowserClient()
    const { error: updErr } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    // RECONCILED D-08 Option C defense-in-depth: any 401 from updateUser
    // re-opens the re-auth dialog with clarifying copy. Covers timing edges
    // where last_sign_in_at proxy and server session.created_at disagree.
    if (
      updErr &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updErr as any).status === 401
    ) {
      setReauth({
        open: true,
        pendingNewPassword: password,
        description: 'Please confirm your password to continue.',
      })
      return
    }
    if (updErr) {
      setError('Could not update password.')
      return
    }

    toast.success('Password updated')
    setPassword('')
    setConfirm('')
  }

  function handleReauthSuccess() {
    setPassword('')
    setConfirm('')
    setError(null)
  }

  return (
    <SettingsSection title="Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose a new password. We&apos;ll ask you to sign in again if your
          last sign-in was over 24 hours ago.
        </p>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="default"
            disabled={submitting || !password || !confirm}
          >
            {submitting ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>

      <PasswordReauthDialog
        open={reauth.open}
        onOpenChange={(next) => {
          if (!next) setReauth({ open: false })
        }}
        currentEmail={currentEmail}
        pendingNewPassword={reauth.open ? reauth.pendingNewPassword : ''}
        initialDescription={reauth.open ? reauth.description : undefined}
        onSuccess={handleReauthSuccess}
      />
    </SettingsSection>
  )
}
