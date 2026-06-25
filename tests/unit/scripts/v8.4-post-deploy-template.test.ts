// Phase 79 / 79-04-PLAN.md — GREEN (was Wave 0 RED stub).
//
// Unit test for D-79-10 renderPostDeployMarkdown template shape, plus
// source-greps covering D-79-08 (unconditional hydration UPDATE) +
// D-79-09 (new brand/family rows default needs_review=false) +
// MIG-04 (post-flight assertion uses a DIFFERENT predicate from the UPDATE's
// WHERE-clause per [[post-flight-assertion-predicate-divergence]]).
//
// renderPostDeployMarkdown is extracted as a pure string-returning function
// so this test stays I/O-free; the file-system writer wraps the renderer.
//
// The source-grep tests cover the production code (scripts/v8.4-brand-
// canonicalization.ts) directly via readFileSync. They are scoped to the
// committed file so the grep-gates fire in CI without an export hand-off.
//
// No DATABASE_URL gate — pure string assertions + filesystem grep.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import {
  renderPostDeployMarkdown,
  type PostDeployArgs,
} from '../../../scripts/v8.4-brand-canonicalization'

const SCRIPT_PATH = path.join(
  process.cwd(),
  'scripts/v8.4-brand-canonicalization.ts',
)

// Strip line- and block-comments so source-grep checks don't get fooled by
// educational JSDoc / inline notes (per [[decision-coverage-gate-citations]]
// per-comment hygiene). Approximate but adequate for the patterns we test.
function stripComments(src: string): string {
  // Block comments (/* ... */ including JSDoc /** ... */).
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '')
  // Line comments (// ...).
  out = out
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
  return out
}

function fixtureArgs(overrides: Partial<PostDeployArgs> = {}): PostDeployArgs {
  return {
    counts: {
      brandsCreated: 33,
      catalogRowsResolvedBrand: 217,
      familiesCreated: 142,
      aliasesAppended: 1,
      catalogRowsResolvedFamily: 217,
      userWatchesHydrated: 41,
    },
    postFlightQuery:
      'SELECT (SELECT count(*) FROM watches_catalog) AS total, ' +
      '(SELECT count(*) FROM watches_catalog WHERE brand_id IS DISTINCT FROM NULL) AS resolved_brand, ' +
      '(SELECT count(*) FROM watches_catalog WHERE family_id IS DISTINCT FROM NULL) AS resolved_family;',
    postFlightResult: {
      total: 217,
      resolvedBrand: 217,
      resolvedFamily: 217,
    },
    isLocal: true,
    today: '2026-06-25',
    ...overrides,
  }
}

