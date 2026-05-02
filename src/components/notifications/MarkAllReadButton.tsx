'use client'

import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { markAllNotificationsRead } from '@/app/actions/notifications'

/**
 * Phase 25 / D-20 + UX-07 — Mark all read button.
 *
 * Replaces the inline `<form action={async () => {'use server'; ...}}>` block
 * that lived at `src/app/notifications/page.tsx:48-62`. Idiomatic Next 16
 * pattern: a Client Component that wraps a `<form action={async ...}>` and
 * uses React's `useFormStatus` hook on a CHILD <SubmitButton> for pending
 * state.
 *
 * UX details (LOCKED per UI-SPEC §<MarkAllReadButton> Component Contract):
 *   - Resting label: `Mark all read`.
 *   - Pending label: `Marking…` (Unicode ellipsis U+2026).
 *   - Toast on success: `toast.success('Notifications cleared')` — NOT
 *     "Marked all read" (UI-SPEC Anti-Pattern #7; CONTEXT §specifics).
 *   - Visual: `text-sm text-muted-foreground hover:text-foreground
 *     disabled:opacity-60` — matches the pre-Phase-25 inline button shape.
 *
 * Why useFormStatus instead of useFormFeedback (D-20):
 *   - This is a single-button surface with no form-level area below the
 *     button to host a FormStatusBanner — toast alone is the user-visible
 *     affordance.
 *   - `<form action={async fn}>` is the Next 16 idiomatic pattern for
 *     Server Action invocation from a Client Component; useFormStatus is
 *     the standard React 19 / Next 16 primitive for the form's pending
 *     state.
 *   - Per UI-SPEC §"<MarkAllReadButton> Component Contract": "This is the
 *     only form in scope that uses useFormStatus (D-20). All other forms
 *     keep useTransition via useFormFeedback."
 *
 * Security (T-25-06-01): the `<form action={SA}>` invocation goes through
 * Next 16's built-in CSRF protection (Action ID header signed at build time
 * + same-origin checks). markAllNotificationsRead enforces auth via
 * getCurrentUser() server-side (pre-Phase-25 contract; T-25-06-05).
 */
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
    >
      {pending ? 'Marking…' : 'Mark all read'}
    </button>
  )
}

export function MarkAllReadButton() {
  return (
    <form
      action={async () => {
        await markAllNotificationsRead()
        toast.success('Notifications cleared')
      }}
    >
      <SubmitButton />
    </form>
  )
}
