// src/lib/taste/vocab.test.ts
//
// Unit tests for Phase 19.1 vocab constants, TasteSchema, and validateAndCleanTaste.

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  DESIGN_MOTIFS,
  PRIMARY_ARCHETYPES,
  ERA_SIGNALS,
  TasteSchema,
  validateAndCleanTaste,
} from './vocab'
import type { TasteWire } from './vocab'

const VALID_WIRE: TasteWire = {
  formality: 0.7,
  sportiness: 0.2,
  heritage_score: 0.85,
  primary_archetype: 'dress',
  era_signal: 'vintage-leaning',
  design_motifs: ['gilt-dial', 'breguet-hands'],
  confidence: 0.9,
}

const CONTEXT = { catalogId: 'cat-test-001' }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('validateAndCleanTaste', () => {
  it('passes through valid input unchanged', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = validateAndCleanTaste(VALID_WIRE, CONTEXT)
    expect(result.formality).toBe(0.7)
    expect(result.sportiness).toBe(0.2)
    expect(result.heritageScore).toBe(0.85)
    expect(result.primaryArchetype).toBe('dress')
    expect(result.eraSignal).toBe('vintage-leaning')
    expect(result.designMotifs).toEqual(['gilt-dial', 'breguet-hands'])
    expect(result.confidence).toBe(0.9)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('drops out-of-vocab design_motifs entries with warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wire: TasteWire = {
      ...VALID_WIRE,
      design_motifs: ['gilt-dial', 'BOGUS', 'breguet-hands'],
    }
    const result = validateAndCleanTaste(wire, CONTEXT)
    expect(result.designMotifs).toEqual(['gilt-dial', 'breguet-hands'])
    expect(warnSpy).toHaveBeenCalledOnce()
    const parsed = JSON.parse(warnSpy.mock.calls[0][0])
    expect(parsed).toMatchObject({
      event: 'taste_vocab_drift',
      field: 'design_motif',
      value: 'BOGUS',
      catalog_id: 'cat-test-001',
    })
  })

  it('primary_archetype out-of-vocab becomes null with warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wire: TasteWire = {
      ...VALID_WIRE,
      primary_archetype: 'BOGUS_ARCH', // out-of-vocab; z.string() allows it; vocab filter drops it
    }
    const result = validateAndCleanTaste(wire, CONTEXT)
    expect(result.primaryArchetype).toBeNull()
    expect(warnSpy).toHaveBeenCalledOnce()
    const parsed = JSON.parse(warnSpy.mock.calls[0][0])
    expect(parsed).toMatchObject({
      event: 'taste_vocab_drift',
      field: 'primary_archetype',
      value: 'BOGUS_ARCH',
    })
  })

  it('era_signal out-of-vocab becomes null with warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wire: TasteWire = {
      ...VALID_WIRE,
      era_signal: 'BOGUS_ERA', // out-of-vocab; z.string() allows it; vocab filter drops it
    }
    const result = validateAndCleanTaste(wire, CONTEXT)
    expect(result.eraSignal).toBeNull()
    expect(warnSpy).toHaveBeenCalledOnce()
    const parsed = JSON.parse(warnSpy.mock.calls[0][0])
    expect(parsed).toMatchObject({
      event: 'taste_vocab_drift',
      field: 'era_signal',
      value: 'BOGUS_ERA',
    })
  })
})

describe('TasteSchema', () => {
  it('rejects empty input', () => {
    const result = TasteSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects malformed taste (string in numeric)', () => {
    const result = TasteSchema.safeParse({ ...VALID_WIRE, formality: '0.5' })
    expect(result.success).toBe(false)
  })

  it('rejects design_motifs over max length', () => {
    const result = TasteSchema.safeParse({
      ...VALID_WIRE,
      design_motifs: [
        'gilt-dial', 'breguet-hands', 'sandwich-dial', 'california-dial',
        'enamel-dial', 'bauhaus', 'cushion-case', 'domed-crystal', 'patina-friendly',
      ], // 9 items > max 8
    })
    expect(result.success).toBe(false)
  })

  it('clamp numeric fields outside 0..1', () => {
    // Zod .min(0).max(1) REJECTs out-of-range values rather than clamping
    const result = TasteSchema.safeParse({ ...VALID_WIRE, formality: 1.5 })
    expect(result.success).toBe(false)
  })
})

describe('vocabulary constants', () => {
  it('DESIGN_MOTIFS has exactly 28 entries', () => {
    expect(DESIGN_MOTIFS).toHaveLength(28)
  })

  it('PRIMARY_ARCHETYPES has exactly 10 entries', () => {
    expect(PRIMARY_ARCHETYPES).toHaveLength(10)
  })

  it('ERA_SIGNALS has exactly 3 entries', () => {
    expect(ERA_SIGNALS).toHaveLength(3)
  })
})
