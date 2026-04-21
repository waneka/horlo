import { notFound } from 'next/navigation'

import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getProfileByUsername } from '@/data/profiles'
import { getFollowingForProfile, isFollowing } from '@/data/follows'
import { FollowerList } from '@/components/profile/FollowerList'

/**
 * GET /u/[username]/following — Server Component.
 *
 * Mirror of /followers with getFollowingForProfile instead of
 * getFollowersForProfile. No "days ago" on rows (showFollowedAt=false) per
 * UI-SPEC copywriting contract.
 *
 * 404 on missing username via notFound() — same surface as missing profile
 * anywhere else in the app (T-09-16 existence-disclosure mitigation).
 */
export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const profile = await getProfileByUsername(username)
  if (!profile) notFound()

  // Resolve viewer (anonymous viewers stay null without throwing).
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }
  const isOwner = viewerId === profile.id

  const entries = await getFollowingForProfile(profile.id)

  // Batched isFollowing hydration for per-row FollowButton initial state.
  const viewerFollowingSet = new Set<string>()
  if (viewerId) {
    const localViewerId = viewerId
    const results = await Promise.all(
      entries.map((e) => isFollowing(localViewerId, e.userId)),
    )
    entries.forEach((e, i) => {
      if (results[i]) viewerFollowingSet.add(e.userId)
    })
  }

  const primaryLabel = profile.displayName ?? `@${profile.username}`

  // UI-SPEC empty-state copy — owner-on-own vs other-profile variants.
  let emptyCopy = ''
  if (entries.length === 0) {
    emptyCopy = isOwner
      ? 'You arent following anyone yet.'
      : `${primaryLabel} isnt following anyone yet.`
  }

  return (
    <div>
      <header className="pt-8 pb-4">
        <h1 className="text-xl font-semibold">Following</h1>
        <p className="text-sm text-muted-foreground">
          {primaryLabel} is following
        </p>
      </header>
      <FollowerList
        entries={entries}
        viewerFollowingSet={viewerFollowingSet}
        viewerId={viewerId}
        emptyCopy={emptyCopy}
        showFollowedAt={false}
      />
    </div>
  )
}
