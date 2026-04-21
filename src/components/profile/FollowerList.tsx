import { FollowerListCard } from './FollowerListCard'
import type { FollowerListEntry } from '@/data/follows'

export interface FollowerListProps {
  /** Rows to render, already ordered by follows.created_at DESC (Plan 01 DAL). */
  entries: FollowerListEntry[]
  /**
   * Set of userIds the current viewer already follows. Used to hydrate each
   * row's inline FollowButton with its correct initial state so the
   * Following / Follow label is correct without a client-side fetch.
   */
  viewerFollowingSet: Set<string>
  /** null for unauthenticated viewer — FollowButton handles the /login redirect. */
  viewerId: string | null
  /** Pre-resolved empty-state copy per UI-SPEC (owner-specific vs other-profile vs own). */
  emptyCopy: string
  /** True on /followers (show "N days ago"); false on /following. */
  showFollowedAt: boolean
}

/**
 * Server Component — maps the follower/following DAL result into
 * FollowerListCard rows, or renders the UI-SPEC empty-state card when the
 * list is empty. Pure presentation: all auth + privacy gating happens
 * upstream (the list itself is public per D-21).
 */
export function FollowerList({
  entries,
  viewerFollowingSet,
  viewerId,
  emptyCopy,
  showFollowedAt,
}: FollowerListProps) {
  if (entries.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center rounded-xl border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyCopy}</p>
      </section>
    )
  }

  return (
    <ul>
      {entries.map((entry) => (
        <li key={entry.userId}>
          <FollowerListCard
            entry={entry}
            viewerId={viewerId}
            viewerIsFollowing={viewerFollowingSet.has(entry.userId)}
            isOwnRow={viewerId !== null && viewerId === entry.userId}
            showFollowedAt={showFollowedAt}
          />
        </li>
      ))}
    </ul>
  )
}
