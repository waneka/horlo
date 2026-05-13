import Link from 'next/link'
import { Lock } from 'lucide-react'

import { FollowButton } from '@/components/profile/FollowButton'
import { buttonVariants } from '@/components/ui/button'

type LockedTabId =
  | 'collection'
  | 'wishlist'
  | 'worn'
  | 'notes'
  | 'stats'
  | 'common-ground'

interface LockedTabCardProps {
  tab: LockedTabId
  displayName: string | null
  username: string
  // Phase 39b D-39b-12 — turn locked-state into progress instead of a dead-end.
  viewerId: string | null              // null = unauthenticated
  targetUserId: string                 // profile owner's user id (for FollowButton.targetUserId)
  initialIsFollowing: boolean          // from isFollowing(viewerId, targetUserId) at parent
  currentPath: string                  // same-origin pathname for /signin?returnTo=
}

// Per-tab label map per UI-SPEC copywriting contract. Note `worn -> "worn
// history"` remap for grammatical flow — matches UI-SPEC line 357.
const TAB_LABELS: Record<Exclude<LockedTabId, 'common-ground'>, string> = {
  collection: 'collection',
  wishlist: 'wishlist',
  worn: 'worn history',
  notes: 'notes',
  stats: 'stats',
}

/**
 * Per-tab locked-state card. Replaces the inline PrivateTabState helper in
 * [tab]/page.tsx. Shows "{displayName ?? @username} keeps their {tab-label}
 * private." with a lucide Lock icon.
 *
 * Common Ground has no locked variant (D-17) — this component returns null
 * when tab === 'common-ground' as a defense-in-depth guard. [tab]/page.tsx
 * should never render LockedTabCard for the common-ground branch in the
 * first place; it calls notFound() instead.
 *
 * Phase 39b D-39b-12: appends an inline FollowButton + caption (logged-in
 * viewer) or a sign-in Link + caption (unauthenticated viewer) so the lock
 * state ends with an action that turns it into progress. PopularCollectorRow
 * is the canonical Server-imports-Client analog — LockedTabCard stays a
 * Server Component and only the FollowButton island hydrates.
 *
 * T-39b-03 mitigation: the unauthenticated branch builds
 * `/signin?returnTo=${encodeURIComponent(currentPath)}` where `currentPath`
 * is a same-origin pathname constructed server-side from route params. The
 * `/signin` consumer enforces validateReturnTo (Phase 28 D-11).
 */
export function LockedTabCard({
  tab,
  displayName,
  username,
  viewerId,
  targetUserId,
  initialIsFollowing,
  currentPath,
}: LockedTabCardProps) {
  if (tab === 'common-ground') return null
  const name = displayName ?? `@${username}`
  const label = TAB_LABELS[tab]
  return (
    <section className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-16 text-center">
      <Lock className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-sm text-muted-foreground">
        {name} keeps their {label} private.
      </p>
      {viewerId !== null ? (
        <>
          <FollowButton
            viewerId={viewerId}
            targetUserId={targetUserId}
            targetDisplayName={name}
            initialIsFollowing={initialIsFollowing}
            variant="inline"
          />
          <p className="text-sm text-muted-foreground">
            Follow @{username} to see their {label}.
          </p>
        </>
      ) : (
        <>
          <Link
            href={`/signin?returnTo=${encodeURIComponent(currentPath)}`}
            className={buttonVariants({ variant: 'outline', size: 'default' })}
          >
            Sign in to follow
          </Link>
          <p className="text-sm text-muted-foreground">
            Sign in to see @{username}&apos;s {label}.
          </p>
        </>
      )}
    </section>
  )
}
