import type {
  Watch,
  UserPreferences,
  SimilarityLabel,
  SimilarityResult,
  CollectionGoal,
  CatalogTasteAttributes,
} from './types'

// Phase 38 D-01/D-05 — preserve relative proportions while reserving 0.20 for taste.
// Anti-pattern (forbidden): hardcoding rescaled values as magic numbers.
// Verify: `grep -E "0\.20.*styleTags|styleTags.*0\.20" src/lib/similarity.ts` returns 0 matches.
const EXISTING_WEIGHTS_BASE = {
  styleTags: 0.25,
  designTraits: 0.20,
  roleTags: 0.20,
  dialColor: 0.10,
  complications: 0.10,
  caseSize: 0.05,
  strapType: 0.05,
  waterResistance: 0.05,
} as const

const TASTE_WEIGHT = 0.20
const EXISTING_SCALE = 1.0 - TASTE_WEIGHT  // 0.80

const WEIGHTS = {
  ...Object.fromEntries(
    Object.entries(EXISTING_WEIGHTS_BASE).map(([k, v]) => [k, v * EXISTING_SCALE]),
  ),
  taste: TASTE_WEIGHT,
} as { [K in keyof typeof EXISTING_WEIGHTS_BASE]: number } & { taste: number }

// Phase 38 D-03 (modified by Phase 49.1 D-SIM-01/D-SIM-02/D-SIM-03) — internal split
// of the 0.20 taste budget. The categorical archetype sub-weight (formerly 0.20) was
// removed; the surviving 3 sub-weights are rescaled proportionally so they still sum
// to 1.0.
//
// Anti-magic-number per lines 10-12: do NOT hardcode the rescaled values. Define the
// pre-removal base, the removed share, and compute RESCALE = 1 / (1 - removed).
// Object.fromEntries(× RESCALE) mirrors the existing EXISTING_WEIGHTS_BASE pattern above.
//
// Per-component effective weight = sub-weight × TASTE_WEIGHT (0.20).
// The Phase 38 D-03 trio-vs-categorical 2:1:1 ratio is preserved post-rescale.
const TASTE_SUB_WEIGHTS_BASE = {
  numericTrioCosine: 0.40,
  eraMatch:          0.20,
  motifsJaccard:     0.20,
} as const  // sums to 0.80 (the surviving budget after removing the 0.20 categorical share)

const REMOVED_SUB_WEIGHT = 0.20  // pre-49.1 categorical archetype share
const RESCALE = 1 / (1 - REMOVED_SUB_WEIGHT)  // 1.25

const TASTE_SUB_WEIGHTS = Object.fromEntries(
  Object.entries(TASTE_SUB_WEIGHTS_BASE).map(([k, v]) => [k, v * RESCALE]),
) as { [K in keyof typeof TASTE_SUB_WEIGHTS_BASE]: number }

// Thresholds for similarity labels (adjusted by overlap tolerance)
const THRESHOLDS = {
  low: { coreFit: 0.7, familiarTerritory: 0.5, roleConflict: 0.6 },
  medium: { coreFit: 0.75, familiarTerritory: 0.55, roleConflict: 0.7 },
  high: { coreFit: 0.8, familiarTerritory: 0.6, roleConflict: 0.8 },
}

// Goal-aware thresholds (CONTEXT.md decisions > "Collection goals")
// Soft shifts from the baseline; hard-mismatch is NEVER modified by goal.
type GoalThresholds = { coreFit: number; familiarTerritory: number; roleConflict: number }
const GOAL_THRESHOLDS: Record<CollectionGoal, GoalThresholds> = {
  'balanced':              { coreFit: 0.65, familiarTerritory: 0.45, roleConflict: 0.70 },
  'specialist':            { coreFit: 0.65, familiarTerritory: 0.45, roleConflict: 0.78 },
  'variety-within-theme':  { coreFit: 0.65, familiarTerritory: 0.40, roleConflict: 0.65 },
  'brand-loyalist':        { coreFit: 0.65, familiarTerritory: 0.45, roleConflict: 0.70 },
}

/**
 * Detect dominant brands in the owned collection. A brand is "loyal" when it
 * accounts for ≥30% of holdings. Requires ≥3 watches for a signal to emerge.
 */
function detectLoyalBrands(owned: Watch[]): string[] {
  if (owned.length < 3) return []
  const counts = new Map<string, number>()
  for (const w of owned) counts.set(w.brand, (counts.get(w.brand) ?? 0) + 1)
  const loyal: string[] = []
  for (const [brand, count] of counts) {
    if (count / owned.length >= 0.30) loyal.push(brand)
  }
  return loyal
}

export { GOAL_THRESHOLDS, detectLoyalBrands, TASTE_SUB_WEIGHTS }

