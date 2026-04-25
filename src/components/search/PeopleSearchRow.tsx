import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { FollowButton } from '@/components/profile/FollowButton'
import { HighlightedText } from '@/components/search/HighlightedText'
import type { SearchProfileResult } from '@/lib/searchTypes'

/**
 * Phase 16 People Search result row (SRCH-05).
 *
 * Mirrors src/components/home/SuggestedCollectorRow.tsx visual pattern (D-13)
 * with three differences:
 *   1. Adds a 1-line bio snippet between the overlap line and the shared-watch
 *      cluster (D-14, line-clamp-1 truncation).
 *   2. Username and bio snippet are wrapped in <HighlightedText> for D-15
 *      match highlighting against the active query.
 *   3. FollowButton.initialIsFollowing is hydrated from result.isFollowing
 *      (D-19 — search may surface already-followed collectors; the inline
 *      FollowButton renders the correct "Following" state without a roundtrip).
 *
 * Click semantics (mirrors SuggestedCollectorRow):
 *   - Whole-row absolute-inset Link → /u/{username}/collection
 *   - FollowButton raised with relative z-10 so click does not bubble
 *
 * Mini-thumb cluster hidden on mobile via `hidden sm:flex` (D-17) — keeps row
 * scannable on narrow viewports.
 *
 * Privacy: this row is rendered by /search; the DAL (Plan 02) enforces
 * profile_public = true upstream — private profiles never reach this component.
 */
export function PeopleSearchRow({
  result,
  q,
  viewerId,
}: {
  result: SearchProfileResult
  q: string
  viewerId: string
}) {
  const name = result.displayName ?? result.username
  const overlapPct = Math.round(result.overlap * 100)

  return (
    <div className="group relative flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md transition-colors hover:bg-muted/40">
      <Link
        href={`/u/${result.username}/collection`}
        aria-label={`${name}'s profile`}
        className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <AvatarDisplay
        avatarUrl={result.avatarUrl}
        displayName={result.displayName}
        username={result.username}
        size={40}
      />
      <div className="relative flex-1 min-w-0 pointer-events-none">
        <p className="text-sm font-semibold truncate">
          <HighlightedText text={name} q={q} />
        </p>
        <p className="text-sm text-muted-foreground">
          {overlapPct}% taste overlap
        </p>
        {result.bioSnippet && (
          <p className="text-sm text-muted-foreground line-clamp-1">
            <HighlightedText text={result.bioSnippet} q={q} />
          </p>
        )}
      </div>
      {result.sharedWatches.length > 0 && (
        <div className="relative hidden sm:flex items-center pointer-events-none">
          {result.sharedWatches.map((w, i) => (
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
                <WatchIcon className="size-4 text-muted-foreground" aria-hidden />
              )}
            </div>
          ))}
          <span
            className="text-sm text-muted-foreground ml-3"
            aria-label={`${result.sharedCount} shared watches with you`}
          >
            {result.sharedCount} shared
          </span>
        </div>
      )}
      <div className="relative z-10">
        <FollowButton
          viewerId={viewerId}
          targetUserId={result.userId}
          targetDisplayName={name}
          initialIsFollowing={result.isFollowing}
          variant="inline"
        />
      </div>
    </div>
  )
}
