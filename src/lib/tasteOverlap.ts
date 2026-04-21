// Pure, server-safe taste-overlap calculation. No 'server-only' directive —
// this mirrors src/lib/similarity.ts (no browser APIs, no I/O) so it is
// importable from either server components or unit tests under jsdom.
import type { Watch, UserPreferences } from '@/lib/types'
import { analyzeSimilarity, GOAL_THRESHOLDS } from '@/lib/similarity'
import { styleDistribution, roleDistribution, type DistributionRow } from '@/lib/stats'

export interface SharedWatchEntry {
  brand: string
  model: string
  viewerWatch: Watch
  ownerWatch: Watch
}

export interface SharedDistributionRow {
  label: string
  viewerPct: number
  ownerPct: number
}

export interface TasteOverlapResult {
  sharedWatches: SharedWatchEntry[]
  sharedTasteTags: string[]
  overlapLabel: 'Strong overlap' | 'Some overlap' | 'Different taste'
  sharedStyleRows: SharedDistributionRow[]
  sharedRoleRows: SharedDistributionRow[]
  hasAny: boolean
}

interface OverlapInput {
  watches: Watch[]
  preferences: UserPreferences
  tasteTags: string[]
}

/**
 * Derive the Common Ground view for a (viewer, owner) pair.
 *
 * Thresholds are anchored to `GOAL_THRESHOLDS.balanced`:
 *   - avg similarity >= 0.65 (coreFit)             → 'Strong overlap'
 *   - avg similarity >= 0.45 (familiarTerritory)   → 'Some overlap'
 *   - otherwise                                    → 'Different taste'
 * Anchoring to the balanced goal (rather than the viewer's personal
 * collectionGoal) keeps Common Ground stable across users and lets the
 * label track any future recalibration of the similarity engine weights.
 *
 * The viewer-has-zero-watches branch always returns 'Different taste'
 * with an empty sharedWatches array (D-05). Tag intersection still fires
 * so the hero band can fall back to taste-tag signals for brand-new users.
 */
export function computeTasteOverlap(
  viewer: OverlapInput,
  owner: OverlapInput,
): TasteOverlapResult {
  // 1. Normalized brand+model intersection — case- and whitespace-insensitive
  //    per D-01 and Pitfall 2. Only owned watches count.
  const norm = (watch: Watch) =>
    `${watch.brand.trim().toLowerCase()}|${watch.model.trim().toLowerCase()}`
  const viewerOwned = viewer.watches.filter((w) => w.status === 'owned')
  const ownerOwned = owner.watches.filter((w) => w.status === 'owned')
  const ownerByKey = new Map(ownerOwned.map((w) => [norm(w), w]))
  const sharedWatches: SharedWatchEntry[] = viewerOwned
    .filter((v) => ownerByKey.has(norm(v)))
    .map((v) => ({
      brand: v.brand,
      model: v.model,
      viewerWatch: v,
      ownerWatch: ownerByKey.get(norm(v))!,
    }))

  // 2. Taste-tag intersection, viewer-first ordering preserved.
  const sharedTasteTags = viewer.tasteTags.filter((tag) =>
    owner.tasteTags.includes(tag),
  )

  // 3. Overlap label derived from the viewer's average similarity against
  //    the owner's collection. Using viewer.preferences keeps the scoring
  //    aware of overlapTolerance and complicationExceptions when meaningful.
  const thresholds = GOAL_THRESHOLDS.balanced
  let overlapLabel: TasteOverlapResult['overlapLabel'] = 'Different taste'
  if (viewerOwned.length > 0 && ownerOwned.length > 0) {
    const scores = viewerOwned.map((vw) =>
      analyzeSimilarity(vw, ownerOwned, viewer.preferences).score,
    )
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    if (avg >= thresholds.coreFit) overlapLabel = 'Strong overlap'
    else if (avg >= thresholds.familiarTerritory) overlapLabel = 'Some overlap'
  }

  // 4. Shared style + role distributions — only when BOTH sides have enough
  //    collection signal (>=3 owned) to make a distribution meaningful.
  let sharedStyleRows: SharedDistributionRow[] = []
  let sharedRoleRows: SharedDistributionRow[] = []
  if (viewerOwned.length >= 3 && ownerOwned.length >= 3) {
    sharedStyleRows = zipDistributions(
      styleDistribution(viewerOwned),
      styleDistribution(ownerOwned),
    )
    sharedRoleRows = zipDistributions(
      roleDistribution(viewerOwned),
      roleDistribution(ownerOwned),
    )
  }

  const hasAny = sharedWatches.length > 0 || sharedTasteTags.length > 0

  return {
    sharedWatches,
    sharedTasteTags,
    overlapLabel,
    sharedStyleRows,
    sharedRoleRows,
    hasAny,
  }
}

function zipDistributions(
  viewerRows: DistributionRow[],
  ownerRows: DistributionRow[],
): SharedDistributionRow[] {
  const byLabel = new Map<string, SharedDistributionRow>()
  for (const r of viewerRows) {
    byLabel.set(r.label, { label: r.label, viewerPct: r.percentage, ownerPct: 0 })
  }
  for (const r of ownerRows) {
    const existing = byLabel.get(r.label)
    if (existing) existing.ownerPct = r.percentage
    else
      byLabel.set(r.label, { label: r.label, viewerPct: 0, ownerPct: r.percentage })
  }
  return [...byLabel.values()].sort(
    (a, b) => b.viewerPct + b.ownerPct - (a.viewerPct + a.ownerPct),
  )
}
