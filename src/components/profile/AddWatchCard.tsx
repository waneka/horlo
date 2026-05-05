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
 *
 * Phase 28 D-08/D-10 — accepts an optional `returnTo` prop from the Client
 * parent (which has access to `usePathname()`). Pattern D from RESEARCH:
 * preserves Server Component semantics — no `'use client'` needed.
 *
 * Labels are PRESERVED verbatim from Phase 27 — Phase 28 only threads the
 * returnTo prop through; copy is NOT modified by this edit (existing label
 * literals in the body shipped pre-Phase-28 and stay).
 */
interface AddWatchCardProps {
  variant?: 'collection' | 'wishlist'
  /** Phase 28 D-08 — entry pathname captured by the Client parent.
   *  Null when the parent did not capture; the link falls back to /watch/new
   *  bare and AddWatchFlow uses the D-13 default destination. */
  returnTo?: string | null
}

export function AddWatchCard({ variant = 'collection', returnTo }: AddWatchCardProps) {
  const label = variant === 'wishlist' ? 'Add to Wishlist' : 'Add to Collection'
  const href = returnTo
    ? `/watch/new?returnTo=${encodeURIComponent(returnTo)}`
    : '/watch/new'
  return (
    <Link
      href={href}
      className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/40 bg-card text-accent transition-colors hover:bg-accent/5"
      aria-label={label}
    >
      <Plus className="size-6" />
      <span className="text-sm font-normal">{label}</span>
    </Link>
  )
}
