// tests/fixtures/catalogTaste.ts
// Phase 38 D-14 — shared CatalogTasteAttributes fixtures for static guard tests.
// Source: 38-RESEARCH.md §Q2. Every primaryArchetype / eraSignal / designMotif value
// validated against src/lib/taste/vocab.ts closed vocab.

import type { CatalogTasteAttributes } from '@/lib/types'

// ── HIGH-CONFIDENCE FIXTURES ────────────────────────────────────────────

/** Submariner-like — high heritage, sport-leaning, dive archetype. */
export const subLikeTaste: CatalogTasteAttributes = {
  formality: 0.25,
  sportiness: 0.85,
  heritageScore: 0.90,
  primaryArchetype: 'dive',
  eraSignal: 'modern',
  designMotifs: ['applied-indices', 'mercedes-hands'],
  confidence: 0.85,
  extractedFromPhoto: false,
}

/** Datejust-like — formal, heritage-heavy, dress archetype with iconic motifs. */
export const datejustLikeTaste: CatalogTasteAttributes = {
  formality: 0.70,
  sportiness: 0.40,
  heritageScore: 0.85,
  primaryArchetype: 'dress',
  eraSignal: 'modern',
  designMotifs: ['applied-indices', 'beads-of-rice-bracelet'],
  confidence: 0.80,
  extractedFromPhoto: false,
}

/** Speedmaster-like — chrono archetype, high heritage, racing motifs. */
export const speedyLikeTaste: CatalogTasteAttributes = {
  formality: 0.45,
  sportiness: 0.75,
  heritageScore: 0.95,
  primaryArchetype: 'chrono',
  eraSignal: 'vintage-leaning',
  designMotifs: ['applied-indices', 'domed-crystal'],
  confidence: 0.90,
  extractedFromPhoto: false,
}

/** Cartier-Tank-like — high formality, low sportiness, dress archetype, tank-case motif. */
export const tankLikeTaste: CatalogTasteAttributes = {
  formality: 0.95,
  sportiness: 0.10,
  heritageScore: 0.90,
  primaryArchetype: 'dress',
  eraSignal: 'vintage-leaning',
  designMotifs: ['tank-case', 'breguet-hands'],
  confidence: 0.75,
  extractedFromPhoto: false,
}

// ── LOW-CONFIDENCE FIXTURE (null-fallback test) ─────────────────────────

/** Low-confidence row — engine MUST treat as taste-null. */
export const lowConfTaste: CatalogTasteAttributes = {
  formality: 0.50,
  sportiness: 0.50,
  heritageScore: 0.50,
  primaryArchetype: 'hybrid',
  eraSignal: 'contemporary',
  designMotifs: [],
  confidence: 0.35,  // < 0.5 → taste contrib = 0
  extractedFromPhoto: false,
}

// ── EDGE FIXTURES (D-15 coverage) ────────────────────────────────────────

/** Confidence exactly = 0.5 (strict `>=` semantics — taste COUNTS). */
export const exactlyHalfConfTaste: CatalogTasteAttributes = {
  formality: 0.60,
  sportiness: 0.70,
  heritageScore: 0.75,
  primaryArchetype: 'sport',
  eraSignal: 'modern',
  designMotifs: ['integrated-bracelet'],
  confidence: 0.50,
  extractedFromPhoto: false,
}

/** Confidence = 0.499 (strict `<` semantics — taste DOES NOT count). */
export const justBelowHalfTaste: CatalogTasteAttributes = {
  formality: 0.60,
  sportiness: 0.70,
  heritageScore: 0.75,
  primaryArchetype: 'sport',
  eraSignal: 'modern',
  designMotifs: ['integrated-bracelet'],
  confidence: 0.499,
  extractedFromPhoto: false,
}

/** Empty designMotifs array (Jaccard returns 0; no crash). */
export const emptyMotifsTaste: CatalogTasteAttributes = {
  formality: 0.40,
  sportiness: 0.60,
  heritageScore: 0.70,
  primaryArchetype: 'field',
  eraSignal: 'contemporary',
  designMotifs: [],
  confidence: 0.80,
  extractedFromPhoto: false,
}

/** All-null numeric trio (cosine drops contribution). */
export const nullNumericsTaste: CatalogTasteAttributes = {
  formality: null,
  sportiness: null,
  heritageScore: null,
  primaryArchetype: 'tool',
  eraSignal: 'contemporary',
  designMotifs: ['compressor-case'],
  confidence: 0.80,
  extractedFromPhoto: false,
}
