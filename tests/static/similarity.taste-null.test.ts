// tests/static/similarity.taste-null.test.ts
// CAT-13 Success Criterion #1 — engine output byte-identical to legacy when:
//   (a) catalogTaste is null on either watch, OR
//   (b) confidence < 0.5 on either watch
//
// D-13 ordering invariant: this file is committed BEFORE src/lib/similarity.ts is
// modified. At commit-time, both assertions pass against the pre-rewire engine
// (which ignores catalogTaste entirely). After the rewire (Task 4), both still
// pass because the gate fires and taste contribution = 0 (byte-identical to pre-rewire).

import { describe, it, expect } from 'vitest'
import { analyzeSimilarity } from '@/lib/similarity'
import { makeWatch, emptyPreferences } from '../fixtures/watches'
import { lowConfTaste, justBelowHalfTaste } from '../fixtures/catalogTaste'

describe('Phase 38 CAT-13 #1 — taste-null engine output is byte-identical to legacy', () => {
  it('returns same SimilarityResult when both watches have catalogTaste = null', () => {
    const target = makeWatch({ catalogTaste: null })
    const owned = [makeWatch({ status: 'owned', catalogTaste: null })]
    const withTaste = analyzeSimilarity(target, owned, emptyPreferences)
    const withoutTaste = analyzeSimilarity(
      { ...target, catalogTaste: undefined },
      owned.map((w) => ({ ...w, catalogTaste: undefined })),
      emptyPreferences,
    )
    expect(withTaste.score).toBe(withoutTaste.score)
    expect(withTaste.label).toBe(withoutTaste.label)
  })

  it('returns same SimilarityResult when both watches have confidence < 0.5 (gate fires on lowConfTaste 0.35)', () => {
    const target = makeWatch({ catalogTaste: lowConfTaste })
    const owned = [makeWatch({ status: 'owned', catalogTaste: lowConfTaste })]
    const withLowConf = analyzeSimilarity(target, owned, emptyPreferences)
    const withoutTaste = analyzeSimilarity(
      { ...target, catalogTaste: null },
      owned.map((w) => ({ ...w, catalogTaste: null })),
      emptyPreferences,
    )
    expect(withLowConf.score).toBe(withoutTaste.score)
    expect(withLowConf.label).toBe(withoutTaste.label)
  })

  it('returns same SimilarityResult when confidence = 0.499 (strict < gate fires)', () => {
    const target = makeWatch({ catalogTaste: justBelowHalfTaste })
    const owned = [makeWatch({ status: 'owned', catalogTaste: justBelowHalfTaste })]
    const withJustBelow = analyzeSimilarity(target, owned, emptyPreferences)
    const withoutTaste = analyzeSimilarity(
      { ...target, catalogTaste: null },
      owned.map((w) => ({ ...w, catalogTaste: null })),
      emptyPreferences,
    )
    expect(withJustBelow.score).toBe(withoutTaste.score)
    expect(withJustBelow.label).toBe(withoutTaste.label)
  })
})
