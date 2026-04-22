import { getWatchesByUser } from '@/data/watches'
import {
  getMostRecentWearDates,
  getAllWearEventsByUser,
} from '@/data/wearEvents'
import {
  getFollowingForProfile,
  getTasteOverlapData,
} from '@/data/follows'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import { wishlistGap } from '@/lib/wishlistGap'
import { daysSince } from '@/lib/wear'
import { SleepingBeautyCard } from '@/components/home/SleepingBeautyCard'
import { MostWornThisMonthCard } from '@/components/home/MostWornThisMonthCard'
import { WishlistGapCard } from '@/components/home/WishlistGapCard'
import { CommonGroundFollowerCard } from '@/components/home/CommonGroundFollowerCard'
import type { Watch } from '@/lib/types'

/** Days of non-wear before a watch qualifies as a Sleeping Beauty (I-01). */
const SLEEPING_BEAUTY_THRESHOLD_DAYS = 14

/** Cap on followers inspected for Common Ground (cost ceiling). */
const COMMON_GROUND_SCAN_LIMIT = 10

/**
 * Personal Insights — up to 4 cards (I-01 through I-04).
 *
 * Layout:
 *   - I-04: when the viewer has zero owned watches, return null (section
 *     hides entirely — the home `space-y-*` stack collapses cleanly).
 *   - Card 1 Sleeping Beauty — watch with the most days unworn (threshold
 *     14 days). Watches that have NEVER been worn sort to the top via an
 *     `effectiveDays` key (+Infinity for null lastWornDate). The card
 *     then renders "Never worn" instead of a fabricated day count.
 *   - Card 2 Most Worn This Month — highest wear count for the current
 *     calendar month. Omitted when there are zero wears this month.
 *   - Card 3 Wishlist Gap — from `wishlistGap(owned, wishlist)`. The card
 *     itself returns null when gap.role is null, which is the correct
 *     degraded behavior (no gap to suggest).
 *   - Card 4 Common Ground — the highest-overlap follower by
 *     `computeTasteOverlap`. `getTasteOverlapData` failures are swallowed
 *     per follower so one bad row doesn't hide the whole card; the card is
 *     omitted if no follower has any sharedWatches.
 */
export async function PersonalInsightsGrid({
  viewerId,
}: {
  viewerId: string
}) {
  const [watches, wearEvents, following] = await Promise.all([
    getWatchesByUser(viewerId),
    getAllWearEventsByUser(viewerId),
    getFollowingForProfile(viewerId),
  ])

  const owned: Watch[] = watches.filter((w) => w.status === 'owned')
  const wishlist: Watch[] = watches.filter(
    (w) => w.status === 'wishlist' || w.status === 'grail',
  )
  if (owned.length === 0) return null // I-04

  // Sleeping Beauty — ORDER by effectiveDays (+Infinity for never-worn).
  // RENDER uses lastWornDate: null → "Never worn" (no fabricated count).
  const wearDateMap = await getMostRecentWearDates(
    viewerId,
    owned.map((w) => w.id),
  )
  let sleepingBeauty:
    | {
        watch: Watch
        days: number | null
        lastWornDate: string | null
        effectiveDays: number
      }
    | null = null
  for (const w of owned) {
    const last = wearDateMap.get(w.id) ?? null
    const days = last ? daysSince(last) : null
    const effectiveDays = days ?? Number.POSITIVE_INFINITY
    if (effectiveDays > SLEEPING_BEAUTY_THRESHOLD_DAYS) {
      if (
        !sleepingBeauty ||
        effectiveDays > sleepingBeauty.effectiveDays
      ) {
        sleepingBeauty = {
          watch: w,
          days,
          lastWornDate: last,
          effectiveDays,
        }
      }
    }
  }

  // Most Worn This Month — calendar-month window (ISO YYYY-MM-DD comparison).
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStartStr = monthStart.toISOString().slice(0, 10)
  const thisMonthWears = wearEvents.filter((e) => e.wornDate >= monthStartStr)
  const countByWatch = new Map<string, number>()
  for (const e of thisMonthWears) {
    countByWatch.set(e.watchId, (countByWatch.get(e.watchId) ?? 0) + 1)
  }
  let mostWorn: { watch: Watch; count: number } | null = null
  for (const [watchId, count] of countByWatch) {
    if (!mostWorn || count > mostWorn.count) {
      const watch = owned.find((w) => w.id === watchId)
      if (watch) mostWorn = { watch, count }
    }
  }

  // Wishlist Gap — pure fn, deterministic.
  const gap = wishlistGap(owned, wishlist)

  // Common Ground — highest-overlap follower. Try/catch per follower so one
  // failing fetch doesn't hide the whole card.
  let commonGround: {
    username: string
    displayName: string | null
    avatarUrl: string | null
    sharedCount: number
  } | null = null
  if (following.length > 0) {
    const scored = await Promise.all(
      following.slice(0, COMMON_GROUND_SCAN_LIMIT).map(async (f) => {
        try {
          const data = await getTasteOverlapData(viewerId, f.userId)
          const result = computeTasteOverlap(data.viewer, data.owner)
          return { f, shared: result.sharedWatches.length }
        } catch {
          return { f, shared: 0 }
        }
      }),
    )
    const top = scored.sort((a, b) => b.shared - a.shared)[0]
    if (top && top.shared > 0) {
      commonGround = {
        username: top.f.username,
        displayName: top.f.displayName,
        avatarUrl: top.f.avatarUrl,
        sharedCount: top.shared,
      }
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold leading-tight text-foreground">For you</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {sleepingBeauty && (
          <SleepingBeautyCard
            watch={sleepingBeauty.watch}
            daysUnworn={sleepingBeauty.days}
            lastWornDate={sleepingBeauty.lastWornDate}
          />
        )}
        {mostWorn && (
          <MostWornThisMonthCard
            watch={mostWorn.watch}
            wearCount={mostWorn.count}
          />
        )}
        <WishlistGapCard gap={gap} />
        {commonGround && <CommonGroundFollowerCard {...commonGround} />}
      </div>
    </section>
  )
}
