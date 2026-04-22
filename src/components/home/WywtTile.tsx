'use client'

import Image from 'next/image'
import { Plus, Watch as WatchIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/timeAgo'
import type { WywtTile as WywtTileData } from '@/lib/wywtTypes'

/**
 * WYWT rail tile (UI-SPEC § Component Inventory → WearTile).
 *
 * Two variants:
 *   1. Self-placeholder — an always-position-0 CTA tile that opens the
 *      WatchPickerDialog. Rendered when the viewer has no own wear in the
 *      last 48h. Label: "What are you wearing?" (CONTEXT.md W-02).
 *   2. Standard tile — full-bleed watch photo, `{username}` + relative time
 *      below, ring reflecting viewed-state.
 *
 * Viewed state (W-04 / Pitfall 4): before client hydration we always render
 * the unviewed ring so SSR and first client paint agree. Once hydrated, the
 * `viewedIds` set is consulted to downgrade the ring for already-opened tiles.
 *
 *   unviewed: `ring-2 ring-ring`            (accent gold-brown)
 *   viewed:   `ring-1 ring-muted-foreground/40`
 */

interface Props {
  /** Server wear-event tile, or null for the self-placeholder variant. */
  tile: WywtTileData | null
  /** When true, render the "What are you wearing?" CTA; ignores `tile`. */
  isSelfPlaceholder: boolean
  /** Post-hydration viewed set from useViewedWears(). */
  viewedIds: Set<string>
  /** False until useViewedWears' useEffect has read localStorage. */
  hydrated: boolean
  /** Non-self tap: opens the overlay at this tile's index. */
  onOpen: () => void
  /** Self-placeholder tap: opens the WatchPickerDialog. */
  onOpenPicker: () => void
}

export function WywtTile({
  tile,
  isSelfPlaceholder,
  viewedIds,
  hydrated,
  onOpen,
  onOpenPicker,
}: Props) {
  if (isSelfPlaceholder) {
    return (
      <button
        type="button"
        aria-label="What are you wearing? Log a wear for today."
        onClick={onOpenPicker}
        className="shrink-0 size-24 md:size-28 rounded-lg bg-muted ring-1 ring-muted-foreground/40 flex flex-col items-center justify-center gap-1 transition hover:scale-[1.02] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus className="size-6 text-muted-foreground" aria-hidden />
        <span className="text-xs text-muted-foreground px-2 text-center leading-tight">
          What are you wearing?
        </span>
      </button>
    )
  }

  if (!tile) return null

  // Pitfall 4: gate viewed-state on the hydrated flag. First render (server
  // OR pre-useEffect client) always shows unviewed to avoid hydration mismatch.
  const isViewed = hydrated && viewedIds.has(tile.wearEventId)

  // wornDate is 'YYYY-MM-DD' — synthesize midnight UTC so timeAgo treats it as
  // a date instant rather than parsing in an unknown tz.
  const time = timeAgo(`${tile.wornDate}T00:00:00Z`)

  const ariaLabel = isViewed
    ? `Wear from ${tile.username}, ${time}`
    : `Unviewed wear from ${tile.username}, ${time}`

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onOpen}
      className={cn(
        'shrink-0 size-24 md:size-28 rounded-lg overflow-hidden relative transition hover:scale-[1.02] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring',
        isViewed
          ? 'ring-1 ring-muted-foreground/40'
          : 'ring-2 ring-ring',
      )}
    >
      {tile.imageUrl ? (
        <Image
          src={tile.imageUrl}
          alt=""
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <WatchIcon className="text-muted-foreground" aria-hidden />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
        <p className="text-xs font-semibold text-white truncate">
          {tile.username}
        </p>
        <p className="text-xs text-white/80">{time}</p>
      </div>
    </button>
  )
}
