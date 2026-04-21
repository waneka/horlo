// Pure server-derivable taste tags for the profile header (D-06 / PROF-10).
// No 'server-only' directive — this is a deterministic function over plain data
// and is safe to import from server components or unit tests.
import type { Watch } from '@/lib/types'

export interface TasteTagInput {
  watches: Watch[]
  totalWearEvents: number
  collectionAgeDays: number // days between earliest watch createdAt and now
}

/**
 * Derive up to 3 taste-tag strings from a user's collection composition + wear data.
 * Rules per D-06:
 *   - Vintage Collector: >40% of owned watches have productionYear < 2000
 *   - {Brand} Fan: any single brand >30% of owned collection
 *   - Sport Watch Collector / Dress Watch Lover / Diver: mutually exclusive,
 *     evaluated in that order against >50% / >50% / >40% of all roleTags
 *   - Daily Rotator: avg wear events per week > 5
 * Output is capped at 3 tags maximum, in evaluation order.
 */
export function computeTasteTags(input: TasteTagInput): string[] {
  const owned = input.watches.filter((watch) => watch.status === 'owned')
  if (owned.length === 0) return []

  const tags: string[] = []

  // Vintage Collector: >40% pre-2000
  const vintageCount = owned.filter(
    (watch) => watch.productionYear !== undefined && watch.productionYear < 2000
  ).length
  if (vintageCount / owned.length > 0.4) {
    tags.push('Vintage Collector')
  }

  // {Brand} Fan: any single brand >30% (case-sensitive — brand bucketing matches stored value exactly)
  const brandCounts: Record<string, number> = {}
  for (const watch of owned) {
    brandCounts[watch.brand] = (brandCounts[watch.brand] ?? 0) + 1
  }
  const sortedBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])
  if (sortedBrands.length > 0 && sortedBrands[0][1] / owned.length > 0.3) {
    tags.push(`${sortedBrands[0][0]} Fan`)
  }

  // Role-based tags — single best match wins (mutually exclusive per D-06)
  const allRoles = owned.flatMap((watch) => watch.roleTags ?? [])
  const totalRoles = allRoles.length
  if (totalRoles > 0) {
    const sportCount = allRoles.filter((role) => role.toLowerCase().includes('sport')).length
    const dressCount = allRoles.filter((role) => role.toLowerCase().includes('dress')).length
    const diveCount = allRoles.filter((role) => role.toLowerCase().includes('dive')).length
    if (sportCount / totalRoles > 0.5) {
      tags.push('Sport Watch Collector')
    } else if (dressCount / totalRoles > 0.5) {
      tags.push('Dress Watch Lover')
    } else if (diveCount / totalRoles > 0.4) {
      tags.push('Diver')
    }
  }

  // Daily Rotator: avg wear events / week > 5
  if (input.collectionAgeDays > 0) {
    const weeks = input.collectionAgeDays / 7
    if (weeks > 0 && input.totalWearEvents / weeks > 5) {
      tags.push('Daily Rotator')
    }
  }

  return tags.slice(0, 3)
}
