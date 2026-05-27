'use client'

// src/components/watch/WatchPhotoSection.tsx
//
// Phase 61 Plan 02 — Owner photo carousel + always-on filmstrip for WatchDetail.
//
// This is the central new component for PHOTO-02/03/05/06. It replaces the
// single <Image> block in WatchDetail (lines 128-143) with:
//   - embla-carousel-react viewport (one photo at a time, swipe on mobile)
//   - Always-on filmstrip (64×64 thumbnails, tap-to-jump, horizontal scroll)
//   - Edit toggle (owner only, viewerCanEdit gate)
//   - dnd-kit drag-reorder in edit mode (horizontalListSortingStrategy)
//   - PhotoDropzone for multi-file upload (edit mode, +Add tile)
//   - Catalog fallback slide when zero owner photos + catalogFallbackUrl
//   - WatchIcon placeholder when zero owner photos + no fallback
//
// Key decisions:
//   - D-01: Always-on filmstrip (no modal), Edit toggle on pointer interaction
//   - D-03: viewerCanEdit gates ALL owner controls (edit, +Add, ×, drag)
//   - D-04: horizontalListSortingStrategy (filmstrip is a single horizontal row)
//   - D-07: Cover badge on index [0] of optimisticIds, moves with drag
//   - D-08: Drag-to-first IS make-cover (no separate button)
//   - D-09: Catalog image as fallback single slide (no label)
//   - D-12/D-13: multiple file input + desktop drop zone
//   - D-14: 10-photo cap + batch-overflow rejection toast
//
// MEMORY project_router_cache_stale_instance: Edit toggle reset on onPointerDown
// (interaction), NOT mount — Next 16 restores the same stale client component
// instance on revisited /w/[ref] dynamic URLs.
//
// RESEARCH Pattern 4 / Pitfall 7: emblaApi.reInit({ draggable: !editMode }) on
// edit mode change so embla swipe is OFF during filmstrip drag.

