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
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import useEmblaCarousel from 'embla-carousel-react'
import Image from 'next/image'
import { Watch as WatchIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SortablePhotoThumb } from './SortablePhotoThumb'
import { PhotoDropzone } from './PhotoDropzone'
import { reorderWatchPhotosAction, deleteWatchPhotoAction } from '@/app/actions/watchPhotos'

export interface SignedPhoto {
  id: string
  signedUrl: string | null
  sortOrder: number
}

export interface WatchPhotoSectionProps {
  photos: SignedPhoto[]
  watchId: string
  catalogFallbackUrl: string | null
  brandModel: string
  viewerCanEdit?: boolean
  /** userId needed for client-direct upload (PhotoDropzone). Server passes down from RSC. */
  userId?: string
}

const MAX_PHOTOS = 10

export function WatchPhotoSection({
  photos,
  watchId,
  catalogFallbackUrl,
  brandModel,
  viewerCanEdit = false,
  userId,
}: WatchPhotoSectionProps) {
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

  function handleDelete(photoId: string) {
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
          // The optimistic state auto-reverts because the startTransition below
          // was never settled (server action never called). A full reload is no
          // longer needed — useOptimistic reverts when the transition is abandoned.
          // window.location.reload() removed: unnecessary and disruptive.
        },
      },
      duration: 5000,
    })

    // WR-02: wrap BOTH the optimistic update and the server call in a single
    // startTransition so useOptimistic auto-reverts the hidden state if the
    // delete action fails (no revalidatePath on the error path → auto-revert).
    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null
      startTransition(async () => {
        setDeletedIds(photoId) // optimistic hide
        const result = await deleteWatchPhotoAction({ watchId, photoId })
        if (!result.success) {
          // useOptimistic auto-reverts the optimistic state when the transition
          // settles without a server-side revalidatePath (the error path does not
          // call revalidatePath, so the photo reappears automatically).
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

  // Determine slides: owner photos OR catalog fallback OR empty
  const totalSlides = hasOwnerPhotos
    ? visibleIds.length
    : catalogFallbackUrl
    ? 1
    : 0

  const showArrows = totalSlides > 1
  const showPositionIndicator = totalSlides > 1

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
      {showPositionIndicator && (
        <p
          className="text-sm text-muted-foreground text-center tabular-nums"
          aria-live="polite"
        >
          {selectedIndex + 1} / {totalSlides}
        </p>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Filmstrip — always visible when there are owner photos */}
      {/* -------------------------------------------------------------------- */}
      {hasOwnerPhotos && (
        <div>
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
                strategy={horizontalListSortingStrategy}
              >
                <div
                  role="list"
                  aria-label="Photo filmstrip"
                  className="flex overflow-x-auto gap-2 pb-1"
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

                  {/* +Add tile — appended at end in edit mode */}
                  {visibleIds.length < MAX_PHOTOS ? (
                    <div
                      role="listitem"
                      className="flex-none w-16 h-16"
                    >
                      <PhotoDropzone
                        watchId={watchId}
                        userId={userId ?? ''}
                        currentPhotoCount={visibleIds.length}
                        onPhotosAdded={() => {
                          // Page revalidates via addWatchPhotoAction's revalidatePath
                        }}
                      />
                    </div>
                  ) : (
                    // At cap: show disabled tile
                    <div
                      role="listitem"
                      className="flex-none w-16 h-16 rounded-md border-dashed border-2 bg-muted flex items-center justify-center opacity-50 cursor-not-allowed"
                      title="10 photos — at the limit."
                    >
                      <Plus className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                  )}
                </div>
              </SortableContext>

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
            </DndContext>
          ) : (
            // View mode: plain scrollable filmstrip, no DndContext
            <div
              role="list"
              aria-label="Photo filmstrip"
              className="flex overflow-x-auto gap-2 pb-1"
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
                  aria-label={`Photo ${idx + 1}${visibleIds[0] === id ? ', Cover' : ''}`}
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

                  {/* Cover badge — always on index [0] in view mode */}
                  {visibleIds[0] === id && (
                    <span
                      className="absolute top-0 left-0 text-xs font-semibold bg-background/80 text-foreground px-1 py-0.5"
                      aria-label="Cover photo"
                    >
                      Cover
                    </span>
                  )}
                </div>
              ))}
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
      {/* Edit toggle + upload affordance row — owner only (D-03) */}
      {/* -------------------------------------------------------------------- */}
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
            {editMode ? 'Done editing' : 'Edit photos'}
          </Button>

          {/* +Add affordance when no owner photos yet (empty state, not edit mode) */}
          {!editMode && !hasOwnerPhotos && userId && (
            <PhotoDropzone
              watchId={watchId}
              userId={userId}
              currentPhotoCount={0}
              onPhotosAdded={() => {
                // Revalidation handled by addWatchPhotoAction
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
