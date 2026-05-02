'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProfileWatchCard } from './ProfileWatchCard'
import { AddWatchCard } from './AddWatchCard'
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
      {isOwner && <AddWatchCard variant="wishlist" />}
    </div>
  )
}
