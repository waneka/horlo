'use client'

import { useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { WearCard } from '@/components/wear/WearCard'
import { useViewedWears } from '@/hooks/useViewedWears'

// ---------------------------------------------------------------------------
// Types — canonical location; src/app/wears/[username]/page.tsx imports from here
// ---------------------------------------------------------------------------

/**
 * One slide's data passed from the server page to WearsLane.
 * Matches WearCardProps minus the fields the lane controls (viewerId,
 * commentHostVariant, onCommentOpenChange) plus wearEventId.
 */
export interface WearSlide {
  wearEventId: string
  signedUrl: string | null
  watchImageUrl: string | null
  altText: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  brand: string
  model: string
  watchId: string
  initialLiked: boolean
  initialCount: number
  showAddToWishlist: boolean
  permalinkUrl: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Respects `prefers-reduced-motion` — copied verbatim from WywtOverlay.tsx lines 35-44.
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WearsLaneProps {
  slides: WearSlide[]
  initialSlideIndex: number
  viewerId: string
}

/**
 * Stories lane carousel — one WearCard per slide, oldest-first (D-05).
 *
 * Drives embla-carousel-react with startIndex clamped to slides.length-1.
 * On comment sheet open, pauses swipe via emblaApi.reInit({ watchDrag: false })
 * (D-10/D-11). Close affordance: top-left X → router.back().
 *
 * Full-screen on mobile (fixed inset-0 h-dvh overflow-hidden), centered
 * 600px column on desktop (md:static md:inset-auto md:h-auto md:overflow-visible)
 * per UI-SPEC §7 and §Route-Specific Layout Contracts (SC-2).
 */
export function WearsLane({ slides, initialSlideIndex, viewerId }: WearsLaneProps) {
  const router = useRouter()
  const { markViewed } = useViewedWears()
  const [commentOpen, setCommentOpen] = useState(false)

  const [emblaRef, emblaApi] = useEmblaCarousel({
    startIndex: Math.max(0, Math.min(initialSlideIndex, slides.length - 1)),
    align: 'start',
    containScroll: false,
    duration: getEmblaDuration(),
  })

  // D-10/D-11: pause swipe when comment sheet is open; restore when closed.
  useEffect(() => {
    if (!emblaApi) return
    emblaApi.reInit({ watchDrag: !commentOpen })
  }, [emblaApi, commentOpen])

  // onSelect → markViewed: mirrors WywtOverlay.tsx lines 69-83.
  useEffect(() => {
    if (!emblaApi) return
    const handleSelect = () => {
      const i = emblaApi.selectedScrollSnap()
      const slide = slides[i]
      if (slide) markViewed(slide.wearEventId)
    }
    emblaApi.on('select', handleSelect)
    // Fire once for the initial slide.
    handleSelect()
    return () => {
      emblaApi.off('select', handleSelect)
    }
  }, [emblaApi, slides, markViewed])

  return (
    // Mobile: fixed inset-0 h-dvh overflow-hidden (full-screen, no nav chrome).
    // Desktop (md+): static, auto height, centered 600px column.
    <div
      ref={emblaRef}
      className="fixed inset-0 h-dvh overflow-hidden md:static md:inset-auto md:h-auto md:overflow-visible bg-background md:max-w-[600px] md:mx-auto"
    >
      {/* Close affordance — top-left X, z-20 above gradient scrims (z-10) */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => router.back()}
        className="absolute top-3 left-3 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center text-white"
      >
        <X className="size-5" aria-hidden />
      </button>

      {/* Embla slide container */}
      <div className="flex h-full">
        {slides.map((slide) => (
          <div key={slide.wearEventId} className="flex-[0_0_100%] min-w-0">
            <WearCard
              {...slide}
              viewerId={viewerId}
              commentHostVariant="bottom-sheet"
              onCommentOpenChange={setCommentOpen}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
