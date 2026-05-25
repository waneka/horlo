'use client'

// src/components/watch/SortablePhotoThumb.tsx
//
// Phase 61 Plan 02 — Sortable thumbnail wrapper for the WatchPhotoSection filmstrip.
//
// Mirrors SortableProfileWatchCard.tsx exactly, adapted for horizontal filmstrip:
// - 64×64px (w-16 h-16) thumbnail instead of full watch card
// - Cover badge at index [0] — moves with drag via optimisticIds tracking
// - Delete × badge (edit mode only) — onClick ONLY (no drag listeners)
// - GripVertical drag handle — the ONLY element that gets {...listeners}
// - Drop indicators are vertical gap-lines (left/right for horizontal filmstrip)
//
// Security: dnd-kit listeners on drag handle only (Pitfall 3 — prevents × tap
// from racing with drag start). touchAction: 'manipulation' required for iOS
// Safari (SortableProfileWatchCard comment line 22 precedent).

import Image from 'next/image'
import { GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

export interface SortablePhotoThumbProps {
  id: string
  index: number
  signedUrl: string | null
  isCover: boolean
  editMode: boolean
  onDelete: () => void
  onClick: () => void
}

/**
 * Phase 61 (PHOTO-05) — Sortable thumbnail for the watch photo filmstrip.
 *
 * touchAction: 'manipulation' is REQUIRED — without it iOS Safari claims the
 * long-press as a scroll gesture instead of letting dnd-kit's TouchSensor
 * promote it to a drag (RESEARCH Pitfall 3, mirrors SortableProfileWatchCard).
 *
 * Listeners attach to the GripVertical drag handle ONLY — not the outer div —
 * so the × delete badge click does not conflict with drag start (Pitfall 3).
 *
 * Drop indicators are vertical gap-lines (left/right) for the horizontal
 * filmstrip. Uses the same symmetry fix as SortableProfileWatchCard:
 *   - Moving right (active < over): indicator AFTER this thumb
 *   - Moving left (active > over): indicator BEFORE this thumb
 */
export function SortablePhotoThumb({
  id,
  index,
  signedUrl,
  isCover,
  editMode,
  onDelete,
  onClick,
}: SortablePhotoThumbProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    activeIndex,
    overIndex,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'manipulation',  // REQUIRED — iOS Safari gesture claim prevention
  }

  // Horizontal drop indicators: vertical gap-lines left/right.
  // Same symmetry logic as SortableProfileWatchCard (lines 70-79).
  const showDropIndicatorBefore = isOver && activeIndex >= 0 && activeIndex > overIndex
  const showDropIndicatorAfter = isOver && activeIndex >= 0 && activeIndex < overIndex

  return (
    <>
      {showDropIndicatorBefore && (
        <div
          className="w-0.5 h-16 bg-ring rounded-full flex-none"
          aria-hidden="true"
        />
      )}
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        // NOTE: listeners NOT spread here — they go on the drag handle only (Pitfall 3)
        aria-roledescription="Photo, grab to reorder"
        aria-label={`Photo ${index + 1}. ${isCover ? 'Cover. ' : ''}Press and hold to drag.`}
        className="relative w-16 h-16 flex-none rounded-md overflow-hidden bg-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
        role="listitem"
        tabIndex={0}
        onClick={editMode ? undefined : onClick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !editMode) {
            e.preventDefault()
            onClick()
          }
        }}
      >
        {signedUrl ? (
          <Image
            src={signedUrl}
            alt={`Photo ${index + 1}`}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center" />
        )}

        {/* Cover badge — always visible on position [0] */}
        {isCover && (
          <span
            className="absolute top-0 left-0 text-xs font-semibold bg-background/80 text-foreground px-1 py-0.5"
            aria-label="Cover photo"
          >
            Cover
          </span>
        )}

        {/* Edit mode controls — delete × and drag handle */}
        {editMode && (
          <>
            {/* Delete × badge — onClick ONLY (no drag listeners) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              aria-label={`Delete photo ${index + 1}`}
              className="absolute top-1 right-1 size-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs leading-none p-0 hover:bg-destructive/80"
            >
              ×
            </button>

            {/* Drag handle — THIS gets {...listeners} spread (Pitfall 3) */}
            <div
              {...listeners}
              className="absolute bottom-1 left-1 cursor-grab active:cursor-grabbing touch-manipulation"
              aria-hidden="true"
            >
              <GripVertical className="size-3 text-white/70" />
            </div>
          </>
        )}
      </div>
      {showDropIndicatorAfter && (
        <div
          className="w-0.5 h-16 bg-ring rounded-full flex-none"
          aria-hidden="true"
        />
      )}
    </>
  )
}
