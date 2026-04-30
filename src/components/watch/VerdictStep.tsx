'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import type { ExtractedWatchData } from '@/lib/extractors'
import type { VerdictBundle } from '@/lib/verdict/types'
import type { PendingTarget } from './flowTypes'

/**
 * Phase 20.1 D-01 + D-06 + D-11 — verdict-ready render.
 *
 * Pure presentation. Three sections rendered in order:
 *   1. Spec preview (brand / model / image / reference + headline specs)
 *   2. <CollectionFitCard verdict={verdict} /> — byte-locked Phase 20 component
 *      OR contextual fallback when verdict===null:
 *        - hasCollection=false → empty-collection notice (D-06)
 *        - hasCollection=true → "Couldn't compute fit" message (UAT gap 1 fix)
 *   3. 3-button row (Wishlist primary, Collection secondary, Skip tertiary per D-11)
 *
 * Pending behavior: when pendingTarget !== null, all 3 buttons disable; the
 * clicked button displays its variant-specific pending label.
 *
 * Accessibility: 3-button row carries an aria-live="polite" wrapper so
 * verdict-ready transitions announce without screen-reader interruption.
 */
interface VerdictStepProps {
  extracted: ExtractedWatchData
  /** null = D-06 empty-collection edge OR enrichment-failure (D-09 fixed-label fallback also produces a non-null verdict — null specifically means "no verdict computed"). */
  verdict: VerdictBundle | null
  /**
   * UAT gap 1 (Plan 06): drives the verdict-null fallback copy split.
   *   - false → empty-collection copy (existing D-06 behavior)
   *   - true  → "Couldn't compute fit" copy (silent upstream failure surfaced honestly)
   */
  hasCollection: boolean
  pending: boolean
  pendingTarget: PendingTarget
  onWishlist: () => void
  onCollection: () => void
  onSkip: () => void
}

export function VerdictStep({
  extracted,
  verdict,
  hasCollection,
  pending,
  pendingTarget,
  onWishlist,
  onCollection,
  onSkip,
}: VerdictStepProps) {
  const brandModel = [extracted.brand, extracted.model].filter(Boolean).join(' ') || 'Watch'

  return (
    <div className="space-y-6" aria-live="polite">
      {/* Spec preview */}
      <Card>
        <CardContent className="flex items-start gap-4 p-6">
          {extracted.imageUrl && (
            <div className="size-20 rounded-md bg-muted overflow-hidden flex-shrink-0">
              <Image
                src={extracted.imageUrl}
                alt={brandModel}
                width={80}
                height={80}
                className="object-cover w-full h-full"
                unoptimized
              />
            </div>
          )}
          <div className="space-y-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">{brandModel}</h2>
            {extracted.reference && (
              <p className="text-sm text-muted-foreground">{extracted.reference}</p>
            )}
            <SpecHeadline data={extracted} />
          </div>
        </CardContent>
      </Card>

      {/* Verdict OR contextual fallback. UAT gap 1: do NOT conflate "no verdict computed"
          with "empty collection". The latter is real (Pitfall 8 / D-06); the former is
          an upstream silent failure we surface honestly. */}
      {verdict ? (
        <CollectionFitCard verdict={verdict} />
      ) : hasCollection ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t compute fit right now — you can still add this to wishlist or collection.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your collection is empty — fit score not available yet.
        </p>
      )}

      {/* 3-button row — D-11 hierarchy + UI-SPEC mobile stack */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <Button
          type="button"
          onClick={onWishlist}
          disabled={pending}
          className="w-full sm:w-auto sm:flex-1"
          aria-label="Add to Wishlist"
        >
          {pending && pendingTarget === 'wishlist' ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : (
            'Add to Wishlist'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCollection}
          disabled={pending}
          className="w-full sm:w-auto sm:flex-1"
          aria-label="Add to Collection"
        >
          {pending && pendingTarget === 'collection' ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : (
            'Add to Collection'
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          disabled={pending}
          className="w-full sm:w-auto"
          aria-label="Skip"
        >
          {pending && pendingTarget === 'skip' ? 'Skipping...' : 'Skip'}
        </Button>
      </div>
    </div>
  )
}

function SpecHeadline({ data }: { data: ExtractedWatchData }) {
  const parts = [
    data.movement,
    data.caseSizeMm ? `${data.caseSizeMm}mm` : null,
    data.dialColor,
  ].filter((p): p is string => Boolean(p))
  if (parts.length === 0) return null
  return <p className="text-sm text-muted-foreground">{parts.join(' • ')}</p>
}
