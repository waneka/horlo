'use client'

import { cn } from '@/lib/utils'

/**
 * Phase 25 / UX-06 — shared form-feedback banner primitive.
 *
 * Implements UI-SPEC §"FormStatusBanner Component Contract" + Decisions D-16
 * (hybrid 5s success / persistent error timing — owned by useFormFeedback) and
 * D-17 (component is purely presentational; no internal timer logic).
 *
 * Visual contract:
 *   - success → role=status, aria-live=polite, accent left-border, "Saved" default copy.
 *   - error   → role=alert,  aria-live=polite, destructive left-border, "Could not save…" default copy.
 *   - pending → muted text caption, "Saving…" default copy, aria-live=polite.
 *   - idle    → renders nothing (return null).
 *
 * The success-state shell mirrors Phase 22's <EmailChangePendingBanner>
 * verbatim (border-l-2 border-l-accent bg-muted/40 p-3 text-sm) so the cross-
 * surface visual language stays consistent. The error state swaps only the
 * strip color — NOT a destructive background fill (see UI-SPEC Anti-Pattern
 * #10).
 *
 * Auto-dismiss is OWNED by useFormFeedback (the hook flips state back to
 * 'idle' after 5s on success, which makes the component return null). Errors
 * persist until the next run() call (D-16).
 *
 * Default copy is LOCKED per UI-SPEC §Copywriting Contract — DO NOT replace
 * "Saved" with "Successfully saved" / "Updated successfully" (Anti-Pattern
 * #16).
 */
export interface FormStatusBannerProps {
  state: 'idle' | 'pending' | 'success' | 'error'
  message?: string
  className?: string
}

export function FormStatusBanner({
  state,
  message,
  className,
}: FormStatusBannerProps) {
  if (state === 'idle') return null

  if (state === 'success') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'mt-3 rounded-lg border border-l-2 border-border border-l-accent bg-muted/40 p-3 text-sm text-foreground',
          className,
        )}
      >
        {message ?? 'Saved'}
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div
        role="alert"
        aria-live="polite"
        className={cn(
          'mt-3 rounded-lg border border-l-2 border-border border-l-destructive bg-muted/40 p-3 text-sm text-destructive',
          className,
        )}
      >
        {message ?? 'Could not save. Please try again.'}
      </div>
    )
  }

  // state === 'pending'
  return (
    <p
      className={cn('mt-3 text-xs text-muted-foreground', className)}
      aria-live="polite"
    >
      {message ?? 'Saving…'}
    </p>
  )
}
