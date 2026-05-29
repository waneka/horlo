'use client'

import Image from 'next/image'
import { Loader2, Star, Watch as WatchIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MOVEMENT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * Phase 68 D-01..D-11 — confirm-screen presenter.
 *
 * Pure presentation. Sections rendered in order:
 *   1. Cover photo (catalogImageUrl → extractedImageUrl → WatchIcon placeholder) [D-06]
 *   2. Read-only brand+model identity + inline reference/year inputs [D-07]
 *   3. Segmented status picker (owned / wishlist / grail — sold absent) [D-04, CONF-03]
 *   4. Status-gated price field (Price paid / Target price) [WatchForm isOwned pattern, CONF-06]
 *   5. Ghost escape row: "Edit details" + "Start over" buttons [D-09, D-10]
 *   6. Primary CTA full-width: label resolves via CTA_LABELS[status] [D-10, CONF-08]
 *
 * Cross-phase invariants:
 *   - reference input is ENABLED even on catalog-bound rows. Phase 67 D-10 server-side
 *     overrides brand/model/reference when catalogId is supplied — user edits are silently
 *     superseded by the Server Action. productionYear is NOT overridden. [D-08]
 *   - Phase 70 owns: initialStatus resolution, addWatch dispatch, onEditDetails wiring,
 *     onStartOver wiring. This component emits callbacks only. [D-03]
 *   - Collection fit verdict is NOT shown here — verdict is deliberately out of scope for
 *     the add flow per PROJECT.md "Verdict deliberately out of scope". [CONTEXT deferred]
 *
 * Pending behavior: pending=true disables all action buttons; primary CTA shows
 * Loader2 spinner + "Saving...". Ghost buttons ("Edit details", "Start over") are
 * also disabled while pending. [D-10]
 */

// ---- Module-scope constants (D-10) ------------------------------------------

const CTA_LABELS = {
  owned: 'Add to Collection',
  wishlist: 'Add to Wishlist',
  grail: 'Save as Grail',
} as const

const OPTIONS: Array<{ value: 'owned' | 'wishlist' | 'grail'; label: string }> = [
  { value: 'owned', label: 'Owned' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'grail', label: 'Grail' },
]

// ---- Prop interface (D-03 locked contract — DO NOT modify shape or names) ----

interface ConfirmStepProps {
  /** Catalog row imageUrl when this watch resolved via search-pick (Phase 67 / D-10). */
  catalogImageUrl?: string | null
  /** Extracted-data imageUrl from the structured / URL extractor (Phase 66). */
  extractedImageUrl?: string | null
  /** Read-only brand (from catalog row when catalogId is bound; from extracted data otherwise). */
  brand: string
  /** Read-only model (same source rule as brand). */
  model: string
  /**
   * Inline-editable reference (CONF-05). Controlled by parent; null/undefined renders empty.
   *
   * NOTE (D-08): When catalogId is bound, Phase 67 D-10 server-side OVERRIDES this value
   * with catalogRow.reference in the addWatch Server Action. User edits to this field on
   * catalog-bound rows are silently superseded. The input stays ENABLED — this is correct
   * behavior; the catalog row is canonical for identity.
   */
  reference: string | null | undefined
  onReferenceChange: (value: string) => void
  /**
   * Inline-editable production year (CONF-05). Number for the controlled value, undefined when blank.
   * productionYear is NOT overridden by Phase 67 D-10 (year is not part of the catalog identity tuple).
   */
  productionYear: number | undefined
  onProductionYearChange: (value: number | undefined) => void
  /** Status picker controlled value. Restricted union excludes 'sold' (CONF-03). */
  status: 'owned' | 'wishlist' | 'grail'
  onStatusChange: (next: 'owned' | 'wishlist' | 'grail') => void
  /** Status-gated price (CONF-06). Single numeric prop; the label flips with status. */
  price: number | undefined
  onPriceChange: (value: number | undefined) => void
  /** Primary CTA. Phase 70 calls addWatch + routes. */
  onPrimary: () => void
  /** CONF-07 — opens WatchForm (Phase 70 decides inline vs route). */
  onEditDetails: () => void
  /** CONF-09 — return user to search idle. */
  onStartOver: () => void
  /** Pending state for the primary CTA. Disables all action buttons + swaps CTA to Loader2. */
  pending?: boolean
  // Optional spec props per 68-UI-SPEC §SpecHeadline Helper (recommendation (a))
  movement?: string | null
  caseSizeMm?: number | null
  dialColor?: string | null
}

// ---- Component ---------------------------------------------------------------

export function ConfirmStep({
  catalogImageUrl,
  extractedImageUrl,
  brand,
  model,
  reference,
  onReferenceChange,
  productionYear,
  onProductionYearChange,
  status,
  onStatusChange,
  price,
  onPriceChange,
  onPrimary,
  onEditDetails,
  onStartOver,
  pending = false,
  movement,
  caseSizeMm,
  dialColor,
}: ConfirmStepProps) {
  const brandModel = [brand, model].filter(Boolean).join(' ') || 'Watch'
  const isOwned = status === 'owned'
  const coverUrl = catalogImageUrl ?? extractedImageUrl ?? null

  // WAI-ARIA 1.2 radiogroup roving-tabindex keyboard handler (68-UI-SPEC §Keyboard navigation)
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const values = ['owned', 'wishlist', 'grail'] as const
    const idx = values.indexOf(status)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      onStatusChange(values[(idx + 1) % values.length])
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      onStatusChange(values[(idx + values.length - 1) % values.length])
    } else if (e.key === 'Home') {
      e.preventDefault()
      onStatusChange(values[0])
    } else if (e.key === 'End') {
      e.preventDefault()
      onStatusChange(values[values.length - 1])
    }
  }

  return (
    <div className="space-y-6" aria-live="polite">

      {/* Section 1: Cover photo + identity card */}
      <Card>
        <CardContent className="flex items-start gap-4 p-6">

          {/* Cover photo slot — always rendered (image or placeholder) */}
          <div className="size-20 rounded-md bg-muted overflow-hidden flex-shrink-0">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={brandModel}
                width={80}
                height={80}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <div
                data-testid="confirm-cover-placeholder"
                className="flex h-full w-full items-center justify-center"
              >
                <WatchIcon className="h-16 w-16 text-muted-foreground/40" aria-hidden />
              </div>
            )}
          </div>

          {/* Identity block */}
          <div className="space-y-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">{brandModel}</h2>
            <SpecHeadline movement={movement} caseSizeMm={caseSizeMm} dialColor={dialColor} />
          </div>

        </CardContent>
      </Card>

      {/* Section 2: Inline-editable reference + year */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          <div className="space-y-2">
            <Label htmlFor="confirm-reference">Reference</Label>
            <Input
              id="confirm-reference"
              value={reference ?? ''}
              onChange={(e) => onReferenceChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-year">Year</Label>
            <Input
              id="confirm-year"
              type="number"
              value={productionYear ?? ''}
              onChange={(e) =>
                onProductionYearChange(e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>

        </div>
      </div>

      {/* Section 3: Status radiogroup picker */}
      <div className="space-y-2">
        <Label htmlFor="confirm-status-group">Status</Label>
        <div
          role="radiogroup"
          aria-label="Watch status"
          id="confirm-status-group"
          className="flex gap-2"
          onKeyDown={handleKeyDown}
        >
          {OPTIONS.map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={status === value}
              tabIndex={status === value ? 0 : -1}
              variant="outline"
              className={cn(
                'min-h-[44px]',
                status === value && 'border-primary bg-primary/10',
              )}
              onClick={() => onStatusChange(value)}
            >
              {value === 'grail' ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-4" aria-hidden />
                  Grail
                </span>
              ) : (
                label
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Section 4: Status-gated price field */}
      <div className="space-y-2">
        <Label htmlFor="confirm-price">
          {isOwned ? 'Price paid' : 'Target price'}
        </Label>
        <Input
          id="confirm-price"
          type="number"
          value={price ?? ''}
          onChange={(e) =>
            onPriceChange(e.target.value ? Number(e.target.value) : undefined)
          }
          placeholder="$"
        />
      </div>

      {/* Section 5: Ghost escape affordances (above primary CTA per 68-UI-SPEC §Container rationale) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onEditDetails}
          disabled={pending}
          className="w-full sm:flex-1"
        >
          Edit details
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onStartOver}
          disabled={pending}
          className="w-full sm:flex-1"
        >
          Start over
        </Button>
      </div>

      {/* Section 6: Primary CTA (full-width at all breakpoints) */}
      <Button
        type="button"
        onClick={onPrimary}
        disabled={pending}
        className="w-full"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
            Saving...
          </>
        ) : (
          CTA_LABELS[status]
        )}
      </Button>

    </div>
  )
}

// ---- Private helpers ---------------------------------------------------------

function SpecHeadline({
  movement,
  caseSizeMm,
  dialColor,
}: {
  movement?: string | null
  caseSizeMm?: number | null
  dialColor?: string | null
}) {
  const parts = [
    movement ? MOVEMENT_LABELS[movement as keyof typeof MOVEMENT_LABELS] : null,
    caseSizeMm ? `${caseSizeMm}mm` : null,
    dialColor,
  ].filter((p): p is string => Boolean(p))
  if (parts.length === 0) return null
  return <p className="text-sm text-muted-foreground">{parts.join(' • ')}</p>
}
