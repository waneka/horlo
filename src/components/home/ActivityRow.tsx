import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { getSafeImageUrl } from '@/lib/images'
import { timeAgo } from '@/lib/timeAgo'
import type { RawFeedRow } from '@/lib/feedTypes'

// F-02 flat verbs — exact strings locked by UI-SPEC § Copywriting § Verbs.
const VERBS: Record<RawFeedRow['type'], string> = {
  watch_added: 'added',
  wishlist_added: 'wishlisted',
  watch_worn: 'wore',
}

/**
 * ActivityRow — F-01 composition:
 *   [avatar LEFT] [{username} {verb} {watchName}    ] [thumbnail RIGHT]
 *                 [{time ago}                       ]
 *
 * F-03: clicking anywhere on the row except the watch name navigates to
 * `/u/{username}/collection`. The watch-name link is a separate, nested
 * clickable that escapes the full-row overlay via `relative z-10`.
 */
export function ActivityRow({ row }: { row: RawFeedRow }) {
  const profileHref = `/u/${row.username}/collection`
  const watchName = `${row.metadata.brand} ${row.metadata.model}`.trim()
  const safeThumb = getSafeImageUrl(row.metadata.imageUrl)

  return (
    <div className="group relative flex items-center gap-4 min-h-16 bg-card px-4 py-3 rounded-md transition-colors hover:bg-muted/40 focus-within:bg-muted/40">
      {/* Full-row link overlay (F-03): absolute inset-0 catches row clicks. */}
      <Link
        href={profileHref}
        aria-label={`${row.username}'s profile`}
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
          {VERBS[row.type]}{' '}
          {row.watchId ? (
            <Link
              href={`/watch/${row.watchId}`}
              aria-label={`${watchName} detail`}
              className="relative z-10 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {watchName}
            </Link>
          ) : (
            <span>{watchName}</span>
          )}
        </p>
        <p className="text-sm font-normal text-muted-foreground">
          {timeAgo(row.createdAt)}
        </p>
      </div>
      <div className="shrink-0 size-12 md:size-14 rounded bg-muted flex items-center justify-center overflow-hidden">
        {safeThumb ? (
          <Image
            src={safeThumb}
            alt={watchName}
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
