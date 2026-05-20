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
    // Phase 49.1 D-VERDICT-01 — pivoted from primaryArchetype to eraSignal.
    // Narrative angle: "first-of-era" (distinct from era-echo's "echoes era").
    predicate: (result, profile, _candidate, taste) => {
      if (result.label !== 'taste-expansion' && result.label !== 'outlier') return null
      if (!taste.eraSignal) return null
      if (profile.dominantEraSignal === taste.eraSignal) return null
      return { era: taste.eraSignal }
    },
    template: 'Fills a hole in your collection — your first ${era} piece.',
    rationaleTemplate: 'My first ${era} piece — fills a real hole in what I own.',
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
    rationaleTemplate: 'Heritage-driven, like the rest of what I am drawn to.',
  },
  {
    id: 'collection-skews-contrast',
    // Phase 49.1 D-VERDICT-01 — pivoted from primaryArchetype to eraSignal.
    // Narrative angle: "collection-vs-piece era contrast" (distinct from
    // era-echo's "echo" angle and fills-a-hole's "first-of-era" angle).
    predicate: (result, profile, _c, taste) => {
      if (result.label === 'core-fit') return null
      if (!profile.dominantEraSignal || !taste.eraSignal) return null
      if (profile.dominantEraSignal === taste.eraSignal) return null
      return { dominant_era: profile.dominantEraSignal, contrast_era: taste.eraSignal }
    },
    template: 'Your collection skews ${dominant_era} — this is a ${contrast_era} piece.',
    rationaleTemplate: 'My collection skews ${dominant_era}, and this is a ${contrast_era} piece.',
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
    rationaleTemplate: 'Plays in the same space as my ${specific}.',
  },
  // ── 8 SUPPORTING TEMPLATES (Claude's Discretion starting set) ──────────────
  {
    id: 'first-watch',
    // Phase 49.1 D-VERDICT-03 — `profile.dominantArchetype` was removed from
    // ViewerTasteProfile; substitute the sibling categorical-mode field
    // (`dominantEraSignal`) as the same "is the viewer aggregate empty?" signal.
    predicate: (_result, profile) => {
      // Only fires when the viewer aggregate has nothing — i.e. EMPTY_PROFILE upstream
      if (profile.dominantEraSignal !== null) return null
      if (profile.meanFormality !== null) return null
      return {}
    },
    template: 'First watch in your collection — no comparison yet.',
    rationaleTemplate: 'My first watch — no collection to compare against yet.',
  },
  {
    id: 'core-fit-confirmed',
    predicate: (result) => (result.label === 'core-fit' ? {} : null),
    template: 'Lines up cleanly with your established taste.',
    rationaleTemplate: 'Lines up cleanly with the taste I have already built.',
  },
  {
    id: 'role-duplicate-warning',
    predicate: (result) => (result.roleOverlap ? {} : null),
    template: 'Competes for wrist time with watches you already own.',
    rationaleTemplate: 'Would compete for wrist time with watches I already own.',
  },
  {
    id: 'archetype-echo',
    // Phase 49.1 D-VERDICT-01 + D-VERDICT-02 — pivoted from primaryArchetype to
    // eraSignal. ID preserved (per planner intent, avoids breaking any persisted
    // references). Narrative angle: "leaning further into the dominant era" —
    // distinct from era-echo's "echoes the era" framing.
    predicate: (_result, profile, _c, taste) => {
      if (!taste.eraSignal) return null
      if (profile.dominantEraSignal !== taste.eraSignal) return null
      return { era: taste.eraSignal }
    },
    template: 'Another ${era} piece — leaning further into the era you favor.',
    rationaleTemplate: 'Another ${era} piece — leans further into the era I keep picking.',
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
    rationaleTemplate: 'Echoes the ${era} era I keep coming back to.',
  },
  {
    id: 'formality-aligned',
    predicate: (_result, profile, _c, taste) => {
      if (taste.formality === null || profile.meanFormality === null) return null
      if (Math.abs(taste.formality - profile.meanFormality) > 0.15) return null
      return {}
    },
    template: 'Matches the formality range of your favourites.',
    rationaleTemplate: 'Matches the formality range of the watches I wear most.',
  },
  {
    id: 'sportiness-contrast',
    predicate: (_result, profile, _c, taste) => {
      if (taste.sportiness === null || profile.meanSportiness === null) return null
      if (Math.abs(taste.sportiness - profile.meanSportiness) < 0.4) return null
      return {}
    },
    template: 'Shifts the sport/dress balance of your collection.',
    rationaleTemplate: 'Would shift the sport/dress balance of what I own.',
  },
  {
    id: 'hard-mismatch-stated',
    predicate: (result) => (result.label === 'hard-mismatch' ? {} : null),
    template: 'Conflicts with the styles you said you avoid.',
    rationaleTemplate: 'Conflicts with styles I said I avoid — if I want it, I want it for a reason.',
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
  'core-fit': 'Lines up cleanly with what you already like.',
  'familiar-territory': "Sits in territory you've already explored.",
  'role-duplicate': "Plays a role you've already filled in your collection.",
  'taste-expansion': "Stretches your taste in a direction it's already leaning.",
  'outlier': "Stands apart from your collection but doesn't conflict.",
  'hard-mismatch': 'Conflicts with styles you said you avoid.',
}

export const RATIONALE_FOR_LABEL: Record<SimilarityLabel, string> = {
  'core-fit': 'Lines up cleanly with what I already like.',
  'familiar-territory': "Sits in territory I've already explored.",
  'role-duplicate': "Plays a role I've already filled in my collection.",
  'taste-expansion': "Stretches my taste in a direction it's already leaning.",
  'outlier': "Stands apart from my collection but doesn't conflict.",
  'hard-mismatch': 'Conflicts with styles I said I avoid — if I want it, I want it for a reason.',
}
