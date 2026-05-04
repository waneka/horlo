'use client'

import { useOptimistic, useTransition, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
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
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ProfileWatchCard } from './ProfileWatchCard'
import { SortableProfileWatchCard } from './SortableProfileWatchCard'
import { AddWatchCard } from './AddWatchCard'
import { reorderWishlist } from '@/app/actions/wishlist'
import type { Watch } from '@/lib/types'

interface WishlistTabContentProps {
  watches: Watch[]
  wearDates: Record<string, string>
  // D-16: end-of-grid AddToWishlist card renders when isOwner+populated.
  isOwner?: boolean
  /** Phase 25 D-10: surfaces non-owner copy "{username} hasn't added any
   *  wishlist watches yet." Threaded from [tab]/page.tsx (profile.username). */
  username: string
}

export function WishlistTabContent({
  watches,
  wearDates,
  isOwner,
  username,
}: WishlistTabContentProps) {
  // EMPTY STATE — PRESERVED VERBATIM (UI-SPEC line 110-114)
  if (watches.length === 0) {
    if (isOwner) {
      // Phase 25 D-05 owner empty state — primary CTA → /watch/new?status=wishlist.
      return (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-base font-semibold">No wishlist watches yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Track watches you want to own, with verdict-style fit analysis.
          </p>
          <div className="mx-auto mt-6 max-w-xs">
            <Button
              variant="default"
              className="w-full"
              render={<Link href="/watch/new?status=wishlist" />}
            >
              Add a wishlist watch
            </Button>
          </div>
        </div>
      )
    }
    // Phase 25 D-10 non-owner empty state — read-only owner-aware copy, NO CTA.
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-base font-semibold">Nothing here yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {username} hasn&apos;t added any wishlist watches yet.
        </p>
      </div>
    )
  }

  // POPULATED — non-owner branch (no DnD; grid-cols-2 per VIS-07)
  if (!isOwner) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {watches.map((watch) => (
          <ProfileWatchCard
            key={watch.id}
            watch={watch}
            lastWornDate={wearDates[watch.id] ?? null}
            showWishlistMeta
          />
        ))}
      </div>
    )
  }

  // POPULATED — owner branch (DnD wired; grid-cols-2 per VIS-07).
  // Delegated to a sub-component so the hooks below this branch don't violate
  // React rules-of-hooks (would otherwise run conditionally after early returns).
  return <OwnerWishlistGrid watches={watches} wearDates={wearDates} />
}

/**
 * Phase 27 (WISH-01) — Owner-only wishlist grid with drag-reorder.
 *
 * Hooks (useOptimistic / useTransition / useState / useMemo / useSensors) are
 * gated behind the empty-state and isOwner branches in WishlistTabContent;
 * they live here as a sub-component to satisfy React rules-of-hooks.
 *
 * Optimistic UI pattern (CONTEXT D-09; RESEARCH Pitfall 9):
 *   1. drag end → arrayMove → setOptimistic(newOrder) → reorderWishlist(...)
 *   2. happy path → server revalidatePath fires → fresh server state replaces
 *      the optimistic state → UI is silently consistent
 *   3. failure path → server does NOT revalidatePath → optimistic state
 *      auto-reverts when the transition resolves → toast.error fires
 */
function OwnerWishlistGrid({
  watches,
  wearDates,
}: {
  watches: Watch[]
  wearDates: Record<string, string>
}) {
  const watchesById = useMemo(
    () => Object.fromEntries(watches.map((w) => [w.id, w])),
    [watches],
  )
  const initialIds = useMemo(() => watches.map((w) => w.id), [watches])

  const [optimisticIds, setOptimistic] = useOptimistic<string[], string[]>(
    initialIds,
    (_state, newOrder) => newOrder,
  )
  const [, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)

  // CONTEXT D-06 (desktop 150ms) / D-07 (mobile 250ms).
  // Activation constraints are mutually exclusive on a single sensor —
  // separate Mouse + Touch sensors are required (RESEARCH Anti-Patterns).
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    // WR-03 fix — DO NOT clear activeId outside the transition. Doing so
    // forces a synchronous re-render with activeId=null + the OLD
    // optimisticIds order, which on slow hardware causes a visible
    // snap-back flicker before the transition's first render with
    // setOptimistic(newOrder). Defer setActiveId(null) into the
    // transition (or the early-return paths below) so React batches the
    // overlay clear with the optimistic update for a single render.
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
      // setActiveId is a regular useState setter (NOT useOptimistic) so
      // calling it inside startTransition still schedules the update —
      // React batches it with setOptimistic for a single render.
      setActiveId(null)
      const result = await reorderWishlist({ orderedIds: newOrder })
      if (!result.success) {
        // UI-SPEC line 116. useOptimistic auto-reverts when transition ends
        // because server didn't revalidatePath on failure (RESEARCH Pitfall 9).
        toast.error("Couldn't save new order. Reverted.")
      }
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            const w = watchesById[active.id as string]
            return `Picked up ${w?.brand ?? ''} ${w?.model ?? ''}. Use arrow keys to move, space to drop, escape to cancel.`
          },
          onDragEnd({ active, over }) {
            const w = watchesById[active.id as string]
            if (!over) {
              return `Reorder canceled. ${w?.brand ?? ''} ${w?.model ?? ''} returned to original position.`
            }
            const newIdx = optimisticIds.indexOf(over.id as string)
            return `Dropped ${w?.brand ?? ''} ${w?.model ?? ''} at position ${newIdx + 1} of ${optimisticIds.length}.`
          },
          onDragCancel({ active }) {
            const w = watchesById[active.id as string]
            return `Reorder canceled. ${w?.brand ?? ''} ${w?.model ?? ''} returned to original position.`
          },
          onDragOver: () => undefined,
          onDragMove: () => undefined,
        },
      }}
      onDragStart={(e: DragStartEvent) => {
        setActiveId(e.active.id as string)
        // UI-SPEC line 169-172 — single 10ms tick on drag start.
        // navigator.vibrate is no-op on non-touch contexts; safe.
        navigator.vibrate?.(10)
      }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={optimisticIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {optimisticIds.map((id) => (
            <SortableProfileWatchCard
              key={id}
              id={id}
              watch={watchesById[id]}
              lastWornDate={wearDates[id] ?? null}
              showWishlistMeta
            />
          ))}
          {/* AddWatchCard intentionally OUTSIDE SortableContext.items
              AND rendered AFTER the SortableContext children block —
              it's an action affordance, not sortable, and must land as
              the final grid cell (UI-SPEC line 236-237; RESEARCH Open Q #3). */}
          <AddWatchCard variant="wishlist" />
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId && watchesById[activeId] ? (
          <div className="scale-105 shadow-xl">
            <ProfileWatchCard
              watch={watchesById[activeId]}
              lastWornDate={wearDates[activeId] ?? null}
              showWishlistMeta
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
