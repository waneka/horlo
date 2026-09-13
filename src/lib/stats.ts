import type { Watch, WatchWithWear, CollectionGoal } from '@/lib/types'
import { MOVEMENT_LABELS } from '@/lib/constants'
import { detectLoyalBrands } from '@/lib/similarity'
import { daysSince, SLEEPING_BEAUTY_DAYS, WINDOW_DAYS } from '@/lib/wear'
import type { WearWindowKey } from '@/lib/wear'

export interface DistributionRow {
  label: string
  count: number
  percentage: number
}

export function calculateDistribution(
  watches: Watch[],
  getValues: (w: Watch) => string[],
): DistributionRow[] {
  const counts: Record<string, number> = {}
  watches.forEach((w) =>
    getValues(w).forEach((v) => {
      counts[v] = (counts[v] ?? 0) + 1
    }),
  )
  const total = watches.length
  return Object.entries(counts)
    .map(([label, count]) => ({
      label,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

export function styleDistribution(watches: Watch[]): DistributionRow[] {
  return calculateDistribution(watches, (w) => w.styleTags ?? [])
}

export function roleDistribution(watches: Watch[]): DistributionRow[] {
  return calculateDistribution(watches, (w) => w.roleTags ?? [])
}

export function topMostWorn(
  watches: Watch[],
  wearCountByWatch: Map<string, number>,
  limit = 3,
): Array<{ watch: Watch; count: number }> {
  return watches
    .map((w) => ({ watch: w, count: wearCountByWatch.get(w.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function topLeastWorn(
  watches: Watch[],
  wearCountByWatch: Map<string, number>,
  limit = 3,
): Array<{ watch: Watch; count: number }> {
  return watches
    .map((w) => ({ watch: w, count: wearCountByWatch.get(w.id) ?? 0 }))
    .sort((a, b) => a.count - b.count)
    .slice(0, limit)
}

export interface ObservationsInput {
  ownedWatches: WatchWithWear[]
  goal?: CollectionGoal | null
  weekdayCounts: Record<number, number> // 0=Sun..6=Sat
}

export function buildObservations(input: ObservationsInput): string[] {
  const observations: string[] = []
  const owned = input.ownedWatches

  // Style lean
  const styles = styleDistribution(owned)
  if (styles[0] && styles[0].percentage >= 50) {
    observations.push(
      `Your collection leans heavily toward ${styles[0].label.toLowerCase()} watches (${Math.round(styles[0].percentage)}%).`,
    )
  }

  // Most-worn brand (loyal brand signal)
  if (owned.length > 0) {
    const loyal = detectLoyalBrands(owned)
    if (loyal.length > 0) {
      observations.push(`You're leaning into ${loyal.join(' and ')}.`)
    }
  }

  // Neglected watches
  const neglected = owned.filter((w) => {
    const d = daysSince(w.lastWornDate)
    return d !== null && d > SLEEPING_BEAUTY_DAYS
  })
  if (neglected.length > 0) {
    const w = neglected[0]
    const d = daysSince(w.lastWornDate)
    observations.push(
      `${w.brand} ${w.model} is due for some wrist time — hasn't been worn in ${d} days.`,
    )
  }

  // Most active wearing day
  const totalWears = Object.values(input.weekdayCounts).reduce(
    (a, b) => a + b,
    0,
  )
  if (totalWears > 0) {
    const top = Object.entries(input.weekdayCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]
    const dayName = [
      'Sundays',
      'Mondays',
      'Tuesdays',
      'Wednesdays',
      'Thursdays',
      'Fridays',
      'Saturdays',
    ][Number(top[0])]
    observations.push(`You wear watches most often on ${dayName}.`)
  }

  // Movement consistency
  const movements = new Set(owned.map((w) => w.movement))
  if (movements.size === 1 && owned.length >= 3) {
    const movementKey = [...movements][0]
    const movementLabel = movementKey ? MOVEMENT_LABELS[movementKey] : movementKey
    observations.push(`All your watches use ${movementLabel} movements.`)
  }

  return observations
}

export function bucketWearsByWeekday(
  events: Array<{ wornDate: string }>,
): Record<number, number> {
  const out: Record<number, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  }
  for (const e of events) {
    const d = new Date(e.wornDate + 'T00:00:00')
    const dow = d.getDay()
    out[dow]++
  }
  return out
}

export function wearCountByWatchMap(
  events: Array<{ watchId: string }>,
): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of events) m.set(e.watchId, (m.get(e.watchId) ?? 0) + 1)
  return m
}

/**
 * Filters wear events to those within a rolling window through the
 * caller-supplied local `today` (D-13, WEAR-04). The window has no upper
 * bound — a cross-timezone viewer's clock skew should never drop an
 * owner's same-day wear.
 *
 * `wornDate` is compared lexically because it's a text ISO column
 * (`YYYY-MM-DD`), never cast to a SQL/JS date for the comparison — see
 * 84-RESEARCH.md Pitfall 4.
 */
export function filterEventsByWindow<T extends { wornDate: string }>(
  events: T[],
  window: WearWindowKey,
  todayISO: string,
): T[] {
  const days = WINDOW_DAYS[window]
  if (days === null) return events.slice()
  const cutoff = new Date(`${todayISO}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1))
  const cutoffISO = cutoff.toISOString().slice(0, 10)
  return events.filter((e) => e.wornDate >= cutoffISO)
}

export interface LeaderboardRow<W> {
  watch: W
  count: number
  mostRecentWornDate: string | null
}

/**
 * Builds the across-collection wear-count leaderboard (D-11, D-13,
 * WEAR-04). Every owned watch gets a row, including zero-wear watches;
 * wears of watches not present in `ownedWatches` never produce a row.
 *
 * Ranking: count desc, then most-recent wornDate desc, then
 * "Brand Model" A→Z. Zero-wear rows fall to the bottom, sorted A→Z
 * among themselves.
 */
export function buildLeaderboard<
  W extends { id: string; brand: string; model: string },
>(
  ownedWatches: W[],
  windowedEvents: Array<{ watchId: string; wornDate: string }>,
): LeaderboardRow<W>[] {
  const counts = wearCountByWatchMap(windowedEvents)
  const mostRecent = new Map<string, string>()
  for (const e of windowedEvents) {
    const existing = mostRecent.get(e.watchId)
    if (!existing || e.wornDate > existing) mostRecent.set(e.watchId, e.wornDate)
  }
  const nameOf = (w: W) => `${w.brand} ${w.model}`

  const rows: LeaderboardRow<W>[] = ownedWatches.map((watch) => ({
    watch,
    count: counts.get(watch.id) ?? 0,
    mostRecentWornDate: mostRecent.get(watch.id) ?? null,
  }))

  return rows.slice().sort((a, b) => {
    if (a.count === 0 && b.count === 0) {
      return nameOf(a.watch).localeCompare(nameOf(b.watch))
    }
    const countDiff = b.count - a.count
    if (countDiff !== 0) return countDiff
    const dateDiff = (b.mostRecentWornDate ?? '').localeCompare(
      a.mostRecentWornDate ?? '',
    )
    if (dateDiff !== 0) return dateDiff
    return nameOf(a.watch).localeCompare(nameOf(b.watch))
  })
}
