import { describe, it, expect } from 'vitest'
import { scopeWornTabWatches } from '@/lib/wornTabScope'

describe('scopeWornTabWatches (D-14 / T-84-LEAK)', () => {
  const O1 = { id: 'o1', status: 'owned' }
  const O2 = { id: 'o2', status: 'owned' }
  const W1 = { id: 'w1', status: 'wishlist' }

  it('isOwner true (any collectionPublic) returns the full owned list and full watch map', () => {
    const result = scopeWornTabWatches({
      isOwner: true,
      collectionPublic: false,
      watches: [O1, O2, W1],
      eventWatchIds: new Set(['o1', 'w1']),
    })
    expect(result.ownedWatches).toEqual([O1, O2])
    expect(result.mapWatches).toEqual([O1, O2, W1])
  })

  it('isOwner false, collectionPublic true returns the full owned list but a map scoped to referenced watches', () => {
    const result = scopeWornTabWatches({
      isOwner: false,
      collectionPublic: true,
      watches: [O1, O2, W1],
      eventWatchIds: new Set(['o1', 'w1']),
    })
    expect(result.ownedWatches).toEqual([O1, O2])
    expect(result.mapWatches).toEqual([O1, W1])
  })

  it('isOwner false, collectionPublic false scopes ownedWatches to owned-and-referenced only', () => {
    const result = scopeWornTabWatches({
      isOwner: false,
      collectionPublic: false,
      watches: [O1, O2, W1],
      eventWatchIds: new Set(['o1', 'w1']),
    })
    expect(result.ownedWatches).toEqual([O1])
    expect(result.mapWatches).toEqual([O1, W1])
  })

  it('isOwner false, collectionPublic false, no visible events returns empty lists for both', () => {
    const result = scopeWornTabWatches({
      isOwner: false,
      collectionPublic: false,
      watches: [O1, O2, W1],
      eventWatchIds: new Set(),
    })
    expect(result.ownedWatches).toEqual([])
    expect(result.mapWatches).toEqual([])
  })

  it('preserves input order in both outputs', () => {
    const result = scopeWornTabWatches({
      isOwner: false,
      collectionPublic: true,
      watches: [W1, O1, O2],
      eventWatchIds: new Set(['o1', 'w1']),
    })
    expect(result.ownedWatches).toEqual([O1, O2])
    expect(result.mapWatches).toEqual([W1, O1])
  })
})
