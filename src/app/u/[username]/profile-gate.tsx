import 'server-only'
import { notFound } from 'next/navigation'
import { isFollowing } from '@/data/follows'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { CommonGroundHeroBand } from '@/components/profile/CommonGroundHeroBand'
import { LockedProfileState } from '@/components/profile/LockedProfileState'
import { ProfileTabs } from '@/components/profile/ProfileTabs'
import { resolveCommonGround } from './common-ground-gate'
import { ProfileShellResolver } from './profile-shell-resolver'

/**
 * Server-side profile shell gate — viewer-dependent branching outside the
 * cached scope (D-39c-05, T-39c-01 / T-39c-04 mitigations). Receives `viewerId`
 * from its caller (Phase 52 D-52-CF-02). Two caller paths after Phase 52's
 * restructure:
 *
 *   * `ProfileChrome` (`./profile-chrome.tsx`) — the async runtime-API
 *     consumer the sync layout wraps in `<Suspense>`. ProfileChrome owns
 *     the cookie read (resolves viewer identity from the session via
 *     `@/lib/auth`) and passes the resolved `viewerId` here. This is the
 *     primary layout-level composition path.
 *
 *   * `ProfileTabContent` (`./[tab]/page.tsx` inner async function) — the
 *     per-tab branching inside the page's own `<Suspense>` boundary. The
 *     page resolves its own `viewerId` for tab-specific gates
 *     (`isFollowing`, `resolveCommonGround`, per-tab privacy checks);
 *     ProfileGate itself is not invoked from the page, but the same
 *     viewerId-as-prop contract is the route-wide invariant.
 *
 * Phase 52 D-52-CF-02 / Phase 39c Pitfall 1 (structural enforcement): the
 * cookie read PHYSICALLY lives in `ProfileChrome` (uncached, async, inside
 * `<Suspense>` per the canonical Cache Components pattern). This file
 * cannot read cookies — the absence of any `@/lib/auth` import below
 * makes the invariant structural rather than conventional.
 *
 * Load-bearing invariants:
 *   (a) `notFound()` MUST be called BEFORE any post-suspending `await`
 *       (Pitfall 5 — loading.md:118-124). It is called immediately after the
 *       resolver returns null, before `isFollowing` or `resolveCommonGround`.
 *   (b) `viewerId` is received as a prop and lives OUTSIDE the
 *       `<ProfileShellResolver/>` cached scope (Pitfall 1). The resolver MUST
 *       NOT receive viewerId. This gate physically cannot read cookies — the
 *       invariant is now structural rather than conventional.
 *   (c) `<ProfileShellResolver/>` is called HERE (inside the gate, not in the
 *       layout body or ProfileChrome) so the locked branch can render
 *       `<LockedProfileState/>` without falling through to the public
 *       composition.
 *
 * PROHIBITED inside this file:
 *   - use-cache directive — the gate is the uncached layer; this MUST stay uncached
 *   - next/cache tag/life primitives (gate is uncached by design)
 *   - Reading cookies via any means — viewer identity arrives via the
 *     `viewerId` prop, resolved by ProfileChrome (Pitfall 1 structural lock,
 *     D-52-CF-02)
 *   - Importing from `@/lib/auth` — the gate is no longer the cookie boundary
 */
export async function ProfileGate({
  username,
  viewerId,
  initialIsFollowing: initialIsFollowingProp,
  children,
}: {
  username: string
  viewerId: string | null
  /**
   * WR-02 (Phase 51 review): optional caller-supplied follow state. When the
   * page already computed `isFollowing(viewerId, profile.id)` (the /u/[tab]
   * page does this to drive its LockedTabCard branches), it can pass the
   * value forward to avoid a second identical DB round-trip on every render.
   * If omitted, the gate falls back to fetching its own copy — this keeps
   * the gate reusable from non-tab callers without forcing every caller to
   * pre-compute follow state.
   */
  initialIsFollowing?: boolean
  children: React.ReactNode
}) {
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
  //
  // WR-02 (Phase 51 review): prefer the caller-supplied value when provided
  // (the /u/[tab] page hoists this fetch). Falls back to a local read so the
  // gate remains correct when reused from a caller that does not pre-compute.
  const initialIsFollowing =
    initialIsFollowingProp ??
    (viewerId && !isOwner ? await isFollowing(viewerId, profile.id) : false)

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