function arrayOverlap(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0
  const intersection = arr1.filter((item) => arr2.includes(item))
  const union = new Set([...arr1, ...arr2])
  return intersection.length / union.size
}

// Phase 38 D-03 — null-safe 3D cosine for the [formality, sportiness, heritageScore] trio.
// 3-line helper; no numerical library needed (fixed dimensionality).
function cosine3D(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
  const ma = Math.hypot(a[0], a[1], a[2])
  const mb = Math.hypot(b[0], b[1], b[2])
  if (ma === 0 || mb === 0) return 0  // null-safe per D-03 edge: all-zero vectors → 0
  // Defensive clamp per RESEARCH §Q10 watch-list #4 — prevents threshold mis-classify on numeric drift:
  return Math.max(0, Math.min(1, dot / (ma * mb)))
}

// Phase 38 D-02 + D-03 — returns taste similarity in [0, 1]. Outer multiply by WEIGHTS.taste
// happens at the caller (matches the existing 8-dim cadence: `score += WEIGHTS.foo * fooSimilarity(...)`).
function tasteSimilarityRaw01(
  t1: CatalogTasteAttributes | null | undefined,
  t2: CatalogTasteAttributes | null | undefined,
): number {
  // D-02 binary gate — any nullish or below-floor confidence → 0 contribution (engine falls back to byte-identical 8-dim behavior)
  if (!t1 || !t2) return 0
  if (t1.confidence === null || t2.confidence === null) return 0
  if (t1.confidence < 0.5 || t2.confidence < 0.5) return 0

  let contrib = 0

  // Numeric trio cosine (computed sub-weight via RESCALE × TASTE_SUB_WEIGHTS_BASE.numericTrioCosine; effective contrib = sub-weight × TASTE_WEIGHT)
  // Drop the contribution when ANY of the 6 numerics is null (D-03 edge: cosine of all-zero pair would be misleading)
  const allNonNull1 = t1.formality !== null && t1.sportiness !== null && t1.heritageScore !== null
  const allNonNull2 = t2.formality !== null && t2.sportiness !== null && t2.heritageScore !== null
  if (allNonNull1 && allNonNull2) {
    const cos = cosine3D(
      [t1.formality as number, t1.sportiness as number, t1.heritageScore as number],
      [t2.formality as number, t2.sportiness as number, t2.heritageScore as number],
    )
    contrib += TASTE_SUB_WEIGHTS.numericTrioCosine * cos
  }

  // Era categorical match (computed sub-weight via RESCALE × TASTE_SUB_WEIGHTS_BASE.eraMatch)
  if (t1.eraSignal !== null && t2.eraSignal !== null && t1.eraSignal === t2.eraSignal) {
    contrib += TASTE_SUB_WEIGHTS.eraMatch * 1.0
  }

  // Motifs Jaccard (computed sub-weight via RESCALE × TASTE_SUB_WEIGHTS_BASE.motifsJaccard) — REUSE existing arrayOverlap (verified Jaccard per D-03)
  contrib += TASTE_SUB_WEIGHTS.motifsJaccard * arrayOverlap(t1.designMotifs, t2.designMotifs)

  return contrib  // in [0, 1]; outer multiply by WEIGHTS.taste happens at caller
}

function caseSizeSimilarity(size1?: number, size2?: number): number {
  if (size1 === undefined || size2 === undefined) return 0.5
  const diff = Math.abs(size1 - size2)
  if (diff <= 2) return 1
  if (diff <= 4) return 0.7
  if (diff <= 6) return 0.4
  return 0.1
}

function waterResistanceBandSimilarity(wr1?: number, wr2?: number): number {
  if (wr1 === undefined || wr2 === undefined) return 0.5

  const getBand = (wr: number) => {
    if (wr < 50) return 'splash'
    if (wr < 100) return 'swim'
    if (wr < 200) return 'dive'
    return 'pro-dive'
  }

  return getBand(wr1) === getBand(wr2) ? 1 : 0.3
}

