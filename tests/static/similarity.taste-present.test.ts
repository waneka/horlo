// tests/static/similarity.taste-present.test.ts
// CAT-13 Success Criterion #2 — engine produces a higher alignment score for
// taste-compatible watch pairings vs taste-incompatible pairings when:
//   - catalogTaste is present on BOTH watches, AND
//   - confidence >= 0.5 on BOTH watches
//
// D-13 ordering invariant: this file is committed BEFORE src/lib/similarity.ts is
// modified. At commit-time, this test FAILS RED against the pre-rewire engine
// (which ignores catalogTaste — compatible & incompatible scores are identical).
// After Task 4 rewires the engine, this test passes. The RED→GREEN transition is
// AUDITABLE in git log via the commit SHA of this file (red) vs the commit SHA of
// the similarity.ts rewire (green).

import { describe, it, expect } from 'vitest'
import { analyzeSimilarity } from '@/lib/similarity'
import { makeWatch, emptyPreferences } from '../fixtures/watches'
import { subLikeTaste, tankLikeTaste, speedyLikeTaste } from '../fixtures/catalogTaste'

describe('Phase 38 CAT-13 #2 — taste-present produces directional alignment', () => {
  it('taste-compatible pair (matching archetype) scores HIGHER than taste-incompatible pair (mismatched archetype)', () => {
    // subLike vs subLike — same archetype (dive), identical numerics → maximum taste contribution
    const target = makeWatch({ catalogTaste: subLikeTaste })
    const compatible = makeWatch({ status: 'owned', catalogTaste: subLikeTaste })
    const incompatible = makeWatch({ status: 'owned', catalogTaste: tankLikeTaste })

    const compatibleResult = analyzeSimilarity(target, [compatible], emptyPreferences)
    const incompatibleResult = analyzeSimilarity(target, [incompatible], emptyPreferences)

    expect(compatibleResult.score).toBeGreaterThan(incompatibleResult.score)
  })

  it('cross-archetype but heritage-leaning pair (speedy vs sub) scores HIGHER than tank-vs-sub', () => {
    // Speedy and Sub share high heritage (0.95 / 0.90) and modern/vintage era proximity;
    // Tank vs Sub mismatches archetype (dress vs dive) AND formality (0.95 vs 0.25)
    const target = makeWatch({ catalogTaste: subLikeTaste })
    const heritageNeighbor = makeWatch({ status: 'owned', catalogTaste: speedyLikeTaste })
    const formalityOpposite = makeWatch({ status: 'owned', catalogTaste: tankLikeTaste })

    const heritageResult = analyzeSimilarity(target, [heritageNeighbor], emptyPreferences)
    const opposingResult = analyzeSimilarity(target, [formalityOpposite], emptyPreferences)

    expect(heritageResult.score).toBeGreaterThan(opposingResult.score)
  })
})
