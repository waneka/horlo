import 'server-only'
import { notFound } from 'next/navigation'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { isFollowing } from '@/data/follows'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { CommonGroundHeroBand } from '@/components/profile/CommonGroundHeroBand'
import { LockedProfileState } from '@/components/profile/LockedProfileState'
import { ProfileTabs } from '@/components/profile/ProfileTabs'
import { resolveCommonGround } from './common-ground-gate'
import { ProfileShellResolver } from './profile-shell-resolver'

/**
 * Server-side profile shell gate — viewer-dependent branching outside the
 * cached scope (D-39c-05, T-39c-01 / T-39c-04 mitigations).
 *
 * Load-bearing invariants:
 *   (a) `notFound()` MUST be called BEFORE any post-suspending `await`
 *       (Pitfall 5 — loading.md:118-124). It is called immediately after the
 *       resolver returns null, before `isFollowing` or `resolveCommonGround`.
 *   (b) `getCurrentUser()` lives OUTSIDE the `<ProfileShellResolver/>` cached
 *       scope (Pitfall 1). This gate is the uncached layer; the resolver MUST
 *       NOT receive viewerId.
 *   (c) `<ProfileShellResolver/>` is called HERE (inside the gate, not in the
 *       layout body) so the locked branch can render `<LockedProfileState/>`
 *       without falling through to the public composition.
 *
 * PROHIBITED inside this file:
 *   - use-cache directive — the gate is the uncached layer; this MUST stay uncached
 *   - next/cache tag/life primitives (gate is uncached by design)
 *   - Reading cookies via any means other than the `getCurrentUser()` try/catch
 */
export async function ProfileGate({
  username,
  children,
}: {
  username: string
  children: React.ReactNode
}) {
  // Viewer resolution OUTSIDE the cached scope — Pitfall 1.
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }

  // Cached, owner-scoped read.
  const resolved = await ProfileShellResolver({ username })

  // 404 BEFORE any post-suspending await (Pitfall 5 — loading.md:118-124).
  if (!resolved.profile) notFound()

  // TypeScript narrows `resolved.profile` to non-null because `notFound()` is `never`-returning.
  const { profile, settings, counts, watches, tasteTags } = resolved

  const isOwner = viewerId === profile.id

  // FOLL-03: hydrate "is this viewer already following the owner?" so the
  // FollowButton renders in its correct initial state on the server. Skipped
  // for owner (button is hidden entirely) and unauth viewers (click bounces
  // to /login regardless of follow state).
  const initialIsFollowing =
    viewerId && !isOwner ? await isFollowing(viewerId, profile.id) : false

  // Locked branch (T-39c-04 mitigation): private-profile gating reads cached
  // settings.profilePublic AFTER the cached resolver returns, BEFORE the public
  // composition renders. Locked branch follower counts reflect the 300s cache
  // window per D-39c-03 (deliberate — SC#6 mandates notFound() short-circuit
  // and locked branch, not live counts).
  if (!isOwner && !settings.profilePublic) {
    return (
      <LockedProfileState
        username={profile.username}
        displayName={profile.displayName ?? null}
        bio={profile.bio ?? null}
        avatarUrl={profile.avatarUrl ?? null}
        followerCount={counts.followers}
        followingCount={counts.following}
        viewerId={viewerId}
        targetUserId={profile.id}
        initialIsFollowing={initialIsFollowing}
      />
    )
  }

  // Public path (or owner path).
  const overlap = await resolveCommonGround({
    viewerId,
    ownerId: profile.id,
    isOwner,
    collectionPublic: settings.collectionPublic,
  })

  const ownedCount = watches.filter((w) => w.status === 'owned').length
  const wishlistCount = watches.filter(
    (w) => w.status === 'wishlist' || w.status === 'grail',
  ).length

  return (
    <>
      <ProfileHeader
        username={username}
        displayName={profile.displayName ?? null}
        bio={profile.bio ?? null}
        avatarUrl={profile.avatarUrl ?? null}
        isOwner={isOwner}
        followerCount={counts.followers}
        followingCount={counts.following}
        watchCount={ownedCount}
        wishlistCount={wishlistCount}
        tasteTags={tasteTags}
        viewerId={viewerId}
        targetUserId={profile.id}
        initialIsFollowing={initialIsFollowing}
        targetDisplayName={profile.displayName ?? `@${profile.username}`}
      />
      {overlap && (
        <CommonGroundHeroBand overlap={overlap} ownerUsername={username} />
      )}
      <div className="mt-6">
        <ProfileTabs
          username={username}
          showCommonGround={overlap?.hasAny ?? false}
          isOwner={isOwner}
        />
      </div>
      <div className="mt-6">{children}</div>
    </>
  )
}
