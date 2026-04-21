import { describe, it, expect } from 'vitest'
import { wishlistGap, CANONICAL_ROLES } from '@/lib/wishlistGap'
import type { Watch } from '@/lib/types'

// Minimal Watch factory — only the fields wishlistGap reads get real values.
function mkWatch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    brand: overrides.brand ?? 'Generic',
    model: overrides.model ?? 'Model',
    status: overrides.status ?? 'owned',
    movement: overrides.movement ?? 'automatic',
    complications: overrides.complications ?? [],
    styleTags: overrides.styleTags ?? [],
    designTraits: overrides.designTraits ?? [],
    roleTags: overrides.roleTags ?? [],
    ...overrides,
  }
}

describe('wishlistGap', () => {
  it('Test 1: empty owned collection returns { role: null, leansOn: null, rationale: null }', () => {
    const result = wishlistGap([], [])
    expect(result).toEqual({ role: null, leansOn: null, rationale: null })
  })

  it('Test 2: 1 owned dive watch + empty wishlist — leansOn=dive, gap=dress (first unowned by tiebreak)', () => {
    const result = wishlistGap([mkWatch({ roleTags: ['dive'] })], [])
    expect(result.leansOn).toBe('dive')
    // Among canonical roles with freq < 0.10, the first (by array order) wins:
    // dive=100% is covered; dress, sport, field, pilot, chronograph, travel,
    // formal, casual are all 0% < 10%. First in CANONICAL_ROLES is 'dress'.
    expect(result.role).toBe('dress')
    expect(result.rationale).toBe(
      'Your collection leans dive. Consider a dress watch to round it out.',
    )
  })

  it('Test 3: 10 owned dive watches + empty wishlist — leansOn=dive, gap=dress', () => {
    const owned = Array.from({ length: 10 }, () =>
      mkWatch({ roleTags: ['dive'] }),
    )
    const result = wishlistGap(owned, [])
    expect(result.leansOn).toBe('dive')
    expect(result.role).toBe('dress')
  })

  it("Test 4: 10 owned dive + wishlist includes 'dress' — gap skips dress, picks sport next", () => {
    const owned = Array.from({ length: 10 }, () =>
      mkWatch({ roleTags: ['dive'] }),
    )
    const wishlist = [mkWatch({ status: 'wishlist', roleTags: ['dress'] })]
    const result = wishlistGap(owned, wishlist)
    expect(result.leansOn).toBe('dive')
    // 'dress' is now covered; next canonical gap by array order is 'sport'.
    expect(result.role).toBe('sport')
  })

  it('Test 5: balanced collection with every role >= 10% — role=null, rationale=null', () => {
    // 10 watches, each canonical role present on at least 1 — freq 10% exactly.
    // Use roleTags multi-role to hit the >=10% threshold on every canonical
    // role across only 10 watches.
    const owned = [
      mkWatch({ roleTags: ['dive', 'dress'] }),
      mkWatch({ roleTags: ['sport', 'field'] }),
      mkWatch({ roleTags: ['pilot', 'chronograph'] }),
      mkWatch({ roleTags: ['travel', 'formal'] }),
      mkWatch({ roleTags: ['casual', 'dive'] }),
      mkWatch({ roleTags: ['dress', 'sport'] }),
      mkWatch({ roleTags: ['field', 'pilot'] }),
      mkWatch({ roleTags: ['chronograph', 'travel'] }),
      mkWatch({ roleTags: ['formal', 'casual'] }),
      mkWatch({ roleTags: ['dive', 'dress'] }),
    ]
    const result = wishlistGap(owned, [])
    expect(result.role).toBeNull()
    expect(result.rationale).toBeNull()
    // leansOn still points at the highest-freq role (not null — we have data).
    expect(result.leansOn).not.toBeNull()
  })

  it('Test 6: dive=40%, dress=40%, sport=20% — leansOn=dive (tiebreak), gap=field (first 0%)', () => {
    const owned = [
      mkWatch({ roleTags: ['dive'] }),
      mkWatch({ roleTags: ['dive'] }),
      mkWatch({ roleTags: ['dress'] }),
      mkWatch({ roleTags: ['dress'] }),
      mkWatch({ roleTags: ['sport'] }),
    ]
    const result = wishlistGap(owned, [])
    // dive and dress both 40%; CANONICAL_ROLES order puts 'dive' first → leansOn=dive.
    expect(result.leansOn).toBe('dive')
    // dive (40%), dress (40%), sport (20%) all >= 10% — not gaps.
    // field, pilot, chronograph, travel, formal, casual all 0% → gaps.
    // First by CANONICAL_ROLES order among gaps = 'field'.
    expect(result.role).toBe('field')
  })

  it('Test 7: every canonical role already in wishlist — role=null, rationale=null', () => {
    const owned = [mkWatch({ roleTags: ['dive'] })]
    const wishlist = [...CANONICAL_ROLES].map((role) =>
      mkWatch({ status: 'wishlist', roleTags: [role] }),
    )
    const result = wishlistGap(owned, wishlist)
    expect(result.role).toBeNull()
    expect(result.rationale).toBeNull()
    // leansOn still has data (dive 100%).
    expect(result.leansOn).toBe('dive')
  })

  it('Test 8: owned watches with empty roleTags — every role freq=0; leansOn=null, gap=dive', () => {
    const owned = [mkWatch({ roleTags: [] }), mkWatch({ roleTags: [] })]
    const result = wishlistGap(owned, [])
    // Every canonical role has freq=0 → leansOn=null (nothing leans).
    expect(result.leansOn).toBeNull()
    // First canonical by array order is 'dive' — all roles are gaps.
    expect(result.role).toBe('dive')
    // rationale is null because leansOn is null.
    expect(result.rationale).toBeNull()
  })

  it('Test 9: multi-role watches contribute to multiple role buckets', () => {
    // Single watch with roleTags=['dive','sport']. Both dive and sport should
    // be at 100% freq (1 watch / 1 total — both roles present).
    const owned = [mkWatch({ roleTags: ['dive', 'sport'] })]
    const result = wishlistGap(owned, [])
    // dive and sport are both at 100%; dive comes first in CANONICAL_ROLES → leansOn=dive.
    expect(result.leansOn).toBe('dive')
    // dress is the first canonical gap (0%).
    expect(result.role).toBe('dress')
  })

  it('Test 10: determinism — calling twice with same input yields identical output', () => {
    const owned = [
      mkWatch({ roleTags: ['dive'] }),
      mkWatch({ roleTags: ['dress'] }),
      mkWatch({ roleTags: ['sport'] }),
    ]
    const wishlist = [mkWatch({ status: 'wishlist', roleTags: ['pilot'] })]
    const a = wishlistGap(owned, wishlist)
    const b = wishlistGap(owned, wishlist)
    expect(a).toEqual(b)
  })

  it('CANONICAL_ROLES exports exactly the 9 expected roles in order', () => {
    expect([...CANONICAL_ROLES]).toEqual([
      'dive',
      'dress',
      'sport',
      'field',
      'pilot',
      'chronograph',
      'travel',
      'formal',
      'casual',
    ])
  })
})
