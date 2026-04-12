import type {
  Watch,
  UserPreferences,
  SimilarityLabel,
  SimilarityResult,
  CollectionGoal,
} from './types'

// Scoring weights for different dimensions
const WEIGHTS = {
  styleTags: 0.25,
  designTraits: 0.20,
  roleTags: 0.20,
  dialColor: 0.10,
  complications: 0.10,
  caseSize: 0.05,
  strapType: 0.05,
  waterResistance: 0.05,
}

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

export { GOAL_THRESHOLDS, detectLoyalBrands }

function arrayOverlap(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0
  const intersection = arr1.filter((item) => arr2.includes(item))
  const union = new Set([...arr1, ...arr2])
  return intersection.length / union.size
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