describe('Phase 79 — v8.4 renderPostDeployMarkdown (D-79-10 + D-79-08 + MIG-04)', () => {
  it('Wave 0 RED stub loads', () => {
    expect(true).toBe(true)
  })

  it('D-79-10: contains ## Apply Summary section with GFM count table substituted from args.counts', () => {
    const md = renderPostDeployMarkdown(fixtureArgs())
    expect(md).toContain('## Apply Summary')
    expect(md).toContain('| Brands created (new rows) | 33 |')
    expect(md).toContain('| Catalog rows resolved (brand_id) | 217 |')
    expect(md).toContain('| Families created (new rows) | 142 |')
    expect(md).toContain('| Aliases appended (merge decisions) | 1 |')
    expect(md).toContain('| Catalog rows resolved (family_id) | 217 |')
    expect(md).toContain(
      '| User watches hydrated (brand+model overwritten) | 41 |',
    )
  })

  it('D-79-10: contains ## Post-Flight Assertion (MIG-04) section with the assertion SQL + results substituted', () => {
    const md = renderPostDeployMarkdown(fixtureArgs())
    expect(md).toContain('## Post-Flight Assertion (MIG-04)')
    expect(md).toContain('IS DISTINCT FROM NULL')
    expect(md).toContain('- total: 217')
    expect(md).toContain('- resolved_brand: 217')
    expect(md).toContain('- resolved_family: 217')
  })

  it("D-79-10: contains ## Operator Sign-Off Queries section with the 6 verification SQL blocks (Hamilton merge check #2 must reference brand_id = '20969364-...')", () => {
    const md = renderPostDeployMarkdown(fixtureArgs())
    expect(md).toContain('## Operator Sign-Off Queries')
    expect(md).toContain('### 1. Zero NULL brand_id or family_id on catalog')
    expect(md).toContain('### 2. Hamilton merge collapsed correctly')
    expect(md).toContain(
      "brand_id = '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc'",
    )
    expect(md).toContain('### 3. New brand row count matches summary')
    expect(md).toContain(
      '### 4. Aliases appended via merge decisions (where applicable)',
    )
    expect(md).toContain('### 5. Hydration of a known user watch')
    expect(md).toContain(
      '### 6. Natural-key UNIQUE constraint survived',
    )
  })

  it('D-79-10: contains ## What this push does NOT do forward-armor section listing Phase 80/81/82 deferred work', () => {
    const md = renderPostDeployMarkdown(fixtureArgs())
    expect(md).toContain('## What this push does NOT do')
    expect(md).toContain('Phase 80')
    expect(md).toContain('Phase 81')
    expect(md).toContain('Phase 82')
    expect(md).toContain('CANON-01')
    expect(md).toContain('INGEST-01')
    expect(md).toContain('RECO-01')
  })

  it('D-79-10: target header reads LOCAL vs PROD per args.isLocal', () => {
    const local = renderPostDeployMarkdown(fixtureArgs({ isLocal: true }))
    const prod = renderPostDeployMarkdown(fixtureArgs({ isLocal: false }))
    expect(local).toContain('# Phase 79 — LOCAL Deployment Record')
    expect(prod).toContain('# Phase 79 — PROD Deployment Record')
  })

  it('MIG-04: source-grep — scripts/v8.4-brand-canonicalization.ts contains at least one `IS DISTINCT FROM NULL` usage (positive predicate per [[post-flight-assertion-predicate-divergence]])', () => {
    const src = readFileSync(SCRIPT_PATH, 'utf8')
    const noComments = stripComments(src)
    // Positive predicate present at least once outside comments — predicate
    // divergence enforced at source.
    const distinctMatches = noComments.match(/IS DISTINCT FROM NULL/g) ?? []
    expect(distinctMatches.length).toBeGreaterThanOrEqual(1)
    // No `WHERE ... brand_id IS NULL ... = 0` style post-flight assertion in
    // non-comment code (that's the inherited-bug shape this guard exists to
    // prevent). The applyBrandPath re-run-safety `brand_id IS NULL` predicate
    // is OK — it's a re-run guard, not an assertion. We only refuse the form
    // where IS NULL appears in a SELECT count(*) ... = 0 / IS NULL comparison
    // pattern, which would inherit the UPDATE's WHERE-clause. The simplest
    // proof: there's no `IS NULL` followed by a `= 0` literal anywhere in
    // non-comment code.
    expect(noComments).not.toMatch(/IS NULL[^\n]*=\s*0\b/)
  })

  it('D-79-08: source-grep — the hydration UPDATE has no WHERE clause filtering on watches.brand/model text (JOIN-only filter; unconditional per D-79-08)', () => {
    const src = readFileSync(SCRIPT_PATH, 'utf8')
    const noComments = stripComments(src)
    // Hydration UPDATE present.
    expect(noComments).toMatch(/UPDATE watches w\s+SET brand = b\.name/)
    // The hydration WHERE clause uses ONLY catalog_id JOIN — no `watches.brand`
    // / `watches.model` text predicates anywhere. We check that the hydration
    // block (UPDATE watches w SET brand = b.name ... WHERE w.catalog_id = c.id)
    // does NOT contain any `AND w.brand` or `AND w.model` predicate before its
    // terminating backtick.
    const hydrationMatch = noComments.match(
      /UPDATE watches w\s+SET brand[\s\S]*?w\.catalog_id = c\.id[\s\S]*?`/,
    )
    expect(hydrationMatch).toBeTruthy()
    const hydrationBlock = hydrationMatch![0]
    expect(hydrationBlock).not.toMatch(/AND\s+w\.brand/)
    expect(hydrationBlock).not.toMatch(/AND\s+w\.model/)
    // Specifically — JOIN-only filter, no `watches.brand` / `watches.model`
    // patterns AT ALL within the hydration UPDATE block.
    expect(hydrationBlock).not.toMatch(/watches\s*\.\s*(brand|model)/)
  })

  it('D-79-09: source-grep — both INSERT INTO brands and INSERT INTO watch_families include needs_review = false / needs_review, false in the same statement (new rows default to false per D-79-09)', () => {
    const src = readFileSync(SCRIPT_PATH, 'utf8')
    const noComments = stripComments(src)
    // INSERT INTO brands ... needs_review ... false — match across newlines
    // ([\s\S] handles the multi-line `(name, slug, needs_review)\n  VALUES (...)
    // \n  RETURNING id` shape).
    const brandsInsert = noComments.match(
      /INSERT INTO brands\s*\([^)]*needs_review[^)]*\)\s*VALUES\s*\([\s\S]*?false[\s\S]*?\)\s*RETURNING/,
    )
    expect(brandsInsert).toBeTruthy()
    // INSERT INTO watch_families ... needs_review ... false (analogous form
    // includes `aliases` so we match across newlines + tolerate the extra
    // VALUES tuple cells).
    const familiesInsert = noComments.match(
      /INSERT INTO watch_families\s*\([^)]*needs_review[^)]*\)\s*VALUES\s*\([\s\S]*?false[\s\S]*?\)\s*RETURNING/,
    )
    expect(familiesInsert).toBeTruthy()
  })
})
