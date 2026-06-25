// Phase 79 / 79-01-PLAN.md — Wave 0 RED stub.
//
// Unit test for D-79-10 renderPostDeployMarkdown template shape, plus
// source-greps covering D-79-08 (unconditional hydration UPDATE) +
// D-79-09 (new brand/family rows default needs_review=false) +
// MIG-04 (post-flight assertion uses a DIFFERENT predicate from the UPDATE's
// WHERE-clause per [[post-flight-assertion-predicate-divergence]]).
//
// renderPostDeployMarkdown is extracted as a pure string-returning function
// so this test stays I/O-free; the file-system writer wraps the renderer.
// The Plan 04 export lands behind the commented import below; flip the
// comment when it ships.
//
// The source-grep tests cover the production code (scripts/v8.4-brand-
// canonicalization.ts) directly via readFileSync. They are scoped to the
// committed file so the grep-gates fire in CI without an export hand-off.
//
// No DATABASE_URL gate — pure string assertions + filesystem grep.

import { describe, it, expect } from 'vitest'
// TODO Plan 04: uncomment when renderPostDeployMarkdown export lands.
// import { renderPostDeployMarkdown } from '../../../scripts/v8.4-brand-canonicalization'

describe('Phase 79 — v8.4 renderPostDeployMarkdown (D-79-10 + D-79-08 + MIG-04)', () => {
  it('Wave 0 RED stub loads', () => {
    expect(true).toBe(true)
  })

  it.todo(
    'D-79-10: contains ## Apply Summary section with GFM count table substituted from args.counts',
  )
  it.todo(
    'D-79-10: contains ## Post-Flight Assertion (MIG-04) section with the assertion SQL + results substituted',
  )
  it.todo(
    "D-79-10: contains ## Operator Sign-Off Queries section with the 6 verification SQL blocks (Hamilton merge check #2 must reference brand_id = '20969364-...')",
  )
  it.todo(
    'D-79-10: contains ## What this push does NOT do forward-armor section listing Phase 80/81/82 deferred work',
  )
  it.todo(
    'MIG-04: source-grep — scripts/v8.4-brand-canonicalization.ts contains exactly one `IS DISTINCT FROM NULL` usage and zero `IS NULL` in the same SELECT block (predicate divergence per [[post-flight-assertion-predicate-divergence]])',
  )
  it.todo(
    'D-79-08: source-grep — the hydration UPDATE has no WHERE clause filtering on watches.brand/model text (JOIN-only filter; unconditional per D-79-08)',
  )
  it.todo(
    'D-79-09: source-grep — both INSERT INTO brands and INSERT INTO watch_families include needs_review = false / needs_review, false in the same statement (new rows default to false per D-79-09)',
  )
})
