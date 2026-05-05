import 'server-only'
import { analyzeSimilarity } from '@/lib/similarity'
import type { Watch, UserPreferences, CatalogEntry } from '@/lib/types'
import type {
  VerdictBundleFull,
  Framing,
  ViewerTasteProfile,
  CandidateTasteSnapshot,
} from '@/lib/verdict/types'
import {
  TEMPLATES,
  HEADLINE_FOR_LABEL,
  DESCRIPTION_FOR_LABEL,
  RATIONALE_FOR_LABEL,
} from '@/lib/verdict/templates'

/**
 * Phase 20 D-01 + Pitfall 4: deterministic verdict composer.
 *
 * Confidence gating (Phase 19.1 D-14):
 *   - confidence === null OR < 0.5 → 6-fixed-label fallback (no templates)
 *   - 0.5 ≤ confidence < 0.7 → templates fire with "Possibly " prefix (hedged)
 *   - confidence ≥ 0.7 → templates fire as written (full contextual)
 *
 * Composer iterates TEMPLATES in insertion order and fires every applicable
 * template (no early-return after first match). Caller decides display count.
 */

interface ComposeArgs {
  candidate: Watch
  catalogEntry?: CatalogEntry | null
  collection: Watch[]
  preferences: UserPreferences
  profile: ViewerTasteProfile
  /** self-owned framing is built upstream (D-08); composer only handles full-verdict cases. */
  framing: Exclude<Framing, 'self-via-cross-user'>
}

const HEDGE_PREFIX = 'Possibly '
const FULL_CONFIDENCE_THRESHOLD = 0.7
const HEDGE_CONFIDENCE_THRESHOLD = 0.5

export function computeVerdictBundle(args: ComposeArgs): VerdictBundleFull {
  const { candidate, catalogEntry, collection, preferences, profile, framing } = args
  const result = analyzeSimilarity(candidate, collection, preferences)

  const candidateTaste: CandidateTasteSnapshot = {
    primaryArchetype: catalogEntry?.primaryArchetype ?? null,
    heritageScore: catalogEntry?.heritageScore ?? null,
    formality: catalogEntry?.formality ?? null,
    sportiness: catalogEntry?.sportiness ?? null,
    confidence: catalogEntry?.confidence ?? null,
  }

  const conf = candidateTaste.confidence
  const isFallback = conf === null || conf < HEDGE_CONFIDENCE_THRESHOLD
  const isHedged = !isFallback && conf < FULL_CONFIDENCE_THRESHOLD

  let contextualPhrasings: string[]
  let rationalePhrasings: string[]
  if (isFallback) {
    contextualPhrasings = [DESCRIPTION_FOR_LABEL[result.label]]
    rationalePhrasings = [RATIONALE_FOR_LABEL[result.label]]
  } else {
    const phrasings: string[] = []
    const rationales: string[] = []
    for (const t of TEMPLATES) {
      const slots = t.predicate(result, profile, candidate, candidateTaste)
      if (!slots) continue
      let copy = fillTemplate(t.template, slots)
      let rationale = fillTemplate(t.rationaleTemplate, slots)
      if (isHedged) {
        copy = applyHedge(copy)
        rationale = applyHedge(rationale)
      }
      phrasings.push(copy)
      rationales.push(rationale)
    }
    contextualPhrasings =
      phrasings.length > 0 ? phrasings : [DESCRIPTION_FOR_LABEL[result.label]]
    rationalePhrasings =
      rationales.length > 0 ? rationales : [RATIONALE_FOR_LABEL[result.label]]
  }

  return {
    framing,
    label: result.label,
    headlinePhrasing: HEADLINE_FOR_LABEL[result.label],
    contextualPhrasings,
    rationalePhrasings,
    mostSimilar: result.mostSimilarWatches.map(({ watch, score }) => ({
      watch,
      score,
    })),
    roleOverlap: result.roleOverlap,
  }
}

function fillTemplate(tmpl: string, slots: Record<string, string>): string {
  return tmpl.replace(/\$\{(\w+)\}/g, (_, k) => slots[k] ?? '')
}

/**
 * Hedge prefix: "Aligns with…" → "Possibly aligns with…" — lowercases the first
 * letter of the original sentence so the hedge reads naturally mid-sentence.
 */
function applyHedge(s: string): string {
  if (s.length === 0) return s
  const lowered = s[0].toLowerCase() + s.slice(1)
  return `${HEDGE_PREFIX}${lowered}`
}
