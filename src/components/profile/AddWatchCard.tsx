import Link from 'next/link'
import { Plus } from 'lucide-react'

/**
 * Owner-only end-of-grid CTA card. Used by:
 *   - CollectionTabContent (default variant — D-15 "Add to Collection")
 *   - WishlistTabContent  (variant="wishlist" — D-16 "Add to Wishlist")
 *
 * Both variants link to /watch/new (single canonical entry — the verdict step
 * is shared). Visual treatment is identical (dashed accent border, Plus icon);
 * only the text + aria-label change per variant.
 */
interface AddWatchCardProps {
  variant?: 'collection' | 'wishlist'
}

export function AddWatchCard({ variant = 'collection' }: AddWatchCardProps) {
  const label = variant === 'wishlist' ? 'Add to Wishlist' : 'Add to Collection'
  return (
    <Link
      href="/watch/new"
      className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/40 bg-card text-accent transition-colors hover:bg-accent/5"
      aria-label={label}
    >
      <Plus className="size-6" />
      <span className="text-sm font-normal">{label}</span>
    </Link>
  )
}
