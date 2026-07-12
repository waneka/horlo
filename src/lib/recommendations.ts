// Pure, deterministic recommendation rationale templates — no I/O, no
// 'server-only' directive, no external calls. The DAL composes this per
// candidate watch, checked in priority order: first match wins.
//
// Per CONTEXT.md C-03 (rule-based rationale, no LLM dependency) +
// RESEARCH.md § Rule-based rationale algorithm.
import type { Watch } from '@/lib/types'

export interface RationaleContext {
  candidateBrand: string
  candidateModel: string
  candidateRoleTags: string[]
  candidateStyleTags: string[]
  viewerOwnedWatches: readonly Watch[]
  /** How many similar collectors in the sampled pool own this candidate. */
  viewerOwnershipCount: number
  /**
   * Pre-computed viewer top brand (Phase 81 D-81-05). Caller (DAL) computes
   * once via `topBrandOf(viewerWatches, brandNameLookup)` and threads through
   * per-candidate contexts — avoids N² per-candidate re-derivation AND
   * removes the need to thread a `brandNameLookup: Map` through this pure
   * function's signature. Null when the viewer's collection has no FK-keyed
   * brand identity (all owned watches carry brandId=undefined — Phase 17
   * `onDelete: 'set null'` edge case) or when the resolved brandName misses
   * the lookup (Pitfall 6 defensive).
   */
  viewerTopBrand: { brandId: string; brandName: string } | null
}

/**
 * Ordered list of template names. First match wins (priority order).
 * Names match grep patterns in the plan's acceptance criteria.
 */
export const RATIONALE_TEMPLATES = [
  'brand-match',
  'popular-role',
  'dominant-style',
  'top-role-pair',
  'community-fallback',
] as const

// Template thresholds, kept as named constants for discoverability.
const POPULAR_OWNERSHIP_THRESHOLD = 5
const DOMINANT_STYLE_THRESHOLD = 0.5

/**
 * Return a human-readable rationale string for a candidate watch. Five
 * templates, checked in order; first match wins.
 *
 *  1. brand-match:      viewer's top-owned brand == candidate brand
 *     → "Fans of {brand} love this"
 *  2. popular-role:     candidate has a canonical role AND is owned by
 *                       >= 5 similar collectors in the pool
 *     → "Popular among {role} watch collectors"
 *  3. dominant-style:   candidate style overlaps viewer's dominant (>50%) style
 *     → "Matches your {style} collection"
 *  4. top-role-pair:    candidate role == viewer's most-owned role
 *     → "Often paired with {role} watches"
 *  5. community-fallback: nothing else matches
 *     → "Popular in the community"
 *
 * Pure — no Date.now(), no I/O, deterministic for a given input.
 */
export function rationaleFor(ctx: RationaleContext): string {
  // 1. Brand match (case-insensitive — top brand is case-normalized).
  // Phase 81: read pre-computed viewerTopBrand from ctx (was: internal
  // topBrandOf call on viewerOwnedWatches). The canonical brandName comes
  // from the DAL-built brandNameLookup; comparison against ctx.candidateBrand
  // stays case-insensitive because candidateBrand can arrive from either
  // (a) a JOIN-derived canonical string (synthetic top-up) or (b) a peer
  // watch's canonical `watches.brand` (DISP-01 hydrated). Pitfall 6:
  // viewerTopBrand?.brandName can never be `undefined` in the substitution
  // — the DAL null-guards when the lookup misses.
  const topBrand = ctx.viewerTopBrand
  if (
    topBrand &&
    topBrand.brandName.toLowerCase() === ctx.candidateBrand.toLowerCase()
  ) {
    return `Fans of ${ctx.candidateBrand} love this`
  }

  // 2. Popular role among similar collectors.
  if (ctx.viewerOwnershipCount >= POPULAR_OWNERSHIP_THRESHOLD) {
    for (const role of ctx.candidateRoleTags) {
      if (role === 'dive') return 'Popular among dive watch collectors'
      if (role === 'dress') return 'Popular among dress watch collectors'
      if (role === 'pilot') return 'Popular among pilot watch collectors'
      if (role === 'field') return 'Popular among field watch collectors'
      if (role === 'sport') return 'Popular among sport watch collectors'
    }
  }

  // 3. Dominant-style match.
  const dominantStyle = dominantStyleOf(ctx.viewerOwnedWatches)
  if (
    dominantStyle &&
    ctx.candidateStyleTags.includes(dominantStyle.label) &&
    dominantStyle.share > DOMINANT_STYLE_THRESHOLD
  ) {
    return `Matches your ${dominantStyle.label} collection`
  }

  // 4. Top-role pair.
  const topRole = topRoleOf(ctx.viewerOwnedWatches)
  if (topRole && ctx.candidateRoleTags.includes(topRole)) {
    return `Often paired with ${topRole} watches`
  }

  // 5. Fallback.
  return 'Popular in the community'
}

