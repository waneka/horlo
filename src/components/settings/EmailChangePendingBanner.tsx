'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface EmailChangePendingBannerProps {
  oldEmail: string
  newEmail: string
}

/**
 * SET-04 / D-05 — persistent inline banner shown ABOVE the email-change form
 * whenever Supabase reports `user.new_email` is non-null.
 *
 * Copy is LOCKED — do not paraphrase. SET-04 mandates the exact wording
 * (UI-SPEC Copywriting Contract lines 207-222).
 *
 * D-06: single secondary action = "Resend confirmation". The banner deliberately
 * has NO secondary cancel/abort affordance — to revert a pending change, the
 * user submits a fresh email-change to the original address (D-06 explicit).
 * Resend re-fires updateUser({email: newEmail}) — Supabase replaces both
 * confirmation tokens (NOT supabase.auth.resend, which resends the existing
 * token; see RESEARCH Pattern 3).
 *
 * T-22-S4 mitigation: this component receives `oldEmail` (the user's confirmed
 * email) and `newEmail` (the pending) separately. The parent EmailChangeForm
 * passes `currentEmail` and `pendingNewEmail` from props — never letting the
 * UI display the new email as "current".
 *
 * UI-SPEC color contract: `border-l-accent` is the ONLY new accent surface
 * introduced by Phase 22. `bg-muted/40` is a soft tint at 40% opacity that
 * resolves cleanly across light + dark mode. UI-SPEC Anti-Pattern #10:
 * DO NOT accent-fill the background.
 */
export function EmailChangePendingBanner({
  oldEmail,
  newEmail,
}: EmailChangePendingBannerProps) {
  const [resending, setResending] = useState(false)

  async function handleResend() {
    setResending(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setResending(false)
    if (error) {
      toast.error('Could not resend confirmation.')
      return
    }
    toast.success('Confirmation resent.')
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 rounded-lg border border-l-2 border-border border-l-accent bg-muted/40 p-3 text-sm"
    >
      <p className="text-foreground">
        Confirmation sent to <strong>{oldEmail}</strong> and{' '}
        <strong>{newEmail}</strong>. Click both links to complete the change.
      </p>
      <div className="mt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? 'Resending…' : 'Resend confirmation'}
        </Button>
      </div>
    </div>
  )
}
