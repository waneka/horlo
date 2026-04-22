import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { FollowButton } from '@/components/profile/FollowButton'
import type { SuggestedCollector } from '@/lib/discoveryTypes'

/**
 * SuggestedCollectorRow — one row in the "Collectors to follow" section
 * (CONTEXT.md S-02).
 *
 * Layout (left → right):
 *   avatar 40×40 · displayName/username + "{N}% taste overlap" · up to
 *   3 mini-thumb cluster + "{N} shared" · FollowButton variant="inline"
 *
 * Click semantics (pattern mirrors feed rows): the whole row is clickable
 * via an absolute-inset Link overlay → /u/{username}/collection. The
 * FollowButton is raised with `relative z-10` so its click never bubbles
 * up to the row link. `initialIsFollowing` is ALWAYS false because this
 * component only renders candidates the viewer does NOT follow (enforced
 * by the DAL's notInArray exclusion — T-10-04-02).
 */
export function SuggestedCollectorRow({
  collector,
  viewerId,
}: {
  collector: SuggestedCollector
  viewerId: string
}) {
  const name = collector.displayName ?? collector.username
  const overlapPct = Math.round(collector.overlap * 100)

  return (
    <div className="group relative flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md transition-colors hover:bg-muted/40">
      <Link
        href={`/u/${collector.username}/collection`}
        aria-label={`${name}'s profile`}
        className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <AvatarDisplay
        avatarUrl={collector.avatarUrl}
        displayName={collector.displayName}
        username={collector.username}
        size={40}
      />
      <div className="relative flex-1 min-w-0 pointer-events-none">
        <p className="text-sm font-semibold truncate">{name}</p>
        <p className="text-sm text-muted-foreground">
          {overlapPct}% taste overlap
        </p>
      </div>
      {collector.sharedWatches.length > 0 && (
        <div className="relative hidden sm:flex items-center pointer-events-none">
          {collector.sharedWatches.map((w, i) => (
            <div
              key={w.watchId}
              className="size-10 md:size-12 rounded-full bg-muted ring-2 ring-card overflow-hidden flex items-center justify-center"
              style={{ marginLeft: i === 0 ? 0 : '-0.5rem' }}
            >
              {w.imageUrl ? (
                <Image
                  src={w.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <WatchIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              )}
            </div>
          ))}
          <span
            className="text-sm text-muted-foreground ml-3"
            aria-label={`${collector.sharedCount} shared watches with you`}
          >
            {collector.sharedCount} shared
          </span>
        </div>
      )}
      <div className="relative z-10">
        <FollowButton
          viewerId={viewerId}
          targetUserId={collector.userId}
          targetDisplayName={name}
          initialIsFollowing={false}
          variant="inline"
        />
      </div>
    </div>
  )
}
