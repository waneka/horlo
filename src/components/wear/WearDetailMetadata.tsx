import Link from 'next/link'
import Image from 'next/image'
import type { JSX } from 'react'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { getSafeImageUrl } from '@/lib/images'
import { timeAgo } from '@/lib/timeAgo'

/**
 * Metadata stack below the hero on /wear/[wearEventId] (WYWT-17, 15-CONTEXT.md D-20).
 *
 * Collector row → watch row → optional note. No engagement mechanics
 * (no like/comment/share/save) — matches PROJECT.md Out-of-Scope posture
 * and keeps the v3.0 data model simple.
 *
 * Uses the project's existing `AvatarDisplay` (src/components/profile/) rather
 * than inventing a new Avatar primitive. `formatRelativeTime` referenced in
 * the plan resolves to `timeAgo` in @/lib/timeAgo — the canonical Phase 10
 * helper used by WywtSlide + every other timestamp surface.
 */
export function WearDetailMetadata({
  username,
  displayName,
  avatarUrl,
  brand,
  model,
  watchImageUrl,
  note,
  createdAt,
}: {
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  brand: string
  model: string
  watchImageUrl: string | null
  note: string | null
  createdAt: Date
}): JSX.Element {
  const safeWatchImage = getSafeImageUrl(watchImageUrl)
  const showCollector = Boolean(username)

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 md:max-w-[600px] md:mx-auto">
      {/* Collector row: avatar + linked username + relative time */}
      <div className="flex items-center gap-3">
        {showCollector ? (
          <Link
            href={`/u/${username}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <AvatarDisplay
              avatarUrl={avatarUrl}
              displayName={displayName}
              username={username!}
              size={40}
            />
            <span className="text-sm font-semibold">
              {displayName ?? username}
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <AvatarDisplay
              avatarUrl={null}
              displayName={null}
              username="?"
              size={40}
            />
            <span className="text-sm font-semibold text-muted-foreground">
              Unknown collector
            </span>
          </div>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {timeAgo(createdAt)}
        </span>
      </div>

      {/* Watch row: small image + brand/model stacked */}
      <div className="flex items-center gap-3">
        {safeWatchImage ? (
          <div className="relative size-10 overflow-hidden rounded-md bg-muted">
            <Image
              src={safeWatchImage}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="size-10 rounded-md bg-muted" aria-hidden />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{brand}</span>
          <span className="text-sm text-muted-foreground">{model}</span>
        </div>
      </div>

      {/* Optional note */}
      {note && (
        <p className="text-sm text-foreground whitespace-pre-wrap">{note}</p>
      )}
    </div>
  )
}
