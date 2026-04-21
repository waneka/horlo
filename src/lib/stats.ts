import type { Watch, WatchWithWear, CollectionGoal } from '@/lib/types'
import { detectLoyalBrands } from '@/lib/similarity'
import { daysSince, SLEEPING_BEAUTY_DAYS } from '@/lib/wear'

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
    observations.push(`All your watches use ${[...movements][0]} movements.`)
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
