'use client'

import { useEffect, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
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
  // #3: progress indicator — tracks selected slide index (driven by embla 'select' event)
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, Math.min(initialSlideIndex, slides.length - 1))
  )

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

  // onSelect → markViewed (mirrors WywtOverlay.tsx lines 69-83) + update progress indicator.
  // Single select handler — do NOT add a second 'select' listener for selectedIndex.
  useEffect(() => {
    if (!emblaApi) return
    const handleSelect = () => {
      const i = emblaApi.selectedScrollSnap()
      setSelectedIndex(i)
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

  // D-06 + #6: cross-user boundary navigation.
  //
  // Named helper so BOTH the swipe-boundary settle effect AND the desktop arrow buttons
  // can invoke cross-user navigation without duplicating railUsernames/railIndex math.
  //
  // Guards honored by goToNeighbor:
  //   - railIndex === -1 (not in rail): no-op
  //   - commentOpen === true (sheet open): no-op
  //   - navigated.current === true (single-flight): no-op
  //   - no neighbor in direction: no-op
  const navigated = useRef(false)

  const goToNeighbor = (direction: 'next' | 'prev') => {
    if (railIndex === -1) return
    if (commentOpen) return
    if (navigated.current) return
    if (direction === 'next') {
      const nextUsername = railUsernames[railIndex + 1]
      if (!nextUsername) return
      navigated.current = true
      router.push(`/wears/${nextUsername}`)
    } else {
      const prevUsername = railUsernames[railIndex - 1]
      if (!prevUsername) return
      navigated.current = true
      router.push(`/wears/${prevUsername}`)
    }
  }

  // Detection strategy: embla with containScroll:false allows over-drag at the
  // boundary slide, but snaps back. We detect forward/backward intent by comparing
  // pointerdown X to pointerup X. On 'settle', if the user dragged past the
  // boundary AND canScrollNext/canScrollPrev is false, call goToNeighbor.
  //
  // dragDeltaX stores (pointerUpX - pointerDownX) after pointerup fires:
  //   negative delta = swiped left = forward intent (toward next user)
  //   positive delta = swiped right = backward intent (toward prev user)
  const pointerDownX = useRef<number | null>(null)
  const dragDeltaX = useRef<number | null>(null)

  // Effect A: pointer tracking only.
  //
  // Deps: [emblaApi, railIndex] — deliberately excludes commentOpen, router,
  // and railUsernames. This prevents the effect from tearing down and
  // re-registering pointer listeners mid-drag when the comment sheet opens or
  // closes, which would reset dragDeltaX.current and silently swallow a
  // cross-user swipe gesture (CR-01).
  //
  // onPointerDown attaches to the embla root (we only start tracking when the
  // drag begins inside the carousel). onPointerUp attaches to window so a drag
  // that ends outside the embla viewport (common on desktop fast drags) still
  // records dragDeltaX (WR-01).
  useEffect(() => {
    if (!emblaApi) return
    // Guard: actor not in the rail — no pointer tracking needed.
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

    root.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      root.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [emblaApi, railIndex])

  // Effect B: settle handler.
  //
  // Re-registers when commentOpen/router/railUsernames/railIndex change so that
  // onSettle always closes over the freshest navigation state. Pointer tracking
  // is in a separate effect (Effect A above) and is NOT torn down when these
  // deps change — dragDeltaX.current is therefore stable across
  // comment-sheet open/close cycles.
  useEffect(() => {
    if (!emblaApi) return
    // Guard: actor not in the rail — disable cross-user navigation entirely.
    if (railIndex === -1) return

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
        goToNeighbor('next')
      } else if (isFirst && !emblaApi.canScrollPrev()) {
        // First slide, no prev snap. Proceed only if the user swiped right (backward intent).
        if (delta <= 0) return // Swiped left or no movement — don't cross backward
        goToNeighbor('prev')
      }
    }

    emblaApi.on('settle', onSettle)

    return () => {
      emblaApi.off('settle', onSettle)
    }
    // goToNeighbor is intentionally omitted from deps: it is a stable inline function
    // that closes over railUsernames, railIndex, commentOpen, and router — all of which
    // ARE in this effect's deps array. Including the function object itself would cause
    // unnecessary re-registrations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emblaApi, railUsernames, railIndex, commentOpen, router])

  // #3/#6: derived values for progress segments and arrow visibility.
  const hasNextUser = railIndex !== -1 && !!railUsernames[railIndex + 1]
  const hasPrevUser = railIndex !== -1 && !!railUsernames[railIndex - 1]
  const isLastSegment = selectedIndex === slides.length - 1
  const isFirstSegment = selectedIndex === 0

  return (
    // Outer container: positional anchor for the close button and arrow buttons.
    // Mobile: fixed inset-0 h-dvh overflow-hidden (full-screen, no nav chrome).
    // Desktop (md+): static, auto height, centered 600px column.
    <div className="fixed inset-0 h-dvh overflow-hidden md:static md:inset-auto md:h-auto md:overflow-visible">

      {/* #3: Top segmented progress indicator.
          Absolutely positioned over the outer container (above photo scrims at z-10).
          Full-width with horizontal padding; pointer-events-none so swipes pass through.
          The X close button overlays at the right end via absolute positioning. */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-1 px-3 pt-3 pointer-events-none md:max-w-[600px] md:mx-auto">
        {slides.map((_, i) => (
          <div
            key={i}
            className={
              'h-[3px] flex-1 rounded-full transition-opacity duration-200 ' +
              (i === selectedIndex ? 'bg-white opacity-90' : 'bg-white opacity-30')
            }
          />
        ))}
        {/* Cross-user boundary hint: subtle chevron at the trailing end of the segment
            row when on the last segment and a next rail user exists.
            text-white at low opacity; no accent color; non-interactive (pointer-events-none). */}
        {isLastSegment && hasNextUser && (
          <ChevronRight className="size-3 text-white opacity-40 shrink-0" aria-hidden />
        )}
      </div>

      {/* #4: Close affordance — repositioned from top-left to top-RIGHT.
          Sits in the top band above the centered 4:5 photo (the empty band created by
          justify-center). The WearCard's own overflow menu (also top-3 right-3) is
          anchored to the WearCard's relative container, which sits vertically centered
          lower in the slide — no visual collision.
          Kept outside embla's pointer-listener tree to avoid swipe-vs-click races. */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => router.back()}
        className="absolute top-3 right-3 z-30 min-h-[44px] min-w-[44px] flex items-center justify-center text-white"
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

      {/* #6: Desktop-only prev/next edge arrows — hidden on mobile (swipe-only).
          Vertically centered on the photo using absolute positioning.
          Reuse goToNeighbor for cross-user nav at the first/last slide boundary. */}

      {/* Left arrow — shown when not at first slide OR when a previous rail user exists */}
      {(!isFirstSegment || hasPrevUser) && (
        <button
          type="button"
          aria-label="Previous wear"
          onClick={() => {
            if (!emblaApi) return
            if (emblaApi.canScrollPrev()) {
              emblaApi.scrollPrev()
            } else {
              goToNeighbor('prev')
            }
          }}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] items-center justify-center text-white"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      )}

      {/* Right arrow — shown when not at last slide OR when a next rail user exists */}
      {(!isLastSegment || hasNextUser) && (
        <button
          type="button"
          aria-label="Next wear"
          onClick={() => {
            if (!emblaApi) return
            if (emblaApi.canScrollNext()) {
              emblaApi.scrollNext()
            } else {
              goToNeighbor('next')
            }
          }}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] items-center justify-center text-white"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      )}
    </div>
  )
}
