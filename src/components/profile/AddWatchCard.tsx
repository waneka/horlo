import Link from 'next/link'
import { Plus } from 'lucide-react'

/**
 * Owner-only "+ Add Watch" card rendered at the END of the Collection grid.
 * Links to the existing add-watch flow at /watch/new (verified against src/app/watch/new/page.tsx).
 */
export function AddWatchCard() {
  return (
    <Link
      href="/watch/new"
      className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/40 bg-card text-accent transition-colors hover:bg-accent/5"
      aria-label="Add Watch"
    >
      <Plus className="size-6" />
      <span className="text-sm font-normal">Add Watch</span>
    </Link>
  )
}
