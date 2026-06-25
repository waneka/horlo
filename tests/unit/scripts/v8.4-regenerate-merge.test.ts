// Phase 78 / 78-03-PLAN.md — GREEN.
//
// Unit test for the --regenerate merge-forward behavior (D-78-07).
//   - default run with existing .md → exits non-zero (covered by integration
//     test in tests/integration/scripts/v8.4-brand-canonicalization.test.ts)
//   - --regenerate preserves rows whose status is merge:<uuid> | new | skip
//     verbatim
//   - --regenerate overwrites rows whose status is needs-review with fresh
//     proposals
//   - --regenerate appends fresh brand_raws not in prior .md at the bottom
//   - --force overwrites unconditionally (covered by integration test)
//
// No DATABASE_URL gate — exercises the exported mergeForward pure function
// directly with fixture inputs.

import { describe, it, expect } from 'vitest'
import {
  mergeForward,
  parseExistingPreserved,
  type BrandRow,
  type Candidate,
} from '../../../scripts/v8.4-brand-canonicalization'

describe('Phase 78 — v8.4-brand-canonicalization --regenerate merge-forward (D-78-07)', () => {
  // Existing artifact as the operator would have it after editing decisions
  // on top of a prior dry-run. Three operator-decided rows + two needs-review
  // (which should be overwritten on --regenerate).
  const existingArtifact = [
    '# v8.4 Brand Merge Decisions',
    '',
    '> Generated 2026-06-24 by scripts/v8.4-brand-canonicalization.ts — READ-ONLY.',
    '',
    '| brand_raw | normalized | proposed_target_id | status | candidates / notes |',
    '| --------- | ---------- | ------------------ | ------ | ------------------ |',
    '| Hamilton |  hamilton |  | merge:00000000-0000-0000-0000-000000000001 | operator-locked',
    // ^ note: the operator may have stripped the trailing `|` while editing;
    // mergeForward preserves the line as-is. We use a canonical form below.
    '| Hamilton | hamilton | uuid-h | merge:00000000-0000-0000-0000-000000000001 | hamilton-khaki |',
    '| Acme | acme |  | new | newly created brand |',
    '| Defunct | defunct |  | skip | operator deferred this row |',
    '| StillReviewing | stillreviewing |  | needs-review | other-brand (0.55) |',
    '| AlsoReviewing | alsoreviewing |  | needs-review |  |',
  ].join('\n')

  const freshRows: BrandRow[] = [
    // Operator-decided rows — should be preserved verbatim:
    {
      brand_raw: 'Hamilton',
      brand_normalized: 'hamilton',
      proposed_target_id: 'uuid-h-NEW', // fresh DB might propose a different uuid
    },
    {
      brand_raw: 'Acme',
      brand_normalized: 'acme',
      proposed_target_id: null,
    },
    {
      brand_raw: 'Defunct',
      brand_normalized: 'defunct',
      proposed_target_id: null,
    },
    // needs-review rows — should be overwritten with fresh proposals:
    {
      brand_raw: 'StillReviewing',
      brand_normalized: 'stillreviewing',
      proposed_target_id: 'uuid-fresh-stillreviewing',
    },
    {
      brand_raw: 'AlsoReviewing',
      brand_normalized: 'alsoreviewing',
      proposed_target_id: null,
    },
    // New brand_raw — should be appended at the bottom:
    {
      brand_raw: 'Tudor',
      brand_normalized: 'tudor',
      proposed_target_id: 'uuid-tudor',
    },
  ]

  const candidatesByNormalized = new Map<string, Candidate[]>([
    ['alsoreviewing', [{ name: 'other', score: 0.55 }]],
  ])

  it('parseExistingPreserved indexes operator-decided rows by brand_raw', () => {
    const preserved = parseExistingPreserved(existingArtifact)
    expect(preserved.has('Hamilton')).toBe(true)
    expect(preserved.has('Acme')).toBe(true)
    expect(preserved.has('Defunct')).toBe(true)
    // needs-review rows are NOT preserved (will be overwritten on regenerate)
    expect(preserved.has('StillReviewing')).toBe(false)
    expect(preserved.has('AlsoReviewing')).toBe(false)
  })

  it('Test 1 — --regenerate preserves rows whose status is merge:<uuid> verbatim per D-78-07', () => {
    const lines = mergeForward(existingArtifact, freshRows, candidatesByNormalized)
    const merged = lines.find((l) => l.includes('Hamilton') && l.includes('merge:'))
    expect(merged).toBeDefined()
    // Verbatim preservation: the merge:<uuid> token from the existing artifact
    // is still present in the merged output (fresh proposed_target_id ignored).
    expect(merged).toContain('merge:00000000-0000-0000-0000-000000000001')
    expect(merged).not.toContain('uuid-h-NEW') // fresh proposal NOT used
  })

  it('Test 2 — --regenerate preserves rows whose status is `new` verbatim per D-78-07', () => {
    const lines = mergeForward(existingArtifact, freshRows, candidatesByNormalized)
    const newRow = lines.find((l) => l.startsWith('| Acme '))
    expect(newRow).toBeDefined()
    expect(newRow).toContain('| new |')
    expect(newRow).toContain('newly created brand')
  })

  it('Test 3 — --regenerate preserves rows whose status is `skip` verbatim per D-78-07', () => {
    const lines = mergeForward(existingArtifact, freshRows, candidatesByNormalized)
    const skipRow = lines.find((l) => l.startsWith('| Defunct '))
    expect(skipRow).toBeDefined()
    expect(skipRow).toContain('| skip |')
    expect(skipRow).toContain('operator deferred this row')
  })

  it('Test 4 — --regenerate OVERWRITES rows whose status is needs-review with fresh proposals per D-78-07', () => {
    const lines = mergeForward(existingArtifact, freshRows, candidatesByNormalized)
    const stillRow = lines.find((l) => l.startsWith('| StillReviewing '))
    expect(stillRow).toBeDefined()
    // StillReviewing's fresh row has a proposed_target_id, so it should auto-
    // resolve in the regenerated output.
    expect(stillRow).toContain('uuid-fresh-stillreviewing')
    expect(stillRow).toContain('| auto-resolved |')
  })

  it('Test 5 — --regenerate appends fresh brand_raw rows not in prior .md at the bottom per D-78-07', () => {
    const lines = mergeForward(existingArtifact, freshRows, candidatesByNormalized)
    const tudorRow = lines.find((l) => l.startsWith('| Tudor '))
    expect(tudorRow).toBeDefined()
    expect(tudorRow).toContain('uuid-tudor')
    expect(tudorRow).toContain('| auto-resolved |')
    // Tudor should appear AFTER the existing brand_raws (Hamilton, Acme, etc.)
    // in the result order — since freshRows lists it last, mergeForward emits
    // it in fresh-row order which puts it at the end.
    const lastDataLine = lines[lines.length - 1]
    expect(lastDataLine.startsWith('| Tudor ')).toBe(true)
  })

  it('Test 6 — preserved row whose brand_raw is missing from fresh result still survives (operator decision not silently dropped)', () => {
    // Simulate a fresh result that doesn't include Hamilton (e.g. operator
    // removed the catalog row between runs). The operator's merge:<uuid>
    // decision should NOT be silently dropped.
    const freshWithoutHamilton = freshRows.filter((r) => r.brand_raw !== 'Hamilton')
    const lines = mergeForward(
      existingArtifact,
      freshWithoutHamilton,
      candidatesByNormalized,
    )
    const merged = lines.find((l) => l.includes('Hamilton') && l.includes('merge:'))
    expect(merged).toBeDefined()
  })
})
