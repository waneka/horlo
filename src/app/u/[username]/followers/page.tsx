import { notFound } from 'next/navigation'

import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getProfileByUsername } from '@/data/profiles'
import { getFollowersForProfile, isFollowing } from '@/data/follows'
import { FollowerList } from '@/components/profile/FollowerList'

/**
 * GET /u/[username]/followers — Server Component.
 *
 * Rendered inside the shared /u/[username] layout (ProfileHeader + ProfileTabs
 * already provide profile context). Resolves the owner profile, then:
 *   1. Fetches the follower list via the Plan 01 single-query DAL (no N+1).
 *   2. Hydrates a viewerFollowingSet via batched Promise.all(isFollowing ...)
 *      so each row's inline FollowButton renders in the correct initial state
 *      server-side — no client fetch, no flash.
 *   3. Resolves UI-SPEC empty-state copy (owner vs other) before passing down.
 *
 * 404 on missing username via notFound() — mirrors the Phase 8 Letterboxd
 * pattern (T-09-16 existence-disclosure mitigation).
 */
export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const profile = await getProfileByUsername(username)
  if (!profile) notFound()

  // Resolve viewer (anonymous viewers stay null without throwing —
  // mirrors src/app/u/[username]/[tab]/page.tsx lines 45-50).
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }
  const isOwner = viewerId === profile.id

  const entries = await getFollowersForProfile(profile.id)

  // Batched isFollowing hydration for per-row FollowButton initial state.
  // Single round trip across N parallel queries — no N+1 serial loop.
  // T-09-19 "discloses viewer's own follows to themselves" is accepted risk
  // (self-known fact; only the authenticated viewer sees these flags).
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
      ? 'You dont have any followers yet.'
      : 'No followers yet.'
  }

  return (
    <div>
      <header className="pt-8 pb-4">
        <h1 className="text-xl font-semibold">Followers</h1>
        <p className="text-sm text-muted-foreground">
          {primaryLabel}&apos;s followers
        </p>
      </header>
      <FollowerList
        entries={entries}
        viewerFollowingSet={viewerFollowingSet}
        viewerId={viewerId}
        emptyCopy={emptyCopy}
        showFollowedAt={true}
      />
    </div>
  )
}
