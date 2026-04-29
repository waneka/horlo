// src/lib/taste/vocab.ts
//
// Closed vocabularies for Phase 19.1 catalog taste enrichment (D-04, D-05, D-06).
// Vocabularies are TS constants, NOT pgEnum — see CONTEXT.md D-02. Adding a value
// is a code deploy, no migration. The DB CHECK constraint mirrors PRIMARY_ARCHETYPES
// and ERA_SIGNALS exactly (Plan 01 supabase/migrations/.../taste_constraints.sql);
// design_motifs is TS-only-validated.

import { z } from 'zod'
import type { CatalogTasteAttributes, PrimaryArchetype, EraSignal } from '@/lib/types'

// Re-export the type aliases so consumers can import vocab + types from one place.
export type { CatalogTasteAttributes, PrimaryArchetype, EraSignal }

// 10 functional categories (D-01).
export const PRIMARY_ARCHETYPES = [
  'dress', 'dive', 'field', 'pilot', 'chrono',
  'gmt', 'racing', 'sport', 'tool', 'hybrid',
] as const

// 3 era buckets (D-01).
export const ERA_SIGNALS = [
  'vintage-leaning', 'modern', 'contemporary',
] as const

// 28 design motifs across 5 categories (RESEARCH §"Design Motifs Vocabulary Draft").
// Visual/aesthetic descriptors with NO overlap to primary_archetype, era_signal,
// or complications. User reviews + locks at plan-check (D-04).
export const DESIGN_MOTIFS = [
  // Dial features (10)
  'sandwich-dial', 'california-dial', 'gilt-dial', 'fume-dial', 'meteorite-dial',
  'enamel-dial', 'guilloche-dial', 'textured-dial', 'skeletonized-dial', 'sector-dial',
  // Indices/hands (5)
  'applied-indices', 'breguet-hands', 'cathedral-hands', 'mercedes-hands', 'syringe-hands',
  // Case shape (5)
  'cushion-case', 'tonneau-case', 'tank-case', 'compressor-case', 'asymmetric-case',
  // Bracelet/strap integration (3)
  'integrated-bracelet', 'beads-of-rice-bracelet', 'tropic-strap',
  // Era-aesthetic / surface character (5)
  'patina-friendly', 'domed-crystal', 'bauhaus', 'exhibition-caseback', 'dressy-bezel',
] as const

// Set lookup for O(1) vocab membership checks (D-05 filter).
const PRIMARY_ARCHETYPE_SET = new Set<string>(PRIMARY_ARCHETYPES)
const ERA_SIGNAL_SET = new Set<string>(ERA_SIGNALS)
const DESIGN_MOTIFS_SET = new Set<string>(DESIGN_MOTIFS)

// ---------------------------------------------------------------------------
// Zod schema — wire-format from LLM tool_use input
// ---------------------------------------------------------------------------
// Mirrors the snake_case wire format the LLM emits. Consumers (enricher.ts) map
// to CatalogTasteAttributes camelCase after Zod parse + vocab filter.
export const TasteSchema = z.object({
  formality:         z.number().min(0).max(1),
  sportiness:        z.number().min(0).max(1),
  heritage_score:    z.number().min(0).max(1),
  // Use z.string() not z.enum() so Zod passes through any string value and
  // validateAndCleanTaste performs the actual vocab filtering (D-05). The
  // enricher's strict:true tool schema handles upstream rejection at API level.
  primary_archetype: z.string(),
  era_signal:        z.string(),
  design_motifs:     z.array(z.string()).max(8),  // strings here; vocab filter applied post-parse
  confidence:        z.number().min(0).max(1),
})
export type TasteWire = z.infer<typeof TasteSchema>

// ---------------------------------------------------------------------------
// validateAndCleanTaste — D-05 vocab filter + structured warning events
// ---------------------------------------------------------------------------
// Input: TasteWire (already Zod-validated).
// Output: CatalogTasteAttributes (camelCase, vocab-filtered).
//
// Behavior:
//   - design_motifs: filter to in-vocab; emit taste_vocab_drift event for each drop
//   - primary_archetype: keep if in vocab, else null + warn
//   - era_signal: keep if in vocab, else null + warn
//   - numeric fields: Zod already enforces [0,1]; out-of-range rejected before reaching here
//   - extractedFromPhoto: caller sets, not in wire format
export function validateAndCleanTaste(
  wire: TasteWire,
  context: { catalogId: string },
): Omit<CatalogTasteAttributes, 'extractedFromPhoto'> {
  const cleanedMotifs: string[] = []
  for (const m of wire.design_motifs) {
    if (DESIGN_MOTIFS_SET.has(m)) {
      cleanedMotifs.push(m)
    } else {
      console.warn(JSON.stringify({
        event: 'taste_vocab_drift',
        catalog_id: context.catalogId,
        field: 'design_motif',
        value: m,
        timestamp: new Date().toISOString(),
      }))
    }
  }

  const archetype = PRIMARY_ARCHETYPE_SET.has(wire.primary_archetype)
    ? (wire.primary_archetype as PrimaryArchetype)
    : null
  if (!archetype) {
    console.warn(JSON.stringify({
      event: 'taste_vocab_drift',
      catalog_id: context.catalogId,
      field: 'primary_archetype',
      value: wire.primary_archetype,
      timestamp: new Date().toISOString(),
    }))
  }

  const era = ERA_SIGNAL_SET.has(wire.era_signal)
    ? (wire.era_signal as EraSignal)
    : null
  if (!era) {
    console.warn(JSON.stringify({
      event: 'taste_vocab_drift',
      catalog_id: context.catalogId,
      field: 'era_signal',
      value: wire.era_signal,
      timestamp: new Date().toISOString(),
    }))
  }

  return {
    formality: wire.formality,
    sportiness: wire.sportiness,
    heritageScore: wire.heritage_score,
    primaryArchetype: archetype,
    eraSignal: era,
    designMotifs: cleanedMotifs,
    confidence: wire.confidence,
  }
}
