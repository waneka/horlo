'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Phase 70 D-11 / D-08 / D-12 — DupeBanner pure-presenter.
 *
 * Sibling presenter mounted ABOVE ConfirmStep when the AddWatchFlow orchestrator
 * resolves a dupeContext (existing owned or wishlist row for the same catalog
 * row). Pure presenter pattern (matches ConfirmStep / SearchEntry / StructuredEntryPanel):
 *   - props in, callbacks out
 *   - no Server Action imports
 *   - no useRouter / useTransition
 *
 * The orchestrator owns dispatch — the banner only fires callbacks.
 *
 * Two contexts:
 *   - owned    (DUPE-02) → headline "Already in your collection"; "View existing" + "Add another copy"
 *   - wishlist (DUPE-03) → headline "On your wishlist";           "View existing" + "Move to Collection" + "Add another copy"
 *
 * Null-reference (D-06 fallback) — when existingReference is null:
 *   - "View existing" button is HIDDEN (no /w/[ref] target derivable)
 *   - Subtext "Reference: …" line is HIDDEN
 *   - Headline + "Add another copy" still render
 *
 * Visual chain (UI-SPEC A1/A2/A3/A4/A7):
 *   - bg-muted/40 rounded-lg border border-border p-4 space-y-3   (compact card)
 *   - text-sm font-semibold text-foreground                       (headline — no raw weight-500)
 *   - flex flex-col gap-2 sm:flex-row sm:gap-3                    (mobile-first stacked → desktop row)
 *   - w-full sm:flex-1 min-h-[44px]                               (per Button — WCAG 2.5.5 touch target)
 *   - Loader2 swap inside "Move to Collection" when pending=true
 *
 * Hierarchy (D-12):
 *   The DupeBanner is the primary affordance when mounted. Primary "View existing" /
 *   "Move to Collection" use the Button default (filled) variant; "Add another copy"
 *   uses the outline variant to signal it as the secondary / bypass action.
 */

interface DupeBannerProps {
  existingStatus: 'owned' | 'wishlist'
  existingReference: string | null
  onViewExisting: () => void
  /** Only provided when existingStatus === 'wishlist' (D-11). */
  onMoveToCollection?: () => void
  onAddAnotherCopy: () => void
  pending?: boolean
}

export function DupeBanner({
  existingStatus,
  existingReference,
  onViewExisting,
  onMoveToCollection,
  onAddAnotherCopy,
  pending = false,
}: DupeBannerProps) {
  const isOwned = existingStatus === 'owned'
  const headline = isOwned ? 'Already in your collection' : 'On your wishlist'

  return (
    <div
      className="rounded-lg border border-border bg-muted/40 p-4 space-y-3"
      aria-live="polite"
    >
      {/* Section 1: Headline + optional reference subtext */}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{headline}</p>
        {existingReference && (
          <p className="text-sm text-muted-foreground">Reference: {existingReference}</p>
        )}
      </div>

      {/* Section 2: Action row — mobile-first stacked, desktop side-by-side */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">

        {/* "View existing" — only when existingReference is non-null (D-06) */}
        {existingReference && (
          <Button
            type="button"
            onClick={onViewExisting}
            disabled={pending}
            className={cn('w-full sm:flex-1 min-h-[44px]')}
          >
            View existing
          </Button>
        )}

        {/* "Move to Collection" — only in wishlist context (D-11) */}
        {!isOwned && onMoveToCollection && (
          <Button
            type="button"
            onClick={onMoveToCollection}
            disabled={pending}
            className={cn('w-full sm:flex-1 min-h-[44px]')}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                Moving…
              </>
            ) : (
              'Move to Collection'
            )}
          </Button>
        )}

        {/* "Add another copy" — always rendered; outline = secondary affordance (D-12) */}
        <Button
          type="button"
          variant="outline"
          onClick={onAddAnotherCopy}
          disabled={pending}
          className={cn('w-full sm:flex-1 min-h-[44px]')}
        >
          Add another copy
        </Button>

      </div>
    </div>
  )
}
