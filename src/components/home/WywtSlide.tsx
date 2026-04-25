'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Watch as WatchIcon } from 'lucide-react'

import { timeAgo } from '@/lib/timeAgo'
import { Button } from '@/components/ui/button'
import { addToWishlistFromWearEvent } from '@/app/actions/wishlist'
import type { WywtTile } from '@/lib/wywtTypes'

/**
 * One slide inside the WYWT overlay (UI-SPEC § Component Inventory →
 * WearOverlay, CONTEXT.md W-05).
 *
 *   [full-bleed watch photo]
 *   {username} · {time ago}    {brand} {model} → /watch/{watchId}
 *   [optional note block]
 *   [Add to wishlist] / [Added to wishlist.] / [Retry]
 *
 * The action is Zod-validated server-side (Plan 03). On failure the button
 * swaps to a "Retry" affordance rather than a toast because the overlay owns
 * the focus trap — staying in-component keeps the retry one tap away.
 */
export function WywtSlide({ tile }: { tile: WywtTile }) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'added' | 'error'>('idle')

  const handleAddToWishlist = () => {
    // WR-03 double-submit guard: block when a request is already in flight
    // (pending) OR when the previous attempt already succeeded (status=added).
    // Without the `status === 'added'` check a second tap on an already-added
    // slide — reachable e.g. via a fast keyboard Enter — would dispatch a
    // second action and create a duplicate watches row. `useTransition` only
    // covers the in-flight case; success is a persistent latched state.
    if (pending || status === 'added') return
    setStatus('idle')
    startTransition(async () => {
      const result = await addToWishlistFromWearEvent({
        wearEventId: tile.wearEventId,
      })
      setStatus(result.success ? 'added' : 'error')
    })
  }

  return (
    <div className="relative h-full flex flex-col bg-background">
      <div className="relative flex-1 bg-muted">
        {/* Phase 15 UAT: prefer the user's wrist-shot wear photo (signed
            URL, minted per-request in src/app/page.tsx) over the watch
            catalog imageUrl. Falls back to catalog when photo_url is null. */}
        {(tile.photoUrl ?? tile.imageUrl) ? (
          <Image
            src={tile.photoUrl ?? tile.imageUrl ?? ''}
            alt={`${tile.brand} ${tile.model}`}
            fill
            className="object-contain"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <WatchIcon className="size-12 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {tile.username}
            </p>
            <p className="text-sm text-muted-foreground">
              {timeAgo(`${tile.wornDate}T00:00:00Z`)}
            </p>
          </div>
          <Link
            href={`/watch/${tile.watchId}`}
            className="font-serif text-lg text-foreground hover:underline"
          >
            {tile.brand} {tile.model}
          </Link>
        </div>

        {tile.note && (
          <p className="text-sm text-foreground bg-muted p-3 rounded-md">
            {tile.note}
          </p>
        )}

        {status === 'added' ? (
          <p className="text-sm text-muted-foreground">Added to wishlist.</p>
        ) : status === 'error' ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              Couldn&apos;t save to wishlist.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddToWishlist}
              disabled={pending}
            >
              Retry
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleAddToWishlist}
            disabled={pending}
          >
            {pending ? 'Saving…' : 'Add to wishlist'}
          </Button>
        )}
      </div>
    </div>
  )
}
