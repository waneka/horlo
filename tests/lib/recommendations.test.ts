import { describe, it, expect } from 'vitest'
import { rationaleFor, RATIONALE_TEMPLATES } from '@/lib/recommendations'
import type { Watch } from '@/lib/types'

// Minimal Watch factory used across rationale cases.
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

describe('rationaleFor', () => {
  it('Test 1 [brand-match]: viewer owns 3 Rolex + 2 Omega; candidate brand=Rolex → "Fans of Rolex love this"', () => {
    const viewerOwnedWatches = [
      mkWatch({ brand: 'Rolex', model: 'Submariner' }),
      mkWatch({ brand: 'Rolex', model: 'GMT' }),
      mkWatch({ brand: 'Rolex', model: 'Datejust' }),
      mkWatch({ brand: 'Omega', model: 'Speedmaster' }),
      mkWatch({ brand: 'Omega', model: 'Seamaster' }),
    ]
    const result = rationaleFor({
      candidateBrand: 'Rolex',
      candidateModel: 'Daytona',
      candidateRoleTags: [],
      candidateStyleTags: [],
      viewerOwnedWatches,
      viewerOwnershipCount: 1,
    })
    expect(result).toBe('Fans of Rolex love this')
  })

  it('Test 2 [popular-role]: candidate has dive role + ownershipCount=5, no brand match → "Popular among dive watch collectors"', () => {
    const viewerOwnedWatches = [
      mkWatch({ brand: 'Tudor', model: 'Black Bay' }),
    ]
    const result = rationaleFor({
      candidateBrand: 'Rolex',
      candidateModel: 'Submariner',
      candidateRoleTags: ['dive'],
      candidateStyleTags: [],
      viewerOwnedWatches,
      viewerOwnershipCount: 5,
    })
    expect(result).toBe('Popular among dive watch collectors')
  })

  it('Test 3 [dominant-style]: candidate style "casual" matches viewer 60%-casual dominant → "Matches your casual collection"', () => {
    const viewerOwnedWatches = [
      mkWatch({ brand: 'A', styleTags: ['casual'] }),
      mkWatch({ brand: 'B', styleTags: ['casual'] }),
      mkWatch({ brand: 'C', styleTags: ['casual'] }),
      mkWatch({ brand: 'D', styleTags: ['dress'] }),
      mkWatch({ brand: 'E', styleTags: ['dress'] }),
    ]
    // No brand tie (candidate brand = Seiko, not A–E), no popular-role
    // (ownershipCount < 5).
    const result = rationaleFor({
      candidateBrand: 'Seiko',
      candidateModel: 'Presage',
      candidateRoleTags: [],
      candidateStyleTags: ['casual'],
      viewerOwnedWatches,
      viewerOwnershipCount: 1,
    })
    expect(result).toBe('Matches your casual collection')
  })

  it('Test 4 [top-role-pair]: candidate role "sport" matches viewer top role "sport" → "Often paired with sport watches"', () => {
    const viewerOwnedWatches = [
      mkWatch({ brand: 'A', roleTags: ['sport'] }),
      mkWatch({ brand: 'B', roleTags: ['sport'] }),
      mkWatch({ brand: 'C', roleTags: ['sport'] }),
      mkWatch({ brand: 'D', roleTags: ['dress'] }),
    ]
    // Not brand match, ownershipCount < 5 so no popular-role, no dominant-style.
    const result = rationaleFor({
      candidateBrand: 'Seiko',
      candidateModel: 'SKX',
      candidateRoleTags: ['sport'],
      candidateStyleTags: [],
      viewerOwnedWatches,
      viewerOwnershipCount: 1,
    })
    expect(result).toBe('Often paired with sport watches')
  })

  it('Test 5 [community-fallback]: nothing matches → "Popular in the community"', () => {
    // Viewer top brand = Omega, candidate = Rolex (no brand match).
    // Candidate has no popular roles; ownershipCount < 5.
    // Candidate has no matching style; no matching role.
    const viewerOwnedWatches = [
      mkWatch({ brand: 'Omega', styleTags: ['sport'], roleTags: ['casual'] }),
    ]
    const result = rationaleFor({
      candidateBrand: 'Rolex',
      candidateModel: 'Daytona',
      candidateRoleTags: ['chronograph'],
      candidateStyleTags: ['dress'],
      viewerOwnedWatches,
      viewerOwnershipCount: 1,
    })
    expect(result).toBe('Popular in the community')
  })

  it('Test 6 [priority]: multiple matches — earlier template wins (brand match beats role match)', () => {
    // Viewer top brand = Rolex; candidate is Rolex AND shares top role sport.
    const viewerOwnedWatches = [
      mkWatch({ brand: 'Rolex', roleTags: ['sport'] }),
      mkWatch({ brand: 'Rolex', roleTags: ['sport'] }),
    ]
    const result = rationaleFor({
      candidateBrand: 'Rolex',
      candidateModel: 'Daytona',
      candidateRoleTags: ['sport'],
      candidateStyleTags: [],
      viewerOwnedWatches,
      viewerOwnershipCount: 10, // would ALSO match popular-role
    })
    // brand-match is first → "Fans of Rolex love this" wins.
    expect(result).toBe('Fans of Rolex love this')
  })

  it('Test 7 [determinism]: same input yields same output string', () => {
    const ctx = {
      candidateBrand: 'Seiko',
      candidateModel: 'SKX',
      candidateRoleTags: ['dive', 'sport'],
      candidateStyleTags: ['tool'],
      viewerOwnedWatches: [
        mkWatch({ brand: 'Tudor', styleTags: ['sport'], roleTags: ['dive'] }),
      ],
      viewerOwnershipCount: 3,
    }
    expect(rationaleFor(ctx)).toBe(rationaleFor(ctx))
  })

  it('RATIONALE_TEMPLATES lists all 5 templates in order', () => {
    expect([...RATIONALE_TEMPLATES]).toEqual([
      'brand-match',
      'popular-role',
      'dominant-style',
      'top-role-pair',
      'community-fallback',
    ])
  })
})
