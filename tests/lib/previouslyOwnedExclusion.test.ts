// Phase 85 Plan 02 — LIFE-06 regression: previously_owned watches must be
// invisible to analyzeSimilarity, computeGapFill, and computeTasteOverlap.
// All three already allowlist `status === 'owned' || status === 'grail'`
// (D-19) — this test proves the allowlist actually holds by comparing
// output WITH vs WITHOUT an extra previously_owned twin of the target in
// the collection. "The Speedmaster you sold no longer counts as owned for
// role-duplicate math" (PROJECT.md framing) is the literal scenario below.

import { describe, it, expect } from 'vitest'
import { analyzeSimilarity } from '@/lib/similarity'
import { computeGapFill } from '@/lib/gapFill'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import { makeWatch, emptyPreferences } from '../fixtures/watches'
import type { Watch } from '@/lib/types'

// Speedmaster-like target the viewer is considering (re-)adding.
const target: Watch = makeWatch({
  brand: 'Omega',
  model: 'Speedmaster',
  status: 'wishlist',
  movement: 'manual',
  styleTags: ['chronograph', 'tool'],
  roleTags: ['daily'],
  caseSizeMm: 42,
})

// An identical watch — same brand/model/styleTags/roleTags/movement/caseSize
// — but previously_owned (a different id; the viewer sold this exact model).
const previouslyOwnedTwin: Watch = makeWatch({
  brand: 'Omega',
  model: 'Speedmaster',
  status: 'previously_owned',
  movement: 'manual',
  styleTags: ['chronograph', 'tool'],
  roleTags: ['daily'],
  caseSizeMm: 42,
})

describe('LIFE-06: previously_owned watches are excluded from similarity/gapFill/tasteOverlap', () => {
  it('analyzeSimilarity: identical previously_owned twin does not affect label/score/mostSimilarWatches', () => {
    const withoutTwin = analyzeSimilarity(target, [], emptyPreferences)
    const withTwin = analyzeSimilarity(target, [previouslyOwnedTwin], emptyPreferences)

    expect(withTwin.label).toBe(withoutTwin.label)
    expect(withTwin.score).toBe(withoutTwin.score)
    expect(withTwin.mostSimilarWatches).toEqual([])
    expect(withoutTwin.mostSimilarWatches).toEqual([])
  })

  it('computeGapFill: identical previously_owned twin does not affect the result', () => {
    const withoutTwin = computeGapFill(target, [], emptyPreferences)
    const withTwin = computeGapFill(target, [previouslyOwnedTwin], emptyPreferences)

    expect(withTwin).toEqual(withoutTwin)
  })

  it('computeTasteOverlap: an extra previously_owned watch on the viewer side does not change the overlap result', () => {
    const owner = {
      watches: [
        makeWatch({ brand: 'Omega', model: 'Speedmaster', status: 'owned' }),
      ],
      preferences: emptyPreferences,
      tasteTags: [],
    }
    const viewerWithoutTwin = {
      watches: [makeWatch({ brand: 'Rolex', model: 'Submariner', status: 'owned' })],
      preferences: emptyPreferences,
      tasteTags: [],
    }
    const viewerWithTwin = {
      watches: [...viewerWithoutTwin.watches, previouslyOwnedTwin],
      preferences: emptyPreferences,
      tasteTags: [],
    }

    const withoutTwin = computeTasteOverlap(viewerWithoutTwin, owner)
    const withTwin = computeTasteOverlap(viewerWithTwin, owner)

    expect(withTwin).toEqual(withoutTwin)
    // The previously_owned twin matches the owner's Speedmaster by
    // brand+model — if the allowlist ever regressed to a denylist, this
    // would surface as an extra sharedWatches entry.
    expect(withTwin.sharedWatches).toHaveLength(0)
  })
})
