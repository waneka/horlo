'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { addWatch } from '@/app/actions/watches'
import type { MovementType, StrapType, CrystalType } from '@/lib/types'

/**
 * Phase 20.1 D-05 — 3-button row on /catalog/[catalogId] in cross-user framing.
 *
 * Rendered ONLY when:
 *   - verdict.framing !== 'self-via-cross-user' (existing 'You own this' UI stays)
 *   - viewer collection has > 0 watches (no verdict means no actionable context)
 *
 * The page Server Component decides whether to render this component. Once
 * mounted, the component is responsible for the 3 click handlers:
 *   - Add to Wishlist → addWatch (status='wishlist') + toast + router.refresh (Pitfall 3)
 *   - Add to Collection → router.push('/watch/new?catalogId=X&intent=owned')
 *     (NOT inline addWatch — Plan 04 page reads searchParams + advances to form-prefill)
 *   - Skip → router.back() (D-05 — no paste field to reset on this surface)
 *
 * Props are the catalog row's identity + spec fields (NOT the full row to keep
 * the client bundle small). The page passes catalogId + a CatalogActionsSpec
 * object built from the catalog entry.
 *
 * Pitfall 6: NEVER set photoSourcePath from /catalog surface.
 */
export interface CatalogActionsSpec {
  brand: string
  model: string
  reference: string | null
  movement: MovementType | null
  caseSizeMm: number | null
  lugToLugMm: number | null
  waterResistanceM: number | null
  strapType: StrapType | null
  crystalType: CrystalType | null
  dialColor: string | null
  isChronometer: boolean | null
  complications: string[]
  styleTags: string[]
  designTraits: string[]
  imageUrl: string | null
}

interface CatalogPageActionsProps {
  catalogId: string
  spec: CatalogActionsSpec
  framing: 'cross-user' | 'same-user'
  /** Phase 28 D-02 — viewer's profile username for the View toast destination.
   *  Null is a soft alarm — toast body still fires but action slot is omitted. */
  viewerUsername: string | null
}

export function CatalogPageActions({
  catalogId,
  spec,
  framing,
  viewerUsername,
}: CatalogPageActionsProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [pendingTarget, setPendingTarget] = useState<'wishlist' | 'collection' | 'skip' | null>(null)
  const [, startTransition] = useTransition()

  const handleWishlist = () => {
    if (pending) return
    setPending(true)
    setPendingTarget('wishlist')
    startTransition(async () => {
      // Pitfall 6: NEVER set photoSourcePath from /catalog surface.
      const payload = {
        brand: spec.brand,
        model: spec.model,
        reference: spec.reference ?? undefined,
        status: 'wishlist' as const,
        movement: spec.movement ?? 'automatic',
        complications: spec.complications,
        caseSizeMm: spec.caseSizeMm ?? undefined,
        lugToLugMm: spec.lugToLugMm ?? undefined,
        waterResistanceM: spec.waterResistanceM ?? undefined,
        strapType: spec.strapType ?? undefined,
        crystalType: spec.crystalType ?? undefined,
        dialColor: spec.dialColor ?? undefined,
        styleTags: spec.styleTags,
        designTraits: spec.designTraits,
        roleTags: [],
        isChronometer: spec.isChronometer ?? undefined,
        imageUrl: spec.imageUrl ?? undefined,
      }
      const result = await addWatch(payload)
      if (result.success) {
        // Phase 28 D-01/D-02/D-03 — Sonner action-slot toast.
        // D-05 row 6: this surface stays on /catalog/[id] after commit, so
        // the post-commit page never equals /u/{viewerUsername}/wishlist;
        // toast ALWAYS fires here. When viewerUsername is null (soft alarm),
        // the body still renders but the action slot is omitted.
        if (viewerUsername) {
          toast.success('Saved to your wishlist', {
            action: {
              label: 'View',
              onClick: () => router.push(`/u/${viewerUsername}/wishlist`),
            },
          })
        } else {
          toast.success('Saved to your wishlist')
        }
        // Pitfall 3: refresh so the page re-renders with viewerOwnedRow detection
        // (now that the wishlist row exists, the framing might switch on next visit).
        router.refresh()
      } else {
        toast.error(result.error)
      }
      setPending(false)
      setPendingTarget(null)
    })
  }

  const handleCollection = () => {
    // D-05 + D-12: navigate to prefilled form (Plan 04 page handles the deep link).
    router.push(`/watch/new?catalogId=${encodeURIComponent(catalogId)}&intent=owned`)
  }

  const handleSkip = () => {
    // D-05: Skip on /catalog navigates back (no paste field to reset on this surface).
    router.back()
  }

  // framing prop kept for parity with the page's verdict — currently unused
  // for visual differences. Reserved for future variant. Mark as referenced
  // to satisfy TS noUnusedLocals.
  void framing

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-3" aria-live="polite">
      <Button
        type="button"
        onClick={handleWishlist}
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
        onClick={handleCollection}
        disabled={pending}
        className="w-full sm:w-auto sm:flex-1"
        aria-label="Add to Collection"
      >
        Add to Collection
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={handleSkip}
        disabled={pending}
        className="w-full sm:w-auto"
        aria-label="Skip"
      >
        Skip
      </Button>
    </div>
  )
}
