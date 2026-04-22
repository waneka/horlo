import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { getSafeImageUrl } from '@/lib/images'
import { timeAgo } from '@/lib/timeAgo'
import type { AggregatedRow } from '@/lib/feedTypes'

// F-08 aggregated-row verbs.
// UI-SPEC § Verbs explicitly lists "added {N} watches"; for symmetry the
// planner chose "wishlisted {N} watches" for wishlist_added aggregations.
// `watch_worn` never aggregates (see feedAggregate.ts contract).
const AGG_VERBS: Record<AggregatedRow['type'], string> = {
  watch_added: 'added',
  wishlist_added: 'wishlisted',
}

/**
 * AggregatedActivityRow — F-08 display for collapsed groups.
 * Line 1: `{username} {verb} {count} watches` (username + count in semibold)
 * Line 2: timeAgo(firstCreatedAt) — the most recent row in the group
 *
 * Entire row is a link to the collector's profile (aggregated groups have no
 * single watch target, so there is no nested watch-name link).
 */
export function AggregatedActivityRow({ row }: { row: AggregatedRow }) {
  const profileHref = `/u/${row.username}/collection`
  const time = timeAgo(row.firstCreatedAt)
  const ariaLabel = `${row.username} ${AGG_VERBS[row.type]} ${row.count} watches. ${time}. View profile.`
  const safeThumb = getSafeImageUrl(row.representativeMetadata.imageUrl)
  const alt = `${row.representativeMetadata.brand} ${row.representativeMetadata.model}`.trim()

  return (
    <div className="group relative flex items-center gap-4 min-h-16 bg-card px-4 py-3 rounded-md transition-colors hover:bg-muted/40 focus-within:bg-muted/40">
      <Link
        href={profileHref}
        aria-label={ariaLabel}
        className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <AvatarDisplay
        avatarUrl={row.avatarUrl}
        displayName={row.displayName}
        username={row.username}
        size={40}
      />
      <div className="relative flex-1 min-w-0 space-y-1">
        <p className="text-base font-normal truncate">
          <span className="font-semibold">{row.username}</span>{' '}
          {AGG_VERBS[row.type]}{' '}
          <span className="font-semibold">{row.count}</span>{' '}
          watches
        </p>
        <p className="text-sm font-normal text-muted-foreground">{time}</p>
      </div>
      <div className="shrink-0 size-12 md:size-14 rounded bg-muted flex items-center justify-center overflow-hidden">
        {safeThumb ? (
          <Image
            src={safeThumb}
            alt={alt}
            width={56}
            height={56}
            className="object-cover size-full"
            unoptimized
          />
        ) : (
          <WatchIcon className="size-6 text-muted-foreground/60" aria-hidden />
        )}
      </div>
    </div>
  )
}
