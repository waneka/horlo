'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ProfileWatchCard } from './ProfileWatchCard'
import type { Watch } from '@/lib/types'

interface SortableProfileWatchCardProps {
  id: string
  watch: Watch
  lastWornDate: string | null
  showWishlistMeta: boolean
}

/**
 * Phase 27 (WISH-01) — Sortable wrapper around ProfileWatchCard.
 * Owner-only render path: WishlistTabContent decides isOwner branch.
 *
 * touchAction: 'manipulation' is REQUIRED — without it iOS Safari claims the
 * long-press as a scroll gesture instead of letting dnd-kit's TouchSensor
 * promote it to a drag (RESEARCH Pitfall 3).
 *
 * The wrapped ProfileWatchCard contains its own <Link> to /watch/[id].
 * Quick-tap navigation (below the 150ms desktop / 250ms mobile activation
 * threshold) bubbles through to that link unmodified. Successful long-press
 * drags suppress the click via dnd-kit's pointer-event preventDefault.
 * Plan 05 Task 4 UAT verifies both paths on real devices (RESEARCH Pitfall 2 +
 * Open Question #2 — synthetic events in jsdom are not equivalent).
 *
 * Drop indicator (UI-SPEC line 153 contract): when this card is the current
 * `over` target AND the active card came from an earlier slot
 * (activeIndex < overIndex), render a 2px line in bg-ring color in the gap
 * BEFORE this card. dnd-kit exposes `isOver`, `activeIndex`, `overIndex` from
 * useSortable() directly — no parent-state coordination needed.
 */
export function SortableProfileWatchCard({
  id,
  watch,
  lastWornDate,
  showWishlistMeta,
}: SortableProfileWatchCardProps) {
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
    touchAction: 'manipulation',
  }

  // UI-SPEC line 153: 2px line in bg-ring color, full-width of the slot,
  // in the gap BEFORE the target slot. Show when this slot is the over-target
  // and the active item is moving toward it from an earlier index.
  const showDropIndicator =
    isOver && activeIndex >= 0 && activeIndex < overIndex

  return (
    <>
      {showDropIndicator && (
        <div
          className="h-0.5 w-full bg-ring rounded-full"
          aria-hidden="true"
        />
      )}
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        aria-roledescription="sortable"
        aria-label={`Reorder ${watch.brand} ${watch.model}. Press and hold to drag, or focus and press space to pick up with keyboard.`}
        className="cursor-grab active:cursor-grabbing"
      >
        <ProfileWatchCard
          watch={watch}
          lastWornDate={lastWornDate}
          showWishlistMeta={showWishlistMeta}
        />
      </div>
    </>
  )
}
