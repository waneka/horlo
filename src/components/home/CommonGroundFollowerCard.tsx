import Link from 'next/link'

import { Card, CardContent } from '@/components/ui/card'
import { AvatarDisplay } from '@/components/profile/AvatarDisplay'

/**
 * CommonGroundFollowerCard — Personal Insights card (I-01).
 *
 * Links to the Phase 9 Common Ground tab at `/u/{username}/common-ground`
 * (the 6th tab shipped in Phase 9). The parent grid selects the highest-
 * overlap follower; this component just renders.
 */
export function CommonGroundFollowerCard({
  username,
  displayName,
  avatarUrl,
  sharedCount,
}: {
  username: string
  displayName: string | null
  avatarUrl: string | null
  sharedCount: number
}) {
  const name = displayName ?? username
  return (
    <Link
      href={`/u/${username}/common-ground`}
      aria-label={`See Common Ground with ${name}`}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition hover:shadow-md">
        <CardContent className="flex items-center gap-3">
          <AvatarDisplay
            avatarUrl={avatarUrl}
            displayName={displayName}
            username={username}
            size={40}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{name}</p>
            <p className="text-sm text-muted-foreground">{sharedCount} shared</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
