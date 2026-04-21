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
  const topBrand = topBrandOf(ctx.viewerOwnedWatches)
  if (
    topBrand &&
    topBrand.toLowerCase() === ctx.candidateBrand.toLowerCase()
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

function topBrandOf(watches: readonly Watch[]): string | null {
  const owned = watches.filter((w) => w.status === 'owned')
  if (owned.length === 0) return null
  const counts = new Map<string, number>()
  for (const w of owned) counts.set(w.brand, (counts.get(w.brand) ?? 0) + 1)
  // Sort by count DESC, then alphabetical ASC for deterministic tiebreak.
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
  return sorted[0]?.[0] ?? null
}

function dominantStyleOf(
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