import { useOptimistic, useTransition, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  DragOverlay,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import useEmblaCarousel from 'embla-carousel-react'
import Image from 'next/image'
import { Watch as WatchIcon, ChevronLeft, ChevronRight, Eye, EyeOff, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SortablePhotoThumb } from './SortablePhotoThumb'
import { PhotoDropzone } from './PhotoDropzone'
import { reorderWatchPhotosAction, deleteWatchPhotoAction } from '@/app/actions/watchPhotos'
import { hideWearPicAction, unhideWearPicAction } from '@/app/actions/wearEvents'
import { LikeButton } from '@/components/shared/LikeButton'
import { WearCommentHost } from '@/components/wear/WearCommentHost'
import type { CommentAuthor, CommentWithAuthor } from '@/components/comment/types'

export interface SignedPhoto {
  id: string
  signedUrl: string | null
  sortOrder: number
}

/**
 * Phase 62 Plan 04: Public wear pic slide — DISTINCT from SignedPhoto.
 * Carries wear-target social data (like/comment) + hide state for Edit mode.
 * Do NOT union with SignedPhoto — kept separate for type-narrowing.
 */
export interface SignedWearPic {
  wearEventId: string
  signedUrl: string | null
  wornDate: string        // ISO date 'YYYY-MM-DD' — format with UTC pin per D-07
  hiddenFromDetail: boolean  // needed to render greyed/Hidden state in Edit mode
  initialLikeState: { liked: boolean; count: number }
  commentCount: number
  initialComments: CommentWithAuthor[]  // pre-fetched by page RSC (Option A)
}

export interface WatchPhotoSectionProps {
  photos: SignedPhoto[]
  watchId: string
  catalogFallbackUrl: string | null
  brandModel: string
  viewerCanEdit?: boolean
  /** userId needed for client-direct upload (PhotoDropzone). Server passes down from RSC. */
  userId?: string
  /** Phase 62 Plan 04 WPIC-01: public wear pics (signed, with social data). Optional. */
  wearPics?: SignedWearPic[]
  /** Phase 62 Plan 04 WPIC-06: viewer identity for LikeButton + WearCommentHost. */
  viewerId?: string | null
  /** Phase 62 Plan 04 WPIC-06: owner identity for WearCommentHost. */
  ownerUserId?: string
  ownerUsername?: string
  /** Phase 62 Plan 04 WPIC-06: viewer's CommentAuthor for optimistic comment inserts. */
  viewerAuthor?: CommentAuthor | null
  /**
   * CR-02 / IN-02: RSC-resolved comment gate for wear-pic comments.
   * Mirrors canCommentDisplay semantics from w/[ref]/page.tsx: false for the
   * owner (suppress compose), true only when the viewer passes the GATE-01
   * follower check. Defaults to false for safety.
   */
  canCommentOnWears?: boolean
  /**
   * CR-02 / IN-02: owner→viewer follow direction for CommentGateLocked copy.
   * Resolved by the RSC (mirrors the same signal used for the watch thread).
   */
  ownerFollowsViewerForWears?: boolean
  /**
   * CR-02 / IN-02: viewer→owner follow direction for CommentGateLocked copy.
   * Resolved by the RSC (mirrors the same signal used for the watch thread).
   */
  viewerIsFollowingForWears?: boolean
}

const MAX_PHOTOS = 10

export function WatchPhotoSection({
  photos: photosProp,
  watchId,
  catalogFallbackUrl,
  brandModel,
  viewerCanEdit = false,
  userId,
  wearPics: wearPicsProp = [],
  viewerId = null,
  ownerUserId = '',
  ownerUsername = '',
  viewerAuthor = null,
  canCommentOnWears = false,
  ownerFollowsViewerForWears = false,
  viewerIsFollowingForWears = false,
}: WatchPhotoSectionProps) {
  // Resilience (issue #2 root cause, 2026-05-26): drop any photo whose signed URL
  // came back null — e.g. a watch_photos row with a malformed storage_path (a full
  // URL instead of a `{userId}/…` path) or a missing/deleted storage object. Such
  // photos can't render anyway; filtering them lets `hasOwnerPhotos` go false so the
  // carousel falls back to the catalog image instead of showing a blank watch-icon.
  const photos = useMemo(
    () => photosProp.filter((p) => p.signedUrl !== null),
    [photosProp],
  )
  // ---------------------------------------------------------------------------
  // Embla carousel setup
  // ---------------------------------------------------------------------------
  // loop:false, dragFree:false — standard snap carousel; watchDrag:true (default)
  // is the initial state. Edit mode uses reInit({ watchDrag: false }) to disable.
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false })

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  // ---------------------------------------------------------------------------
  // Edit mode state — reset on onPointerDown (NOT mount) to prevent stale
  // instance re-activation (MEMORY project_router_cache_stale_instance).
  // ---------------------------------------------------------------------------
  const [editMode, setEditMode] = useState(false)

  // ---------------------------------------------------------------------------
  // Optimistic state for drag-reorder (mirrors OwnerWishlistGrid pattern)
  // ---------------------------------------------------------------------------
  const photosById = useMemo(
    () => Object.fromEntries(photos.map((p) => [p.id, p])),
    [photos],
  )
  const initialIds = useMemo(() => photos.map((p) => p.id), [photos])

  const [optimisticIds, setOptimistic] = useOptimistic<string[], string[]>(
    initialIds,
    (_state, newOrder) => newOrder,
  )

  // Optimistic delete state
  const [deletedIds, setDeletedIds] = useOptimistic<Set<string>, string>(
    new Set<string>(),
    (state, idToDelete) => new Set([...state, idToDelete]),
  )

  const [, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)

  // WR-04: track photos added in the current session so the PhotoDropzone's
  // currentPhotoCount stays accurate between uploads without waiting for RSC
  // revalidation. visibleIds.length only reflects photos already in photosById
  // (RSC-rendered prop) — newly uploaded photos appear in photosById only after
  // the next revalidatePath flush. localUploadCount bridges that gap client-side.
  const [localUploadCount, setLocalUploadCount] = useState(0)

  // ---------------------------------------------------------------------------
  // Phase 62 Plan 04: wear-pic optimistic hide state + comment sheet state
  // ---------------------------------------------------------------------------

  // Optimistic wear-pic hide: mirrors the deletedIds pattern above but for
  // hiddenFromDetail. Each entry is { wearEventId, hidden }. On toggle, flip
  // locally before the server action resolves; revert + toast.error on failure.
  const [optimisticWearPics, applyOptimisticHide] = useOptimistic<
    SignedWearPic[],
    { wearEventId: string; hidden: boolean }
  >(
    wearPicsProp,
    (prev, update) =>
      prev.map((p) =>
        p.wearEventId === update.wearEventId ? { ...p, hiddenFromDetail: update.hidden } : p,
      ),
  )

  // Per-wear-pic comment counts — mutable client-side via onCountChange callback
  // (Pitfall 7: keeps social row badge in sync after user posts without page reload).
  const [wearPicCommentCounts, setWearPicCommentCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(wearPicsProp.map((p) => [p.wearEventId, p.commentCount])),
  )

  // Comment sheet state — one sheet serves the wear-pic whose button was clicked.
  const [commentSheetOpen, setCommentSheetOpen] = useState(false)
  // CR-01/WR-02: the sheet's target wear event, set explicitly by the clicked
  // slide's comment button — NOT derived from selectedIndex (the carousel
  // position). A non-active slide's button (keyboard/AT focus, partial drag)
  // must open the sheet for ITS OWN wear pic, not whichever slide embla
  // currently considers selected.
  const [sheetWearEventId, setSheetWearEventId] = useState<string | null>(null)

  // WR-04: reset localUploadCount when the RSC re-renders with fresh photos (i.e.,
  // when revalidatePath has flushed and the `photos` prop reflects the new rows).
  // After this point, visibleIds.length already accounts for the newly added photos,
  // so the local counter can be reset to avoid double-counting.
  const photosLengthRef = useRef(photos.length)
  useEffect(() => {
    if (photos.length !== photosLengthRef.current) {
      photosLengthRef.current = photos.length
      setLocalUploadCount(0)
    }
  }, [photos.length])

  // ---------------------------------------------------------------------------
  // Embla sync — update state on slide change and reInit
  // ---------------------------------------------------------------------------
  const syncEmblaState = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
    setCanScrollPrev(emblaApi.canScrollPrev())
    setCanScrollNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    syncEmblaState()
    emblaApi.on('select', syncEmblaState)
    emblaApi.on('reInit', syncEmblaState)
    return () => {
      emblaApi.off('select', syncEmblaState)
      emblaApi.off('reInit', syncEmblaState)
    }
  }, [emblaApi, syncEmblaState])

  // ---------------------------------------------------------------------------
  // embla ↔ dnd-kit gesture conflict resolution (RESEARCH Pattern 4 / Pitfall 7)
  // Disable embla draggable when edit mode is ON so swipe and filmstrip drag
  // don't compete for the same touch events.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // watchDrag: false disables embla's pointer/touch drag detection in edit mode
    // so it doesn't compete with dnd-kit touch events during filmstrip drag.
    // (RESEARCH Pattern 4 / Pitfall 7: 'draggable' renamed to 'watchDrag' in embla v8)
    emblaApi?.reInit({ watchDrag: !editMode })
  }, [editMode, emblaApi])

  // ---------------------------------------------------------------------------
  // dnd-kit sensor configuration (mirrors OwnerWishlistGrid lines 173-183)
  // Dual sensors: mouse (150ms delay) + touch (250ms delay) — mutually exclusive
  // activation constraints; separate sensors required (RESEARCH Anti-Patterns).
  // ---------------------------------------------------------------------------
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  )

  // ---------------------------------------------------------------------------
  // Drag-reorder handler (mirrors OwnerWishlistGrid handleDragEnd lines 185-218)
  // ---------------------------------------------------------------------------
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) {
      setActiveId(null)
      return
    }
    const oldIdx = optimisticIds.indexOf(active.id as string)
    const newIdx = optimisticIds.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) {
      setActiveId(null)
      return
    }
    const newOrder = arrayMove(optimisticIds, oldIdx, newIdx)
    startTransition(async () => {
      setOptimistic(newOrder)
      setActiveId(null)
      const result = await reorderWatchPhotosAction({ watchId, orderedIds: newOrder })
      if (!result.success) {
        if (result.error?.includes('changed in another tab')) {
          toast.error('Photos changed in another tab. Refresh and try again.')
        } else {
          toast.error("Couldn't save new order.")
        }
        // On failure: no revalidatePath in action on error path → optimistic auto-reverts
      } else {
        toast.success('Order updated')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Per-photo delete: immediate optimistic + undo toast (lighter than Dialog)
  // UI-SPEC §Delete State: no Dialog confirm, 5-second undo window.
  //
  // CR-01 fix: add useEffect cleanup to clear the pending timer on unmount so a
  // navigating-away user cannot trigger a background delete on a stale watchId.
  //
  // WR-02 fix: move the server action call inside startTransition alongside the
  // optimistic update so useOptimistic auto-reverts the hidden state on failure.
  // Without this, setDeletedIds fires in a separate transition from the actual
  // server call, so React cannot auto-revert the optimistic state on failure and
  // the photo remains permanently hidden even though the delete failed.
  //
  // Undo: clear the timer ref and null it so a late undo cannot fire
  // clearTimeout on an already-fired ID (which is a no-op, not a guard).
  // ---------------------------------------------------------------------------
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // CR-01: clear any pending delete timer on unmount to prevent background mutations.
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  // Track the transition key so Undo can force a new transition to restore the photo.
  // We use a simple counter — increment to "abandon" the current deletion transition.
  const undoSignalRef = useRef<{ aborted: boolean }>({ aborted: false })

  function handleDelete(photoId: string) {
    // gap #6: hide the photo IMMEDIATELY at click time (optimistic).
    // useOptimistic setDeletedIds fires within a startTransition so the thumbnail
    // and carousel slide disappear at once, before the server call.
    const signal = { aborted: false }
    undoSignalRef.current = signal

    startTransition(() => {
      setDeletedIds(photoId) // optimistic hide — immediate
    })

    // Show the undo toast immediately (5-second window).
    toast('Photo deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          // CR-01: null the ref after clearing so a late undo click cannot
          // clearTimeout on an already-fired timer ID (which is a silent no-op).
          if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current)
            undoTimerRef.current = null
          }
          // Mark this deletion as aborted so the setTimeout body skips the server call.
          signal.aborted = true
          // The optimistic state auto-reverts because the outer startTransition completed
          // but no new transition updates the server state. Trigger a new transition with
          // no-op to flush the optimistic layer and restore the photo.
          startTransition(() => {
            // no-op transition: React will re-render and restore useOptimistic state
            // to the server snapshot (deletedIds reverts to empty Set).
          })
        },
      },
      duration: 5000,
    })

    // gap #6: the 5s setTimeout contains ONLY the server delete call.
    // The optimistic hide already fired above; this just commits the deletion.
    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null
      if (signal.aborted) return // Undo was clicked — skip server call
      startTransition(async () => {
        const result = await deleteWatchPhotoAction({ watchId, photoId })
        if (!result.success) {
          // WR-02: useOptimistic auto-reverts when the transition settles without
          // revalidatePath (the error path does not call revalidatePath).
          toast.error("Couldn't delete photo.")
        }
      })
    }, 5000)
  }

  // ---------------------------------------------------------------------------
  // Visible slides: exclude optimistically deleted photos
  // ---------------------------------------------------------------------------
  const visibleIds = optimisticIds.filter(
    (id) => photosById[id] && !deletedIds.has(id),
  )
  const hasOwnerPhotos = visibleIds.length > 0

  // Phase 62 Plan 04: merged slide count — owner photos first, wear pics appended
  // newest-worn first (already ordered by the DAL). CSS Chain Assertion 5: position
  // indicator MUST count the merged total, not just owner photo count.
  const visibleWearPics = optimisticWearPics  // hide/show is toggled only in Edit mode filmstrip; carousel always shows all public pics from RSC
  const hasWearPics = visibleWearPics.length > 0

  // Determine slides: owner photos (+ wear pics) OR catalog fallback (+ wear pics) OR empty
  const ownerSlideCount = hasOwnerPhotos ? visibleIds.length : catalogFallbackUrl ? 1 : 0
  const wearPicSlideCount = visibleWearPics.length
  const totalSlides = ownerSlideCount + wearPicSlideCount

  const showArrows = totalSlides > 1
  const showPositionIndicator = totalSlides > 1

  // Determine if selectedIndex points at a wear-pic slide vs owner/catalog slide.
  const isWearPicSlide = selectedIndex >= ownerSlideCount && wearPicSlideCount > 0
  const activeWearPic = isWearPicSlide ? visibleWearPics[selectedIndex - ownerSlideCount] : null

  // CR-01/WR-02: the comment sheet renders against the wear pic whose button was
  // clicked (sheetWearEventId), independent of which slide embla considers active.
  // Falls back to activeWearPic when no button has been clicked yet (or its target
  // was removed) so the host guard still behaves sensibly.
  const sheetWearPic =
    visibleWearPics.find((p) => p.wearEventId === sheetWearEventId) ?? activeWearPic

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      role="region"
      aria-label="Watch photos"
      className="space-y-3"
    >
      {/* -------------------------------------------------------------------- */}
      {/* Carousel viewport */}
      {/* -------------------------------------------------------------------- */}
      <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-lg bg-muted">
        <div ref={emblaRef} className="h-full overflow-hidden">
          <div className="flex h-full">
            {hasOwnerPhotos ? (
              // Owner photos
              visibleIds.map((id, idx) => {
                const photo = photosById[id]
                return (
                  <div key={id} className="flex-none w-full h-full relative">
                    {photo.signedUrl ? (
                      <Image
                        src={photo.signedUrl}
                        alt={`Photo ${idx + 1} of ${visibleIds.length}`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <WatchIcon className="h-16 w-16 text-muted-foreground/40" aria-hidden />
                      </div>
                    )}
                  </div>
                )
              })
            ) : catalogFallbackUrl ? (
              // Catalog fallback — D-09: no "stock" label
              <div className="flex-none w-full h-full relative">
                <Image
                  src={catalogFallbackUrl}
                  alt={brandModel}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            ) : (
              // Empty: WatchIcon placeholder — same as current WatchDetail fallback
              <div className="flex-none w-full h-full flex items-center justify-center">
                <span role="img" aria-label="No photo yet">
                  <WatchIcon className="h-16 w-16 text-muted-foreground/40" />
                </span>
              </div>
            )}

            {/* Phase 62 Plan 04 WPIC-01: wear-pic slides appended after owner photos.
                Each slide carries a "Worn · [date]" badge (D-07 / React #418).
                Badge is absolute-positioned bottom-left; no badge on owner/catalog slides. */}
            {visibleWearPics.map((wp, idx) => {
              // WR-01: only the active wear slide's overlay should be interactive
              // and in the tab/AT order. Inactive slides are merely clipped by the
              // embla viewport's overflow-hidden — without this gate their
              // like/comment controls remain focusable off-screen and a comment
              // button can be activated for a slide that is not the active one.
              const isActiveWearSlide = selectedIndex - ownerSlideCount === idx
              return (
              <div key={wp.wearEventId} className="flex-none w-full h-full relative">
                {wp.signedUrl ? (
                  <Image
                    src={wp.signedUrl}
                    alt={`Wear photo ${idx + 1}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <WatchIcon className="h-16 w-16 text-muted-foreground/40" aria-hidden />
                  </div>
                )}
                {/* Worn · [date] badge — MANDATORY UTC pin (D-07 / React #418 / T-62-15) */}
                <span className="absolute bottom-2 left-2 text-xs font-semibold bg-background/80 backdrop-blur-sm text-foreground px-2 py-0.5 rounded">
                  Worn · {new Date(wp.wornDate + 'T00:00:00Z').toLocaleDateString('en-US', {
                    timeZone: 'UTC',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {/* Phase 62 Plan 05 WPIC-06: per-slide bottom-right social overlay.
                    Anchored bottom-RIGHT; badge stays bottom-LEFT — no collision.
                    Scrim matches badge/arrow token chain (bg-background/80 backdrop-blur-sm)
                    so bare icons stay legible over light AND dark photos.
                    onClick on both controls — NOT onPointerDown (fresh-per-interaction,
                    not a one-shot stale-instance toggle; per MEMORY project_router_cache_stale_instance). */}
                <div
                  className={cn(
                    'absolute bottom-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-1',
                    // WR-01: take non-active overlays out of the interactive path so
                    // off-screen slides can't be clicked/dragged into the wrong sheet.
                    !isActiveWearSlide && 'pointer-events-none',
                  )}
                  // WR-01: hide off-screen overlays from assistive tech so the AT user
                  // doesn't traverse like/comment controls for slides they can't see.
                  aria-hidden={!isActiveWearSlide}
                  role="group"
                  aria-label="Wear photo interactions"
                >
                  <LikeButton
                    viewerId={viewerId}
                    target={{ type: 'wear', id: wp.wearEventId }}
                    initialLiked={wp.initialLikeState.liked}
                    initialCount={wp.initialLikeState.count}
                  />
                  <button
                    type="button"
                    aria-label={
                      (wearPicCommentCounts[wp.wearEventId] ?? wp.commentCount) > 0
                        ? `View ${wearPicCommentCounts[wp.wearEventId] ?? wp.commentCount} comment${(wearPicCommentCounts[wp.wearEventId] ?? wp.commentCount) === 1 ? '' : 's'}`
                        : 'Add a comment'
                    }
                    // WR-01: remove the off-screen slides' comment button from tab order.
                    tabIndex={isActiveWearSlide ? undefined : -1}
                    // CR-01/WR-02: set the sheet's target to THIS slide's wear event
                    // before opening — the label and the action now derive from the
                    // same wp, so they cannot drift onto activeWearPic's wrong thread.
                    // onClick (NOT onPointerDown) — fresh-per-interaction, per MEMORY
                    // project_router_cache_stale_instance.
                    onClick={() => {
                      setSheetWearEventId(wp.wearEventId)
                      setCommentSheetOpen(true)
                    }}
                    className="inline-flex items-center gap-1 min-h-[44px] min-w-[44px] px-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MessageCircle className="size-5 text-muted-foreground" aria-hidden />
                    {(wearPicCommentCounts[wp.wearEventId] ?? wp.commentCount) > 0 && (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {wearPicCommentCounts[wp.wearEventId] ?? wp.commentCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              )
            })}
          </div>
        </div>

        {/* Prev/Next arrows — hidden at single slide, disabled at boundary */}
        {showArrows && (
          <>
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canScrollPrev}
              aria-label="Previous photo"
              aria-disabled={!canScrollPrev}
              className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-background/80 flex items-center justify-center transition-opacity',
                !canScrollPrev && 'opacity-50 cursor-not-allowed',
              )}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canScrollNext}
              aria-label="Next photo"
              aria-disabled={!canScrollNext}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-background/80 flex items-center justify-center transition-opacity',
                !canScrollNext && 'opacity-50 cursor-not-allowed',
              )}
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      {/* Position indicator — only when multiple slides */}
      {/* gap #4: wrap in w-full max-w-md to match carousel viewport width so text-center
          centers on the photo, not the full parent region */}
      {showPositionIndicator && (
        <div className="w-full max-w-md">
          <p
            className="text-sm text-muted-foreground text-center tabular-nums"
            aria-live="polite"
          >
            {selectedIndex + 1} / {totalSlides}
          </p>
        </div>
      )}

      {/* Phase 62 Plan 04 WPIC-06: Wear-pic comment bottom sheet.
          WearCommentHost client component — no 'use cache' anywhere in this path (T-62-16).
          initialComments pre-fetched by page RSC (Option A); onCountChange keeps badge in sync. */}
      {sheetWearPic && (
        <WearCommentHost
          variant="bottom-sheet"
          wearEventId={sheetWearPic.wearEventId}
          open={commentSheetOpen}
          onOpenChange={setCommentSheetOpen}
          initialComments={sheetWearPic.initialComments}
          canComment={canCommentOnWears}
          ownerFollowsViewer={ownerFollowsViewerForWears}
          viewerIsFollowing={viewerIsFollowingForWears}
          ownerUserId={ownerUserId}
          ownerUsername={ownerUsername}
          viewerId={viewerId}
          viewerAuthor={viewerAuthor}
          onCountChange={(delta) => {
            setWearPicCommentCounts((prev) => ({
              ...prev,
              [sheetWearPic.wearEventId]: (prev[sheetWearPic.wearEventId] ?? sheetWearPic.commentCount) + delta,
            }))
          }}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Filmstrip — shown when there are owner photos OR wear pics OR in edit */}
      {/* mode (so a photo-less watch can still reach the dropzone).            */}
      {/* Issue #3 (2026-05-26). Phase 62: also shown when there are wear pics. */}
      {/* -------------------------------------------------------------------- */}
      {(hasOwnerPhotos || hasWearPics || editMode) && (
        <div className="min-w-0">
          {editMode ? (
            // Edit mode: wrap filmstrip in DndContext + SortableContext
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(e: DragStartEvent) => {
                setActiveId(e.active.id as string)
              }}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleIds}
                strategy={rectSortingStrategy}
              >
                {/* Issue #1 (2026-05-26): WRAP after ~5 thumbs instead of a single
                    overflow-x-auto row (the horizontal scroll caused overflow/spacing
                    issues on mobile + desktop). flex-wrap + max-w-sm fits ~5 per row
                    and wraps to new rows; rectSortingStrategy handles the 2D layout. */}
                <div
                  role="list"
                  aria-label="Photo filmstrip"
                  className="flex flex-wrap gap-2 pb-1 max-w-sm"
                >
                  {visibleIds.map((id, idx) => (
                    <SortablePhotoThumb
                      key={id}
                      id={id}
                      index={idx}
                      signedUrl={photosById[id].signedUrl}
                      isCover={visibleIds[0] === id}
                      editMode={true}
                      onDelete={() => handleDelete(id)}
                      onClick={() => emblaApi?.scrollTo(idx)}
                    />
                  ))}

                  {/* UAT enhancement (test 1, 2026-05-26): the redundant in-filmstrip
                      +Add [+] tile was REMOVED. Now that the Edit-mode dropzone below
                      renders its full affordance text legibly (gap-closure from 61-05),
                      the dropzone is the single add control. At-cap feedback is the
                      "10 photos — at the limit." message below; the dropzone self-hides
                      at the cap (visibleIds.length < MAX_PHOTOS guard). */}
                </div>
              </SortableContext>

              {/* Phase 62 Plan 04 WPIC-02: wear-pic edit-mode thumbnails.
                  Parallel non-sortable wrapper (NOT SortablePhotoThumb — wear pics
                  cannot be reordered or deleted, only hidden/shown). D-08/D-10. */}
              {optimisticWearPics.length > 0 && (
                <div
                  role="list"
                  aria-label="Wear photo filmstrip"
                  className="flex flex-wrap gap-2 pb-1 max-w-sm mt-1"
                >
                  {optimisticWearPics.map((wp, idx) => {
                    const isHidden = wp.hiddenFromDetail
                    const slideIdx = ownerSlideCount + idx
                    return (
                      <div
                        key={wp.wearEventId}
                        role="listitem"
                        className="relative flex-none w-16 h-16 rounded-md overflow-hidden bg-muted cursor-pointer"
                        onClick={() => emblaApi?.scrollTo(slideIdx)}
                        aria-label={
                          isHidden
                            ? 'Photo, hidden from this page. Tap to show.'
                            : `Wear photo ${idx + 1}`
                        }
                      >
                        {/* CSS Chain Assertion 3: opacity-50 on IMAGE only, not container,
                            so the bg-muted base shows through and the "Hidden" label stays
                            fully opaque. */}
                        {wp.signedUrl ? (
                          <Image
                            src={wp.signedUrl}
                            alt={`Wear photo ${idx + 1}`}
                            fill
                            sizes="64px"
                            className={cn('object-cover', isHidden && 'opacity-50')}
                          />
                        ) : (
                          <div className={cn('w-full h-full bg-muted', isHidden && 'opacity-50')} />
                        )}

                        {/* Hidden label strip (full-width, bottom of thumb) */}
                        {isHidden && (
                          <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] font-semibold text-foreground bg-background/70 py-0.5">
                            Hidden
                          </span>
                        )}

                        {/* Eye/EyeOff toggle — onPointerDown (NOT onClick) per
                            MEMORY project_router_cache_stale_instance: Next 16
                            restores the same stale client component instance. */}
                        <button
                          type="button"
                          aria-pressed={isHidden}
                          aria-label={isHidden ? 'Show on this page' : 'Hide from this page'}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            // WR-03: capture both states from the render closure
                            // BEFORE startTransition so the async body reverts to
                            // the same snapshot it applied — not a stale closure that
                            // could drift if a second tap fires before this one resolves.
                            const currentHidden = isHidden
                            const newHidden = !isHidden
                            startTransition(async () => {
                              applyOptimisticHide({ wearEventId: wp.wearEventId, hidden: newHidden })
                              const action = currentHidden ? unhideWearPicAction : hideWearPicAction
                              const result = await action({ wearEventId: wp.wearEventId, watchId })
                              if (!result.success) {
                                // Revert to the captured pre-tap state
                                applyOptimisticHide({ wearEventId: wp.wearEventId, hidden: currentHidden })
                                toast.error("Couldn't update. Try again.")
                              } else {
                                toast.success(currentHidden ? 'Shown on this page' : 'Hidden from this page')
                              }
                            })
                          }}
                          className="absolute top-1 right-1 size-6 bg-background/80 rounded-full flex items-center justify-center"
                        >
                          {isHidden ? (
                            <Eye className="size-4" aria-hidden />
                          ) : (
                            <EyeOff className="size-4" aria-hidden />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* DragOverlay renders clone at pointer during drag */}
              <DragOverlay>
                {activeId && photosById[activeId] ? (
                  <div className="w-16 h-16 rounded-md overflow-hidden opacity-90 shadow-xl scale-105">
                    {photosById[activeId].signedUrl ? (
                      <Image
                        src={photosById[activeId].signedUrl!}
                        alt="Dragging"
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted" />
                    )}
                  </div>
                ) : null}
              </DragOverlay>

              {/* gap #2: full-width upload affordance below the filmstrip in edit mode.
                  The +Add tile above triggers this dropzone via id. Renders full text. */}
              {visibleIds.length < MAX_PHOTOS && (
                <div className="mt-2">
                  <PhotoDropzone
                    id={`photo-dropzone-${watchId}`}
                    watchId={watchId}
                    userId={userId ?? ''}
                    currentPhotoCount={visibleIds.length + localUploadCount}
                    onPhotosAdded={(newIds) => {
                      // WR-04: increment localUploadCount by the number of newly
                      // added photos so the cap math stays accurate before RSC
                      // revalidation reflects the new rows in photosById.
                      setLocalUploadCount((c) => c + newIds.length)
                    }}
                  />
                </div>
              )}
            </DndContext>
          ) : (
            // View mode: plain wrapping filmstrip, no DndContext.
            // Issue #1 (2026-05-26): flex-wrap + max-w-sm wraps after ~5 thumbs
            // instead of a single overflow-x-auto row.
            <div
              role="list"
              aria-label="Photo filmstrip"
              className="flex flex-wrap gap-2 pb-1 max-w-sm"
            >
              {visibleIds.map((id, idx) => (
                <div
                  key={id}
                  role="listitem"
                  tabIndex={0}
                  className="relative flex-none w-16 h-16 rounded-md overflow-hidden bg-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                  onClick={() => emblaApi?.scrollTo(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      emblaApi?.scrollTo(idx)
                    }
                  }}
                  aria-label={`Photo ${idx + 1}`}
                >
                  {photosById[id].signedUrl ? (
                    <Image
                      src={photosById[id].signedUrl!}
                      alt={`Photo ${idx + 1}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted" />
                  )}
                  {/* D-07 revised 2026-05-25: no Cover badge in view mode */}
                </div>
              ))}

              {/* Phase 62 Plan 04 D-03: wear-pic filmstrip thumbs (view mode) —
                  tap-to-jump; offset by ownerSlideCount so they jump to the correct
                  merged carousel index. No badge on thumb (too small at 64px). */}
              {visibleWearPics.map((wp, idx) => {
                const slideIdx = ownerSlideCount + idx
                return (
                  <div
                    key={wp.wearEventId}
                    role="listitem"
                    tabIndex={0}
                    className="relative flex-none w-16 h-16 rounded-md overflow-hidden bg-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                    onClick={() => emblaApi?.scrollTo(slideIdx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        emblaApi?.scrollTo(slideIdx)
                      }
                    }}
                    aria-label={`Wear photo ${idx + 1}`}
                  >
                    {wp.signedUrl ? (
                      <Image
                        src={wp.signedUrl}
                        alt={`Wear photo ${idx + 1}`}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted" />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Cap message in edit mode at 10 photos */}
          {editMode && visibleIds.length >= MAX_PHOTOS && (
            <p className="text-sm text-muted-foreground mt-2">
              10 photos — at the limit.
            </p>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Edit toggle row — owner only (D-03) */}
      {/* -------------------------------------------------------------------- */}
      {/* Issue #3 (2026-05-26): the dropzone must ONLY appear in edit mode. The
          former empty-state dropzone (rendered when !editMode && !hasOwnerPhotos)
          showed on page load and hid in edit mode — backwards. It's removed; the
          edit-mode dropzone above is now the single add affordance for every watch
          (photo-less watches reach it via this toggle, which the filmstrip section
          now renders in edit mode regardless of hasOwnerPhotos). */}
      {viewerCanEdit && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-pressed={editMode}
            // onPointerDown — NOT onClick — for stale-instance reset
            // (MEMORY project_router_cache_stale_instance: Next 16 restores the
            // same stale client component instance on revisited /w/[ref] URLs;
            // state changes on interaction, not mount, so the toggle is always
            // responsive even on revisit without a page reload).
            onPointerDown={() => setEditMode((prev) => !prev)}
          >
            {editMode ? 'Done editing' : hasOwnerPhotos ? 'Edit photos' : 'Add photos'}
          </Button>
        </div>
      )}
    </div>
  )
}
