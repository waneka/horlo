import { notFound } from 'next/navigation'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import {
  getProfileByUsername,
  getProfileSettings,
  getFollowerCounts,
} from '@/data/profiles'
import { getWatchesByUser } from '@/data/watches'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import { computeTasteTags } from '@/lib/tasteTags'
import { ProfileTabs } from '@/components/profile/ProfileTabs'
import { LockedProfileState } from '@/components/profile/LockedProfileState'
import { ProfileHeader } from '@/components/profile/ProfileHeader'

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  // Resolve viewer FIRST so we know if owner == viewer.
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }

  const profile = await getProfileByUsername(username)
  // Letterboxd pattern (T-08-06): identical 404 whether profile is missing or private + non-owner.
  // We resolve to notFound() here for missing; private+non-owner is handled below by rendering LockedProfileState.
  if (!profile) notFound()

  const isOwner = viewerId === profile.id
  const settings = await getProfileSettings(profile.id)

  if (!isOwner && !settings.profilePublic) {
    const counts = await getFollowerCounts(profile.id)
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
        <LockedProfileState
          username={profile.username}
          displayName={profile.displayName ?? null}
          bio={profile.bio ?? null}
          avatarUrl={profile.avatarUrl ?? null}
          followerCount={counts.followers}
          followingCount={counts.following}
        />
      </main>
    )
  }

  // Public path (or owner path) — fetch the rest of the data needed for header taste tags.
  const [counts, watches, wearEvents] = await Promise.all([
    getFollowerCounts(profile.id),
    getWatchesByUser(profile.id),
    getAllWearEventsByUser(profile.id),
  ])

  // Collection age = days from earliest acquisitionDate to now (createdAt is on the
  // watch row but not on the domain Watch). Default to 30 days when unknown so the
  // Daily Rotator tag isn't falsely added before there is enough history.
  const earliestDate = watches
    .map((w) => w.acquisitionDate)
    .filter((d): d is string => Boolean(d))
    .sort()[0]
  const collectionAgeDays = earliestDate
    ? Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(earliestDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 30

  const tasteTags = computeTasteTags({
    watches,
    totalWearEvents: wearEvents.length,
    collectionAgeDays,
  })

  const ownedCount = watches.filter((w) => w.status === 'owned').length
  const wishlistCount = watches.filter(
    (w) => w.status === 'wishlist' || w.status === 'grail',
  ).length

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
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
      />
      <div className="mt-6">
        <ProfileTabs username={username} />
      </div>
      <div className="mt-6">{children}</div>
    </main>
  )
}
