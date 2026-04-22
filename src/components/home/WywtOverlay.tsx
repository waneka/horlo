'use client'

import { useEffect } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { WywtSlide } from '@/components/home/WywtSlide'
import type { WywtTile } from '@/lib/wywtTypes'

/**
 * WYWT overlay (CONTEXT.md W-05, UI-SPEC § Component Inventory → WearOverlay).
 *
 * Mobile: full-bleed (`inset-0`). Desktop: centered modal
 * (`md:inset-8 md:max-w-md md:mx-auto`). Swipe between slides via
 * embla-carousel-react (RESEARCH.md Standard Stack). Respects
 * `prefers-reduced-motion` by dropping embla's duration to 0ms.
 *
 * On embla `'select'`, marks the newly active tile's wearEventId as viewed
 * via the `onViewed` callback (the parent rail's `markViewed`).
 *
 * Note: base-ui's DialogContent positioning classes (`top-1/2 left-1/2
 * -translate-*`) are overridden here with `!fixed !inset-0 !translate-x-0
 * !translate-y-0 !top-0 !left-0` on mobile so the overlay is truly full-bleed.
 * Using important-modifiers keeps the shadcn primitive intact for every other
 * dialog call site.
 */

// Respects `prefers-reduced-motion` — lifted out so it's easy to stub in
// tests and to re-use if we add more animated components.
function getEmblaDuration(): number {
  if (typeof window === 'undefined') return 25
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 25
  } catch {
    return 25
  }
}

interface Props {
  tiles: WywtTile[]
  initialIndex: number
  open: boolean
  onOpenChange: (v: boolean) => void
  onViewed: (wearEventId: string) => void
  viewerId: string
}

export function WywtOverlay({
  tiles,
  initialIndex,
  open,
  onOpenChange,
  onViewed,
}: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    startIndex: Math.max(0, Math.min(initialIndex, tiles.length - 1)),
    align: 'start',
    containScroll: false,
    duration: getEmblaDuration(),
  })

  useEffect(() => {
    if (!emblaApi) return
    const handleSelect = () => {
      const i = emblaApi.selectedScrollSnap()
      const tile = tiles[i]
      if (tile) onViewed(tile.wearEventId)
    }
    emblaApi.on('select', handleSelect)
    // Fire once so the initial tile (which the rail already marked viewed
    // on tap) is idempotently re-marked by the overlay as well.
    handleSelect()
    return () => {
      emblaApi.off('select', handleSelect)
    }
  }, [emblaApi, tiles, onViewed])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !max-w-none !rounded-none !p-0 md:!inset-8 md:!top-8 md:!left-1/2 md:!-translate-x-1/2 md:!translate-y-0 md:!max-w-md md:!mx-auto md:!rounded-lg bg-background"
      >
        <DialogTitle className="sr-only">Wear viewer</DialogTitle>

        <button
          type="button"
          aria-label="Close wear viewer"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-20 size-11 flex items-center justify-center rounded-full bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" aria-hidden />
        </button>

        <button
          type="button"
          aria-label="Previous wear"
          onClick={() => emblaApi?.scrollPrev()}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 size-11 items-center justify-center rounded-full bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>

        <button
          type="button"
          aria-label="Next wear"
          onClick={() => emblaApi?.scrollNext()}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 size-11 items-center justify-center rounded-full bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>

        <div className="overflow-hidden h-full" ref={emblaRef}>
          <div className="flex h-full">
            {tiles.map((tile) => (
              <div
                key={tile.wearEventId}
                className="flex-[0_0_100%] min-w-0 h-full"
              >
                <WywtSlide tile={tile} />
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
