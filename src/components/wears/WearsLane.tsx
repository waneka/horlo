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

// Minimum horizontal drag distance (px) required to trigger a cross-user swipe.
// Below this threshold a tap or minor slide at the boundary is ignored.
const CROSS_USER_THRESHOLD_PX = 50

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
 * (D-10/D-11). Close affordance: top-right X → router.back().
 *
 * Full-screen on mobile (fixed inset-0 h-dvh overflow-hidden), centered
 * 600px column on desktop (md:relative md:inset-auto md:h-auto md:overflow-visible)
 * per UI-SPEC §7 and §Route-Specific Layout Contracts (SC-2).
 *
 * Cross-user swipe (D-06): when the user is at the first or last slide and
 * releases a pointer drag that exceeds CROSS_USER_THRESHOLD_PX, the component
 * navigates to the previous or next user's lane via router.replace (so the
 * previous lane is replaced in history, not stacked — one close → home).
 * Guarded: no nav when railIndex === -1, no neighbor exists, commentOpen is
 * true, or the navigated single-flight ref is set.
 *
 * Detection strategy (replaces 'settle'-based approach):
 *   Cross-user intent is detected at pointerup on the window, not in the
 *   embla 'settle' event. This avoids: (a) spurious settles from reInit
 *   (comment-sheet open/close), (b) 'settle' never firing for single-wear
 *   lanes that have nothing to scroll, (c) the race between embla snap-back
 *   and navigation. The pointerup handler checks: at boundary slide + correct
 *   swipe direction + drag distance > threshold → navigate immediately.
 *
 * Instagram-stories landing rule (R3 fix — W1 stuck-state):
 *   - Forward cross → next user's FIRST slide (slide 0). No hint needed; page.tsx
 *     defaults initialSlideIndex=0.
 *   - Backward cross → previous user's LAST slide. goToNeighbor('prev') appends
 *     ?at=last so page.tsx sets initialSlideIndex=wears.length-1. Without this,
 *     a backward-crossed lane always opened at slide 0. For multi-wear users
 *     that meant the forward-cross condition (isLast) was never met on re-entry,
 *     locking cross-user nav after the first A→B→A round trip.
 *
 * W1 fix: page.tsx keys this component by username (`key={username}`) so that
 * navigating to a different user's lane via router.replace (same dynamic
 * route segment) triggers a full remount — resetting navigated.current and
 * the embla instance. Without the key, the App Router reuses the same
 * instance, leaving navigated.current=true (cross-user nav locked) and embla
 * carrying stale slide state from the previous user.
 *
 * R4 fix: navigated.current is also explicitly reset to false at the START of
 * each onPointerDown gesture. This defends against Next.js 16's Router Cache
 * restoring a stale WearsLane instance (with navigated.current=true) when
 * router.replace navigates back to an already-cached /wears/<user> URL —
 * defeating the key={username} remount. The reset at pointerdown re-arms the
 * guard for every new gesture, regardless of whether the instance was remounted
 * or cache-restored. The single-flight guard (navigated.current=true) still
 * prevents double-fire within a single gesture because it is set in goToNeighbor
 * before the router.replace call and is only cleared on the next pointerdown.
 */
