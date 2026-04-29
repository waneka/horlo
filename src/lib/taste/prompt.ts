// src/lib/taste/prompt.ts
//
// Prompt builders for Phase 19.1 taste enrichment (D-08, D-11).
// Two builders: text-only and vision (with photo). Both produce a single string
// the enricher passes as the user-message content (or as the text block of a
// multimodal message in vision mode).
//
// Security note (T-19.1-02-01): user-typed brand/model/reference are interpolated
// via JSON.stringify to escape quotes/newlines and prevent prompt-injection by
// breaking the prompt structure. Length-cap at 200 chars before stringify.

import { PRIMARY_ARCHETYPES, ERA_SIGNALS, DESIGN_MOTIFS } from './vocab'
import type { EnrichmentSpecInput } from './types'

const FIELD_LENGTH_CAP = 200

function safeField(v: string | null | undefined): string {
  if (!v) return ''
  return JSON.stringify(v.slice(0, FIELD_LENGTH_CAP))
}

const SYSTEM_FRAMING = `You are evaluating a watch and recording its structured taste attributes for a personal collection-management app. Use the provided spec data and (if present) the photo to infer the watch's character.

Apply the following closed vocabularies — values outside these lists will be discarded:

primary_archetype (pick exactly one): ${PRIMARY_ARCHETYPES.join(', ')}

era_signal (pick exactly one): ${ERA_SIGNALS.join(', ')}

design_motifs (pick zero or more, max 8): ${DESIGN_MOTIFS.join(', ')}

Numeric fields (formality, sportiness, heritage_score, confidence) are 0..1 floats:
- formality: 0 = casual, 1 = black-tie dress
- sportiness: 0 = sedentary, 1 = active sport
- heritage_score: 0 = ahistorical novelty, 1 = storied/historically-significant lineage
- confidence: 0..1 self-rated. Use < 0.5 for ambiguous cases (sparse spec data, unfamiliar reference, photo unclear).

Use the record_taste_attributes tool to emit your assessment. Do NOT respond in plain text.`

function buildSpecBlock(spec: EnrichmentSpecInput): string {
  return [
    `Brand: ${safeField(spec.brand)}`,
    `Model: ${safeField(spec.model)}`,
    spec.reference ? `Reference: ${safeField(spec.reference)}` : null,
    spec.movement ? `Movement: ${safeField(spec.movement)}` : null,
    spec.caseSizeMm ? `Case size: ${spec.caseSizeMm}mm` : null,
    spec.lugToLugMm ? `Lug-to-lug: ${spec.lugToLugMm}mm` : null,
    spec.waterResistanceM ? `Water resistance: ${spec.waterResistanceM}m` : null,
    spec.crystalType ? `Crystal: ${safeField(spec.crystalType)}` : null,
    spec.dialColor ? `Dial color: ${safeField(spec.dialColor)}` : null,
    spec.isChronometer ? `Chronometer-certified: yes` : null,
    spec.productionYear ? `Production year: ${spec.productionYear}` : null,
    spec.complications.length ? `Complications: ${spec.complications.join(', ')}` : null,
  ].filter(Boolean).join('\n')
}

export function buildTextPrompt(spec: EnrichmentSpecInput): string {
  return `${SYSTEM_FRAMING}

WATCH SPEC:
${buildSpecBlock(spec)}

Produce taste attributes from the spec data above.`
}

export function buildVisionPrompt(spec: EnrichmentSpecInput): string {
  return `${SYSTEM_FRAMING}

WATCH SPEC:
${buildSpecBlock(spec)}

A photo of the watch is provided. Use BOTH the photo and the spec to produce taste attributes. The photo may reveal motifs (patina, dial finish, hand style, bracelet shape) the spec text does not capture — weight these signals in design_motifs.`
}
