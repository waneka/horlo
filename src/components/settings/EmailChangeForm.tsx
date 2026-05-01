'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { SettingsSection } from './SettingsSection'
import { EmailChangePendingBanner } from './EmailChangePendingBanner'

interface EmailChangeFormProps {
  /**
   * Current confirmed email — what the disabled "Current email" input shows.
   * SET-04 + T-22-S4 explicit: NEVER show pendingNewEmail as current.
   */
  currentEmail: string
  /**
   * Pending change email from `user.new_email`; null when no change is in
   * flight. D-05 banner gate: when non-null, EmailChangePendingBanner renders
   * above the form fields.
   */
  pendingNewEmail: string | null
}

/**
 * SET-04 — Account section email-change form.
 *
 * T-22-S4 mitigation (UI spoofing / phishing aid): the disabled "Current email"
 * input ALWAYS renders `value={currentEmail}` (the user's confirmed `email`),
 * NEVER `pendingNewEmail`. SET-04 explicit; UI-SPEC Anti-Pattern #8 explicit.
 * The pending email surfaces ONLY inside the bolded banner copy, never as the
 * form's "current" affordance.
 *
 * D-05 banner gate: when `pendingNewEmail` is non-null (sourced server-side
 * from `user.new_email`), the EmailChangePendingBanner renders ABOVE the
 * form. When confirmation completes, Supabase clears `new_email` and the
 * banner disappears on the next render.
 *
 * D-07: a second submit while a change is pending silently overwrites the
 * prior pending change — native Supabase semantics, no client guard.
 */
export function EmailChangeForm({
  currentEmail,
  pendingNewEmail,
}: EmailChangeFormProps) {
  const router = useRouter()
  const [newEmail, setNewEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.updateUser({ email: newEmail })
    setSubmitting(false)
    if (err) {
      // UI-SPEC server error fallback copy — locked.
      setError('Could not update email. Please try again.')
      return
    }
    toast.success('Confirmation sent. Check your inbox.')
    setNewEmail('')
    // Force the parent Server Component to re-fetch user.new_email so the
    // banner appears on the next render. D-07: a second submit while pending
    // silently overwrites the prior pending change — no client guard, native
    // Supabase semantics.
    router.refresh()
  }

  return (
    <SettingsSection title="Email">
      {pendingNewEmail && (
        <EmailChangePendingBanner
          oldEmail={currentEmail}
          newEmail={pendingNewEmail}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Change the email address used for sign-in and account recovery.
        </p>
        <div className="space-y-2">
          <Label htmlFor="current-email">Current email</Label>
          <Input
            id="current-email"
            type="email"
            value={currentEmail}
            disabled
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-email">New email address</Label>
          <Input
            id="new-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="default"
            disabled={submitting || !newEmail || newEmail === currentEmail}
          >
            {submitting ? 'Updating…' : 'Update email'}
          </Button>
        </div>
      </form>
    </SettingsSection>
  )
}
