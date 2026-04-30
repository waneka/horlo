import type { Template } from '@/lib/verdict/types'
import type { SimilarityLabel } from '@/lib/types'

/**
 * Phase 20 D-01: deterministic template library, single source of truth for FIT-02.
 *
 * 4 roadmap-mandated templates (CONTEXT.md D-01) + 8 supporting templates.
 * Predicates gate on observable signals from (SimilarityResult, ViewerTasteProfile,
 * Watch, CandidateTasteSnapshot). No randomness.
 *
 * The 4 roadmap templates ARE NOT optional — composer.test.ts asserts each fires
 * under its canonical fixture.
 */
export const TEMPLATES: Template[] = [
  // ── 4 ROADMAP TEMPLATES (D-01 lock) ────────────────────────────────────────
  {
    id: 'fills-a-hole',
    predicate: (result, profile, _candidate, taste) => {
      if (result.label !== 'taste-expansion' && result.label !== 'outlier') return null
      if (!taste.primaryArchetype) return null
      if (profile.dominantArchetype === taste.primaryArchetype) return null
      return { archetype: taste.primaryArchetype }
    },
    template: 'Fills a hole in your collection — your first ${archetype}.',
  },
  {
    id: 'aligns-with-heritage',
    predicate: (result, profile, _c, taste) => {
      if (result.label === 'hard-mismatch') return null
      if ((taste.heritageScore ?? 0) < 0.7) return null
      if ((profile.meanHeritageScore ?? 0) < 0.6) return null
      return {}
    },
    template: 'Aligns with your heritage-driven taste.',
  },
  {
    id: 'collection-skews-contrast',
    predicate: (result, profile, _c, taste) => {
      if (result.label === 'core-fit') return null
      if (!profile.dominantArchetype || !taste.primaryArchetype) return null
      if (profile.dominantArchetype === taste.primaryArchetype) return null
      return { dominant: profile.dominantArchetype, contrast: taste.primaryArchetype }
    },
    template: 'Your collection skews ${dominant} — this is a ${contrast}.',
  },
  {
    id: 'overlaps-with-specific',
    predicate: (result) => {
      const top = result.mostSimilarWatches[0]
      if (!top) return null
      if (top.score < 0.6) return null
      return { specific: `${top.watch.brand} ${top.watch.model}` }
    },
    template: 'Overlaps strongly with your ${specific}.',
  },
  // ── 8 SUPPORTING TEMPLATES (Claude's Discretion starting set) ──────────────
  {
    id: 'first-watch',
    predicate: (_result, profile) => {
      // Only fires when the viewer aggregate has nothing — i.e. EMPTY_PROFILE upstream
      if (profile.dominantArchetype !== null) return null
      if (profile.meanFormality !== null) return null
      return {}
    },
    template: 'First watch in your collection — no comparison yet.',
  },
  {
    id: 'core-fit-confirmed',
    predicate: (result) => (result.label === 'core-fit' ? {} : null),
    template: 'Lines up cleanly with your established taste.',
  },
  {
    id: 'role-duplicate-warning',
    predicate: (result) => (result.roleOverlap ? {} : null),
    template: 'Competes for wrist time with watches you already own.',
  },
  {
    id: 'archetype-echo',
    predicate: (_result, profile, _c, taste) => {
      if (!taste.primaryArchetype) return null
      if (profile.dominantArchetype !== taste.primaryArchetype) return null
      return { archetype: taste.primaryArchetype }
    },
    template: 'Another ${archetype} — your dominant style.',
  },
  {
    id: 'era-echo',
    predicate: (_result, _profile, _c, _taste) => {
      // taste does not carry eraSignal in CandidateTasteSnapshot — derive via candidate's
      // Phase 19.1 catalog row upstream; if not threaded, predicate cannot fire.
      // Reserved slot — composer caller may inject candidateEraSignal in future.
      return null
    },
    template: 'Echoes the ${era} era of your collection.',
  },
  {
    id: 'formality-aligned',
    predicate: (_result, profile, _c, taste) => {
      if (taste.formality === null || profile.meanFormality === null) return null
      if (Math.abs(taste.formality - profile.meanFormality) > 0.15) return null
      return {}
    },
    template: 'Matches the formality range of your favourites.',
  },
  {
    id: 'sportiness-contrast',
    predicate: (_result, profile, _c, taste) => {
      if (taste.sportiness === null || profile.meanSportiness === null) return null
      if (Math.abs(taste.sportiness - profile.meanSportiness) < 0.4) return null
      return {}
    },
    template: 'Shifts the sport/dress balance of your collection.',
  },
  {
    id: 'hard-mismatch-stated',
    predicate: (result) => (result.label === 'hard-mismatch' ? {} : null),
    template: 'Conflicts with the styles you said you avoid.',
  },
]

export const HEADLINE_FOR_LABEL: Record<SimilarityLabel, string> = {
  'core-fit': 'Core Fit',
  'familiar-territory': 'Familiar Territory',
  'role-duplicate': 'Role Duplicate',
  'taste-expansion': 'Taste Expansion',
  'outlier': 'Outlier',
  'hard-mismatch': 'Hard Mismatch',
}

export const DESCRIPTION_FOR_LABEL: Record<SimilarityLabel, string> = {
  'core-fit': 'Highly aligned with your taste',
  'familiar-territory': 'Similar to what you like',
  'role-duplicate': 'May compete for wrist time',
  'taste-expansion': 'New but still aligned',
  'outlier': 'Unusual for your collection',
  'hard-mismatch': 'Conflicts with stated dislikes',
}
