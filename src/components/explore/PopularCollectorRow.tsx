import Link from 'next/link'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { FollowButton } from '@/components/profile/FollowButton'
import type { PopularCollector } from '@/data/discovery'

/**
 * PopularCollectorRow — one row in the Popular Collectors rail (DISC-04 / D-11).
 *
 * Mirrors SuggestedCollectorRow exactly minus the mini-thumb cluster (the
 * "shared with viewer" thumbs from Phase 10 don't apply to a follower-ranked
 * row). Sublabel switches from "{N}% taste overlap" to "{N} followers" with
 * an optional "· {N} watches" tertiary stat.
 *
 * Click semantics mirror SuggestedCollectorRow: the whole row is clickable
 * via an absolute-inset Link → /u/{username}/collection. The FollowButton
 * is raised with `relative z-10` so its click never bubbles up to the row
 * link. `initialIsFollowing` is ALWAYS false because the DAL exclusion
 * (Pattern 4) guarantees the viewer doesn't already follow this collector.
 */
export function PopularCollectorRow({
  collector,
  viewerId,
}: {
  collector: PopularCollector
  viewerId: string
}) {
  const name = collector.displayName ?? collector.username
  const followersText =
    collector.followersCount === 1
      ? '1 follower'
      : `${collector.followersCount} followers`
  const watchesText =
    collector.watchCount > 0
      ? collector.watchCount === 1
        ? ' · 1 watch'
        : ` · ${collector.watchCount} watches`
      : ''

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
          {followersText}
          {watchesText}
        </p>
      </div>
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
