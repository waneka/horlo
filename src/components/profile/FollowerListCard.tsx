'use client'

import Link from 'next/link'

import { AvatarDisplay } from './AvatarDisplay'
import { FollowButton } from './FollowButton'
import type { FollowerListEntry } from '@/data/follows'
import { cn } from '@/lib/utils'

export interface FollowerListCardProps {
  /** Single row payload from getFollowersForProfile / getFollowingForProfile (Plan 01). */
  entry: FollowerListEntry
  /** Current viewer — null when unauthenticated. Passed into FollowButton for auth gating. */
  viewerId: string | null
  /** Server-hydrated initial state: does the viewer already follow THIS row's user? */
  viewerIsFollowing: boolean
  /** True iff this row represents the viewer themselves — hides the FollowButton (D-12). */
  isOwnRow: boolean
  /** True on /followers page (show "N days ago"); false on /following page. */
  showFollowedAt: boolean
}

/**
 * One row in a follower / following list (FOLL-04).
 *
 * Layout contract (UI-SPEC, "Follower / following list page layout"):
 *   [Avatar 40px] [displayName ?? @username]           [Follow btn]
 *                 [bio truncated 1 line]
 *                 [N watches · M wishlist]  ·  3 days ago
 *
 * Interaction contract:
 *   - Whole row is clickable as a Link to /u/{username}/collection (D-14 explicit
 *     default-tab link — skips the layout redirect hop).
 *   - Link overlay is absolute-positioned so text/avatar stay behind it; the
 *     FollowButton wrapper sets pointer-events-auto + stopPropagation so clicks
 *     on the button don't navigate.
 *   - Button hidden entirely on own row (D-12).
 *
 * Private-profile masking (T-09-15):
 *   - When entry.profilePublic === false, bio and stat strip are NOT rendered.
 *     Username + avatar still render — the graph is public (D-21) but surface
 *     area for private profiles in lists is intentionally minimal.
 */
export function FollowerListCard({
  entry,
  viewerId,
  viewerIsFollowing,
  isOwnRow,
  showFollowedAt,
}: FollowerListCardProps) {
  const primaryLabel = entry.displayName ?? `@${entry.username}`
  const showBioAndStats = entry.profilePublic === true

  return (
    <div
      className={cn(
        'relative flex items-center gap-4 border-b border-border py-4 transition-colors',
        'hover:bg-muted/40',
      )}
    >
      {/*
        Link overlay covers the entire row. Inner content uses pointer-events-none
        so the Link receives clicks/focus; the Follow button wrapper below re-enables
        pointer events locally. aria-label spells out the navigation target.
      */}
      <Link
        href={`/u/${entry.username}/collection`}
        aria-label={`View ${primaryLabel}'s profile`}
        className="absolute inset-0 z-0"
      />

      <div className="relative z-10 pointer-events-none">
        <AvatarDisplay
          avatarUrl={entry.avatarUrl}
          displayName={entry.displayName}
          username={entry.username}
          size={40}
        />
      </div>

      <div className="relative z-10 flex-1 min-w-0 pointer-events-none">
        <p className="text-sm font-semibold text-foreground truncate">
          {primaryLabel}
        </p>
        {showBioAndStats && entry.bio && (
          <p className="text-xs text-muted-foreground truncate">{entry.bio}</p>
        )}
        {showBioAndStats && (
          <p className="text-xs text-muted-foreground">
            {entry.watchCount} watches · {entry.wishlistCount} wishlist
            {showFollowedAt && (
              <> · {relativeTime(entry.followedAt)}</>
            )}
          </p>
        )}
      </div>

      {!isOwnRow && (
        <div
          className="relative z-10 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
          }}
        >
          <FollowButton
            viewerId={viewerId}
            targetUserId={entry.userId}
            targetDisplayName={primaryLabel}
            initialIsFollowing={viewerIsFollowing}
            variant="inline"
          />
        </div>
      )}
    </div>
  )
}

/**
 * Human-readable relative time, UI-SPEC copywriting contract on /followers only.
 * - < 1 day → "today"
 * - exactly 1 day → "1 day ago"
 * - < 30 days → "{n} days ago"
 * - < 365 days → "1 month ago" / "{n} months ago"
 * - >= 365 days → "1 year ago" / "{n} years ago"
 */
function relativeTime(isoDate: string): string {
  const then = new Date(isoDate).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const day = 86_400_000
  const days = Math.floor(diffMs / day)
  if (days < 1) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`
  const years = Math.floor(days / 365)
  return years === 1 ? '1 year ago' : `${years} years ago`
}
