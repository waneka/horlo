'use client'

import { ProfileWatchCard } from './ProfileWatchCard'
import type { Watch } from '@/lib/types'

interface WishlistTabContentProps {
  watches: Watch[]
  wearDates: Record<string, string>
  // isOwner accepted for symmetry with other tab content components and future
  // "Add to Wishlist" affordances. Not currently used.
  isOwner?: boolean
}

export function WishlistTabContent({
  watches,
  wearDates,
}: WishlistTabContentProps) {
  if (watches.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-base font-semibold">Your wishlist is empty.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Track watches you want with target prices and notes.
        </p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
