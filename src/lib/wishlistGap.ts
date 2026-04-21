// Pure, deterministic "Wishlist Gap" derivation — no I/O, no Date.now(), no
// server-only directive. Safe to import from server components, client code,
// or tests. Per CONTEXT.md I-01 + RESEARCH.md Pitfall 9.
import type { Watch } from '@/lib/types'
import type { CanonicalRole, WishlistGap } from '@/lib/discoveryTypes'

/**
 * The 9 canonical roles Phase 10 evaluates for under-representation.
 *
 * Array ORDER is load-bearing: it is the stable tiebreak for
 * equal-frequency gap candidates AND the stable tiebreak for equal-frequency
 * leansOn candidates. Do not reorder without updating the test fixtures.
 */
export const CANONICAL_ROLES = [
  'dive',
  'dress',
  'sport',
  'field',
  'pilot',
  'chronograph',
  'travel',
  'formal',
  'casual',
] as const satisfies readonly CanonicalRole[]

/** A role is a "gap" candidate when its owned-freq is strictly below this threshold. */
const GAP_THRESHOLD = 0.10

function isCanonical(tag: string): tag is CanonicalRole {
  return (CANONICAL_ROLES as readonly string[]).includes(tag)
}

/**
 * Identify the under-represented canonical role in the OWNED collection that
 * is NOT already covered by a wishlist entry.
 *
 * Algorithm (per CONTEXT.md I-01 + RESEARCH.md Pitfall 9, LOCKED):
 *   1. Compute each canonical role's freq in OWNED watches.
 *      freq(role) = |owned where role in roleTags| / |owned|.
 *      Multi-role watches count toward every role they carry.
 *   2. For each canonical role where freq < 0.10:
 *        - skip if ANY wishlist row covers this role.
 *        - otherwise, it's a gap candidate.
 *   3. Among gap candidates, pick the one with the LOWEST owned freq. Tiebreak
 *      by CANONICAL_ROLES array order (stable).
 *   4. leansOn = canonical role with the HIGHEST owned freq (>0; null if none).
 *   5. rationale = "Your collection leans {leansOn}. Consider a {role} watch
 *      to round it out." when both are present; null otherwise.
 *
 * Edge cases:
 *   - Empty owned → { role: null, leansOn: null, rationale: null }.
 *   - Every canonical role already in wishlist → role=null, rationale=null.
 *   - owned.every(roleTags=[]) → every freq is 0; leansOn=null so rationale=null.
 *
 * Pure — deterministic for a given input pair, no wall-clock reads.
 */
export function wishlistGap(
  ownedWatches: readonly Watch[],
  wishlistWatches: readonly Watch[],
): WishlistGap {
  if (ownedWatches.length === 0) {
    return { role: null, leansOn: null, rationale: null }
  }

  // Per-role count in owned. Multi-role watches count toward each role.
  const ownedCounts = new Map<CanonicalRole, number>()
  for (const role of CANONICAL_ROLES) ownedCounts.set(role, 0)
  for (const w of ownedWatches) {
    for (const tag of w.roleTags) {
      if (isCanonical(tag)) {
        ownedCounts.set(tag, (ownedCounts.get(tag) ?? 0) + 1)
      }
    }
  }
  const total = ownedWatches.length
  const freq = (r: CanonicalRole) => (ownedCounts.get(r) ?? 0) / total

  // Wishlist coverage — which canonical roles are already in the wishlist?
  const wishlistRoles = new Set<string>()
  for (const w of wishlistWatches) for (const t of w.roleTags) wishlistRoles.add(t)

  // Pick the canonical role with the LOWEST freq that is (a) below the gap
  // threshold and (b) not already wishlisted. Array-order iteration makes the
  // tiebreak stable on equal freqs (first-seen wins because strict `<` below
  // does not replace on tie).
  let gap: CanonicalRole | null = null
  let gapFreq = Number.POSITIVE_INFINITY
  for (const r of CANONICAL_ROLES) {
    if (wishlistRoles.has(r)) continue
    const f = freq(r)
    if (f < GAP_THRESHOLD && f < gapFreq) {
      gap = r
      gapFreq = f
    }
  }

  // leansOn = the canonical role with the HIGHEST owned freq. Tiebreak by
  // CANONICAL_ROLES array order — iterate in order and only replace on strict
  // greater-than, so the first-seen max wins.
  let leansOn: CanonicalRole | null = null
  let leansFreq = -1
  for (const r of CANONICAL_ROLES) {
    const f = freq(r)
    if (f > leansFreq) {
      leansOn = r
      leansFreq = f
    }
  }
  if (leansFreq === 0) leansOn = null

  const rationale =
    gap && leansOn
      ? `Your collection leans ${leansOn}. Consider a ${gap} watch to round it out.`
      : null

  return { role: gap, leansOn, rationale }
}
