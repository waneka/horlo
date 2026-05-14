import { cacheLife, cacheTag } from 'next/cache'

import {
  getProfileByUsername,
  getProfileSettings,
  getFollowerCounts,
} from '@/data/profiles'
import { getWatchesByUser } from '@/data/watches'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import { computeTasteTags } from '@/lib/tasteTags'

/**
 * ProfileShellResolver — owner-scoped cached aggregator for the profile shell (D-39c-03).
 *
 * CRITICAL (Pitfall 1): viewerId MUST NOT be read inside this cached scope.
 * Viewer-scoped reads (`isFollowing`, `resolveCommonGround`) live in `<ProfileGate/>`.
 * If viewer identity leaked into this scope, the cache key would omit the viewer
 * and serve the first viewer's overlay data to subsequent viewers.
 *
 * Cache profile: per-username 5min revalidate; tag `profile:${username}` is
 * invalidated by Server Actions in profile.ts / watches.ts / follows.ts /
 * wearEvents.ts per D-39c-04. One cache entry shared across ALL viewers for
 * the same profile — correct for owner-scoped data.
 *
 * Empty-state policy: if profile lookup returns null, return `{ profile: null }
 * as const` — the gate calls `notFound()`.
 */
export async function ProfileShellResolver({ username }: { username: string }) {
  'use cache'
  cacheTag(`profile:${username}`)
  cacheLife({ revalidate: 300 }) // 300s = 5min; qualifies for prerender (cacheLife.md:254-258)

  const profile = await getProfileByUsername(username)
  if (!profile) return { profile: null } as const

  const [settings, counts, watches, wearEvents] = await Promise.all([
    getProfileSettings(profile.id),
    getFollowerCounts(profile.id),
    getWatchesByUser(profile.id),
    getAllWearEventsByUser(profile.id),
  ])

  // Collection age = days from earliest acquisitionDate to now.
  // Default to 30 days when unknown so Daily Rotator tag isn't falsely added
  // before there is enough history.
  const earliestDate = watches
    .map((w) => w.acquisitionDate)
    .filter((d): d is string => Boolean(d))
    .sort()[0]
  const collectionAgeDays = earliestDate
    ? Math.max(1, Math.floor((Date.now() - new Date(earliestDate).getTime()) / 86400000))
    : 30

  const tasteTags = computeTasteTags({ watches, totalWearEvents: wearEvents.length, collectionAgeDays })

  return { profile, settings, counts, watches, wearEvents, tasteTags } as const
}
