import type { CatalogTasteAttributes } from '@/lib/types'

// D-16 thresholds (locked — do not change without updating tests).
const SCALAR_THRESHOLD = 0.1
const MOTIF_THRESHOLD = 0.8

/**
 * Compute a plain-language phrase describing the single highest-delta taste
 * dimension between two watches. D-16 algorithm (Phase 40 FIT-05).
 *
 * Both arguments are `CatalogTasteAttributes` from the verdict bundle — already
 * validated upstream. No forbidden imports: this module does NOT import
 * `@/lib/similarity` or `@/lib/verdict/composer`.
 */
export function computeDeltaPhrase(
  candidate: CatalogTasteAttributes,
  owned: CatalogTasteAttributes,
): string {
  // Step 1-3: compute per-dimension deltas.
  // Scalars: null when either side is null (excluded from winner comparison).
  const formalityDelta =
    candidate.formality !== null && owned.formality !== null
      ? Math.abs(candidate.formality - owned.formality)
      : null
  const sportinessDelta =
    candidate.sportiness !== null && owned.sportiness !== null
      ? Math.abs(candidate.sportiness - owned.sportiness)
      : null
  const heritageDelta =
    candidate.heritageScore !== null && owned.heritageScore !== null
      ? Math.abs(candidate.heritageScore - owned.heritageScore)
      : null

  // Categoricals: null===null counts as match (delta=0); null vs non-null is mismatch (delta=1).
  // Phase 49.1 D-SCOPE-01c — archetypeDelta dimension dropped; eraSignal is the
  // sole surviving categorical taste dimension.
  const eraDelta = candidate.eraSignal === owned.eraSignal ? 0 : 1

  // Motifs: Jaccard similarity; delta = 1 - similarity.
  const motifJaccard = jaccardSimilarity(
    candidate.designMotifs ?? [],
    owned.designMotifs ?? [],
  )
  const motifDelta = 1 - motifJaccard

  // Step 4: "Very similar" fallback — all deltas within thresholds.
  const allScalarsSmall = [formalityDelta, sportinessDelta, heritageDelta].every(
    (d) => d === null || d < SCALAR_THRESHOLD,
  )
  if (
    allScalarsSmall &&
    eraDelta === 0 &&
    motifJaccard >= MOTIF_THRESHOLD
  ) {
    return 'Very similar across all taste dimensions'
  }

  // Step 5: find the winning dimension (highest delta).
  // Tie-break: dimension declaration order in CatalogTasteAttributes
  // (formality > sportiness > heritageScore > eraSignal > designMotifs).
  // Phase 49.1 D-SCOPE-01c — primaryArchetype removed; ranked list is now 5-deep.
  // Replace best only when current > best (strict-greater preserves earlier entries on tie).
  type DimEntry = { name: string; delta: number }
  let best: DimEntry | null = null

  function tryUpdate(name: string, delta: number | null): void {
    if (delta === null) return
    if (best === null || delta > best.delta) {
      best = { name, delta }
    }
  }

  tryUpdate('formality', formalityDelta)
  tryUpdate('sportiness', sportinessDelta)
  tryUpdate('heritageScore', heritageDelta)
  // Categoricals only enter the winner list when they are different (delta === 1).
  // Phase 49.1 D-SCOPE-01c — primaryArchetype dimension dropped from the ranked list.
  if (eraDelta === 1) tryUpdate('eraSignal', eraDelta)
  tryUpdate('designMotifs', motifDelta)

  // Step 5 edge case: all deltas null (degenerate input) — return fallback.
  if (best === null) {
    return 'Very similar across all taste dimensions'
  }

  // Capture in a const so TypeScript control-flow narrowing correctly types it as DimEntry.
  const winner: DimEntry = best

  // Step 5: emit the phrase for the winning dimension.
  switch (winner.name) {
    case 'formality':
      return (candidate.formality ?? 0) > (owned.formality ?? 0)
        ? 'This is more formal'
        : 'This is more casual'

    case 'sportiness':
      return (candidate.sportiness ?? 0) > (owned.sportiness ?? 0)
        ? 'This is more sport'
        : 'This is less sport'

    case 'heritageScore':
      return (candidate.heritageScore ?? 0) > (owned.heritageScore ?? 0)
        ? 'More heritage-leaning'
        : 'More modern in character'

    // Phase 49.1 D-SCOPE-01c — primaryArchetype case deleted; eraSignal is now the
    // sole categorical case in the phrase switch.
    case 'eraSignal':
      return `Different era: ${displayEnum(candidate.eraSignal)} vs ${displayEnum(owned.eraSignal)}`

    case 'designMotifs':
      return 'Different design motifs'

    default:
      return 'Very similar across all taste dimensions'
  }
}

// --- Internal helpers (not exported) ---

/**
 * Jaccard similarity between two string arrays.
 * Both empty → 1 (identical empty sets).
 * One empty → 0 (union is non-empty, intersection is empty).
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  const setA = new Set(a)
  const intersection = b.filter((x) => setA.has(x)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 1 : intersection / union
}

/**
 * Display transform for closed-vocab enum values.
 * Replaces underscores and hyphens with spaces, then capitalizes each word.
 * null → '—'.
 */
function displayEnum(val: string | null): string {
  if (val === null) return '—'
  return val
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