function calculatePairSimilarity(
  watch1: Watch,
  watch2: Watch,
  exceptions: readonly string[] = [],
): number {
  let score = 0

  // Style tags
  score += WEIGHTS.styleTags * arrayOverlap(watch1.styleTags, watch2.styleTags)

  // Design traits
  score += WEIGHTS.designTraits * arrayOverlap(watch1.designTraits, watch2.designTraits)

  // Role tags
  score += WEIGHTS.roleTags * arrayOverlap(watch1.roleTags, watch2.roleTags)

  // Dial color
  score += WEIGHTS.dialColor * (watch1.dialColor === watch2.dialColor ? 1 : 0)

  // Complications — complicationExceptions drop out of the overlap calc entirely
  // so a user can own several chronographs without a similarity penalty.
  const filtered1 = exceptions.length
    ? watch1.complications.filter((c) => !exceptions.includes(c))
    : watch1.complications
  const filtered2 = exceptions.length
    ? watch2.complications.filter((c) => !exceptions.includes(c))
    : watch2.complications
  score += WEIGHTS.complications * arrayOverlap(filtered1, filtered2)

  // Case size
  score += WEIGHTS.caseSize * caseSizeSimilarity(watch1.caseSizeMm, watch2.caseSizeMm)

  // Strap type
  score += WEIGHTS.strapType * (watch1.strapType === watch2.strapType ? 1 : 0)

  // Water resistance
  score += WEIGHTS.waterResistance * waterResistanceBandSimilarity(
    watch1.waterResistanceM,
    watch2.waterResistanceM
  )

  // Phase 38 D-01..D-05 — 9th additive taste dimension (outer weight 0.20; gates on confidence >= 0.5)
  score += WEIGHTS.taste * tasteSimilarityRaw01(watch1.catalogTaste, watch2.catalogTaste)

  return score
}

function hasRoleOverlap(targetWatch: Watch, collectionWatches: Watch[]): boolean {
  return collectionWatches.some(
    (watch) => arrayOverlap(targetWatch.roleTags, watch.roleTags) > 0.5
  )
}

function checkPreferenceAlignment(
  watch: Watch,
  preferences: UserPreferences
): { aligned: boolean; conflicts: boolean; reasoning: string[] } {
  const reasoning: string[] = []
  let alignmentScore = 0
  let conflictScore = 0

  // Check style preferences
  const preferredStyleMatch = watch.styleTags.some((tag) =>
    preferences.preferredStyles.includes(tag)
  )
  const dislikedStyleMatch = watch.styleTags.some((tag) =>
    preferences.dislikedStyles.includes(tag)
  )

  if (preferredStyleMatch) {
    alignmentScore++
    reasoning.push('Matches preferred style')
  }
  if (dislikedStyleMatch) {
    conflictScore++
    reasoning.push('Contains disliked style')
  }

  // Check design trait preferences
  const preferredTraitMatch = watch.designTraits.some((trait) =>
    preferences.preferredDesignTraits.includes(trait)
  )
  const dislikedTraitMatch = watch.designTraits.some((trait) =>
    preferences.dislikedDesignTraits.includes(trait)
  )

  if (preferredTraitMatch) {
    alignmentScore++
    reasoning.push('Matches preferred design traits')
  }
  if (dislikedTraitMatch) {
    conflictScore++
    reasoning.push('Contains disliked design traits')
  }

  // Check dial color preferences
  if (watch.dialColor) {
    if (preferences.preferredDialColors.includes(watch.dialColor)) {
      alignmentScore++
      reasoning.push('Preferred dial color')
    }
    if (preferences.dislikedDialColors.includes(watch.dialColor)) {
      conflictScore++
      reasoning.push('Disliked dial color')
    }
  }

  // Check case size preferences
  if (watch.caseSizeMm && preferences.preferredCaseSizeRange) {
    const { min, max } = preferences.preferredCaseSizeRange
    if (watch.caseSizeMm >= min && watch.caseSizeMm <= max) {
      alignmentScore++
      reasoning.push('Within preferred case size range')
    } else {
      conflictScore++
      reasoning.push('Outside preferred case size range')
    }
  }

  // Check complication preferences
  const preferredCompMatch = watch.complications.some((comp) =>
    preferences.preferredComplications.includes(comp)
  )
  if (preferredCompMatch) {
    alignmentScore++
    reasoning.push('Has preferred complications')
  }

  return {
    aligned: alignmentScore >= 2,
    conflicts: conflictScore >= 2,
    reasoning,
  }
}

