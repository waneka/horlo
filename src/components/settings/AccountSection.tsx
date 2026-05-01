import { EmailChangeForm } from './EmailChangeForm'
import { PasswordChangeForm } from './PasswordChangeForm'

interface AccountSectionProps {
  currentEmail: string
  pendingNewEmail: string | null
  lastSignInAt: string | null
}

/**
 * Phase 22 SET-04 + SET-05 — Account tab content. Composes EmailChangeForm
 * (Plan 03) + PasswordChangeForm (Plan 04). UI-SPEC line 448 mandates the
 * `space-y-8` (32px) separation between Email and Password subsections.
 */
export function AccountSection({
  currentEmail,
  pendingNewEmail,
  lastSignInAt,
}: AccountSectionProps) {
  return (
    <div className="space-y-8">
      <EmailChangeForm
        currentEmail={currentEmail}
        pendingNewEmail={pendingNewEmail}
      />
      <PasswordChangeForm
        currentEmail={currentEmail}
        lastSignInAt={lastSignInAt}
      />
    </div>
  )
}
