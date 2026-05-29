// Phase 70 Plan 04 — flowTypes.ts CLNP-05 kind enumeration + DupeContext shape

import { describe, it, expect } from 'vitest'

import type { FlowState, DupeContext } from '@/components/watch/flowTypes'

// D-01 final FlowState union — exhaustive kind list (Phase 70 CLNP-05).
// If a kind is added/removed, this array must update OR the compile-time
// check in case (a) will surface the divergence.
const ALL_KINDS = [
  'search-idle',
  'extracting-url',
  'extraction-failed',
  'confirming',
  'form-prefill',
  'manual-entry',
  'photos-pending',
] as const

// Old verdict-flow variants removed by CLNP-05. Documentation-level
// assertion that none of these names overlap with the new union.
// (TypeScript compile gate in AddWatchFlow.tsx is the authoritative
//  enforcement — any consumer of the removed kinds fails to compile.)
const REMOVED_KINDS = [
  'idle',
  'extracting',
  'verdict-ready',
  'wishlist-rationale-open',
  'submitting-wishlist',
  'submitting-collection',
] as const

describe('flowTypes — CLNP-05 union shape (Phase 70 Plan 04)', () => {
  it('(a) all 7 kinds in ALL_KINDS are valid FlowState["kind"] values', () => {
    // Compile-time check: this assignment errors if any kind in ALL_KINDS
    // is not in the FlowState['kind'] union.
    const kinds: FlowState['kind'][] = [...ALL_KINDS]
    expect(kinds).toHaveLength(7)
  })

  it('(b) removed verdict-flow kinds are absent from the new ALL_KINDS list', () => {
    // Documentation test — runtime intersection check.
    for (const removed of REMOVED_KINDS) {
      // ALL_KINDS is typed `readonly [...]`; cast to readonly string[] for .includes().
      expect((ALL_KINDS as readonly string[]).includes(removed)).toBe(false)
    }
  })

  it('(c) DupeContext literal type-checks with all three required fields', () => {
    const dc: DupeContext = {
      existingWatchId: 'cafef00d-1111-4111-8111-111111111111',
      existingStatus: 'owned',
      existingReference: 'REF-001',
    }
    expect(dc.existingStatus).toBe('owned')
    expect(dc.existingReference).toBe('REF-001')

    // Verify null-branch of existingReference type-checks
    const dcNullRef: DupeContext = {
      existingWatchId: 'cafef00d-2222-4222-8222-222222222222',
      existingStatus: 'wishlist',
      existingReference: null,
    }
    expect(dcNullRef.existingStatus).toBe('wishlist')
    expect(dcNullRef.existingReference).toBeNull()
  })

  it('(d) extraction-failed.mode accepts both "url" and "structured" literals', () => {
    const urlMode: FlowState = {
      kind: 'extraction-failed',
      partial: null,
      reason: 'fetch failed',
      category: 'generic-network',
      mode: 'url',
    }
    const structuredMode: FlowState = {
      kind: 'extraction-failed',
      partial: null,
      reason: 'no specs found',
      category: 'structured-data-missing',
      mode: 'structured',
    }
    // Narrow via discriminant so TypeScript exposes .mode
    if (urlMode.kind === 'extraction-failed') {
      expect(urlMode.mode).toBe('url')
    }
    if (structuredMode.kind === 'extraction-failed') {
      expect(structuredMode.mode).toBe('structured')
    }
  })
})
