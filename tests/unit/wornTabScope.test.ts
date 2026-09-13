import { describe, it, expect } from 'vitest'
import { scopeWornTabWatches, toWornTabWatchSummary } from '@/lib/wornTabScope'

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

describe('toWornTabWatchSummary (84-REVIEW CR-02 — field-level leak guard)', () => {
  // A full Watch-like row as returned by getWatchesByUser: carries private
  // fields that must never reach the 'use client' WornTabContent payload.
  const fullRow = {
    id: 'o1',
    status: 'owned',
    brand: 'Omega',
    model: 'Speedmaster',
    imageUrl: 'https://example.com/a.jpg',
    pricePaid: 6500,
    targetPrice: 7000,
    marketPrice: 7200,
    acquisitionDate: '2024-01-01',
    notes: 'bought from a friend, private',
    notesPublic: false,
  }

  it('returns only id/brand/model/imageUrl — no pricePaid, notes, or acquisition fields', () => {
    const summary = toWornTabWatchSummary(fullRow)
    expect(summary).toEqual({
      id: 'o1',
      brand: 'Omega',
      model: 'Speedmaster',
      imageUrl: 'https://example.com/a.jpg',
    })
    expect(Object.keys(summary).sort()).toEqual(['brand', 'id', 'imageUrl', 'model'])
    for (const key of [
      'pricePaid',
      'targetPrice',
      'marketPrice',
      'acquisitionDate',
      'notes',
      'notesPublic',
      'status',
    ]) {
      expect(summary).not.toHaveProperty(key)
    }
  })

  it('normalizes a missing imageUrl to null', () => {
    const { imageUrl: _omit, ...noImage } = fullRow
    void _omit
    expect(toWornTabWatchSummary(noImage).imageUrl).toBeNull()
  })

  it('scoped owned watches projected for a private-collection viewer carry no private fields', () => {
    const { ownedWatches } = scopeWornTabWatches({
      isOwner: false,
      collectionPublic: false,
      watches: [fullRow],
      eventWatchIds: new Set(['o1']),
    })
    const projected = ownedWatches.map(toWornTabWatchSummary)
    expect(projected).toHaveLength(1)
    expect(projected[0]).not.toHaveProperty('pricePaid')
    expect(projected[0]).not.toHaveProperty('notes')
  })
})
