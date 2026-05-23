'use client'

import { useEffect, useRef, useState } from 'react'
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
  /** The ordered list of usernames in the home rail (D-06). Server-derived; never from URL. */
  railUsernames: string[]
  /** The index of the current actor within railUsernames; -1 if not in the rail (manual URL). */
  railIndex: number
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
 *
 * Cross-user swipe (D-06): when the user reaches the first or last slide and
 * attempts to continue swiping, the component navigates to the previous or next
 * user's lane. Guarded: no nav when railIndex === -1, no neighbor exists, or
 * commentOpen is true.
 */
export function WearsLane({ slides, initialSlideIndex, viewerId, railUsernames, railIndex }: WearsLaneProps) {
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

  // D-06: cross-user boundary navigation.
  //
  // Detection strategy: embla with containScroll:false allows over-drag at the
  // boundary slide, but snaps back. We detect forward/backward intent by comparing
  // pointerdown X to pointerup X. On 'settle', if the user dragged past the
  // boundary AND canScrollNext/canScrollPrev is false, push to the neighbor lane.
  //
  // dragDeltaX stores (pointerUpX - pointerDownX) after pointerup fires:
  //   negative delta = swiped left = forward intent (toward next user)
  //   positive delta = swiped right = backward intent (toward prev user)
  //
  // Single-flight: `navigated` ref prevents a second router.push until remount.
  // Guards: railIndex === -1 (not in rail), no neighbor in requested direction,
  //         commentOpen === true (sheet is open — never navigate while sheet is open).
  const navigated = useRef(false)
  const pointerDownX = useRef<number | null>(null)
  const dragDeltaX = useRef<number | null>(null)

  useEffect(() => {
    if (!emblaApi) return
    // Guard: actor not in the rail — disable cross-user navigation entirely.
    if (railIndex === -1) return

    const root = emblaApi.rootNode()

    const onPointerDown = (e: PointerEvent) => {
      pointerDownX.current = e.clientX
      dragDeltaX.current = null
    }

    const onPointerUp = (e: PointerEvent) => {
      if (pointerDownX.current !== null) {
        dragDeltaX.current = e.clientX - pointerDownX.current
        pointerDownX.current = null
      }
    }

    const onSettle = () => {
      // Guard: sheet open — never navigate while the comment sheet is visible.
      if (commentOpen) return
      // Guard: already navigated — single-flight until remount.
      if (navigated.current) return

      const snapList = emblaApi.scrollSnapList()
      const current = emblaApi.selectedScrollSnap()
      const isLast = current === snapList.length - 1
      const isFirst = current === 0

      // Require a pointer-driven drag (not keyboard / programmatic scroll).
      if (dragDeltaX.current === null) return
      const delta = dragDeltaX.current
      dragDeltaX.current = null

      if (isLast && !emblaApi.canScrollNext()) {
        // Last slide, no next snap. Proceed only if the user swiped left (forward intent).
        if (delta >= 0) return // Swiped right or no movement — don't cross forward
        const nextUsername = railUsernames[railIndex + 1]
        if (!nextUsername) return // At the end of the rail — do nothing
        navigated.current = true
        // Forward cross: open next user's lane at its default (oldest-unviewed, D-05).
        router.push(`/wears/${nextUsername}`)
      } else if (isFirst && !emblaApi.canScrollPrev()) {
        // First slide, no prev snap. Proceed only if the user swiped right (backward intent).
        if (delta <= 0) return // Swiped left or no movement — don't cross backward
        const prevUsername = railUsernames[railIndex - 1]
        if (!prevUsername) return // At the start of the rail — do nothing
        navigated.current = true
        // Backward cross: open previous user's lane at its default.
        router.push(`/wears/${prevUsername}`)
      }
    }

    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('pointerup', onPointerUp)
    emblaApi.on('settle', onSettle)

    return () => {
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointerup', onPointerUp)
      emblaApi.off('settle', onSettle)
    }
  }, [emblaApi, railUsernames, railIndex, commentOpen, router])

  return (
    // Outer container: positional anchor for the close button.
    // Mobile: fixed inset-0 h-dvh overflow-hidden (full-screen, no nav chrome).
    // Desktop (md+): static, auto height, centered 600px column.
    <div className="fixed inset-0 h-dvh overflow-hidden md:static md:inset-auto md:h-auto md:overflow-visible">
      {/* Close affordance — sibling of the embla viewport, not inside it.
          Positioned absolute to this outer container (z-20 above scrims at z-10).
          Kept outside embla's pointer-listener tree to avoid swipe-vs-click races. */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => router.back()}
        className="absolute top-3 left-3 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center text-white"
      >
        <X className="size-5" aria-hidden />
      </button>

      {/* Embla viewport — emblaRef applied here only, not on the outer wrapper */}
      <div
        ref={emblaRef}
        className="h-full overflow-hidden bg-background md:max-w-[600px] md:mx-auto"
      >
        {/* Embla slide container */}
        <div className="flex h-full">
          {slides.map((slide) => (
            <div key={slide.wearEventId} className="flex-[0_0_100%] min-w-0 flex flex-col justify-center">
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
    </div>
  )
}
