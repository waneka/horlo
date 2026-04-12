import type { Watch, UserPreferences, CollectionGoal } from './types'
import { detectLoyalBrands } from './similarity'

/**
 * Goal-aware gap-fill result. `kind === 'numeric'` carries a 0-100 score and
 * the list of new (style × role × dial) tuples; every other kind is a chip
 * label with `score: null`.
 */
export interface GapFillResult {
  kind: 'numeric' | 'first-watch' | 'outside-specialty' | 'off-brand' | 'breaks-theme'
  score: number | null
  newTuples: string[]
  totalTuplesInUniverse: number
  goalUsed: CollectionGoal
}

const MIN_COLLECTION_FOR_DETECTION = 3
const DOMINANCE_THRESHOLD = 0.5 // >=50% per CONTEXT.md

/**
 * Enumerate (style × role × dial) tuples for a single watch.
 * Missing dialColor drops to (style × role). Empty style/role arrays
 * fall back to a `(none)` sentinel so the watch still contributes one tuple.
 */
function tuplesOf(watch: Watch): string[] {
  const styles = watch.styleTags.length > 0 ? watch.styleTags : ['(none)']
  const roles = watch.roleTags.length > 0 ? watch.roleTags : ['(none)']
  const out: string[] = []
  if (watch.dialColor) {
    for (const s of styles) for (const r of roles) out.push(`${s}|${r}|${watch.dialColor}`)
  } else {
    for (const s of styles) for (const r of roles) out.push(`${s}|${r}`)
  }
  return out
}

/** Detect the dominant style tag (>=50% of owned). Fallback: dominant role tag. */
function detectSpecialty(owned: Watch[]): { kind: 'style' | 'role' | 'none'; value?: string } {
  if (owned.length < MIN_COLLECTION_FOR_DETECTION) return { kind: 'none' }
  const styleCounts = new Map<string, number>()
  for (const w of owned) for (const s of w.styleTags) styleCounts.set(s, (styleCounts.get(s) ?? 0) + 1)
  for (const [s, c] of styleCounts) {
    if (c / owned.length >= DOMINANCE_THRESHOLD) return { kind: 'style', value: s }
  }
  const roleCounts = new Map<string, number>()
  for (const w of owned) for (const r of w.roleTags) roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1)
  for (const [r, c] of roleCounts) {
    if (c / owned.length >= DOMINANCE_THRESHOLD) return { kind: 'role', value: r }
  }
  return { kind: 'none' }
}

/** Detect design traits shared by >=50% of owned watches. */
function detectTheme(owned: Watch[]): string[] {
  if (owned.length < MIN_COLLECTION_FOR_DETECTION) return []
  const counts = new Map<string, number>()
  for (const w of owned) for (const t of w.designTraits) counts.set(t, (counts.get(t) ?? 0) + 1)
  const theme: string[] = []
  for (const [t, c] of counts) if (c / owned.length >= DOMINANCE_THRESHOLD) theme.push(t)
  return theme
}

export function computeGapFill(
  target: Watch,
  collection: Watch[],
  preferences: UserPreferences,
): GapFillResult {
  const owned = collection.filter((w) => w.status === 'owned' || w.status === 'grail')

  // Edge: empty collection -> neutral first-watch label
  if (owned.length === 0) {
    return {
      kind: 'first-watch',
      score: null,
      newTuples: [],
      totalTuplesInUniverse: 0,
      goalUsed: 'balanced',
    }
  }

  // Below detection floor -> force balanced universe regardless of stated goal.
  const requestedGoal: CollectionGoal = preferences.collectionGoal ?? 'balanced'
  const effectiveGoal: CollectionGoal =
    owned.length < MIN_COLLECTION_FOR_DETECTION ? 'balanced' : requestedGoal

  // Out-of-universe checks (per goal)
  if (effectiveGoal === 'specialist') {
    const spec = detectSpecialty(owned)
    if (spec.kind === 'style' && !target.styleTags.includes(spec.value!)) {
      return {
        kind: 'outside-specialty',
        score: null,
        newTuples: [],
        totalTuplesInUniverse: 0,
        goalUsed: 'specialist',
      }
    }
    if (spec.kind === 'role' && !target.roleTags.includes(spec.value!)) {
      return {
        kind: 'outside-specialty',
        score: null,
        newTuples: [],
        totalTuplesInUniverse: 0,
        goalUsed: 'specialist',
      }
    }
    // spec.kind === 'none' -> falls through to balanced tuple scoring (goalUsed reflects fallback below)
  }

  if (effectiveGoal === 'brand-loyalist') {
    const loyal = detectLoyalBrands(owned)
    if (loyal.length > 0 && !loyal.includes(target.brand)) {
      return {
        kind: 'off-brand',
        score: null,
        newTuples: [],
        totalTuplesInUniverse: 0,
        goalUsed: 'brand-loyalist',
      }
    }
  }

  if (effectiveGoal === 'variety-within-theme') {
    const theme = detectTheme(owned)
    if (theme.length > 0) {
      const shared = target.designTraits.filter((t) => theme.includes(t)).length
      if (shared < Math.ceil(theme.length / 2)) {
        return {
          kind: 'breaks-theme',
          score: null,
          newTuples: [],
          totalTuplesInUniverse: 0,
          goalUsed: 'variety-within-theme',
        }
      }
    }
  }

  // Specialist fallback: if specialty couldn't be detected, goalUsed reflects
  // the balanced fallback per CONTEXT.md.
  let goalUsed: CollectionGoal = effectiveGoal
  if (effectiveGoal === 'specialist') {
    const spec = detectSpecialty(owned)
    if (spec.kind === 'none') goalUsed = 'balanced'
  }

  // Numeric scoring: tuple universe = union of all owned tuples + target tuples
  const ownedTuples = new Set<string>()
  for (const w of owned) for (const t of tuplesOf(w)) ownedTuples.add(t)

  const targetTuples = tuplesOf(target)
  const newTuples = targetTuples.filter((t) => !ownedTuples.has(t))
  const universe = new Set<string>([...ownedTuples, ...targetTuples])

  const score = universe.size === 0 ? 0 : Math.round((newTuples.length / universe.size) * 100)

  // Humanize tuples for display (pipe → ` + `)
  const humanized = newTuples.map((t) => t.split('|').join(' + '))

  return {
    kind: 'numeric',
    score,
    newTuples: humanized,
    totalTuplesInUniverse: universe.size,
    goalUsed,
  }
}