export function WearsLane({ slides, initialSlideIndex, viewerId, railUsernames, railIndex }: WearsLaneProps) {
  const router = useRouter()
  const { markViewed } = useViewedWears()
  const [commentOpen, setCommentOpen] = useState(false)
  // #3: progress indicator — tracks selected slide index (driven by embla 'select' event)
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, Math.min(initialSlideIndex, slides.length - 1))
  )

  // R4 DEBUG BADGE: pointer-down/up counters rendered in the on-screen badge.
  // These are refs incremented in handlers, with state mirrors that trigger re-render.
  // REMOVE THIS BLOCK next round once the stuck-state is confirmed fixed.
  const pointerDownCountRef = useRef(0)
  const pointerUpCountRef = useRef(0)
  const [debugPd, setDebugPd] = useState(0)
  const [debugPu, setDebugPu] = useState(0)

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
  // Named helper so BOTH the pointer-release boundary effect AND the desktop arrow buttons
  // can invoke cross-user navigation without duplicating railUsernames/railIndex math.
  //
  // Guards honored by goToNeighbor:
  //   - railIndex === -1 (not in rail): no-op
  //   - commentOpen === true (sheet open): no-op
  //   - navigated.current === true (single-flight): no-op
  //   - no neighbor in direction: no-op
  //
  // Uses router.replace (not router.push) so the previous user's lane is replaced
  // in history rather than stacked — one close tap → home (H2 fix).
  //
  // Landing rule (R3 fix):
  //   - 'next': no hint → page.tsx defaults to slide 0 (first). Correct for IG-stories.
  //   - 'prev': appends ?at=last → page.tsx sets initialSlideIndex=wears.length-1 (last).
  //     Without this, backward-crossed multi-wear lanes opened at slide 0, so the
  //     forward-cross condition (isLast) was never met on re-entry → stuck.
  //
  // R4 fix: navigated.current is reset to false at the START of each onPointerDown
  // (see Effect A below). This defends against Next.js 16 Router Cache restoring a
  // stale instance with navigated.current=true on a revisited /wears/<user> URL,
  // which would defeat the key={username} remount and lock cross-user nav on the 3rd hop.
  // The single-flight guard still works: navigated is set true in goToNeighbor before
  // router.replace, and cleared on the next gesture's pointerdown.
  const navigated = useRef(false)

  // Defensive mount reset (R4 belt-and-suspenders): in case the Router Cache restores
  // this instance without triggering a React remount, reset navigated on mount so the
  // component always starts fresh regardless of prior cached state.
  useEffect(() => {
    navigated.current = false
  }, [])

  const goToNeighbor = (direction: 'next' | 'prev') => {
    if (railIndex === -1) return
    if (commentOpen) return
    if (navigated.current) return
    if (direction === 'next') {
      const nextUsername = railUsernames[railIndex + 1]
      if (!nextUsername) return
      navigated.current = true
      // Forward: land at first slide (default; no hint needed).
      router.replace(`/wears/${nextUsername}`)
    } else {
      const prevUsername = railUsernames[railIndex - 1]
      if (!prevUsername) return
      navigated.current = true
      // Backward: land at last slide so forward-cross is immediately available.
      router.replace(`/wears/${prevUsername}?at=last`)
    }
  }

  // Cross-user boundary detection via pointer events (H1 fix).
  //
  // Strategy: detect gesture intent at pointerup rather than in embla's 'settle'
  // event. This avoids spurious cross-user navigations caused by:
  //   (a) emblaApi.reInit() (comment-sheet open/close) firing 'settle' while
  //       dragDeltaX.current is non-null from a prior drag
  //   (b) 'settle' never firing for single-wear lanes (nothing to scroll — the
  //       carousel is already settled, so over-dragging snaps back silently)
  //   (c) Keyboard / programmatic scrolls that fire 'settle' without a gesture
  //
  // Two effects, same rationale as before:
  //   Effect A — pointer tracking (stable deps: emblaApi, railIndex).
  //     Attaches pointerdown to the embla root (tracks drag origin inside the
  //     carousel). Attaches pointerup to window (captures fast drags that end
  //     outside the viewport — WR-01). At pointerup, immediately evaluates the
  //     cross-user boundary condition and calls goToNeighbor if met.
  //   Effect B — exposes current goToNeighbor guard state to Effect A's closure
  //     via a ref, so Effect A never needs to re-register when commentOpen or
  //     router changes (avoids tearing down listeners mid-drag — CR-01).
  //
  // Boundary condition checked at pointerup:
  //   - At last slide AND user swiped left (delta < -CROSS_USER_THRESHOLD_PX) → next user
  //   - At first slide AND user swiped right (delta > CROSS_USER_THRESHOLD_PX) → prev user
  //
  // Note: canScrollNext/canScrollPrev is NOT used here. containScroll:false means
  // embla does not block drags at boundaries — the slide position check
  // (isFirst / isLast) is the correct boundary signal. canScroll* reflects
  // whether additional snaps exist, which is equivalent for multi-slide lanes but
  // identical to the position check for single-slide lanes (both isFirst AND
  // isLast are true simultaneously there — position check handles both correctly).

  const pointerDownX = useRef<number | null>(null)

  // Stable ref to the current goToNeighbor guard state — lets Effect A call
  // goToNeighbor without being in its deps array (avoids listener re-registration
  // on commentOpen / router change mid-drag).
  const goToNeighborRef = useRef(goToNeighbor)
  useEffect(() => {
    goToNeighborRef.current = goToNeighbor
    // goToNeighbor is re-created each render (inline function) — update the ref
    // whenever the component re-renders so Effect A always calls the latest version.
    // Intentionally no deps array: always sync the ref.
  })

  // Effect A: pointer tracking + boundary detection at pointerup.
  //
  // Deps: [emblaApi, railIndex] — stable. commentOpen and router are accessed
  // via goToNeighborRef, not captured in this effect's closure.
  //
  // R4 fix: onPointerDown now resets navigated.current=false before recording the
  // drag origin. This re-arms the single-flight guard on every fresh gesture,
  // defending against the Router-Cache-restore case where a stale instance is
  // returned with navigated.current=true (3rd-hop symmetric stuck state).
  useEffect(() => {
    if (!emblaApi) return
    // Guard: actor not in the rail — no cross-user pointer tracking needed.
    if (railIndex === -1) return

    const root = emblaApi.rootNode()

    const onPointerDown = (e: PointerEvent) => {
      // R4 fix: reset the single-flight guard at the start of every gesture.
      // This is the primary defense against Router-Cache-restore returning a stale
      // instance with navigated.current=true. A fresh pointerdown always fires even
      // on a cache-restored instance, so this reset is unconditional and robust.
      navigated.current = false
      pointerDownX.current = e.clientX

      // R4 DEBUG BADGE: increment counter + trigger re-render for badge display.
      // REMOVE next round once stuck-state is confirmed fixed.
      pointerDownCountRef.current += 1
      setDebugPd(pointerDownCountRef.current)
    }

    const onPointerUp = (e: PointerEvent) => {
      // R4 DEBUG BADGE: increment counter + trigger re-render.
      // REMOVE next round once stuck-state is confirmed fixed.
      pointerUpCountRef.current += 1
      setDebugPu(pointerUpCountRef.current)

      if (pointerDownX.current === null) return
      const delta = e.clientX - pointerDownX.current
      pointerDownX.current = null

      if (!emblaApi) return
      const snapList = emblaApi.scrollSnapList()
      const current = emblaApi.selectedScrollSnap()
      const isLast = current === snapList.length - 1
      const isFirst = current === 0

      // Forward intent: swiped left past threshold at last slide → next user.
      if (isLast && delta < -CROSS_USER_THRESHOLD_PX) {
        goToNeighborRef.current('next')
        return
      }
      // Backward intent: swiped right past threshold at first slide → prev user.
      if (isFirst && delta > CROSS_USER_THRESHOLD_PX) {
        goToNeighborRef.current('prev')
      }
    }

    root.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      root.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [emblaApi, railIndex])

  // #3/#6: derived values for progress segments and arrow visibility.
  const hasNextUser = railIndex !== -1 && !!railUsernames[railIndex + 1]
  const hasPrevUser = railIndex !== -1 && !!railUsernames[railIndex - 1]
  const isLastSegment = selectedIndex === slides.length - 1
  const isFirstSegment = selectedIndex === 0

  // R4 DEBUG BADGE: derive snap info for display. Only safe to read when emblaApi is available.
  const snapCount = emblaApi ? emblaApi.scrollSnapList().length : slides.length

  return (
    // Outer container: positional anchor for the close button and progress bar.
    // Mobile: fixed inset-0 h-dvh overflow-hidden (full-screen, no nav chrome).
    // Desktop (md+): relative (preserves positioning context for absolute children),
    // auto height, centered 600px column. md:static would break absolute positioning.
    <div className="fixed inset-0 h-dvh overflow-hidden md:relative md:inset-auto md:h-auto md:overflow-visible">

      {/* #3: Top segmented progress indicator.
          Absolutely positioned over the outer container (above photo scrims at z-10).
          Full-width with horizontal padding; pointer-events-none so swipes pass through.
          The X close button overlays at the right end via absolute positioning.
          Desktop: constrained to the 600px column via max-w + mx-auto.
          W2 fix: ChevronRight boundary-hint caret removed (isLastSegment/hasNextUser
          consts retained — still used by arrow visibility conditions below). */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-1 px-3 pt-3 pointer-events-none md:max-w-[600px] md:mx-auto">
        {slides.map((_, i) => (
          <div
            key={i}
            className={
              'h-[3px] flex-1 rounded-full transition-opacity duration-200 ' +
              (i === selectedIndex
                ? 'bg-white opacity-90 md:bg-foreground md:opacity-70'
                : 'bg-white opacity-30 md:bg-foreground md:opacity-20')
            }
          />
        ))}
      </div>

      {/* #4: Close affordance — top-RIGHT.
          Sits in the top band above the centered 4:5 photo.
          On desktop: dark foreground icon for contrast on light background.
          Kept outside embla's pointer-listener tree to avoid swipe-vs-click races. */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => router.back()}
        className="absolute top-3 right-3 z-30 min-h-[44px] min-w-[44px] flex items-center justify-center text-white md:text-foreground"
      >
        <X className="size-5" aria-hidden />
      </button>

      {/*
       * W3 fix: Photo column wrapper — relative positioned so desktop arrow
       * buttons anchor to the 600px photo column edges, not the full-width
       * outer container. Must NOT be overflow-hidden (the embla viewport keeps
       * its own overflow-hidden). Mobile: full-height passthrough (h-full).
       * Desktop: centers the 600px column; arrows positioned left-0/right-0
       * of this wrapper sit at the photo column edges, not the viewport edges.
       */}
      <div className="relative h-full md:max-w-[600px] md:mx-auto">

        {/* Embla viewport — emblaRef applied here only, not on any wrapper */}
        <div
          ref={emblaRef}
          className="h-full overflow-hidden bg-background"
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
            Anchored to the photo-column wrapper (W3 fix): left-0/right-0 of the
            600px column, not the full-width outer container.
            Vertically centered via absolute top-1/2 -translate-y-1/2.
            Semi-transparent dark circle provides contrast on the light desktop background. */}

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
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] items-center justify-center text-foreground bg-background/70 rounded-full shadow"
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
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] items-center justify-center text-foreground bg-background/70 rounded-full shadow"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        )}

      </div>

      {/* R4 DEBUG BADGE — TEMPORARY. Remove next round once stuck-state is confirmed fixed.
          Fixed bottom-left, high z, pointer-events-none so it does not interfere with swipes.
          Low opacity so it does not obscure content. Shows live state for on-phone triage:
            nav  = navigated.current (true = guard armed; should be false when stuck if R4 fix works)
            pd   = total pointerdown count (should increment on every swipe attempt)
            pu   = total pointerup count (should increment on every swipe release)
            i    = selectedIndex / snapCount-1 (current slide / last slide index)
            last = isLastSegment (true = at last slide; forward-cross requires this)
            1st  = isFirstSegment (true = at first slide; backward-cross requires this)
            rIdx = railIndex (-1 = not in rail)
            nxt  = hasNextUser (true = a next rail user exists)
            prv  = hasPrevUser (true = a prev rail user exists)
          Tiebreaker logic:
            - If stuck AND nav=true → R4 fix incomplete (navigated not being reset in time)
            - If stuck AND pu does NOT increment on swipe → pointer listeners dropped on cache-restore
            - If stuck AND last=false when expecting to be at boundary → still a position issue */}
      <div
        className="fixed bottom-4 left-2 z-50 pointer-events-none opacity-60 text-[10px] leading-tight font-mono bg-black/70 text-white rounded px-1.5 py-1"
        aria-hidden
      >
        <div>nav={String(navigated.current)}</div>
        <div>pd={debugPd} pu={debugPu}</div>
        <div>i={selectedIndex}/{snapCount - 1}</div>
        <div>last={String(isLastSegment)} 1st={String(isFirstSegment)}</div>
        <div>rIdx={railIndex}</div>
        <div>nxt={String(hasNextUser)} prv={String(hasPrevUser)}</div>
      </div>
    </div>
  )
}