// -------- helpers --------

/**
 * Return the viewer's top-owned brand keyed by canonical `brandId` (FK to
 * `brands.id`) with the resolved `brandName` from `brandNameLookup`.
 *
 * Phase 81 D-81-05 signature widen. Was: `(watches) => string | null` that
 * counted by free-text `w.brand`; now: counts by `w.brandId!` with legacy
 * `brandId=undefined` rows correctly excluded (Phase 17 `ON DELETE SET NULL`
 * edge case would otherwise inflate stale-string totals).
 *
 * Tiebreak: count DESC, then resolved brandName ASC (via `localeCompare`).
 * Returns `null` when no owned watches carry a brandId OR when the resolved
 * brandName is missing from `brandNameLookup` (Pitfall 6 defensive — better
 * to return null than substitute `undefined` into a rationale template).
 *
 * @param watches   Viewer's full watch list (all statuses; internally filters to owned+brandId).
 * @param brandNameLookup Pre-fetched `brand_id → brands.name` map. DAL builds
 *   once per request from `SELECT id, name FROM brands WHERE id IN (…viewer's brandIds…)`
 *   — cheap pk-indexed query, 5-30 rows per typical viewer.
 */
export function topBrandOf(
  watches: readonly Watch[],
  brandNameLookup: Map<string, string>,
): { brandId: string; brandName: string } | null {
  // Filter to owned AND brandId-present. Legacy watches (catalog wiped via
  // Phase 17 onDelete: 'set null') carry brandId=undefined and are excluded
  // — under D-81-05 they no longer inflate stale-string counts.
  const owned = watches.filter((w) => w.status === 'owned' && w.brandId)
  if (owned.length === 0) return null

  const counts = new Map<string, number>()
  for (const w of owned) {
    // Filter above guarantees brandId non-null.
    counts.set(w.brandId!, (counts.get(w.brandId!) ?? 0) + 1)
  }

  // Sort by count DESC, then resolved brandName ASC for deterministic tiebreak
  // (was: raw brand string ASC — now canonical brand name).
  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    const aName = brandNameLookup.get(a[0]) ?? ''
    const bName = brandNameLookup.get(b[0]) ?? ''
    return aName.localeCompare(bName)
  })

  const winner = sorted[0]
  if (!winner) return null
  const brandName = brandNameLookup.get(winner[0])
  // Pitfall 6 defensive — if the DAL-built lookup missed this brandId (race
  // condition: viewer added a watch mid-request), return null rather than
  // surface `Fans of undefined love this` downstream.
  if (!brandName) return null
  return { brandId: winner[0], brandName }
}

export function dominantStyleOf(
  watches: readonly Watch[],
): { label: string; share: number } | null {
  const owned = watches.filter((w) => w.status === 'owned')
  if (owned.length === 0) return null
  const counts = new Map<string, number>()
  for (const w of owned)
    for (const s of w.styleTags) counts.set(s, (counts.get(s) ?? 0) + 1)
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
  const top = sorted[0]
  if (!top) return null
  return { label: top[0], share: top[1] / owned.length }
}

function topRoleOf(watches: readonly Watch[]): string | null {
  const owned = watches.filter((w) => w.status === 'owned')
  if (owned.length === 0) return null
  const counts = new Map<string, number>()
  for (const w of owned)
    for (const r of w.roleTags) counts.set(r, (counts.get(r) ?? 0) + 1)
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
  return sorted[0]?.[0] ?? null
}