export function analyzeSimilarity(
  targetWatch: Watch,
  collection: Watch[],
  preferences: UserPreferences
): SimilarityResult {
  // Filter out the target watch from collection if it exists
  const otherWatches = collection.filter((w) => w.id !== targetWatch.id)

  // Only compare against owned and grail watches for collection analysis
  const ownedWatches = otherWatches.filter(
    (w) => w.status === 'owned' || w.status === 'grail'
  )

  if (ownedWatches.length === 0) {
    return {
      label: 'core-fit',
      score: 0,
      mostSimilarWatches: [],
      roleOverlap: false,
      reasoning: ['First watch in collection - perfect fit!'],
    }
  }

  // Calculate similarity with each owned watch (with complicationExceptions applied)
  const exceptions = preferences.complicationExceptions ?? []
  const watchSimilarities = ownedWatches.map((watch) => ({
    watch,
    score: calculatePairSimilarity(targetWatch, watch, exceptions),
  }))

  // Sort by similarity and get top matches
  watchSimilarities.sort((a, b) => b.score - a.score)
  const mostSimilarWatches = watchSimilarities.slice(0, 3)

  // Calculate average similarity
  const avgSimilarity =
    watchSimilarities.reduce((sum, w) => sum + w.score, 0) / watchSimilarities.length

  // Check for role overlap
  const roleOverlap = hasRoleOverlap(targetWatch, ownedWatches)

  // Check preference alignment
  const preferenceCheck = checkPreferenceAlignment(targetWatch, preferences)

  // Goal-aware threshold resolution. Below the detection floor (<3 owned),
  // force balanced behavior regardless of stated goal.
  const requestedGoal: CollectionGoal = preferences.collectionGoal ?? 'balanced'
  let effectiveGoal: CollectionGoal = ownedWatches.length < 3 ? 'balanced' : requestedGoal

  // Brand-loyalist: route on-brand watches to specialist thresholds,
  // off-brand watches get the off-brand reasoning line.
  let offBrandReasoning: string | null = null
  if (effectiveGoal === 'brand-loyalist') {
    const loyalBrands = detectLoyalBrands(ownedWatches)
    if (loyalBrands.length === 0) {
      effectiveGoal = 'balanced'
    } else if (loyalBrands.includes(targetWatch.brand)) {
      effectiveGoal = 'specialist'
    } else {
      offBrandReasoning = `Off-brand — breaks your ${loyalBrands.join('/')} pattern`
    }
  }

  const thresholds = GOAL_THRESHOLDS[effectiveGoal]

  // Determine label
  let label: SimilarityLabel
  const reasoning: string[] = [...preferenceCheck.reasoning]

  if (preferenceCheck.conflicts) {
    label = 'hard-mismatch'
    reasoning.push('Conflicts with stated preferences')
  } else if (roleOverlap && avgSimilarity > thresholds.roleConflict) {
    label = 'role-duplicate'
    if (effectiveGoal === 'specialist') {
      reasoning.push('Continues the specialist path')
    } else {
      reasoning.push('Similar role to existing watches')
    }
    reasoning.push(`High similarity (${Math.round(avgSimilarity * 100)}%)`)
  } else if (avgSimilarity > thresholds.coreFit && preferenceCheck.aligned) {
    label = 'core-fit'
    reasoning.push('Highly aligned with your taste')
    if (effectiveGoal === 'specialist') {
      // Compute dominant style tag count for depth callout
      const styleCounts = new Map<string, number>()
      for (const w of ownedWatches) for (const s of w.styleTags) {
        styleCounts.set(s, (styleCounts.get(s) ?? 0) + 1)
      }
      let topStyle: string | null = null
      let topCount = 0
      for (const [s, c] of styleCounts) {
        if (c > topCount) { topStyle = s; topCount = c }
      }
      if (topStyle && topCount > 0) {
        reasoning.push(`${topCount} ${topStyle} watches — strong depth`)
      }
    }
  } else if (avgSimilarity > thresholds.familiarTerritory) {
    label = 'familiar-territory'
    reasoning.push('Similar to watches you already have')
  } else if (avgSimilarity < 0.3 && !preferenceCheck.aligned) {
    label = 'outlier'
    reasoning.push('Different from your current collection')
  } else {
    label = 'taste-expansion'
    if (effectiveGoal === 'variety-within-theme') {
      reasoning.push('Exactly what this collection needs')
    } else {
      reasoning.push('Adds variety while staying aligned')
    }
  }

  // Brand-loyalist off-brand reasoning line appended last, score untouched.
  if (offBrandReasoning && label !== 'hard-mismatch') {
    reasoning.push(offBrandReasoning)
  }

  return {
    label,
    score: avgSimilarity,
    mostSimilarWatches,
    roleOverlap,
    reasoning,
  }
}

export function getSimilarityLabelDisplay(label: SimilarityLabel): {
  text: string
  color: string
  description: string
} {
  const labels: Record<SimilarityLabel, { text: string; color: string; description: string }> = {
    'core-fit': {
      text: 'Core Fit',
      color: 'bg-green-100 text-green-800',
      description: 'Highly aligned with your taste',
    },
    'familiar-territory': {
      text: 'Familiar Territory',
      color: 'bg-blue-100 text-blue-800',
      description: 'Similar to what you like',
    },
    'role-duplicate': {
      text: 'Role Duplicate',
      color: 'bg-yellow-100 text-yellow-800',
      description: 'May compete for wrist time',
    },
    'taste-expansion': {
      text: 'Taste Expansion',
      color: 'bg-purple-100 text-purple-800',
      description: 'New but still aligned',
    },
    'outlier': {
      text: 'Outlier',
      color: 'bg-gray-100 text-gray-800',
      description: 'Unusual for your collection',
    },
    'hard-mismatch': {
      text: 'Hard Mismatch',
      color: 'bg-red-100 text-red-800',
      description: 'Conflicts with stated dislikes',
    },
  }

  return labels[label]
}
