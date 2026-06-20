'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Loader2, Star, Watch as WatchIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MOVEMENT_LABELS } from '@/lib/constants'
import type { MovementType } from '@/lib/types'
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
  'catalog-only': 'Save to Catalog',
} as const

const OPTIONS: Array<{ value: 'owned' | 'wishlist' | 'grail'; label: string }> = [
  { value: 'owned', label: 'Owned' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'grail', label: 'Grail' },
]

/** SEED-018 — admin-only fourth option; appended to OPTIONS for admin viewers. */
const CATALOG_ONLY_OPTION = { value: 'catalog-only' as const, label: 'Catalog only' }

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
  /**
   * Status picker controlled value. Restricted union excludes 'sold' (CONF-03).
   * SEED-018: widened to include 'catalog-only' for admin-gated path; only rendered
   * when isAdmin=true (additive; backward compat preserved via isAdmin default false).
   */
  status: 'owned' | 'wishlist' | 'grail' | 'catalog-only'
  onStatusChange: (next: 'owned' | 'wishlist' | 'grail' | 'catalog-only') => void
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
  /**
   * Phase 74 D-02 — when true, the primary CTA in the final section is NOT rendered at all (per Phase 74 D-01).
   * Set when a DupeBanner is mounted as a sibling above ConfirmStep (Phase 70 D-11) and that
   * banner is the user-action surface; the redundant gated CTA is noise. Additive extension
   * per Phase 68 D-03 prop contract. Default false preserves backward compat.
   */
  bannerActive?: boolean
  /**
   * SEED-018 — when true, a fourth "Catalog only" radio is rendered; arrow-key nav cycles 4 options.
   * When false (default), the option is NOT rendered at all (not disabled, not aria-hidden — absent).
   * Additive per Phase 68 D-03 prop contract; default false preserves backward compat.
   */
  isAdmin?: boolean
  // Optional spec props per 68-UI-SPEC §SpecHeadline Helper (recommendation (a))
  movement?: MovementType | null
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
  bannerActive = false,
  isAdmin = false,
  movement,
  caseSizeMm,
  dialColor,
}: ConfirmStepProps) {
  const brandModel = [brand, model].filter(Boolean).join(' ') || 'Watch'
  const isOwned = status === 'owned'
  const isCatalogOnly = status === 'catalog-only'
  const coverUrl = catalogImageUrl ?? extractedImageUrl ?? null

  // SEED-018 — OPTIONS_FOR_VIEWER: append 'Catalog only' for admins; absent entirely for non-admins.
  const OPTIONS_FOR_VIEWER = isAdmin ? [...OPTIONS, CATALOG_ONLY_OPTION] : OPTIONS

  // Ref on the radiogroup container — used to move DOM focus after status change (CR-01)
  const groupRef = useRef<HTMLDivElement>(null)

  // WAI-ARIA 1.2 radiogroup roving-tabindex keyboard handler (68-UI-SPEC §Keyboard navigation)
  // After calling onStatusChange, imperatively move focus to the newly selected button so
  // the browser does not leave keyboard cursor on the old button (now tabIndex=-1). Focus
  // is dispatched via requestAnimationFrame so it runs after React commits the new tabIndex.
  // SEED-018: values derived dynamically from OPTIONS_FOR_VIEWER so arrow-key nav cycles
  // 4 options for admins and 3 for non-admins.
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const values = OPTIONS_FOR_VIEWER.map(o => o.value)
    const idx = values.indexOf(status)
    let next: typeof values[number] | null = null

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      next = values[(idx + 1) % values.length]
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      next = values[(idx + values.length - 1) % values.length]
    } else if (e.key === 'Home') {
      e.preventDefault()
      next = values[0]
    } else if (e.key === 'End') {
      e.preventDefault()
      next = values[values.length - 1]
    }

    if (next !== null) {
      onStatusChange(next)
      const nextValue = next
      requestAnimationFrame(() => {
        groupRef.current
          ?.querySelector<HTMLButtonElement>(`[data-value="${nextValue}"]`)
          ?.focus()
      })
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
              disabled={pending}
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
              disabled={pending}
            />
          </div>

        </div>
      </div>

      {/* Section 3: Status radiogroup picker */}
      <div className="space-y-2">
        {/* Plain text heading — <label htmlFor> over a <div role="radiogroup"> is a no-op
            and misleading; the radiogroup's own aria-label provides the accessible name. */}
        <p className="text-sm font-semibold leading-none">Status</p>
        <div
          ref={groupRef}
          role="radiogroup"
          aria-label="Watch status"
          className="flex gap-2"
          onKeyDown={handleKeyDown}
        >
          {OPTIONS_FOR_VIEWER.map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={status === value}
              tabIndex={status === value ? 0 : -1}
              data-value={value}
              variant="outline"
              className={cn(
                'min-h-[44px]',
                status === value &&
                  'border-accent bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground',
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

      {/* Section 4: Status-gated price field.
          SEED-018: hidden entirely on catalog-only (no user-side watches row). */}
      {!isCatalogOnly && (
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
            disabled={pending}
          />
        </div>
      )}

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

      {/* Section 6: Primary CTA (full-width at all breakpoints) — Phase 74 D-01/D-02:
          hidden entirely when bannerActive=true (DupeBanner sibling above is the action surface). */}
      {!bannerActive && (
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
      )}

    </div>
  )
}

// ---- Private helpers ---------------------------------------------------------

function SpecHeadline({
  movement,
  caseSizeMm,
  dialColor,
}: {
  movement?: MovementType | null
  caseSizeMm?: number | null
  dialColor?: string | null
}) {
  const parts = [
    movement ? MOVEMENT_LABELS[movement] : null,
    caseSizeMm ? `${caseSizeMm}mm` : null,
    dialColor,
  ].filter((p): p is string => Boolean(p))
  if (parts.length === 0) return null
  return <p className="text-sm text-muted-foreground">{parts.join(' • ')}</p>
}
